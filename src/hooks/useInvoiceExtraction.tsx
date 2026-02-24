import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedData {
  core: {
    vendor_name?: string;
    vendor_tax_id?: string;
    vendor_address?: string;
    vendor_phone?: string;
    vendor_fax?: string;
    vendor_account_no?: string;
    buyer_name?: string;
    buyer_tax_id?: string;
    buyer_address?: string;
    buyer_account_no?: string;
    invoice_id?: string;
    invoice_serial?: string;
    invoice_date?: string;
    payment_method?: string;
    currency?: string;
    exchange_rate?: string;
    tax_authority_code?: string;
    lookup_code?: string;
    lookup_url?: string;
    subtotal?: string;
    tax_rate?: string;
    tax_amount?: string;
    total_amount?: string;
    amount_in_words?: string;
    line_items?: Array<{
      item_code?: string;
      description?: string;
      unit?: string;
      quantity?: string;
      unit_price?: string;
      amount?: string;
    }>;
  };
  extend?: Record<string, any>;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 string
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const extractInvoiceAsync = async (file: File): Promise<ExtractedData | null> => {
  try {
    // Validate file type - support images and PDFs
    const validImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const isPdf = file.type === "application/pdf";

    if (!isPdf && !validImageTypes.includes(file.type)) {
      toast.error("Chỉ hỗ trợ file ảnh (PNG, JPG, WEBP) hoặc PDF");
      return null;
    }

    // Convert file to base64
    const fileBase64 = await fileToBase64(file);
    const mimeType = file.type;

    // Call edge function - send file directly, let AI handle PDF
    const { data, error } = await supabase.functions.invoke("extract-invoice", {
      body: {
        imageBase64: fileBase64,
        mimeType,
      },
    });

    if (error) {
      console.error("Extraction error:", error);
      toast.error("Lỗi khi trích xuất hóa đơn");
      return null;
    }

    if (!data?.success) {
      toast.error(data?.error || "Không thể trích xuất dữ liệu từ hóa đơn");
      return null;
    }

    toast.success("Trích xuất hóa đơn thành công!");

    // Attach confidence_score to the returned data
    const result = data.data as ExtractedData;
    (result as any).confidence_score = data.confidence_score ?? null;
    return result;
  } catch (error) {
    console.error("Extraction error:", error);
    toast.error("Đã xảy ra lỗi khi trích xuất hóa đơn");
    return null;
  }
};

export const useInvoiceExtraction = () => {
  const [extractingCount, setExtractingCount] = useState(0);

  const extractInvoice = async (file: File): Promise<ExtractedData | null> => {
    setExtractingCount((prev) => prev + 1);
    try {
      return await extractInvoiceAsync(file);
    } finally {
      setExtractingCount((prev) => prev - 1);
    }
  };

  return {
    extractInvoice,
    isExtracting: extractingCount > 0,
  };
};
