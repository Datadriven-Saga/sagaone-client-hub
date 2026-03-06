import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlag {
  id: string;
  flag_key: string;
  flag_label: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  scope: string;
  updated_at: string;
  updated_by: string | null;
}

export interface FeatureFlagEmpresa {
  id: string;
  flag_id: string;
  empresa_id: string;
  is_enabled: boolean;
  created_at: string;
  empresa_nome?: string;
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_feature_flags")
        .select("*")
        .order("category")
        .order("flag_label");
      if (error) throw error;
      setFlags((data as FeatureFlag[]) || []);
    } catch (err) {
      console.error("Erro ao carregar feature flags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const isEnabled = useCallback(
    (key: string): boolean => {
      const flag = flags.find((f) => f.flag_key === key);
      return flag?.is_enabled ?? false;
    },
    [flags]
  );

  /** Check if a per_empresa flag is enabled for a specific empresa */
  const isEnabledForEmpresa = useCallback(
    async (key: string, empresaId: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase.rpc("is_feature_enabled_for_empresa", {
          p_flag_key: key,
          p_empresa_id: empresaId,
        });
        if (error) throw error;
        return data ?? false;
      } catch (err) {
        console.error("Erro ao verificar flag por empresa:", err);
        return false;
      }
    },
    []
  );

  return { flags, loading, reload: loadFlags, isEnabled, isEnabledForEmpresa };
}
