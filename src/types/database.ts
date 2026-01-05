// Database enums
export type EntityStatus = 'active' | 'inactive' | 'deleted';
export type InvoiceStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'processed' | 'cancelled';
export type GenderType = 'male' | 'female' | 'other';
export type NotificationType = 'info' | 'warning' | 'error' | 'success';

// Profile
export interface Profile {
  id: string;
  user_code: string | null;
  full_name: string | null;
  email: string | null;
  gender: GenderType | null;
  date_of_birth: string | null;
  address: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

// Role
export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  status: EntityStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// User Role
export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
  role?: Role;
}

// Invoice
export interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_serial: string | null;
  invoice_type: string | null;
  invoice_date: string | null;
  
  // Vendor info
  vendor_name: string | null;
  vendor_tax_id: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  vendor_fax: string | null;
  vendor_account_no: string | null;
  
  // Buyer info
  buyer_name: string | null;
  buyer_tax_id: string | null;
  buyer_address: string | null;
  buyer_account_no: string | null;
  
  // Financial info
  currency: string | null;
  exchange_rate: number | null;
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  amount_in_words: string | null;
  payment_method: string | null;
  
  // Lookup info
  tax_authority_code: string | null;
  lookup_code: string | null;
  lookup_url: string | null;
  
  // Processing info
  status: InvoiceStatus;
  confidence_score: number | null;
  raw_json: Record<string, unknown> | null;
  extend: Record<string, unknown> | null;
  
  // Relations
  owner_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// Invoice Item
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_code: string | null;
  description: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  sort_order: number;
  created_at: string;
}

// Notification
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// User Settings
export interface UserSettings {
  id: string;
  user_id: string;
  default_currency: string;
  date_format: string;
  language: string;
  timezone: string;
  email_notifications: boolean;
  weekly_reports: boolean;
  error_alerts: boolean;
  theme: string;
  created_at: string;
  updated_at: string;
}

// Dashboard Stats
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
