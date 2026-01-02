import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Role, UserRole } from "@/types/database";

interface UserRoleState {
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  hasRole: (roleName: string) => boolean;
  hasPermission: (action: string, resource: string) => Promise<boolean>;
}

export const useUserRole = (): UserRoleState => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select(`
            id,
            user_id,
            role_id,
            created_at,
            roles:role_id (
              id,
              name,
              description,
              is_system,
              status,
              created_at,
              updated_at
            )
          `)
          .eq("user_id", user.id);

        if (error) {
          console.error("Error fetching user roles:", error);
          setRoles([]);
        } else if (data) {
          const userRoles = data
            .filter((ur: any) => ur.roles)
            .map((ur: any) => ur.roles as Role);
          setRoles(userRoles);
        }
      } catch (err) {
        console.error("Error:", err);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  const hasRole = (roleName: string): boolean => {
    return roles.some((role) => role.name === roleName && role.status === 'active');
  };

  const hasPermission = async (action: string, resource: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .rpc('has_permission', {
          _user_id: user.id,
          _action: action,
          _resource: resource
        });

      if (error) {
        console.error("Error checking permission:", error);
        return false;
      }

      return data || false;
    } catch (err) {
      console.error("Error:", err);
      return false;
    }
  };

  return {
    roles,
    loading,
    isAdmin: hasRole('admin'),
    hasRole,
    hasPermission,
  };
};
