import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type TipoAcesso = Database["public"]["Enums"]["tipo_acesso"];

export function useUserAccessType() {
  const { user } = useAuth();
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTipoAcesso = async () => {
      if (!user) {
        setTipoAcesso(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("tipo_acesso")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar tipo de acesso:", error);
          setTipoAcesso(null);
        } else {
          setTipoAcesso(data?.tipo_acesso ?? null);
        }
      } catch (err) {
        console.error("Erro ao buscar tipo de acesso:", err);
        setTipoAcesso(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTipoAcesso();
  }, [user]);

  const isAdmin = tipoAcesso === "Administrador";
  const isTI = tipoAcesso === "TI";
  const isAdminOrTI = isAdmin || isTI;
  const isDiretor = tipoAcesso === "Diretor";
  const isGerente = tipoAcesso === "Gerente de Leads" || tipoAcesso === "Gerente de Loja";

  return {
    tipoAcesso,
    loading,
    isAdmin,
    isTI,
    isAdminOrTI,
    isDiretor,
    isGerente,
  };
}
