import { useState, useMemo } from 'react';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useInvoices } from '@/hooks/useInvoices';
import { useUserRole } from '@/hooks/useUserRole';
import { useCreateNotification } from '@/hooks/useCreateNotification';
import { useInvoicePreview } from '@/hooks/useInvoicePreview';
import { Invoice, InvoiceItem } from '@/types/database';
import { exportToExcel, exportToCSV } from '@/lib/exportInvoices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Filter, Eye, Download, FileText, Loader2, Pencil, Ban, CalendarIcon, X, ChevronRight, Archive, FolderOpen, CheckCircle2, XCircle, Image, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceEditDialog } from '@/components/invoices/InvoiceEditDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, Briefcase } from 'lucide-react';
import { BrokerInvoicesPanel } from '@/components/invoices/BrokerInvoicesPanel';

const statusStyles: Record<string, string> = {
  processed: 'bg-success/10 text-success border-success/20',
  approved: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  draft: 'bg-muted/50 text-muted-foreground border-muted',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  cancelled: 'bg-muted/50 text-muted-foreground border-muted line-through',
};

const statusLabels: Record<string, string> = {
  processed: 'Đã xử lý',
  approved: 'Đã duyệt',
  pending: 'Đang chờ',
  draft: 'Nháp',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

type InvoiceGroup =
  | { type: 'single'; invoice: Invoice }
  | { type: 'zip'; zipName: string; invoices: Invoice[] };

export default function InvoicesPage() {
  const { invoices, loading, fetchInvoiceItems, updateInvoice, fetchInvoices } = useInvoices();
  const { isAdmin } = useUserRole();
  const { createNotification } = useCreateNotification();
  const { previewUrl, loadingPreview, getPreviewUrl, clearPreview } = useInvoicePreview();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const PAGE_SIZE = 20;

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || dateFrom || dateTo;

  const handleCancelInvoice = async () => {
    if (!cancelId) return;
    const invoiceToCancel = invoices.find(inv => inv.id === cancelId);
    setIsCancelling(true);
    await updateInvoice(cancelId, { status: 'cancelled' });
    setIsCancelling(false);
    setCancelId(null);
    toast.success('Đã hủy hóa đơn');
    await createNotification({
      title: 'Hóa đơn đã bị hủy',
      message: `Hóa đơn "${invoiceToCancel?.invoice_number || invoiceToCancel?.invoice_serial || 'N/A'}" đã được hủy.`,
      type: 'warning',
      link: '/invoices',
    });
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    await updateInvoice(invoiceId, { status: 'approved' });
    toast.success('Đã duyệt hóa đơn');
    await createNotification({
      title: 'Hóa đơn đã được duyệt',
      message: `Hóa đơn "${inv?.invoice_number || 'N/A'}" đã được phê duyệt.`,
      type: 'success',
      link: '/invoices',
    });
  };

  const handleRejectInvoice = async (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    await updateInvoice(invoiceId, { status: 'rejected' });
    toast.success('Đã từ chối hóa đơn');
    await createNotification({
      title: 'Hóa đơn đã bị từ chối',
      message: `Hóa đơn "${inv?.invoice_number || 'N/A'}" đã bị từ chối.`,
      type: 'warning',
      link: '/invoices',
    });
  };

  const handleViewPreview = async (filePath: string | null) => {
    if (!filePath) {
      toast.error('Không có file gốc');
      return;
    }
    await getPreviewUrl(filePath);
    setShowPreview(true);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      (invoice.invoice_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (invoice.vendor_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (invoice.buyer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    let matchesDate = true;
    if (dateFrom || dateTo) {
      const invoiceDate = invoice.created_at ? new Date(invoice.created_at) : null;
      if (invoiceDate) {
        if (dateFrom && dateTo) {
          matchesDate = isWithinInterval(invoiceDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
        } else if (dateFrom) {
          matchesDate = invoiceDate >= startOfDay(dateFrom);
        } else if (dateTo) {
          matchesDate = invoiceDate <= endOfDay(dateTo);
        }
      } else {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Group filtered invoices: ZIP groups + singles
  const groupedInvoices = useMemo<InvoiceGroup[]>(() => {
    const zipMap = new Map<string, Invoice[]>();
    const singles: Invoice[] = [];

    for (const inv of filteredInvoices) {
      if (inv.source_zip_name) {
        const existing = zipMap.get(inv.source_zip_name) || [];
        existing.push(inv);
        zipMap.set(inv.source_zip_name, existing);
      } else {
        singles.push(inv);
      }
    }

    const groups: InvoiceGroup[] = [];

    // Add ZIP groups
    for (const [zipName, invs] of zipMap) {
      groups.push({ type: 'zip', zipName, invoices: invs });
    }

    // Add singles
    for (const inv of singles) {
      groups.push({ type: 'single', invoice: inv });
    }

    return groups;
  }, [filteredInvoices]);

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setLoadingItems(true);
    const items = await fetchInvoiceItems(invoice.id);
    setInvoiceItems(items);
    setLoadingItems(false);
  };

  const handleEditInvoice = async (invoice: Invoice) => {
    setEditInvoice(invoice);
    const items = await fetchInvoiceItems(invoice.id);
    setEditItems(items);
  };

  const handleSaveInvoice = async (
    invoiceData: Partial<Invoice>,
    items: Partial<InvoiceItem>[]
  ): Promise<boolean> => {
    if (!editInvoice) return false;
    try {
      const success = await updateInvoice(editInvoice.id, invoiceData);
      if (!success) return false;
      await supabase.from('invoice_items').delete().eq('invoice_id', editInvoice.id);
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          invoice_id: editInvoice.id,
          item_code: item.item_code || null,
          description: item.description || null,
          unit: item.unit || null,
          quantity: item.quantity ?? null,
          unit_price: item.unit_price ?? null,
          amount: item.amount ?? null,
          sort_order: index,
        }));
        const { error } = await supabase.from('invoice_items').insert(itemsToInsert);
        if (error) {
          console.error('Error updating invoice items:', error);
          toast.error('Không thể cập nhật hàng hóa');
          return false;
        }
      }
      await fetchInvoices();
      return true;
    } catch (error) {
      console.error('Error saving invoice:', error);
      return false;
    }
  };

  // Old exportCSV removed - using exportInvoices lib now

  const formatAmount = (amount: number | null) => {
    if (!amount) return '0';
    return amount.toLocaleString('vi-VN');
  };

  const renderInvoiceRow = (invoice: Invoice, index: number) => {
    const isCancelled = invoice.status === 'cancelled';
    const createdAt = invoice.created_at ? new Date(invoice.created_at) : null;
    const updatedAt = invoice.updated_at ? new Date(invoice.updated_at) : null;
    const isUpdated = createdAt && updatedAt && updatedAt.getTime() - createdAt.getTime() > 1000;

    return (
      <motion.tr
        key={invoice.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 * index }}
        className={cn(
          "border-border cursor-pointer",
          isCancelled ? "opacity-50 bg-muted/20" : "hover:bg-muted/30"
        )}
        onClick={() => handleViewInvoice(invoice)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            {invoice.invoice_number || invoice.invoice_serial || 'N/A'}
          </div>
        </TableCell>
        <TableCell>{invoice.vendor_name || 'N/A'}</TableCell>
        <TableCell>{invoice.invoice_date || 'N/A'}</TableCell>
        <TableCell className="font-semibold">
          {invoice.currency || ''} {formatAmount(invoice.total_amount)}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn('capitalize', statusStyles[invoice.status] || statusStyles.pending)}>
            {statusLabels[invoice.status] || invoice.status}
          </Badge>
        </TableCell>
        <TableCell>
          {invoice.confidence_score != null ? (
            <div className="flex items-center gap-2">
              <Progress value={invoice.confidence_score * 100} className={cn("h-2 w-16", invoice.confidence_score < 0.7 && "[&>div]:bg-warning")} />
              <span className={cn("text-xs font-medium", invoice.confidence_score < 0.7 ? "text-warning" : "text-muted-foreground")}>
                {Math.round(invoice.confidence_score * 100)}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
        {isAdmin && (
          <>
            <TableCell className="text-sm text-muted-foreground">{invoice.created_by_profile?.user_code || '-'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{createdAt ? format(createdAt, 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{isUpdated ? (invoice.updated_by_profile?.user_code || '-') : '-'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{isUpdated ? format(updatedAt, 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
          </>
        )}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleViewInvoice(invoice); }} title="Xem chi tiết">
              <Eye className="h-4 w-4" />
            </Button>
            {invoice.original_file_path && (
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleViewPreview(invoice.original_file_path); }} title="Xem file gốc" className="text-muted-foreground hover:text-primary">
                <Image className="h-4 w-4" />
              </Button>
            )}
            {!isCancelled && (
              <>
                {(invoice.status === 'processed' || invoice.status === 'pending') && (
                  <>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleApproveInvoice(invoice.id); }} className="text-muted-foreground hover:text-success" title="Duyệt">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRejectInvoice(invoice.id); }} className="text-muted-foreground hover:text-destructive" title="Từ chối">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice); }} className="text-muted-foreground hover:text-primary" title="Sửa">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setCancelId(invoice.id); }} className="text-muted-foreground hover:text-warning" title="Hủy hóa đơn">
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </motion.tr>
    );
  };

  const tableHeaders = (
    <TableHeader>
      <TableRow className="border-border hover:bg-transparent">
        <TableHead className="text-muted-foreground">Mã HĐ</TableHead>
        <TableHead className="text-muted-foreground">Nhà cung cấp</TableHead>
        <TableHead className="text-muted-foreground">Ngày HĐ</TableHead>
        <TableHead className="text-muted-foreground">Tổng tiền</TableHead>
        <TableHead className="text-muted-foreground">Trạng thái</TableHead>
        <TableHead className="text-muted-foreground">Độ tin cậy</TableHead>
        {isAdmin && (
          <>
            <TableHead className="text-muted-foreground">Người tạo</TableHead>
            <TableHead className="text-muted-foreground">Ngày tạo</TableHead>
            <TableHead className="text-muted-foreground">Người cập nhật</TableHead>
            <TableHead className="text-muted-foreground">Ngày cập nhật</TableHead>
          </>
        )}
        <TableHead className="text-muted-foreground text-right">Thao tác</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <MainLayout>
      <Header title="Hóa Đơn" subtitle="Quản lý và xem hóa đơn đã trích xuất" />

      <div className="p-6">
        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="standard" className="gap-2">
              <Receipt className="h-4 w-4" />
              Hóa đơn thường
            </TabsTrigger>
            <TabsTrigger value="broker" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Hóa đơn Broker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standard">
        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Tìm theo mã HĐ, nhà cung cấp, người mua..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-muted/50" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-muted/50">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả TT</SelectItem>
                <SelectItem value="processed">Đã xử lý</SelectItem>
                <SelectItem value="approved">Đã duyệt</SelectItem>
                <SelectItem value="pending">Đang chờ</SelectItem>
                <SelectItem value="draft">Nháp</SelectItem>
                <SelectItem value="rejected">Từ chối</SelectItem>
                <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal bg-muted/50", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Từ ngày"}
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
                  {dateTo ? format(dateTo, "dd/MM/yyyy") : "Đến ngày"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 text-muted-foreground">
                <X className="h-4 w-4" />
                Xóa bộ lọc
              </Button>
            )}

            <div className="flex-1" />

            <span className="text-sm text-muted-foreground">
              {filteredInvoices.length} / {invoices.length} hóa đơn
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2" disabled={filteredInvoices.length === 0}>
                  <Download className="h-4 w-4" />
                  Xuất dữ liệu
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportToExcel(filteredInvoices)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Xuất Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToCSV(filteredInvoices)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Xuất CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {loading ? (
            <div className="glass rounded-xl p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {invoices.length === 0 ? 'Chưa có hóa đơn nào. Hãy upload hóa đơn để bắt đầu.' : 'Không tìm thấy hóa đơn phù hợp.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* ZIP folders */}
              {groupedInvoices.filter(g => g.type === 'zip').map((group) => (
                group.type === 'zip' && (
                  <ZipInvoiceFolder
                    key={group.zipName}
                    zipName={group.zipName}
                    invoices={group.invoices}
                    isAdmin={isAdmin}
                    tableHeaders={tableHeaders}
                    renderInvoiceRow={renderInvoiceRow}
                    formatAmount={formatAmount}
                  />
                )
              ))}

              {/* Single invoices with pagination */}
              {(() => {
                const singleInvoices = groupedInvoices.filter(g => g.type === 'single');
                if (singleInvoices.length === 0) return null;
                const totalPages = Math.ceil(singleInvoices.length / PAGE_SIZE);
                const paginatedSingles = singleInvoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

                return (
                  <div className="space-y-3">
                    <div className="glass rounded-xl overflow-hidden">
                      <Table>
                        {tableHeaders}
                        <TableBody>
                          {paginatedSingles.map((g, i) => g.type === 'single' && renderInvoiceRow(g.invoice, (currentPage - 1) * PAGE_SIZE + i))}
                        </TableBody>
                      </Table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Trước
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Trang {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Sau
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </motion.div>

        {/* Invoice Detail Dialog */}
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                Chi tiết hóa đơn - {selectedInvoice?.invoice_number || selectedInvoice?.invoice_serial}
              </DialogTitle>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-6">
                {/* Confidence Score + Preview Button */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Độ tin cậy AI</p>
                      {selectedInvoice.confidence_score != null ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={selectedInvoice.confidence_score * 100} className={cn("h-2.5 w-24", selectedInvoice.confidence_score < 0.7 && "[&>div]:bg-warning")} />
                          <span className={cn("text-sm font-semibold", selectedInvoice.confidence_score < 0.7 ? "text-warning" : selectedInvoice.confidence_score >= 0.9 ? "text-success" : "text-foreground")}>
                            {Math.round(selectedInvoice.confidence_score * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Không có dữ liệu</span>
                      )}
                    </div>
                    {selectedInvoice.confidence_score != null && selectedInvoice.confidence_score < 0.7 && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        ⚠ Cần kiểm tra lại
                      </Badge>
                    )}
                  </div>
                  {selectedInvoice.original_file_path && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => handleViewPreview(selectedInvoice.original_file_path)} disabled={loadingPreview}>
                      {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                      Xem file gốc
                    </Button>
                  )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary">Thông tin nhà cung cấp</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Tên:</span> {selectedInvoice.vendor_name || 'N/A'}</p>
                      <p><span className="text-muted-foreground">MST:</span> {selectedInvoice.vendor_tax_id || 'N/A'}</p>
                      <p><span className="text-muted-foreground">Địa chỉ:</span> {selectedInvoice.vendor_address || 'N/A'}</p>
                      <p><span className="text-muted-foreground">SĐT:</span> {selectedInvoice.vendor_phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary">Thông tin người mua</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Tên:</span> {selectedInvoice.buyer_name || 'N/A'}</p>
                      <p><span className="text-muted-foreground">MST:</span> {selectedInvoice.buyer_tax_id || 'N/A'}</p>
                      <p><span className="text-muted-foreground">Địa chỉ:</span> {selectedInvoice.buyer_address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4 p-4 rounded-lg bg-muted/30">
                  <div><p className="text-xs text-muted-foreground">Ngày hóa đơn</p><p className="font-semibold">{selectedInvoice.invoice_date || 'N/A'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Hình thức TT</p><p className="font-semibold">{selectedInvoice.payment_method || 'N/A'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tiền tệ</p><p className="font-semibold">{selectedInvoice.currency || 'N/A'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Ký hiệu</p><p className="font-semibold">{selectedInvoice.invoice_serial || 'N/A'}</p></div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold text-primary">Danh mục hàng hóa</h4>
                  {loadingItems ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : invoiceItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center p-4">Không có dữ liệu hàng hóa</p>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs">Mã</TableHead>
                            <TableHead className="text-xs">Mô tả</TableHead>
                            <TableHead className="text-xs">ĐVT</TableHead>
                            <TableHead className="text-xs text-right">SL</TableHead>
                            <TableHead className="text-xs text-right">Đơn giá</TableHead>
                            <TableHead className="text-xs text-right">Thành tiền</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoiceItems.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{item.item_code || 'N/A'}</TableCell>
                              <TableCell className="text-sm">{item.description || 'N/A'}</TableCell>
                              <TableCell className="text-sm">{item.unit || 'N/A'}</TableCell>
                              <TableCell className="text-sm text-right">{item.quantity || '0'}</TableCell>
                              <TableCell className="text-sm text-right">{formatAmount(item.unit_price)}</TableCell>
                              <TableCell className="font-semibold text-right">{formatAmount(item.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cộng tiền hàng</span>
                      <span>{formatAmount(selectedInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Thuế ({selectedInvoice.tax_rate || '0'}%)</span>
                      <span>{formatAmount(selectedInvoice.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border font-semibold text-lg">
                      <span>Tổng cộng</span>
                      <span className="text-primary">{selectedInvoice.currency || ''} {formatAmount(selectedInvoice.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.amount_in_words && (
                  <p className="text-sm text-muted-foreground italic text-right">{selectedInvoice.amount_in_words}</p>
                )}

                {selectedInvoice.extend && Object.keys(selectedInvoice.extend).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="mb-3 font-semibold text-primary">Thông tin mở rộng</h4>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(selectedInvoice.extend).map(([key, value]) => (
                        <div key={key} className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="font-medium text-sm mt-1">{typeof value === 'object' ? JSON.stringify(value) : String(value || 'N/A')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel Confirmation */}
        <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận hủy hóa đơn</AlertDialogTitle>
              <AlertDialogDescription>
                Hóa đơn sẽ được đánh dấu là đã hủy và không thể chỉnh sửa. Bạn vẫn có thể xem nhưng không thể thao tác gì trên hóa đơn này.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Đóng</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelInvoice} disabled={isCancelling} className="bg-warning hover:bg-warning/90 text-warning-foreground">
                {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hủy hóa đơn'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* File Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={(open) => { if (!open) { setShowPreview(false); clearPreview(); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                Xem file gốc
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center min-h-[400px]">
              {loadingPreview ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : previewUrl ? (
                previewUrl.includes('.pdf') || previewUrl.includes('application/pdf') ? (
                  <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border border-border" />
                ) : (
                  <img src={previewUrl} alt="Invoice preview" className="max-w-full max-h-[70vh] rounded-lg object-contain" />
                )
              ) : (
                <p className="text-muted-foreground">Không thể tải file</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <InvoiceEditDialog
          invoice={editInvoice}
          items={editItems}
          open={!!editInvoice}
          onClose={() => { setEditInvoice(null); setEditItems([]); }}
          onSave={handleSaveInvoice}
        />
          </TabsContent>

          <TabsContent value="broker">
            <BrokerInvoicesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function ZipInvoiceFolder({
  zipName,
  invoices,
  isAdmin,
  tableHeaders,
  renderInvoiceRow,
  formatAmount,
}: {
  zipName: string;
  invoices: Invoice[];
  isAdmin: boolean;
  tableHeaders: React.ReactNode;
  renderInvoiceRow: (invoice: Invoice, index: number) => React.ReactNode;
  formatAmount: (amount: number | null) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 w-full p-4 hover:bg-muted/30 transition-colors text-left">
            <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-90')} />
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent shrink-0">
              {isOpen ? <FolderOpen className="h-5 w-5 text-accent-foreground" /> : <Archive className="h-5 w-5 text-accent-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{zipName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {invoices.length} hóa đơn · Tổng: {formatAmount(totalAmount)}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">{invoices.length} file</Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            <Table>
              {tableHeaders}
              <TableBody>
                {invoices.map((inv, i) => renderInvoiceRow(inv, i))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
