import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Usando os tipos corretos do banco de dados
export interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  status: 'Novo' | 'Enviado' | 'Recebido' | 'Agendado' | 'Confirmado' | 'Cancelado';
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
  'Enviado': 'enviados', 
  'Recebido': 'recebidos',
  'Agendado': 'agendados',
  'Confirmado': 'confirmados',
  'Cancelado': 'cancelados'
} as const;

export const kanbanStatusMap = {
  'novo': 'Novo',
  'enviados': 'Enviado',
  'recebidos': 'Recebido', 
  'agendados': 'Agendado',
  'confirmados': 'Confirmado',
  'cancelados': 'Cancelado'
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

export const useContatoData = () => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inicializar dateFilter com valores padrão
  const getDefaultDates = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: firstDayOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  };
  
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>(getDefaultDates());
  const { user } = useAuth();
  const { toast } = useToast();

  // Buscar prospecções da empresa com filtro de data
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

  // Buscar contatos da empresa
  const fetchContatos = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Mapear status antigos para novos
      const contatosWithNewStatus = (data || []).map(contato => ({
        ...contato,
        status: (() => {
          const statusMap: Record<string, Contato['status']> = {
            'Novo': 'Novo',
            'Negociação': 'Enviado',
            'Em Contato': 'Recebido',
            'Qualificado': 'Agendado',
            'Proposta': 'Agendado',
            'Fechado': 'Confirmado',
            'Perdido': 'Cancelado'
          };
          return statusMap[contato.status] || 'Novo';
        })()
      }));
      
      setContatos(contatosWithNewStatus);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({
        title: "Erro ao carregar contatos",
        description: "Não foi possível carregar os contatos",
        variant: "destructive"
      });
    }
  };

  // Adicionar novos contatos ao banco
  const adicionarContatos = async (novosContatos: {
    nome: string;
    telefone: string;
    email?: string;
    origem: Contato['origem'];
    empresa_id?: string;
    observacoes?: string;
  }[], prospeccaoId?: string) => {
    try {
      // Buscar empresa_id do usuário logado
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil do usuário:', profileError);
        throw profileError;
      }

      const contatosParaInserir = novosContatos.map(contato => ({
        ...contato,
        status: 'Novo' as const,
        origem: contato.origem || 'Outros' as const,
        empresa_id: profile.empresa_id
      }));

      const { data, error } = await supabase
        .from('contatos')
        .insert(contatosParaInserir)
        .select();

      if (error) throw error;

      if (data) {
        // Mapear os dados inseridos para os novos status
        const dataWithNewStatus = data.map(contato => ({
          ...contato,
          status: 'Novo' as Contato['status']
        }));
        
        setContatos(prev => [...dataWithNewStatus, ...prev]);
        
        // Disparar gatilho para cada novo contato adicionado
        if (prospeccaoId) {
          for (const contato of data) {
            console.log('Disparando webhook para contato:', contato);
            try {
              const webhookResult = await supabase.functions.invoke('trigger-webhook', {
                body: {
                  gatilho: 'novo_contato_prospeccao',
                  dados: {
                    prospeccao_id: prospeccaoId,
                    contato_id: contato.id,
                    nome: contato.nome,
                    telefone: contato.telefone,
                    email: contato.email,
                    status: contato.status
                  }
                }
              });
              console.log('Resultado do webhook:', webhookResult);
            } catch (webhookError) {
              console.error('Erro ao disparar webhook:', webhookError);
            }
          }
        }
        
        return data;
      }
    } catch (error) {
      console.error('Erro ao adicionar contatos:', error);
      toast({
        title: "Erro ao adicionar contatos",
        description: "Não foi possível adicionar os contatos ao banco",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Criar nova prospecção
  const criarProspeccao = async (dadosProspeccao: {
    titulo: string;
    descricao?: string;
    data_inicio?: string;
    data_fim?: string;
    meta_leads?: number;
    local_evento?: string;
    condicoes_especiais?: string;
    objetivo_vendas?: string;
    imagem_divulgacao_url?: string;
  }) => {
    console.log('criarProspeccao called with:', dadosProspeccao);
    console.log('Current user:', user);
    console.log('User authenticated:', !!user);
    console.log('User ID:', user?.id);
    
    if (!user) {
      console.error('User not authenticated');
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para criar uma prospecção",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Buscar empresa_id do usuário logado
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil do usuário:', profileError);
        throw profileError;
      }

      const prospeccaoData = {
        ...dadosProspeccao,
        leads_gerados: 0,
        responsavel_id: user?.id,
        empresa_id: profile.empresa_id
      };

      console.log('Data to insert:', prospeccaoData);

      const { data, error } = await supabase
        .from('prospeccoes')
        .insert([prospeccaoData])
        .select()
        .single();

      console.log('Supabase response:', { data, error });

      if (error) throw error;

      if (data) {
        setProspeccoes(prev => [data, ...prev]);
        toast({
          title: "Sucesso",
          description: "Prospecção criada com sucesso!"
        });
        return data;
      }
    } catch (error) {
      console.error('Erro ao criar prospecção:', error);
      toast({
        title: "Erro ao criar prospecção",
        description: "Não foi possível criar a prospecção. Verifique se você está logado.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Atualizar status do contato
  const atualizarStatusContato = async (contatoId: string, novoStatus: Contato['status']) => {
    try {
      // Mapear novo status para status do banco
      const statusMap: Record<Contato['status'], string> = {
        'Novo': 'Novo',
        'Enviado': 'Negociação',
        'Recebido': 'Em Contato',
        'Agendado': 'Qualificado',
        'Confirmado': 'Fechado',
        'Cancelado': 'Perdido'
      };
      
      const { error } = await supabase
        .from('contatos')
        .update({ 
          status: statusMap[novoStatus] as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', contatoId);

      if (error) throw error;

      setContatos(prev => prev.map(contato => 
        contato.id === contatoId 
          ? { ...contato, status: novoStatus, updated_at: new Date().toISOString() }
          : contato
      ));
    } catch (error) {
      console.error('Erro ao atualizar status do contato:', error);
      toast({
        title: "Erro ao atualizar contato",
        description: "Não foi possível atualizar o status do contato",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Excluir contato
  const excluirContato = async (contatoId: string) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', contatoId);

      if (error) throw error;

      setContatos(prev => prev.filter(contato => contato.id !== contatoId));
      
      toast({
        title: "Contato excluído",
        description: "O contato foi removido com sucesso"
      });
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      toast({
        title: "Erro ao excluir contato",
        description: "Não foi possível excluir o contato",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Atribuir responsável ao contato
  const atribuirResponsavel = async (contatoId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('contatos')
        .update({ 
          responsavel_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', contatoId);

      if (error) throw error;

      setContatos(prev => prev.map(contato => 
        contato.id === contatoId 
          ? { ...contato, responsavel_id: userId, updated_at: new Date().toISOString() }
          : contato
      ));

      toast({
        title: "Responsável atribuído",
        description: "O responsável foi definido com sucesso"
      });
    } catch (error) {
      console.error('Erro ao atribuir responsável:', error);
      toast({
        title: "Erro ao atribuir responsável",
        description: "Não foi possível atribuir o responsável",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Calcular métricas dos contatos
  const getMetricas = () => {
    const metricas = contatos.reduce((acc, contato) => {
      const status = contato.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalBase: contatos.length,
      novo: metricas['Novo'] || 0,
      enviados: metricas['Enviado'] || 0,
      recebidos: metricas['Recebido'] || 0,
      agendados: metricas['Agendado'] || 0,
      confirmados: metricas['Confirmado'] || 0,
      cancelados: metricas['Cancelado'] || 0
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchProspeccoes(),
        fetchContatos()
      ]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user]);

  // Função para atualizar filtro de data com verificação de mudança
  const updateDateFilter = (start: string, end: string) => {
    // Só atualizar se os valores realmente mudaram
    if (dateFilter.start !== start || dateFilter.end !== end) {
      setDateFilter({ start, end });
    }
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
    refetch: () => {
      fetchProspeccoes();
      fetchContatos();
    }
  };
};