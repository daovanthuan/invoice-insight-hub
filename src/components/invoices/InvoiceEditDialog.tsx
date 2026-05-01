import { useState, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceEditDialogProps {
  invoice: Invoice | null;
  items: InvoiceItem[];
  open: boolean;
  onClose: () => void;
  onSave: (invoiceData: Partial<Invoice>, items: Partial<InvoiceItem>[]) => Promise<boolean>;
}

const statusOptions: { value: InvoiceStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processed', label: 'Processed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
];

export function InvoiceEditDialog({
  invoice,
  items,
  open,
  onClose,
  onSave,
}: InvoiceEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Invoice>>({});
  const [lineItems, setLineItems] = useState<Partial<InvoiceItem>[]>([]);
  const [extendData, setExtendData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setFormData({
        vendor_name: invoice.vendor_name || '',
        vendor_tax_id: invoice.vendor_tax_id || '',
        vendor_address: invoice.vendor_address || '',
        vendor_phone: invoice.vendor_phone || '',
        vendor_fax: invoice.vendor_fax || '',
        vendor_account_no: invoice.vendor_account_no || '',
        buyer_name: invoice.buyer_name || '',
        buyer_tax_id: invoice.buyer_tax_id || '',
        buyer_address: invoice.buyer_address || '',
        buyer_account_no: invoice.buyer_account_no || '',
        invoice_number: invoice.invoice_number || '',
        invoice_serial: invoice.invoice_serial || '',
        invoice_date: invoice.invoice_date || '',
        payment_method: invoice.payment_method || '',
        currency: invoice.currency || 'VND',
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total_amount: invoice.total_amount,
        amount_in_words: invoice.amount_in_words || '',
        status: invoice.status,
      });

      // Parse extend data
      if (invoice.extend && typeof invoice.extend === 'object') {
        const ext: Record<string, string> = {};
        Object.entries(invoice.extend).forEach(([key, value]) => {
          ext[key] = typeof value === 'string' ? value : JSON.stringify(value);
        });
        setExtendData(ext);
      } else {
        setExtendData({});
      }
    }
  }, [invoice]);

  useEffect(() => {
    setLineItems(
      items.map((item) => ({
        id: item.id,
        invoice_id: item.invoice_id,
        item_code: item.item_code || '',
        description: item.description || '',
        unit: item.unit || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: item.sort_order,
      }))
    );
  }, [items]);

  const handleInputChange = (field: keyof Invoice, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number | null) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        item_code: '',
        description: '',
        unit: '',
        quantity: null,
        unit_price: null,
        amount: null,
        sort_order: prev.length,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExtendChange = (key: string, value: string) => {
    setExtendData((prev) => ({ ...prev, [key]: value }));
  };

  const addExtendField = () => {
    const newKey = `field_${Object.keys(extendData).length + 1}`;
    setExtendData((prev) => ({ ...prev, [newKey]: '' }));
  };

  const removeExtendField = (key: string) => {
    setExtendData((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const renameExtendField = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !newKey.trim()) return;
    setExtendData((prev) => {
      const updated: Record<string, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        updated[k === oldKey ? newKey : k] = v;
      });
      return updated;
    });
  };

  const handleSave = async () => {
    if (!invoice) return;

    setIsSaving(true);
    try {
      // Calculate subtotal from line items
      const calculatedSubtotal = lineItems.reduce((sum, item) => {
        return sum + (Number(item.amount) || 0);
      }, 0);

      const invoiceData: Partial<Invoice> = {
        ...formData,
        subtotal: calculatedSubtotal > 0 ? calculatedSubtotal : formData.subtotal,
        extend: Object.keys(extendData).length > 0 ? extendData : null,
      };

      const success = await onSave(invoiceData, lineItems);
      if (success) {
        toast.success('Changes saved');
        onClose();
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Could not save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit invoice - {invoice.invoice_number || invoice.invoice_serial}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">General info</TabsTrigger>
            <TabsTrigger value="items">Line items ({lineItems.length})</TabsTrigger>
            <TabsTrigger value="extend">Extended ({Object.keys(extendData).length})</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-6 mt-4">
            {/* Vendor Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Vendor information</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Vendor name</Label>
                  <Input
                    value={formData.vendor_name || ''}
                    onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax ID</Label>
                  <Input
                    value={formData.vendor_tax_id || ''}
                    onChange={(e) => handleInputChange('vendor_tax_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.vendor_address || ''}
                    onChange={(e) => handleInputChange('vendor_address', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.vendor_phone || ''}
                    onChange={(e) => handleInputChange('vendor_phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account number</Label>
                  <Input
                    value={formData.vendor_account_no || ''}
                    onChange={(e) => handleInputChange('vendor_account_no', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Buyer Info */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Buyer information</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Buyer name</Label>
                  <Input
                    value={formData.buyer_name || ''}
                    onChange={(e) => handleInputChange('buyer_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax ID</Label>
                  <Input
                    value={formData.buyer_tax_id || ''}
                    onChange={(e) => handleInputChange('buyer_tax_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.buyer_address || ''}
                    onChange={(e) => handleInputChange('buyer_address', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account number</Label>
                  <Input
                    value={formData.buyer_account_no || ''}
                    onChange={(e) => handleInputChange('buyer_account_no', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Invoice information</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Invoice number</Label>
                  <Input
                    value={formData.invoice_number || ''}
                    onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serial</Label>
                  <Input
                    value={formData.invoice_serial || ''}
                    onChange={(e) => handleInputChange('invoice_serial', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice date</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date || ''}
                    onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment method</Label>
                  <Input
                    value={formData.payment_method || ''}
                    onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={formData.currency || ''}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Totals</h4>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Subtotal</Label>
                  <Input
                    type="number"
                    value={formData.subtotal ?? ''}
                    onChange={(e) => handleInputChange('subtotal', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax rate (%)</Label>
                  <Input
                    type="number"
                    value={formData.tax_rate ?? ''}
                    onChange={(e) => handleInputChange('tax_rate', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax amount</Label>
                  <Input
                    type="number"
                    value={formData.tax_amount ?? ''}
                    onChange={(e) => handleInputChange('tax_amount', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    type="number"
                    value={formData.total_amount ?? ''}
                    onChange={(e) => handleInputChange('total_amount', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount in words</Label>
                <Textarea
                  value={formData.amount_in_words || ''}
                  onChange={(e) => handleInputChange('amount_in_words', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-primary">Line items</h4>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add row
                </Button>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs w-24">Code</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs w-20">Unit</TableHead>
                      <TableHead className="text-xs w-20 text-right">Qty</TableHead>
                      <TableHead className="text-xs w-28 text-right">Unit price</TableHead>
                      <TableHead className="text-xs w-28 text-right">Amount</TableHead>
                      <TableHead className="text-xs w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="p-1">
                          <Input
                            className="h-8 text-xs"
                            value={item.item_code || ''}
                            onChange={(e) => handleItemChange(idx, 'item_code', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            className="h-8 text-xs"
                            value={item.description || ''}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            className="h-8 text-xs"
                            value={item.unit || ''}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={item.quantity ?? ''}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value ? Number(e.target.value) : null)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={item.unit_price ?? ''}
                            onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value ? Number(e.target.value) : null)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            className="h-8 text-xs text-right"
                            value={item.amount ?? ''}
                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value ? Number(e.target.value) : null)}
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLineItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {lineItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No line items. Click "Add row" to add one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Extend Tab */}
          <TabsContent value="extend" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-primary">Extended information</h4>
                <Button variant="outline" size="sm" onClick={addExtendField}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add field
                </Button>
              </div>

              <div className="space-y-3">
                {Object.entries(extendData).map(([key, value]) => (
                  <div key={key} className="flex gap-3 items-start">
                    <div className="space-y-1 w-48">
                      <Label className="text-xs text-muted-foreground">Field name</Label>
                      <Input
                        value={key}
                        onChange={(e) => renameExtendField(key, e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs text-muted-foreground">Value</Label>
                      <Input
                        value={value}
                        onChange={(e) => handleExtendChange(key, e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeExtendField(key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {Object.keys(extendData).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No extended information. Click "Add field" to add one.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
