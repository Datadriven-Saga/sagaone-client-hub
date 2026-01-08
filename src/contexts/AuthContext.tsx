import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useSessionManager } from "@/hooks/useSessionManager";
import { clearAuthData } from "@/hooks/useUserPreferences";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithAzure: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setSession(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  // Handle app closed/hidden
  const handleAppClosed = useCallback(() => {
    setUser(null);
    setSession(null);
    // Navigation will happen on next app open since session is cleared
  }, []);

  // Use session manager
  useSessionManager({
    onSessionExpired: handleSessionExpired,
    onAppClosed: handleAppClosed,
    isAuthenticated: !!user,
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Clear auth data on sign out
        if (event === 'SIGNED_OUT') {
          clearAuthData();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      // Store session start time on successful login
      sessionStorage.setItem('session_start_time', Date.now().toString());
    }
    
    return { error };
  };

  const signInWithAzure = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'email profile openid',
      },
    });
    return { error };
  };

  const signOut = async () => {
    clearAuthData();
    sessionStorage.removeItem('session_start_time');
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signIn,
    signInWithAzure,
    signOut,
    resetPassword,
  }), [user, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Wrapper that handles the case when Router is not available
export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}