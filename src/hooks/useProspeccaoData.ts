import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

// Usando os tipos corretos do banco de dados
export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  status: 'Novo' | 'Negociação' | 'Em Contato' | 'Qualificado' | 'Proposta' | 'Fechado' | 'Perdido';
  valor_potencial?: number;
  responsavel_id?: string;
  cliente_id?: string;
  empresa_id?: string;
  observacoes?: string;
  origem: 'Site' | 'WhatsApp' | 'Instagram' | 'Facebook' | 'Google' | 'Indicação' | 'Telefone' | 'Email' | 'Outros';
  created_at: string;
  updated_at: string;
}

// Mapeamento dos status do banco para as colunas do Kanban
export const statusKanbanMap = {
  'Novo': 'novo',
  'Negociação': 'enviados', 
  'Em Contato': 'recebidos',
  'Qualificado': 'respondidos',
  'Proposta': 'agendados',
  'Fechado': 'confirmados',
  'Perdido': 'cancelados'
} as const;

export const kanbanStatusMap = {
  'novo': 'Novo',
  'enviados': 'Negociação',
  'recebidos': 'Em Contato', 
  'respondidos': 'Qualificado',
  'agendados': 'Proposta',
  'confirmados': 'Fechado',
  'cancelados': 'Perdido'
} as const;

export interface Prospeccao {
  id: string;
  titulo: string;
  descricao?: string;
  data_inicio?: string;
  data_fim?: string;
  meta_leads?: number;
  leads_gerados: number;
  responsavel_id?: string;
  empresa_id?: string;
  persona_id?: string;
  created_at: string;
  updated_at: string;
}

export const useProspeccaoData = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Buscar prospecções da empresa
  const fetchProspeccoes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('prospeccoes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProspeccoes(data || []);
    } catch (error) {
      console.error('Erro ao buscar prospecções:', error);
      toast({
        title: "Erro ao carregar prospecções",
        description: "Não foi possível carregar as prospecções",
        variant: "destructive"
      });
    }
  };

  // Buscar leads da empresa
  const fetchLeads = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
      toast({
        title: "Erro ao carregar leads",
        description: "Não foi possível carregar os leads",
        variant: "destructive"
      });
    }
  };

  // Adicionar novos leads ao banco
  const adicionarLeads = async (novosLeads: {
    nome: string;
    telefone: string;
    email?: string;
    origem: Lead['origem'];
    empresa_id?: string;
    observacoes?: string;
  }[]) => {
    try {
      const leadsParaInserir = novosLeads.map(lead => ({
        ...lead,
        status: 'Novo' as const,
        origem: lead.origem || 'Outros' as const
      }));

      const { data, error } = await supabase
        .from('leads')
        .insert(leadsParaInserir)
        .select();

      if (error) throw error;

      if (data) {
        setLeads(prev => [...data, ...prev]);
        return data;
      }
    } catch (error) {
      console.error('Erro ao adicionar leads:', error);
      toast({
        title: "Erro ao adicionar leads",
        description: "Não foi possível adicionar os leads ao banco",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Atualizar status do lead
  const atualizarStatusLead = async (leadId: string, novoStatus: Lead['status']) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: novoStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, status: novoStatus, updated_at: new Date().toISOString() }
          : lead
      ));
    } catch (error) {
      console.error('Erro ao atualizar status do lead:', error);
      toast({
        title: "Erro ao atualizar lead",
        description: "Não foi possível atualizar o status do lead",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Calcular métricas dos leads
  const getMetricas = () => {
    const metricas = leads.reduce((acc, lead) => {
      const status = lead.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalBase: leads.length,
      novo: metricas['Novo'] || 0,
      enviados: metricas['Negociação'] || 0,
      recebidos: metricas['Em Contato'] || 0,
      respondidos: metricas['Qualificado'] || 0,
      agendados: metricas['Proposta'] || 0,
      confirmados: metricas['Fechado'] || 0,
      cancelados: metricas['Perdido'] || 0
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchProspeccoes(),
        fetchLeads()
      ]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user]);

  return {
    leads,
    prospeccoes,
    loading,
    adicionarLeads,
    atualizarStatusLead,
    getMetricas,
    refetch: () => {
      fetchProspeccoes();
      fetchLeads();
    }
  };
};