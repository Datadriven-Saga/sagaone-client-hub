import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

export interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  status: 'Novo' | 'Em Contato' | 'Qualificado' | 'Proposta' | 'Negociação' | 'Fechado' | 'Perdido';
  valor_potencial?: number;
  responsavel_email?: string;
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
  'Qualificado': 'agendados',
  'Fechado': 'confirmados',
  'Perdido': 'cancelados'
} as const;

export const kanbanStatusMap = {
  'novo': 'Novo',
  'enviados': 'Negociação',
  'recebidos': 'Em Contato', 
  'agendados': 'Qualificado',
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
  canal: 'Whatsapp' | 'Ligação';
  persona_id?: string;
  created_at: string;
  updated_at: string;
}

export const useContatoData = () => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  const { user } = useAuth();

  console.log('🏢 useContatoData - activeCompany:', activeCompany);
  console.log('👤 useContatoData - user:', user);

  // Buscar prospecções com filtro de empresa
  const fetchProspeccoes = async () => {
    if (!activeCompany?.id) {
      console.warn('useContatoData: No active company found for prospeccoes');
      setProspeccoes([]);
      return;
    }

    try {
      console.log('🔍 Fetching prospeccoes for company:', activeCompany.id);
      
      const { data, error } = await supabase
        .from('prospeccoes')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching prospeccoes:', error);
        throw error;
      }
      
      console.log('📊 Prospeccoes fetched:', data?.length || 0);
      setProspeccoes((data || []).map(p => ({
        ...p,
        canal: (p.canal as 'Whatsapp' | 'Ligação') || 'Whatsapp'
      })));
    } catch (error) {
      console.error('Erro ao buscar prospecções:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar prospecções: " + (error as Error).message,
        variant: "destructive"
      });
      setProspeccoes([]);
    }
  };

  // Buscar contatos com filtro de empresa
  const fetchContatos = async () => {
    if (!activeCompany?.id) {
      console.warn('useContatoData: No active company found for contatos');
      setContatos([]);
      return;
    }

    try {
      console.log('🔍 Fetching contatos for company:', activeCompany.id);
      
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contatos:', error);
        throw error;
      }
      
      console.log('📞 Contatos fetched:', data?.length || 0);
      setContatos(data || []);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({
        title: "Erro", 
        description: "Erro ao carregar contatos: " + (error as Error).message,
        variant: "destructive"
      });
      setContatos([]);
    }
  };

  // Carregamento de dados quando empresa ativa muda
  useEffect(() => {
    if (!user) {
      console.log('👤 User not authenticated, skipping data load');
      setLoading(false);
      return;
    }

    if (!activeCompany?.id) {
      console.log('🏢 No active company, clearing data');
      setContatos([]);
      setProspeccoes([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      console.log('🔄 Loading data for company:', activeCompany.id);
      setLoading(true);
      
      try {
        await Promise.all([
          fetchProspeccoes(),
          fetchContatos()
        ]);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeCompany?.id, user]); // Depende da empresa ativa e do usuário

  // Adicionar novos contatos com empresa_id automático
  const adicionarContatos = async (novosContatos: {
    nome: string;
    telefone: string;
    email?: string;
    origem: Contato['origem'];
    observacoes?: string;
    responsavel_email?: string;
  }[], prospeccaoId?: string) => {
    if (!activeCompany?.id) {
      toast({ 
        title: "Erro", 
        description: "Empresa não selecionada", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const contatosComEmpresa = novosContatos.map(contato => ({
        ...contato,
        status: 'Novo' as const,
        empresa_id: activeCompany.id
      }));

      console.log('➕ Adding contatos:', contatosComEmpresa);

      const { data, error } = await supabase
        .from('contatos')
        .insert(contatosComEmpresa)
        .select();

      if (error) {
        console.error('Error adding contatos:', error);
        throw error;
      }
      
      console.log('✅ Contatos added successfully:', data?.length);
      if (data) setContatos(prev => [...data, ...prev]);
      
      toast({ 
        title: "Sucesso", 
        description: `${data?.length || 0} contatos adicionados com sucesso` 
      });
    } catch (error) {
      console.error('Erro ao adicionar contatos:', error);
      toast({ 
        title: "Erro", 
        description: "Erro ao adicionar contatos: " + (error as Error).message, 
        variant: "destructive" 
      });
    }
  };

  // Atualizar status - SIMPLES
  const atualizarStatusContato = async (contatoId: string, novoStatus: Contato['status']) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .update({ status: novoStatus })
        .eq('id', contatoId);

      if (error) throw error;
      setContatos(prev => prev.map(c => c.id === contatoId ? { ...c, status: novoStatus } : c));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  // Excluir contato - SIMPLES
  const excluirContato = async (contatoId: string) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', contatoId);

      if (error) throw error;
      setContatos(prev => prev.filter(c => c.id !== contatoId));
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
    }
  };

  // Atribuir responsável - SIMPLES  
  const atribuirResponsavel = async (contatoId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .update({ responsavel_email: userId })
        .eq('id', contatoId);

      if (error) throw error;
      setContatos(prev => prev.map(c => c.id === contatoId ? { ...c, responsavel_email: userId } : c));
    } catch (error) {
      console.error('Erro ao atribuir responsável:', error);
    }
  };

  // Criar prospecção com empresa_id automático
  const criarProspeccao = async (dadosProspeccao: Omit<Prospeccao, 'id' | 'created_at' | 'updated_at' | 'leads_gerados'>) => {
    if (!activeCompany?.id) {
      throw new Error('Empresa não selecionada');
    }

    try {
      const prospeccaoComEmpresa = {
        ...dadosProspeccao,
        leads_gerados: 0,
        empresa_id: activeCompany.id
      };

      console.log('➕ Creating prospeccao:', prospeccaoComEmpresa);

      const { data, error } = await supabase
        .from('prospeccoes')
        .insert(prospeccaoComEmpresa)
        .select()
        .single();

      if (error) {
        console.error('Error creating prospeccao:', error);
        throw error;
      }
      
      if (data) {
        const prospeccaoFormatada = {
          ...data,
          canal: (data.canal as 'Whatsapp' | 'Ligação') || 'Whatsapp'
        };
        console.log('✅ Prospeccao created successfully:', prospeccaoFormatada);
        setProspeccoes(prev => [prospeccaoFormatada, ...prev]);
        toast({ 
          title: "Sucesso", 
          description: "Prospecção criada com sucesso" 
        });
        return prospeccaoFormatada;
      }
    } catch (error) {
      console.error('Erro ao criar prospecção:', error);
      toast({ 
        title: "Erro", 
        description: "Erro ao criar prospecção: " + (error as Error).message, 
        variant: "destructive" 
      });
      throw error;
    }
  };

  // Editar prospecção - SIMPLES
  const editarProspeccao = async (prospeccaoId: string, dadosAtualizados: Partial<Prospeccao>) => {
    try {
      const { data, error } = await supabase
        .from('prospeccoes')
        .update(dadosAtualizados)
        .eq('id', prospeccaoId)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const prospeccaoFormatada = {
          ...data,
          canal: (data.canal as 'Whatsapp' | 'Ligação') || 'Whatsapp'
        };
        setProspeccoes(prev => prev.map(p => p.id === prospeccaoId ? prospeccaoFormatada : p));
      }
    } catch (error) {
      console.error('Erro ao editar prospecção:', error);
      throw error;
    }
  };

  // Excluir prospecção - SIMPLES
  const excluirProspeccao = async (prospeccaoId: string) => {
    try {
      const { error } = await supabase
        .from('prospeccoes')
        .delete()
        .eq('id', prospeccaoId);

      if (error) throw error;
      setProspeccoes(prev => prev.filter(p => p.id !== prospeccaoId));
    } catch (error) {
      console.error('Erro ao excluir prospecção:', error);
      throw error;
    }
  };

  // Métricas - SIMPLES
  const getMetricas = () => {
    const totalBase = contatos.length;
    const novo = contatos.filter(c => c.status === 'Novo').length;
    const atribuidos = contatos.filter(c => c.status === 'Negociação').length;
    const convidados = contatos.filter(c => c.status === 'Em Contato').length;
    const agendados = contatos.filter(c => c.status === 'Qualificado').length;
    const confirmados = contatos.filter(c => c.status === 'Fechado').length;
    const checkin = contatos.filter(c => c.status === 'Perdido').length;
    const descartados = 0;
    const desperdicio = 0;

    return {
      totalBase,
      novo,
      atribuidos,
      convidados,
      agendados,
      confirmados,
      checkin,
      descartados,
      desperdicio
    };
  };

  const updateDateFilter = (start: string, end: string) => {
    setDateFilter({ start, end });
  };

  return {
    contatos,
    prospeccoes,
    loading,
    adicionarContatos,
    atualizarStatusContato,
    excluirContato,
    atribuirResponsavel,
    getMetricas,
    updateDateFilter,
    criarProspeccao,
    editarProspeccao,
    excluirProspeccao,
    refetch: () => {
      fetchProspeccoes();
      fetchContatos();
    }
  };
};