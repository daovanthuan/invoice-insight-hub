import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface UserSettings {
  id: string;
  user_id: string;
  date_format: string;
  default_currency: string;
  email_notifications: boolean;
  error_alerts: boolean;
  weekly_reports: boolean;
  created_at: string;
  updated_at: string;
}

const defaultSettings: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  date_format: 'dmy',
  default_currency: 'VND',
  email_notifications: true,
  error_alerts: true,
  weekly_reports: false,
};

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      } else {
        // Create default settings for new user
        const { data: newSettings, error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            ...defaultSettings,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Không thể tải cài đặt");
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user || !settings) {
      toast.error("Vui lòng đăng nhập");
      return false;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_settings")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      setSettings((prev) => prev ? { ...prev, ...updates } : null);
      toast.success("Đã lưu cài đặt");
      return true;
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Không thể lưu cài đặt");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    defaultSettings,
  };
};
