import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { BrokerInvoice, BrokerInvoiceStatus } from "@/types/database";

export const useBrokerInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<BrokerInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("broker_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvoices((data as unknown as BrokerInvoice[]) || []);
    } catch (e) {
      console.error("Error fetching broker invoices:", e);
      toast.error("Failed to load broker invoices");
    } finally {
      setLoading(false);
    }
  };

  const updateInvoice = async (id: string, updates: Partial<BrokerInvoice>) => {
    if (!user) {
      toast.error("Please sign in");
      return false;
    }
    try {
      const updateData: any = { ...updates, updated_by: user.id };
      if (updates.extend) updateData.extend = JSON.parse(JSON.stringify(updates.extend));
      if (updates.raw_json) updateData.raw_json = JSON.parse(JSON.stringify(updates.raw_json));
      const { error } = await supabase
        .from("broker_invoices")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      await fetchInvoices();
      return true;
    } catch (e) {
      console.error("Error updating broker invoice:", e);
      toast.error("Failed to update broker invoice");
      return false;
    }
  };

  const updateStatus = (id: string, status: BrokerInvoiceStatus) =>
    updateInvoice(id, { status });

  const deleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase.from("broker_invoices").delete().eq("id", id);
      if (error) throw error;
      await fetchInvoices();
      toast.success("Broker invoice deleted");
    } catch (e) {
      console.error("Error deleting broker invoice:", e);
      toast.error("Failed to delete broker invoice");
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

  return { invoices, loading, fetchInvoices, updateInvoice, updateStatus, deleteInvoice };
};
