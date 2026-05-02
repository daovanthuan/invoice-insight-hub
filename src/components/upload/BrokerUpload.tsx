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

const TX_TYPES = ["CREDIT_ADVICE", "DIVIDEND", "FX_FT"];
const AUTO_SAVE_THRESHOLD = 0.75;

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
        update(bf.id, (f) => ({ ...f, status: "error", error: "Extraction failed" }));
        return;
      }

      update(bf.id, (f) => ({ ...f, progress: 80, result }));

      // Luôn lưu vào DB. Status: completed nếu confidence cao, pending nếu cần review.
      const autoComplete = result.confidence_score >= AUTO_SAVE_THRESHOLD;
      await saveBroker(result.data, result.confidence_score, result.extend, filePath || null, sourceZip || null);
      update(bf.id, (f) => ({ ...f, status: autoComplete ? "completed" : "pending", progress: 100 }));
      await createNotification({
        title: autoComplete ? "Broker invoice saved" : "Broker invoice needs review",
        message: autoComplete
          ? `${bf.file.name} auto-extracted (${Math.round(result.confidence_score * 100)}%)`
          : `${bf.file.name} saved, please review in the Broker tab (${Math.round(result.confidence_score * 100)}%)`,
        type: autoComplete ? "success" : "warning",
        link: "/invoices",
      });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Processing error";
      update(bf.id, (f) => ({ ...f, status: "error", error: msg }));
    }
  };

  const processExcelCsv = async (file: File) => {
    // For Excel/CSV we delegate to AI as text — convert via base64 and let AI parse, but most reliable: ask user this is a tabular import.
    const id = crypto.randomUUID();
    const bf: BrokerFile = { id, file, status: "uploading", progress: 0 };
    setFiles((prev) => [...prev, bf]);
    update(id, (f) => ({ ...f, status: "error", error: "Excel/CSV import will be supported in a future release" }));
    toast.info("Excel/CSV: bulk import will be supported in a future release");
  };

  const handleFiles = async (input: File[]) => {
    const singles: File[] = [];
    const zips: File[] = [];
    for (const f of input) {
      if (isZip(f)) zips.push(f);
      else if (isExcelCsv(f)) processExcelCsv(f);
      else if (VALID_IMAGE_PDF.includes(f.type)) singles.push(f);
      else toast.warning(`Skipping unsupported file: ${f.name}`);
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
      toast.info(`Extracting ${zipFile.name}...`);
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
          toast.error(`${zipFile.name}: no valid files`);
          continue;
        }
        const newOnes: BrokerFile[] = inner.map((file) => ({
          id: crypto.randomUUID(), file, status: "uploading", progress: 0,
        }));
        setFiles((prev) => [...prev, ...newOnes]);
        newOnes.forEach((bf) => processOne(bf, zipFile.name));
      } catch (e) {
        console.error(e);
        toast.error(`Failed to extract ${zipFile.name}`);
      }
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) handleFiles(dropped);
  }, []);

  const remove = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const statusIcon = (s: BrokerFile["status"]) => {
    switch (s) {
      case "uploading":
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const statusText = (f: BrokerFile) => {
    switch (f.status) {
      case "uploading": return "Uploading...";
      case "processing": return "Extracting...";
      case "pending": return `Saved - needs review (${Math.round((f.result?.confidence_score || 0) * 100)}%)`;
      case "completed": return `Completed (${Math.round((f.result?.confidence_score || 0) * 100)}%)`;
      case "error": return f.error || "Failed";
    }
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
              {isDragging ? "Drop files here" : "Drag & drop broker invoices"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to select files (PNG, JPG, WEBP, PDF, ZIP)
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Archive className="h-4 w-4" />
              <span>Supports ZIP files with multiple invoices</span>
            </div>
            <Button variant="outline" className="pointer-events-none">Choose File</Button>
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
                Uploaded files ({files.length})
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
    </>
  );
}