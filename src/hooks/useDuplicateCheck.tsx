import { supabase } from "@/integrations/supabase/client";

export interface DuplicateResult {
  isDuplicate: boolean;
  existingInvoiceId?: string;
  matchedFields: string[];
}

export const useDuplicateCheck = () => {
  const checkDuplicate = async (
    invoiceNumber: string | null,
    invoiceSerial: string | null,
    vendorName: string | null,
    invoiceDate: string | null
  ): Promise<DuplicateResult> => {
    if (!invoiceNumber && !invoiceSerial) {
      return { isDuplicate: false, matchedFields: [] };
    }

    try {
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, invoice_serial, vendor_name, invoice_date")
        .neq("status", "cancelled");

      // Match by invoice_number + invoice_serial (strongest indicator)
      if (invoiceNumber) {
        query = query.eq("invoice_number", invoiceNumber);
      }
      if (invoiceSerial) {
        query = query.eq("invoice_serial", invoiceSerial);
      }

      const { data, error } = await query.limit(1);

      if (error || !data || data.length === 0) {
        return { isDuplicate: false, matchedFields: [] };
      }

      const existing = data[0];
      const matchedFields: string[] = [];

      if (invoiceNumber && existing.invoice_number === invoiceNumber) {
        matchedFields.push("Invoice number");
      }
      if (invoiceSerial && existing.invoice_serial === invoiceSerial) {
        matchedFields.push("Serial");
      }
      if (vendorName && existing.vendor_name === vendorName) {
        matchedFields.push("Vendor");
      }
      if (invoiceDate && existing.invoice_date === invoiceDate) {
        matchedFields.push("Invoice date");
      }

      return {
        isDuplicate: true,
        existingInvoiceId: existing.id,
        matchedFields,
      };
    } catch (error) {
      console.error("Error checking duplicate:", error);
      return { isDuplicate: false, matchedFields: [] };
    }
  };

  return { checkDuplicate };
};
