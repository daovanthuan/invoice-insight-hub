import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface InvoiceRecord {
  id: string;
  vendor_name: string | null;
  vendor_tax_id: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  buyer_address: string | null;
  invoice_id: string | null;
  invoice_serial: string | null;
  invoice_date: string | null;
  payment_method: string | null;
  currency: string | null;
  subtotal: string | null;
  tax_rate: string | null;
  tax_amount: string | null;
  total_amount: string | null;
  amount_in_words: string | null;
  status: string | null;
  file_name: string | null;
  file_path: string | null;
  raw_json: any;
  extend: any;
  created_at: string;
  updated_at: string;
}

export interface LineItemRecord {
  id: string;
  invoice_id: string;
  item_code: string | null;
  description: string | null;
  unit: string | null;
  quantity: string | null;
  unit_price: string | null;
  amount: string | null;
}

export const useInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Không thể tải danh sách hóa đơn");
    } finally {
      setLoading(false);
    }
  };

  const fetchLineItems = async (invoiceId: string): Promise<LineItemRecord[]> => {
    try {
      const { data, error } = await supabase
        .from("line_items")
        .select("*")
        .eq("invoice_id", invoiceId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching line items:", error);
      return [];
    }
  };

  const createInvoice = async (invoiceData: Partial<InvoiceRecord>, lineItems?: Partial<LineItemRecord>[]) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để tạo hóa đơn");
      return null;
    }

    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          ...invoiceData,
          user_id: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      if (lineItems && lineItems.length > 0 && invoice) {
        const lineItemsWithInvoiceId = lineItems.map(item => ({
          ...item,
          invoice_id: invoice.id,
        }));

        const { error: lineItemsError } = await supabase
          .from("line_items")
          .insert(lineItemsWithInvoiceId);

        if (lineItemsError) {
          console.error("Error inserting line items:", lineItemsError);
        }
      }

      await fetchInvoices();
      return invoice;
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Không thể tạo hóa đơn");
      return null;
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", invoiceId);

      if (error) throw error;
      await fetchInvoices();
    } catch (error) {
      console.error("Error updating invoice status:", error);
      toast.error("Không thể cập nhật trạng thái hóa đơn");
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId);

      if (error) throw error;
      await fetchInvoices();
      toast.success("Đã xóa hóa đơn");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Không thể xóa hóa đơn");
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  return {
    invoices,
    loading,
    fetchInvoices,
    fetchLineItems,
    createInvoice,
    updateInvoiceStatus,
    deleteInvoice,
  };
};
