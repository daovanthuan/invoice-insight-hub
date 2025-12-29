import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type AppRole = "admin" | "user";

interface UserRoleState {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
}

export const useUserRole = (): UserRoleState => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole("user"); // Default to user if error
        } else {
          setRole(data?.role as AppRole || "user");
        }
      } catch (err) {
        console.error("Error:", err);
        setRole("user");
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
  };
};
