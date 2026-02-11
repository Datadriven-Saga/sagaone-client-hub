import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useMfaMaster() {
  const { user } = useAuth();
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsMaster(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      try {
        // Check mfa_master_users table
        const { data, error } = await supabase.rpc("is_mfa_master", { check_user_id: user.id });
        if (!error && data) { setIsMaster(true); setLoading(false); return; }
        
        // Also check if tipo_acesso is 'Master'
        const { data: profile } = await supabase
          .from("profiles")
          .select("tipo_acesso")
          .eq("id", user.id)
          .single();
        if (profile?.tipo_acesso === "Master") { setIsMaster(true); setLoading(false); return; }
        
        setIsMaster(false);
      } catch {
        setIsMaster(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [user]);

  const logAction = useCallback(async (
    action: string,
    accountId?: string,
    accountIssuer?: string,
    targetUserId?: string,
    targetUserEmail?: string,
    details?: Record<string, unknown>
  ) => {
    if (!user) return;
    try {
      // Get user info
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", user.id)
        .single();

      await supabase.from("mfa_audit_logs" as any).insert({
        user_id: user.id,
        user_email: user.email || "",
        user_name: profile?.nome_completo || user.email || "",
        action,
        account_id: accountId || null,
        account_issuer: accountIssuer || null,
        target_user_id: targetUserId || null,
        target_user_email: targetUserEmail || null,
        details: details || null,
      });
    } catch (err) {
      console.error("[MFA Audit] Log error:", err);
    }
  }, [user]);

  return { isMaster, loading, logAction };
}
