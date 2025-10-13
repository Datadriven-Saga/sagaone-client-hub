import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export interface RecepcaoVisita {
  id: string;
  nome_cliente: string;
  telefone_cliente: string;
  nome_campanha: string;
  empresa_id: string;
  data_hora_visita: string;
  created_at: string;
}

export interface NovaVisita {
  nome_cliente: string;
  telefone_cliente: string;
  nome_campanha: string;
  empresa_id: string;
}

export const useRecepcaoData = () => {
  const [visitas, setVisitas] = useState<RecepcaoVisita[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { toast } = useToast();

  const fetchVisitas = async () => {
    if (!activeCompany) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("recepcao_visitas")
        .select("*")
        .eq("empresa_id", activeCompany.id)
        .order("data_hora_visita", { ascending: false });

      if (error) throw error;

      setVisitas(data || []);
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
      toast({
        title: "Erro ao carregar visitas",
        description: "Não foi possível carregar a lista de visitas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitas();
  }, [activeCompany, user]);

  const adicionarVisita = async (novaVisita: NovaVisita): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("recepcao_visitas")
        .insert([novaVisita])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Visita registrada",
        description: "A visita foi registrada com sucesso.",
      });

      await fetchVisitas();
    } catch (error) {
      console.error("Erro ao adicionar visita:", error);
      toast({
        title: "Erro ao registrar visita",
        description: "Não foi possível registrar a visita.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const excluirVisita = async (visitaId: string) => {
    try {
      const { error } = await supabase
        .from("recepcao_visitas")
        .delete()
        .eq("id", visitaId);

      if (error) throw error;

      toast({
        title: "Visita excluída",
        description: "A visita foi removida com sucesso.",
      });

      await fetchVisitas();
    } catch (error) {
      console.error("Erro ao excluir visita:", error);
      toast({
        title: "Erro ao excluir visita",
        description: "Não foi possível excluir a visita.",
        variant: "destructive",
      });
    }
  };

  return {
    visitas,
    loading,
    adicionarVisita,
    excluirVisita,
    refetch: fetchVisitas,
  };
};
