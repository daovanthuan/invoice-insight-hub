import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export interface BrokerExtractionResult {
  data: Record<string, string>;
  extend: Record<string, unknown>;
  confidence_score: number;
  raw: unknown;
}

export function useBrokerExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);

  const extractBroker = async (file: File): Promise<BrokerExtractionResult | null> => {
    setIsExtracting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-broker-invoice", {
        body: { fileBase64, mimeType: file.type, fileName: file.name },
      });
      if (error) {
        console.error("Broker extraction error:", error);
        toast.error(error.message || "Không thể trích xuất hóa đơn broker");
        return null;
      }
      if ((data as any)?.error) {
        toast.error((data as any).error);
        return null;
      }
      return data as BrokerExtractionResult;
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi trích xuất hóa đơn broker");
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  return { extractBroker, isExtracting };
}