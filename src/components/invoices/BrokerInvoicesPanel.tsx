import { useMemo, useState } from "react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Filter, Eye, Download, Briefcase, Loader2, Pencil, Ban,
  CalendarIcon, X, FileText, FileSpreadsheet, Image as ImageIcon, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrokerInvoices } from "@/hooks/useBrokerInvoices";
import { useUserRole } from "@/hooks/useUserRole";
import { useInvoicePreview } from "@/hooks/useInvoicePreview";
import { useCreateNotification } from "@/hooks/useCreateNotification";
import { BrokerInvoice } from "@/types/database";
import { toast } from "sonner";
import {
  BROKER_FIELD_LABELS, getBrokerVisibleFields, formatBrokerValue,
  BROKER_STATUS_LABELS, BROKER_STATUS_STYLES, BROKER_TX_TYPES, BROKER_TX_TYPE_LABELS,
} from "@/lib/brokerFields";
import { exportBrokerToExcel, exportBrokerToCSV } from "@/lib/exportInvoices";
import { BrokerInvoiceDetailDialog } from "./BrokerInvoiceDetailDialog";

const ALL_KEYS = Object.keys(BROKER_FIELD_LABELS);
const PAGE_SIZE = 20;

export function BrokerInvoicesPanel() {
  const { invoices, loading, updateInvoice, updateStatus } = useBrokerInvoices();
  const { isAdmin } = useUserRole();
  const { previewUrl, loadingPreview, getPreviewUrl, clearPreview } = useInvoicePreview();
  const { createNotification } = useCreateNotification();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [txFilter, setTxFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  const [selected, setSelected] = useState<BrokerInvoice | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const hasActiveFilters = searchTerm || statusFilter !== "all" || txFilter !== "all" || dateFrom || dateTo;
  const clearAllFilters = () => {
    setSearchTerm(""); setStatusFilter("all"); setTxFilter("all");
    setDateFrom(undefined); setDateTo(undefined); setCurrentPage(1);
  };

  const filtered = useMemo(() => invoices.filter((inv) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q
      || (inv.client_name || "").toLowerCase().includes(q)
      || (inv.securities_id || "").toLowerCase().includes(q)
      || (inv.security_name || "").toLowerCase().includes(q)
      || (inv.account_no || "").toLowerCase().includes(q)
      || (inv.description || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesTx = txFilter === "all" || inv.transaction_type === txFilter;

    let matchesDate = true;
    if (dateFrom || dateTo) {
      const d = inv.created_at ? new Date(inv.created_at) : null;
      if (d) {
        if (dateFrom && dateTo) matchesDate = isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
        else if (dateFrom) matchesDate = d >= startOfDay(dateFrom);
        else if (dateTo) matchesDate = d <= endOfDay(dateTo);
      } else matchesDate = false;
    }
    return matchesSearch && matchesStatus && matchesTx && matchesDate;
  }), [invoices, searchTerm, statusFilter, txFilter, dateFrom, dateTo]);

  // Chỉ hiển thị các field quan trọng trong bảng. Chi tiết đầy đủ xem trong dialog.
  const visibleKeys = useMemo(() => {
    const CORE = [
      "client_name", "securities_id", "transaction_type",
      "trade_date", "currency", "net_amount",
    ];
    const dynamic = getBrokerVisibleFields(filtered.length ? filtered : invoices, CORE);
    return CORE.filter((k) => dynamic.includes(k));
  }, [filtered, invoices]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePreview = async (path: string | null) => {
    if (!path) { toast.error("Original file not available"); return; }
    await getPreviewUrl(path, "broker-invoices");
    setShowPreview(true);
  };

  const handleApprove = async (inv: BrokerInvoice) => {
    const ok = await updateStatus(inv.id, "completed");
    if (ok) {
      toast.success("Broker invoice approved");
      await createNotification({
        title: "Broker invoice approved",
        message: `${inv.client_name || inv.securities_id || "N/A"} has been approved.`,
        type: "success",
        link: "/invoices",
      });
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    const inv = invoices.find((i) => i.id === cancelId);
    setActing(true);
    const ok = await updateStatus(cancelId, "cancelled");
    setActing(false);
    setCancelId(null);
    if (ok) {
      toast.success("Broker invoice cancelled");
      await createNotification({
        title: "Broker invoice cancelled",
        message: `${inv?.client_name || inv?.securities_id || "N/A"} has been cancelled.`,
        type: "warning",
        link: "/invoices",
      });
    }
  };

  return (
    <div>
      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by client, security ID, account..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 bg-muted/50"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px] bg-muted/50">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={txFilter} onValueChange={(v) => { setTxFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px] bg-muted/50">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {BROKER_TX_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{BROKER_TX_TYPE_LABELS[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal bg-muted/50", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "From date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal bg-muted/50", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "To date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 text-muted-foreground">
              <X className="h-4 w-4" /> Clear filters
            </Button>
          )}

          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {filtered.length} / {invoices.length} invoices
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" disabled={filtered.length === 0}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportBrokerToExcel(filtered)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportBrokerToCSV(filtered)}>
                <FileText className="h-4 w-4 mr-2" /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {loading ? (
          <div className="glass rounded-xl p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {invoices.length === 0
                ? "No broker invoices yet. Upload to get started."
                : "No matching invoices found."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="glass rounded-xl overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    {visibleKeys.map((k) => (
                      <TableHead key={k} className="text-muted-foreground whitespace-nowrap">
                        {BROKER_FIELD_LABELS[k]}
                      </TableHead>
                    ))}
                    <TableHead className="text-muted-foreground whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-muted-foreground whitespace-nowrap">Confidence</TableHead>
                    {isAdmin && (
                      <>
                        <TableHead className="text-muted-foreground whitespace-nowrap">Created by</TableHead>
                        <TableHead className="text-muted-foreground whitespace-nowrap">Created at</TableHead>
                      </>
                    )}
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((inv, index) => {
                    const isCancelled = inv.status === "cancelled";
                    const createdAt = inv.created_at ? new Date(inv.created_at) : null;
                    return (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * index }}
                        className={cn(
                          "border-border cursor-pointer",
                          isCancelled ? "opacity-50 bg-muted/20" : "hover:bg-muted/30"
                        )}
                        onClick={() => setSelected(inv)}
                      >
                        {visibleKeys.map((k, idx) => (
                          <TableCell
                            key={k}
                            className={cn(
                              "whitespace-nowrap",
                              idx === 0 && "font-medium"
                            )}
                          >
                            {idx === 0 && (
                              <span className="inline-flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                                </span>
                                {formatBrokerValue(k, (inv as any)[k])}
                              </span>
                            )}
                            {idx !== 0 && formatBrokerValue(k, (inv as any)[k])}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Badge variant="outline" className={cn(BROKER_STATUS_STYLES[inv.status])}>
                            {BROKER_STATUS_LABELS[inv.status] || inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.confidence_score != null ? (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={inv.confidence_score * 100}
                                className={cn("h-2 w-16", inv.confidence_score < 0.7 && "[&>div]:bg-warning")}
                              />
                              <span className={cn("text-xs font-medium", inv.confidence_score < 0.7 ? "text-warning" : "text-muted-foreground")}>
                                {Math.round(inv.confidence_score * 100)}%
                              </span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </TableCell>
                        {isAdmin && (
                          <>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">-</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {createdAt ? format(createdAt, "dd/MM/yyyy HH:mm") : "-"}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelected(inv); }} title="View details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {inv.original_file_path && (
                              <Button
                                variant="ghost" size="icon"
                                onClick={(e) => { e.stopPropagation(); handlePreview(inv.original_file_path); }}
                                title="View original file"
                                className="text-muted-foreground hover:text-primary"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </Button>
                            )}
                            {!isCancelled && inv.status === "pending" && (
                              <Button
                                variant="ghost" size="icon"
                                onClick={(e) => { e.stopPropagation(); handleApprove(inv); }}
                                className="text-muted-foreground hover:text-success"
                                title="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {!isCancelled && (
                              <>
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={(e) => { e.stopPropagation(); setSelected(inv); }}
                                  className="text-muted-foreground hover:text-primary"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={(e) => { e.stopPropagation(); setCancelId(inv.id); }}
                                  className="text-muted-foreground hover:text-warning"
                                  title="Cancel"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Detail / edit dialog */}
      <BrokerInvoiceDetailDialog
        invoice={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSave={updateInvoice}
        onPreviewFile={handlePreview}
        loadingPreview={loadingPreview}
      />

      {/* Cancel confirm */}
      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm cancel invoice</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice will be marked as cancelled and can no longer be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={acting}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File preview */}
      <Dialog open={showPreview} onOpenChange={(o) => { if (!o) { setShowPreview(false); clearPreview(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" /> View original file
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[400px]">
            {loadingPreview ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : previewUrl ? (
              previewUrl.includes(".pdf") || previewUrl.includes("application/pdf") ? (
                <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border border-border" />
              ) : (
                <img src={previewUrl} alt="Broker invoice preview" className="max-w-full max-h-[70vh] rounded-lg object-contain" />
              )
            ) : (
              <p className="text-muted-foreground">Could not load file</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
