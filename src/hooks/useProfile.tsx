import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Profile } from "@/types/database";

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data as Profile | null);
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Không thể tải thông tin hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      return false;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, ...updates } : null);
      toast.success("Đã cập nhật hồ sơ");
      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Không thể cập nhật hồ sơ");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return {
    profile,
    loading,
    saving,
    updateProfile,
    refetch: fetchProfile,
  };
};
