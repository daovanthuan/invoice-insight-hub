import { useState, useEffect } from "react";
import { parse, isValid, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Invoice, InvoiceItem, InvoiceStatus } from "@/types/database";

export const useInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizeInvoiceDate = (value: unknown): string | null => {
    if (!value) return null;

    if (value instanceof Date) {
      return format(value, "yyyy-MM-dd");
    }

    if (typeof value !== "string") return null;
    const s = value.trim();
    if (!s) return null;

    // Already ISO date
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Common VN formats coming from OCR/AI
    const candidates: Array<{ fmt: string; re: RegExp }> = [
      { fmt: "dd/MM/yyyy", re: /^\d{2}\/\d{2}\/\d{4}$/ },
      { fmt: "dd-MM-yyyy", re: /^\d{2}-\d{2}-\d{4}$/ },
      { fmt: "yyyy/MM/dd", re: /^\d{4}\/\d{2}\/\d{2}$/ },
    ];

    for (const c of candidates) {
      if (!c.re.test(s)) continue;
      const d = parse(s, c.fmt, new Date());
      if (isValid(d)) return format(d, "yyyy-MM-dd");
    }

    return null;
  };

  const fetchInvoices = async () => {
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          created_by_profile:profiles!invoices_created_by_fkey(user_code),
          updated_by_profile:profiles!invoices_updated_by_fkey(user_code)
        `)
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
          invoice_date: normalizeInvoiceDate(invoiceData.invoice_date),
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

      if ("invoice_date" in updates) {
        updateData.invoice_date = normalizeInvoiceDate(updates.invoice_date);
      }

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
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);

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

