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
  id_maia?: string;
}

export interface NovaVisita {
  nome_cliente: string;
  telefone_cliente: string;
  nome_campanha: string;
  empresa_id: string;
  id_maia?: string;
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
      // 1. Inserir a visita na tabela recepcao_visitas
      const { data, error } = await supabase
        .from("recepcao_visitas")
        .insert([novaVisita])
        .select()
        .single();

      if (error) throw error;

      // 2. Buscar contato existente com o mesmo telefone
      const { data: contatosExistentes, error: searchError } = await supabase
        .from("contatos")
        .select("id, status")
        .eq("empresa_id", novaVisita.empresa_id)
        .eq("telefone", novaVisita.telefone_cliente);

      if (searchError) throw searchError;

      if (contatosExistentes && contatosExistentes.length > 0) {
        // 3a. Se existe, atualizar status para Check-in
        const contatoId = contatosExistentes[0].id;
        const { error: updateError } = await supabase
          .from("contatos")
          .update({ 
            status: "Check-in" as any,
            updated_at: new Date().toISOString() 
          })
          .eq("id", contatoId);

        if (updateError) throw updateError;

        toast({
          title: "Visita registrada",
          description: "Cliente movido para Check-in no Kanban.",
        });
      } else {
        // 3b. Se não existe, criar novo contato com status Check-in
        const { error: insertError } = await supabase
          .from("contatos")
          .insert([{
            nome: novaVisita.nome_cliente,
            telefone: novaVisita.telefone_cliente,
            empresa_id: novaVisita.empresa_id,
            status: "Check-in" as any,
            origem: "Outros" as any,
            observacoes: `Visita registrada via recepção - Campanha: ${novaVisita.nome_campanha}`
          }]);

        if (insertError) throw insertError;

        toast({
          title: "Visita registrada",
          description: "Novo cliente criado na coluna Check-in do Kanban.",
        });
      }

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
