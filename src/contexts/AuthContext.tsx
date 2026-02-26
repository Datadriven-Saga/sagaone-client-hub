import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthData } from "@/hooks/useUserPreferences";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours max session
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour of inactivity
const SESSION_START_KEY = 'session_start_time';
const LAST_ACTIVITY_KEY = 'last_activity_time';
const ALLOWED_DOMAIN = '@gruposaga.com.br';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authUser: User | null; // Alias para compatibilidade
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithAzure: () => Promise<{ error: any }>;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

// Função para validar domínio do email
const isValidDomain = (email: string | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase());
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear session completely
  const clearSession = useCallback(async () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    sessionStorage.removeItem(SESSION_START_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
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

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    
    // Reset inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      console.log('Session expired due to inactivity');
      handleSessionExpired();
    }, INACTIVITY_TIMEOUT_MS);
  }, [handleSessionExpired]);

  // Start session timer (8 hour max)
  const startSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
    }

    let sessionStart = sessionStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      sessionStart = Date.now().toString();
      sessionStorage.setItem(SESSION_START_KEY, sessionStart);
    }

    const elapsed = Date.now() - parseInt(sessionStart, 10);
    const remaining = SESSION_DURATION_MS - elapsed;

    if (remaining <= 0) {
      console.log('Session expired after 8 hours');
      handleSessionExpired();
      return;
    }

    sessionTimerRef.current = setTimeout(() => {
      console.log('Session expired after 8 hours');
      handleSessionExpired();
    }, remaining);

    // Also start inactivity timer
    updateActivity();
  }, [handleSessionExpired, updateActivity]);

  // Track user activity
  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    
    // Throttle activity updates to avoid excessive calls
    let lastUpdate = 0;
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate > 30000) { // Update at most every 30 seconds
        lastUpdate = now;
        updateActivity();
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, throttledUpdate, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledUpdate);
      });
    };
  }, [user, updateActivity]);

  // Session management
  useEffect(() => {
    if (!user) return;

    startSessionTimer();

    return () => {
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [user, startSessionTimer]);

  // Check session validity on mount and when tab becomes visible
  useEffect(() => {
    const checkSession = () => {
      const sessionStart = sessionStorage.getItem(SESSION_START_KEY);
      const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);
      const now = Date.now();

      // Check if session expired (8 hours)
      if (sessionStart) {
        const sessionElapsed = now - parseInt(sessionStart, 10);
        if (sessionElapsed >= SESSION_DURATION_MS) {
          console.log('Session expired on check (8 hours)');
          handleSessionExpired();
          return;
        }
      }

      // Check if inactive for too long (1 hour)
      if (lastActivity) {
        const inactiveTime = now - parseInt(lastActivity, 10);
        if (inactiveTime >= INACTIVITY_TIMEOUT_MS) {
          console.log('Session expired on check (1 hour inactivity)');
          handleSessionExpired();
          return;
        }
      }

      // If still valid, restart timers
      if (user) {
        startSessionTimer();
      }
    };

    // Check when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial check
    checkSession();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, handleSessionExpired, startSessionTimer]);

  // Validar domínio após autenticação
  const validateAndSetUser = useCallback(async (session: Session | null) => {
    if (session?.user) {
      const email = session.user.email;
      
      // Validar domínio
      if (!isValidDomain(email)) {
        console.log('Invalid domain detected:', email);
        toast.error(`Acesso negado. Apenas emails do domínio ${ALLOWED_DOMAIN} são permitidos.`);
        await clearSession();
        setUser(null);
        setSession(null);
        navigate('/login', { replace: true });
        return;
      }
      
      setSession(session);
      setUser(session.user);
    } else {
      setSession(null);
      setUser(null);
    }
    setLoading(false);
  }, [clearSession, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          clearAuthData();
          setSession(null);
          setUser(null);
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Defer domain validation to avoid deadlock
          setTimeout(() => {
            validateAndSetUser(session);
          }, 0);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      validateAndSetUser(session);
    });

    return () => subscription.unsubscribe();
  }, [validateAndSetUser]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
      const now = Date.now().toString();
      sessionStorage.setItem(SESSION_START_KEY, now);
      sessionStorage.setItem(LAST_ACTIVITY_KEY, now);
    }
    
    return { error };
  };

  const signInWithAzure = async () => {
    // Use skipBrowserRedirect + window.open to avoid iframe blocking by Microsoft
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'email profile openid',
        skipBrowserRedirect: true,
      },
    });
    
    if (data?.url && !error) {
      // Open in new tab to bypass iframe restrictions (preview environment)
      window.open(data.url, '_blank');
    }
    
    return { error };
  };

  const signOut = async () => {
    await clearSession();
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = useMemo(() => ({
    user,
    authUser: user, // Alias para compatibilidade
    session,
    loading,
    signIn,
    signInWithAzure,
    signInWithMagicLink,
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