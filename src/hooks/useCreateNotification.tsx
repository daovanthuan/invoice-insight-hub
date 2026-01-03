import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Json } from "@/integrations/supabase/types";

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface CreateNotificationParams {
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  metadata?: Json;
}

export const useCreateNotification = () => {
  const { user } = useAuth();

  const createNotification = async ({
    title,
    message,
    type = 'info',
    link,
    metadata,
  }: CreateNotificationParams) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert([{
          user_id: user.id,
          title,
          message,
          type,
          link: link || null,
          metadata: metadata || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating notification:", error);
      return null;
    }
  };

  return { createNotification };
};
