export interface LineItem {
  item_code: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
  amount: string;
}

export interface InvoiceCore {
  vendor_name: string;
  vendor_tax_id: string;
  vendor_address: string;
  vendor_phone: string;
  vendor_fax: string;
  vendor_account_no: string;
  buyer_name: string;
  buyer_tax_id: string;
  buyer_address: string;
  buyer_account_no: string;
  invoice_id: string;
  invoice_serial: string;
  invoice_date: string;
  payment_method: string;
  currency: string;
  exchange_rate: string;
  tax_authority_code: string;
  lookup_code: string;
  lookup_url: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  amount_in_words: string;
  line_items: LineItem[];
}

export interface Invoice {
  id: string;
  core: InvoiceCore;
  extend: Record<string, unknown>;
  status: 'pending' | 'processed' | 'error';
  createdAt: Date;
  filename: string;
}

export interface DashboardStats {
  totalInvoices: number;
  totalAmount: number;
  pendingInvoices: number;
  processedToday: number;
  averageAmount: number;
  topVendors: { name: string; count: number; amount: number }[];
  monthlyData: { month: string; count: number; amount: number }[];
  statusDistribution: { status: string; count: number }[];
}
