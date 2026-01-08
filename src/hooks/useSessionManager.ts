import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearAuthData } from './useUserPreferences';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const SESSION_START_KEY = 'session_start_time';

interface UseSessionManagerProps {
  onSessionExpired: () => void;
  onAppClosed: () => void;
  isAuthenticated: boolean;
}

export function useSessionManager({ 
  onSessionExpired, 
  onAppClosed,
  isAuthenticated 
}: UseSessionManagerProps) {
  const expirationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  // Clear session data completely
  const clearSession = useCallback(async () => {
    // Clear the expiration timer
    if (expirationTimerRef.current) {
      clearTimeout(expirationTimerRef.current);
      expirationTimerRef.current = null;
    }
    
    // Remove session start time
    sessionStorage.removeItem(SESSION_START_KEY);
    sessionStartRef.current = null;
    
    // Clear auth data from storage
    clearAuthData();
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  // Start session timer
  const startSessionTimer = useCallback(() => {
    // Clear any existing timer
    if (expirationTimerRef.current) {
      clearTimeout(expirationTimerRef.current);
    }

    // Get or set session start time
    let sessionStart = sessionStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      sessionStart = Date.now().toString();
      sessionStorage.setItem(SESSION_START_KEY, sessionStart);
    }
    sessionStartRef.current = parseInt(sessionStart, 10);

    // Calculate remaining time
    const elapsed = Date.now() - sessionStartRef.current;
    const remaining = SESSION_DURATION_MS - elapsed;

    if (remaining <= 0) {
      // Session already expired
      clearSession().then(onSessionExpired);
      return;
    }

    // Set timer for session expiration
    expirationTimerRef.current = setTimeout(() => {
      clearSession().then(onSessionExpired);
    }, remaining);
  }, [clearSession, onSessionExpired]);

  // Handle visibility change (tab hidden, app minimized, etc.)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App is being hidden/minimized - clear session
        clearSession().then(onAppClosed);
      }
    };

    const handleBeforeUnload = () => {
      // App is being closed - clear session synchronously
      sessionStorage.removeItem(SESSION_START_KEY);
      clearAuthData();
    };

    const handlePageHide = () => {
      // More reliable than beforeunload for mobile
      sessionStorage.removeItem(SESSION_START_KEY);
      clearAuthData();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isAuthenticated, clearSession, onAppClosed]);

  // Start/stop session timer based on authentication
  useEffect(() => {
    if (isAuthenticated) {
      startSessionTimer();
    } else {
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current);
        expirationTimerRef.current = null;
      }
    }

    return () => {
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current);
      }
    };
  }, [isAuthenticated, startSessionTimer]);

  // Check session on mount
  useEffect(() => {
    if (isAuthenticated) {
      const sessionStart = sessionStorage.getItem(SESSION_START_KEY);
      if (sessionStart) {
        const elapsed = Date.now() - parseInt(sessionStart, 10);
        if (elapsed >= SESSION_DURATION_MS) {
          // Session expired while app was closed
          clearSession().then(onSessionExpired);
        }
      }
    }
  }, [isAuthenticated, clearSession, onSessionExpired]);

  return {
    clearSession,
    startSessionTimer,
  };
}
