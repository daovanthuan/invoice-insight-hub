import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { UserSettings } from "@/types/database";

const defaultSettings: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  date_format: 'dd/MM/yyyy',
  default_currency: 'VND',
  language: 'vi',
  timezone: 'Asia/Ho_Chi_Minh',
  email_notifications: true,
  error_alerts: true,
  weekly_reports: false,
  theme: 'system',
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
        setSettings(data as UserSettings);
      } else {
        // Settings should be created by trigger, but create if missing
        const { data: newSettings, error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            ...defaultSettings,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings as UserSettings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user || !settings) {
      toast.error("Please sign in");
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
      toast.success("Settings saved");
      return true;
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Failed to save settings");
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
