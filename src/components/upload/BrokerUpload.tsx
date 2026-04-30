import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrokerExtraction, BrokerExtractionResult } from "@/hooks/useBrokerExtraction";
import { useCreateNotification } from "@/hooks/useCreateNotification";

interface BrokerFile {
  id: string;
  file: File;
  status: "uploading" | "processing" | "completed" | "pending" | "error";
  progress: number;
  error?: string;
  result?: BrokerExtractionResult;
  filePath?: string;
}

const TX_TYPES = ["BUY", "SELL", "DIVIDEND", "INTEREST", "FX", "TRANSFER", "OTHER"];
const AUTO_SAVE_THRESHOLD = 0.85;

const VALID_IMAGE_PDF = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

const isZip = (f: File) =>
  f.type === "application/zip" || f.type === "application/x-zip-compressed" || f.name.toLowerCase().endsWith(".zip");

const isExcelCsv = (f: File) =>
  f.name.toLowerCase().match(/\.(xlsx|xls|csv)$/) !== null;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const dateOrNull = (v: unknown): string | null => {
  if (!v || typeof v !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

export function BrokerUpload() {
  const [files, setFiles] = useState<BrokerFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { extractBroker } = useBrokerExtraction();
  const { createNotification } = useCreateNotification();

  const update = (id: string, u: (f: BrokerFile) => BrokerFile) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? u(f) : f)));

  const uploadToStorage = async (file: File): Promise<string | null> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return null;
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("broker-invoices").upload(path, file);
    if (error) {
      console.error(error);
      return null;
    }
    return path;
  };

  const saveBroker = async (data: Record<string, string>, confidence: number, extend: Record<string, unknown>, filePath: string | null, sourceZip: string | null) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Not authenticated");

    const tx = (data.transaction_type || "").toUpperCase();
    const txValid = TX_TYPES.includes(tx) ? tx : null;

    const { error } = await supabase.from("broker_invoices").insert({
      owner_id: user.id,
      created_by: user.id,
      status: confidence >= AUTO_SAVE_THRESHOLD ? "completed" : "pending",
      confidence_score: confidence,
      client_name: data.client_name || null,
      account_no: data.account_no || null,
      description: data.description || null,
      securities_id: data.securities_id || null,
      security_name: data.security_name || null,
      units: num(data.units),
      transaction_type: txValid as any,
      trade_date: dateOrNull(data.trade_date),
      settlement_date: dateOrNull(data.settlement_date),
      ex_date: dateOrNull(data.ex_date),
      payment_date: dateOrNull(data.payment_date),
      currency: data.currency || "USD",
      gross_amount: num(data.gross_amount),
      net_amount: num(data.net_amount),
      dividend_rate: num(data.dividend_rate),
      wht_rate: num(data.wht_rate),
      wht_amount: num(data.wht_amount),
      currency_buy: data.currency_buy || null,
      currency_sell: data.currency_sell || null,
      amount_buy: num(data.amount_buy),
      amount_sell: num(data.amount_sell),
      rate: num(data.rate),
      account_no_buy: data.account_no_buy || null,
      account_no_sell: data.account_no_sell || null,
      original_file_path: filePath,
      source_zip_name: sourceZip,
      raw_json: data as any,
      extend: extend as any,
    });
    if (error) throw error;
  };

  const processOne = async (bf: BrokerFile, sourceZip?: string) => {
    update(bf.id, (f) => ({ ...f, status: "processing", progress: 30 }));
    try {
      const filePath = await uploadToStorage(bf.file);
      update(bf.id, (f) => ({ ...f, progress: 50, filePath: filePath || undefined }));

      const result = await extractBroker(bf.file);
      if (!result) {
        update(bf.id, (f) => ({ ...f, status: "error", error: "Không thể trích xuất" }));
        return;
      }

      update(bf.id, (f) => ({ ...f, progress: 80, result }));

      if (result.confidence_score >= AUTO_SAVE_THRESHOLD) {
        await saveBroker(result.data, result.confidence_score, result.extend, filePath || null, sourceZip || null);
        update(bf.id, (f) => ({ ...f, status: "completed", progress: 100 }));
        await createNotification({
          title: "Hóa đơn broker đã lưu",
          message: `${bf.file.name} đã được trích xuất tự động (${Math.round(result.confidence_score * 100)}%)`,
          type: "success",
          link: "/invoices",
        });
      } else {
        update(bf.id, (f) => ({ ...f, status: "review", progress: 100 }));
        toast.info(`${bf.file.name}: cần xem lại (${Math.round(result.confidence_score * 100)}%)`);
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Lỗi xử lý";
      update(bf.id, (f) => ({ ...f, status: "error", error: msg }));
    }
  };

  const processExcelCsv = async (file: File) => {
    // For Excel/CSV we delegate to AI as text — convert via base64 and let AI parse, but most reliable: ask user this is a tabular import.
    const id = crypto.randomUUID();
    const bf: BrokerFile = { id, file, status: "uploading", progress: 0 };
    setFiles((prev) => [...prev, bf]);
    update(id, (f) => ({ ...f, status: "error", error: "Excel/CSV import sẽ được hỗ trợ trong bản tiếp theo" }));
    toast.info("Excel/CSV: sẽ hỗ trợ import bulk trong phiên bản kế tiếp");
  };

  const handleFiles = async (input: File[]) => {
    const singles: File[] = [];
    const zips: File[] = [];
    for (const f of input) {
      if (isZip(f)) zips.push(f);
      else if (isExcelCsv(f)) processExcelCsv(f);
      else if (VALID_IMAGE_PDF.includes(f.type)) singles.push(f);
      else toast.warning(`Bỏ qua file không hỗ trợ: ${f.name}`);
    }

    const newSingles: BrokerFile[] = singles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "uploading",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newSingles]);
    newSingles.forEach((bf) => processOne(bf));

    for (const zipFile of zips) {
      toast.info(`Đang giải nén ${zipFile.name}...`);
      try {
        const zip = await JSZip.loadAsync(zipFile);
        const inner: File[] = [];
        const promises: Promise<void>[] = [];
        zip.forEach((path, entry) => {
          if (entry.dir || path.startsWith("__MACOSX") || path.startsWith(".")) return;
          const ext = path.toLowerCase().split(".").pop();
          const map: Record<string, string> = {
            png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
            webp: "image/webp", pdf: "application/pdf",
          };
          if (ext && map[ext]) {
            promises.push(
              entry.async("blob").then((b) => {
                const name = path.split("/").pop() || path;
                inner.push(new File([b], name, { type: map[ext] }));
              })
            );
          }
        });
        await Promise.all(promises);
        if (inner.length === 0) {
          toast.error(`${zipFile.name}: không có file hợp lệ`);
          continue;
        }
        const newOnes: BrokerFile[] = inner.map((file) => ({
          id: crypto.randomUUID(), file, status: "uploading", progress: 0,
        }));
        setFiles((prev) => [...prev, ...newOnes]);
        newOnes.forEach((bf) => processOne(bf, zipFile.name));
      } catch (e) {
        console.error(e);
        toast.error(`Lỗi giải nén ${zipFile.name}`);
      }
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) handleFiles(dropped);
  }, []);

  const openReview = (bf: BrokerFile) => {
    if (!bf.result) return;
    setReviewData({ ...bf.result.data });
    setReviewFile(bf);
  };

  const submitReview = async () => {
    if (!reviewFile || !reviewFile.result) return;
    try {
      await saveBroker(
        reviewData,
        reviewFile.result.confidence_score,
        reviewFile.result.extend,
        reviewFile.filePath || null,
        null
      );
      update(reviewFile.id, (f) => ({ ...f, status: "completed" }));
      toast.success("Đã lưu hóa đơn broker");
      setReviewFile(null);
      await createNotification({
        title: "Hóa đơn broker đã lưu",
        message: `${reviewFile.file.name} đã được lưu sau khi xem lại`,
        type: "success",
        link: "/invoices",
      });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Lỗi lưu dữ liệu");
    }
  };

  const remove = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const statusIcon = (s: BrokerFile["status"]) => {
    switch (s) {
      case "uploading":
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "review":
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const statusText = (f: BrokerFile) => {
    switch (f.status) {
      case "uploading": return "Đang tải lên...";
      case "processing": return "Đang trích xuất...";
      case "review": return `Cần xem lại (${Math.round((f.result?.confidence_score || 0) * 100)}%)`;
      case "completed": return "Hoàn tất";
      case "error": return f.error || "Thất bại";
    }
  };

  const fieldLabels: Record<string, string> = {
    client_name: "Khách hàng",
    account_no: "Số tài khoản",
    description: "Mô tả",
    securities_id: "Mã chứng khoán",
    security_name: "Tên chứng khoán",
    transaction_type: "Loại giao dịch",
    trade_date: "Ngày giao dịch (YYYY-MM-DD)",
    settlement_date: "Ngày thanh toán",
    ex_date: "Ngày chốt quyền",
    payment_date: "Ngày trả",
    currency: "Tiền tệ",
    gross_amount: "Tổng tiền (gross)",
    net_amount: "Tiền ròng (net)",
    units: "Số lượng",
    dividend_rate: "Tỷ lệ cổ tức",
    wht_rate: "Thuế khấu trừ (%)",
    wht_amount: "Số tiền thuế",
    currency_buy: "Tiền tệ mua",
    currency_sell: "Tiền tệ bán",
    amount_buy: "Số tiền mua",
    amount_sell: "Số tiền bán",
    rate: "Tỷ giá",
    account_no_buy: "Tài khoản mua",
    account_no_sell: "Tài khoản bán",
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <label
          htmlFor="broker-upload"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300",
            isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/50"
          )}
        >
          <motion.div animate={{ scale: isDragging ? 1.1 : 1 }} className="flex flex-col items-center justify-center py-6">
            <div className={cn("mb-4 rounded-full p-4 transition-colors", isDragging ? "bg-primary/20" : "bg-muted")}>
              <UploadIcon className={cn("h-10 w-10 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
            </div>
            <p className="mb-2 text-lg font-semibold text-foreground">
              {isDragging ? "Thả file vào đây" : "Kéo & thả hóa đơn Broker"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              hoặc click để chọn file (PNG, JPG, WEBP, PDF, ZIP)
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Archive className="h-4 w-4" />
              <span>Hỗ trợ file ZIP chứa nhiều hóa đơn</span>
            </div>
            <Button variant="outline" className="pointer-events-none">Chọn File</Button>
          </motion.div>
          <input
            id="broker-upload"
            type="file"
            className="hidden"
            multiple
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf,.zip,application/zip,application/x-zip-compressed,.xlsx,.xls,.csv"
            onChange={(e) => {
              const fs = Array.from(e.target.files || []);
              if (fs.length) handleFiles(fs);
              e.target.value = "";
            }}
          />
        </label>
      </motion.div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                File đã tải ({files.length})
              </h3>
            </div>
            <div className="space-y-3">
              {files.map((f, index) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-2"
                >
                  <div className="flex-1 flex items-center gap-3 rounded-lg bg-muted/20 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{f.file.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {statusIcon(f.status)}
                        <span className={cn("text-xs", f.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                          {statusText(f)}
                        </span>
                      </div>
                      {(f.status === "uploading" || f.status === "processing") && (
                        <Progress value={f.progress} className="mt-1.5 h-1" />
                      )}
                    </div>
                    {f.status === "review" && (
                      <Button size="sm" onClick={() => openReview(f)}>Xem lại</Button>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">{(f.file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => remove(f.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    disabled={f.status === "uploading" || f.status === "processing"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!reviewFile} onOpenChange={(o) => !o && setReviewFile(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Xem lại dữ liệu trích xuất
              {reviewFile && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({Math.round((reviewFile.result?.confidence_score || 0) * 100)}% tin cậy)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {Object.keys(fieldLabels).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`f-${k}`} className="text-xs">{fieldLabels[k]}</Label>
                {k === "transaction_type" ? (
                  <Select
                    value={reviewData[k] || ""}
                    onValueChange={(v) => setReviewData((p) => ({ ...p, [k]: v }))}
                  >
                    <SelectTrigger id={`f-${k}`}><SelectValue placeholder="Chọn..." /></SelectTrigger>
                    <SelectContent>
                      {TX_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`f-${k}`}
                    value={reviewData[k] || ""}
                    onChange={(e) => setReviewData((p) => ({ ...p, [k]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFile(null)}>Hủy</Button>
            <Button onClick={submitReview}>Lưu hóa đơn broker</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}