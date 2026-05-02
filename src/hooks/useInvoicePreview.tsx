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
      toast.error("No source file for this invoice");
      return null;
    }

    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // 1 hour

      if (error) {
        console.error("Error getting signed URL:", error);
        toast.error("Failed to load source file");
        return null;
      }

      setPreviewUrl(data.signedUrl);
      return data.signedUrl;
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error loading source file");
      return null;
    } finally {
      setLoadingPreview(false);
    }
  };

  const clearPreview = () => setPreviewUrl(null);

  return { previewUrl, loadingPreview, getPreviewUrl, clearPreview };
};
