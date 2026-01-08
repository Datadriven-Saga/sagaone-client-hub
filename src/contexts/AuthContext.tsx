import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthData } from "@/hooks/useUserPreferences";
import { useNavigate } from "react-router-dom";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_START_KEY = 'session_start_time';

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
  const expirationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear session completely
  const clearSession = useCallback(async () => {
    if (expirationTimerRef.current) {
      clearTimeout(expirationTimerRef.current);
      expirationTimerRef.current = null;
    }
    sessionStorage.removeItem(SESSION_START_KEY);
    clearAuthData();
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setSession(null);
    clearSession();
    navigate('/login', { replace: true });
  }, [navigate, clearSession]);

  // Start session timer
  const startSessionTimer = useCallback(() => {
    if (expirationTimerRef.current) {
      clearTimeout(expirationTimerRef.current);
    }

    let sessionStart = sessionStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      sessionStart = Date.now().toString();
      sessionStorage.setItem(SESSION_START_KEY, sessionStart);
    }

    const elapsed = Date.now() - parseInt(sessionStart, 10);
    const remaining = SESSION_DURATION_MS - elapsed;

    if (remaining <= 0) {
      handleSessionExpired();
      return;
    }

    expirationTimerRef.current = setTimeout(() => {
      handleSessionExpired();
    }, remaining);
  }, [handleSessionExpired]);

  // Session management effects
  useEffect(() => {
    if (!user) return;

    startSessionTimer();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearSession();
        setUser(null);
        setSession(null);
      }
    };

    const handleBeforeUnload = () => {
      sessionStorage.removeItem(SESSION_START_KEY);
      clearAuthData();
    };

    const handlePageHide = () => {
      sessionStorage.removeItem(SESSION_START_KEY);
      clearAuthData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current);
      }
    };
  }, [user, startSessionTimer, clearSession]);

  // Check session validity on mount
  useEffect(() => {
    const sessionStart = sessionStorage.getItem(SESSION_START_KEY);
    if (sessionStart) {
      const elapsed = Date.now() - parseInt(sessionStart, 10);
      if (elapsed >= SESSION_DURATION_MS) {
        clearSession();
      }
    }
  }, [clearSession]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === 'SIGNED_OUT') {
          clearAuthData();
        }
      }
    );

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
      sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
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
    await clearSession();
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