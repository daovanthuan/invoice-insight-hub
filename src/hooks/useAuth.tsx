import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDisabled: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDisabled, setIsDisabled] = useState(false);

  const checkUserStatus = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking user status:', error);
        return true; // Allow access if can't check
      }

      return profile?.status === 'active';
    } catch (err) {
      console.error('Error:', err);
      return true;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Check user status after token refresh (not SIGNED_IN since Auth.tsx handles that)
        if (currentSession?.user && event === 'TOKEN_REFRESHED') {
          setTimeout(async () => {
            const isActive = await checkUserStatus(currentSession.user.id);
            if (!isActive) {
              setIsDisabled(true);
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
            } else {
              setIsDisabled(false);
            }
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      // Only check status for existing sessions (page refresh), not new logins
      if (existingSession?.user) {
        const isActive = await checkUserStatus(existingSession.user.id);
        if (!isActive) {
          setIsDisabled(true);
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsDisabled(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isDisabled, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
