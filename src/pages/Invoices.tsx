import { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useInvoices } from '@/hooks/useInvoices';
import { Invoice, InvoiceItem } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Filter, Eye, Download, FileText, Loader2, Pencil, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceEditDialog } from '@/components/invoices/InvoiceEditDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export default function InvoicesPage() {
  const { invoices, loading, fetchInvoiceItems, updateInvoice, fetchInvoices } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelInvoice = async () => {
    if (!cancelId) return;
    setIsCancelling(true);
    await updateInvoice(cancelId, { status: 'cancelled' });
    setIsCancelling(false);
    setCancelId(null);
    toast.success('Đã hủy hóa đơn');
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      (invoice.invoice_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (invoice.vendor_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
      // Update invoice
      const success = await updateInvoice(editInvoice.id, invoiceData);
      if (!success) return false;

      // Delete existing items and insert new ones
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

  const exportCSV = () => {
    const headers = ['Invoice Number', 'Vendor', 'Date', 'Currency', 'Total', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number || '',
      inv.vendor_name || '',
      inv.invoice_date || '',
      inv.currency || '',
      String(inv.total_amount || ''),
      inv.status || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatAmount = (amount: number | null) => {
    if (!amount) return '0';
    return amount.toLocaleString('vi-VN');
  };

  return (
    <MainLayout>
      <Header title="Hóa Đơn" subtitle="Quản lý và xem hóa đơn đã trích xuất" />

      <div className="p-6">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-wrap items-center gap-4"
        >
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã hóa đơn, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/50"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-muted/50">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Lọc theo trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="processed">Đã xử lý</SelectItem>
              <SelectItem value="approved">Đã duyệt</SelectItem>
              <SelectItem value="pending">Đang chờ</SelectItem>
              <SelectItem value="draft">Nháp</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
              <SelectItem value="cancelled">Đã hủy</SelectItem>
            </SelectContent>
          </Select>

          <Button className="gap-2" onClick={exportCSV} disabled={filteredInvoices.length === 0}>
            <Download className="h-4 w-4" />
            Xuất CSV
          </Button>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl overflow-hidden"
        >
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {invoices.length === 0
                  ? 'Chưa có hóa đơn nào. Hãy upload hóa đơn để bắt đầu.'
                  : 'Không tìm thấy hóa đơn phù hợp.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Mã HĐ</TableHead>
                  <TableHead className="text-muted-foreground">Nhà cung cấp</TableHead>
                  <TableHead className="text-muted-foreground">Ngày HĐ</TableHead>
                  <TableHead className="text-muted-foreground">Tổng tiền</TableHead>
                  <TableHead className="text-muted-foreground">Trạng thái</TableHead>
                  <TableHead className="text-muted-foreground">Ngày tạo</TableHead>
                  <TableHead className="text-muted-foreground">Cập nhật</TableHead>
                  <TableHead className="text-muted-foreground text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice, index) => {
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
                      <Badge
                        variant="outline"
                        className={cn('capitalize', statusStyles[invoice.status] || statusStyles.pending)}
                      >
                        {statusLabels[invoice.status] || invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {createdAt ? format(createdAt, 'dd/MM/yyyy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {isUpdated ? format(updatedAt, 'dd/MM/yyyy HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewInvoice(invoice);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!isCancelled && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditInvoice(invoice);
                              }}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelId(invoice.id);
                              }}
                              className="text-muted-foreground hover:text-warning"
                              title="Hủy hóa đơn"
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
                {/* Vendor & Buyer Info */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary">Thông tin nhà cung cấp</h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Tên:</span>{' '}
                        {selectedInvoice.vendor_name || 'N/A'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">MST:</span>{' '}
                        {selectedInvoice.vendor_tax_id || 'N/A'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Địa chỉ:</span>{' '}
                        {selectedInvoice.vendor_address || 'N/A'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">SĐT:</span>{' '}
                        {selectedInvoice.vendor_phone || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary">Thông tin người mua</h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Tên:</span>{' '}
                        {selectedInvoice.buyer_name || 'N/A'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">MST:</span>{' '}
                        {selectedInvoice.buyer_tax_id || 'N/A'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Địa chỉ:</span>{' '}
                        {selectedInvoice.buyer_address || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Invoice Meta */}
                <div className="grid gap-4 md:grid-cols-4 p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Ngày hóa đơn</p>
                    <p className="font-semibold">{selectedInvoice.invoice_date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hình thức TT</p>
                    <p className="font-semibold">{selectedInvoice.payment_method || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tiền tệ</p>
                    <p className="font-semibold">{selectedInvoice.currency || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ký hiệu</p>
                    <p className="font-semibold">{selectedInvoice.invoice_serial || 'N/A'}</p>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <h4 className="mb-3 font-semibold text-primary">Danh mục hàng hóa</h4>
                  {loadingItems ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : invoiceItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center p-4">
                      Không có dữ liệu hàng hóa
                    </p>
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
                              <TableCell className="font-mono text-xs">
                                {item.item_code || 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm">{item.description || 'N/A'}</TableCell>
                              <TableCell className="text-sm">{item.unit || 'N/A'}</TableCell>
                              <TableCell className="text-sm text-right">
                                {item.quantity || '0'}
                              </TableCell>
                              <TableCell className="text-sm text-right">
                                {formatAmount(item.unit_price)}
                              </TableCell>
                              <TableCell className="font-semibold text-right">
                                {formatAmount(item.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cộng tiền hàng</span>
                      <span>{formatAmount(selectedInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Thuế ({selectedInvoice.tax_rate || '0'}%)
                      </span>
                      <span>{formatAmount(selectedInvoice.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border font-semibold text-lg">
                      <span>Tổng cộng</span>
                      <span className="text-primary">
                        {selectedInvoice.currency || ''} {formatAmount(selectedInvoice.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.amount_in_words && (
                  <p className="text-sm text-muted-foreground italic text-right">
                    {selectedInvoice.amount_in_words}
                  </p>
                )}

                {/* Extend Section */}
                {selectedInvoice.extend && Object.keys(selectedInvoice.extend).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="mb-3 font-semibold text-primary">Thông tin mở rộng</h4>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(selectedInvoice.extend).map(([key, value]) => (
                        <div key={key} className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="font-medium text-sm mt-1">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value || 'N/A')}
                          </p>
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
              <AlertDialogAction
                onClick={handleCancelInvoice}
                disabled={isCancelling}
                className="bg-warning hover:bg-warning/90 text-warning-foreground"
              >
                {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hủy hóa đơn'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Invoice Dialog */}
        <InvoiceEditDialog
          invoice={editInvoice}
          items={editItems}
          open={!!editInvoice}
          onClose={() => {
            setEditInvoice(null);
            setEditItems([]);
          }}
          onSave={handleSaveInvoice}
        />
      </div>
    </MainLayout>
  );
}
