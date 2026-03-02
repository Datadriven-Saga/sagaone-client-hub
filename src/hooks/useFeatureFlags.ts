import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlag {
  id: string;
  flag_key: string;
  flag_label: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
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

  return { flags, loading, reload: loadFlags, isEnabled };
}
