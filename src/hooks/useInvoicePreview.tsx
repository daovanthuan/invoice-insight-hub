import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useInvoicePreview = () => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const getPreviewUrl = async (
    filePath: string | null,
    bucket: string = "invoices"
  ): Promise<string | null> => {
    if (!filePath) {
      toast.error("Không có file gốc cho hóa đơn này");
      return null;
    }

    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // 1 hour

      if (error) {
        console.error("Error getting signed URL:", error);
        toast.error("Không thể tải file gốc");
        return null;
      }

      setPreviewUrl(data.signedUrl);
      return data.signedUrl;
    } catch (error) {
      console.error("Error:", error);
      toast.error("Lỗi khi tải file gốc");
      return null;
    } finally {
      setLoadingPreview(false);
    }
  };

  const clearPreview = () => setPreviewUrl(null);

  return { previewUrl, loadingPreview, getPreviewUrl, clearPreview };
};
