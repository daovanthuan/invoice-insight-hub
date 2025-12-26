import { useState } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { mockInvoices } from '@/data/mockData';
import { Invoice } from '@/types/invoice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Search, Filter, Eye, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles = {
  processed: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function InvoicesPage() {
  const [invoices] = useState<Invoice[]>(mockInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.core.invoice_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.core.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.filename.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <Header title="Invoices" subtitle="Manage and view extracted invoices" />

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
              placeholder="Search by invoice ID, vendor, or filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/50"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-muted/50">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Invoice ID</TableHead>
                <TableHead className="text-muted-foreground">Vendor</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Amount</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
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
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      {invoice.core.invoice_id || invoice.filename}
                    </div>
                  </TableCell>
                  <TableCell>{invoice.core.vendor_name}</TableCell>
                  <TableCell>{invoice.core.invoice_date}</TableCell>
                  <TableCell className="font-semibold">
                    {invoice.core.currency} {invoice.core.total_amount}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('capitalize', statusStyles[invoice.status])}
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInvoice(invoice);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </motion.div>

        {/* Invoice Detail Dialog */}
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                Invoice Details - {selectedInvoice?.core.invoice_id}
              </DialogTitle>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-6">
                {/* Vendor & Buyer Info */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary">Vendor Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {selectedInvoice.core.vendor_name}</p>
                      <p><span className="text-muted-foreground">Tax ID:</span> {selectedInvoice.core.vendor_tax_id}</p>
                      <p><span className="text-muted-foreground">Address:</span> {selectedInvoice.core.vendor_address}</p>
                      <p><span className="text-muted-foreground">Phone:</span> {selectedInvoice.core.vendor_phone}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-primary">Buyer Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {selectedInvoice.core.buyer_name}</p>
                      <p><span className="text-muted-foreground">Tax ID:</span> {selectedInvoice.core.buyer_tax_id}</p>
                      <p><span className="text-muted-foreground">Address:</span> {selectedInvoice.core.buyer_address}</p>
                    </div>
                  </div>
                </div>

                {/* Invoice Meta */}
                <div className="grid gap-4 md:grid-cols-4 p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice Date</p>
                    <p className="font-semibold">{selectedInvoice.core.invoice_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Method</p>
                    <p className="font-semibold">{selectedInvoice.core.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Currency</p>
                    <p className="font-semibold">{selectedInvoice.core.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Serial</p>
                    <p className="font-semibold">{selectedInvoice.core.invoice_serial}</p>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <h4 className="mb-3 font-semibold text-primary">Line Items</h4>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs">Code</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Unit</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs text-right">Price</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.core.line_items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                            <TableCell className="text-sm">{item.description}</TableCell>
                            <TableCell className="text-sm">{item.unit}</TableCell>
                            <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                            <TableCell className="text-sm text-right">{item.unit_price}</TableCell>
                            <TableCell className="font-semibold text-right">{item.amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{selectedInvoice.core.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({selectedInvoice.core.tax_rate})</span>
                      <span>{selectedInvoice.core.tax_amount}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border font-semibold text-lg">
                      <span>Total</span>
                      <span className="text-primary">
                        {selectedInvoice.core.currency} {selectedInvoice.core.total_amount}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.core.amount_in_words && (
                  <p className="text-sm text-muted-foreground italic text-right">
                    {selectedInvoice.core.amount_in_words}
                  </p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
