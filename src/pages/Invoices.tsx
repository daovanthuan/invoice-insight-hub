import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useInvoices, InvoiceRecord, LineItemRecord } from '@/hooks/useInvoices';
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
import { Search, Filter, Eye, Download, FileText, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  processed: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function InvoicesPage() {
  const { invoices, loading, fetchLineItems, deleteInvoice } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [lineItems, setLineItems] = useState<LineItemRecord[]>([]);
  const [loadingLineItems, setLoadingLineItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      (invoice.invoice_id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (invoice.vendor_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (invoice.file_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewInvoice = async (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    setLoadingLineItems(true);
    const items = await fetchLineItems(invoice.id);
    setLineItems(items);
    setLoadingLineItems(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await deleteInvoice(deleteId);
    setIsDeleting(false);
    setDeleteId(null);
  };

  const exportCSV = () => {
    const headers = ['Invoice ID', 'Vendor', 'Date', 'Currency', 'Total', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoice_id || '',
      inv.vendor_name || '',
      inv.invoice_date || '',
      inv.currency || '',
      inv.total_amount || '',
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
              <SelectItem value="pending">Đang chờ</SelectItem>
              <SelectItem value="failed">Lỗi</SelectItem>
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
                  <TableHead className="text-muted-foreground">Ngày</TableHead>
                  <TableHead className="text-muted-foreground">Tổng tiền</TableHead>
                  <TableHead className="text-muted-foreground">Trạng thái</TableHead>
                  <TableHead className="text-muted-foreground text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice, index) => (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className="border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleViewInvoice(invoice)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        {invoice.invoice_id || invoice.file_name || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>{invoice.vendor_name || 'N/A'}</TableCell>
                    <TableCell>{invoice.invoice_date || 'N/A'}</TableCell>
                    <TableCell className="font-semibold">
                      {invoice.currency || ''} {invoice.total_amount || '0'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', statusStyles[invoice.status || 'pending'])}
                      >
                        {invoice.status === 'processed'
                          ? 'Đã xử lý'
                          : invoice.status === 'failed'
                          ? 'Lỗi'
                          : 'Đang chờ'}
                      </Badge>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(invoice.id);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
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
                Chi tiết hóa đơn - {selectedInvoice?.invoice_id || selectedInvoice?.file_name}
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
                  {loadingLineItems ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : lineItems.length === 0 ? (
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
                          {lineItems.map((item, idx) => (
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
                                {item.unit_price || '0'}
                              </TableCell>
                              <TableCell className="font-semibold text-right">
                                {item.amount || '0'}
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
                      <span>{selectedInvoice.subtotal || '0'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Thuế ({selectedInvoice.tax_rate || '0%'})
                      </span>
                      <span>{selectedInvoice.tax_amount || '0'}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border font-semibold text-lg">
                      <span>Tổng cộng</span>
                      <span className="text-primary">
                        {selectedInvoice.currency || ''} {selectedInvoice.total_amount || '0'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.amount_in_words && (
                  <p className="text-sm text-muted-foreground italic text-right">
                    {selectedInvoice.amount_in_words}
                  </p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa hóa đơn này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  'Xóa'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
