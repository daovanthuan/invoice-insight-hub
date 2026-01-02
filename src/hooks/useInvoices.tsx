import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Invoice, InvoiceItem, InvoiceStatus } from "@/types/database";

export const useInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
      setInvoices((data as Invoice[]) || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Không thể tải danh sách hóa đơn");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceItems = async (invoiceId: string): Promise<InvoiceItem[]> => {
    try {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data as InvoiceItem[]) || [];
    } catch (error) {
      console.error("Error fetching invoice items:", error);
      return [];
    }
  };

  const createInvoice = async (
    invoiceData: Partial<Invoice>, 
    items?: Partial<InvoiceItem>[]
  ) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để tạo hóa đơn");
      return null;
    }

    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          ...invoiceData,
          owner_id: user.id,
          created_by: user.id,
          extend: invoiceData.extend ? JSON.parse(JSON.stringify(invoiceData.extend)) : null,
          raw_json: invoiceData.raw_json ? JSON.parse(JSON.stringify(invoiceData.raw_json)) : null,
        } as any)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      if (items && items.length > 0 && invoice) {
        const itemsWithInvoiceId = items.map((item, index) => ({
          ...item,
          invoice_id: invoice.id,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(itemsWithInvoiceId);

        if (itemsError) {
          console.error("Error inserting invoice items:", itemsError);
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

  const updateInvoice = async (invoiceId: string, updates: Partial<Invoice>) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      return false;
    }

    try {
      const updateData: any = {
        ...updates,
        updated_by: user.id,
      };
      if (updates.extend) updateData.extend = JSON.parse(JSON.stringify(updates.extend));
      if (updates.raw_json) updateData.raw_json = JSON.parse(JSON.stringify(updates.raw_json));
      
      const { error } = await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", invoiceId);

      if (error) throw error;
      await fetchInvoices();
      return true;
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Không thể cập nhật hóa đơn");
      return false;
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: InvoiceStatus) => {
    return updateInvoice(invoiceId, { status });
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
    fetchInvoiceItems,
    createInvoice,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
  };
};
