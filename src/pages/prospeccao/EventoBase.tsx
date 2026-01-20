import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Download, Users, Search, Filter, Send, Loader2, CheckCircle, Phone, Mail, 
  Calendar, Clock, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, MessageCircle, PhoneCall, Lock, RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserAccessType } from '@/hooks/useUserAccessType';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DispararProgressModal from '@/components/DispararProgressModal';

interface ContatoEvento {
  id: string;
  lead_id: number | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string | null;
  origem: string | null;
  created_at: string | null;
  updated_at: string | null;
  data_disparo_ia: string | null;
  responsavel_email: string | null;
  vendedor_nome: string | null;
}

interface Prospeccao {
  id: string;
  titulo: string;
  canal: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  meta_convites?: number | null;
  meta_confirmacoes?: number | null;
  meta_checkins?: number | null;
  event_id_pri?: string | null;
}

type StatusFilter = 'todos' | string;
type DisparoFilter = 'todos' | 'pendente' | 'disparado';

const statusColors: Record<string, string> = {
  'Novo': 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
  'Atribuído': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  'Convidado': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100',
  'Agendado': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  'Confirmado': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
  'Check-in': 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100',
  'Venda': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  'Descartado': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  'Opt Out': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  'Desperdício': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  'Em Espera': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
};

const PAGE_SIZE = 20;

export default function EventoBase() {
  const { eventoId } = useParams<{ eventoId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  const { isAdminOrTI, isAdmin, isTI, isCRM, loading: loadingAccess } = useUserAccessType();
  const isGerenteLeads = useUserAccessType().tipoAcesso === "Gerente de Leads";

  // Constantes de configuração de disparo
  const BATCH_SIZE = 1000; // Tamanho do lote por chamada ao webhook
  const MAX_DISPATCH_LIMIT = 5000; // Limite máximo por disparo

  // Estados
  const [prospeccao, setProspeccao] = useState<Prospeccao | null>(null);
  const [contatos, setContatos] = useState<ContatoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(searchParams.get('status') || 'todos');
  const [disparoFilter, setDisparoFilter] = useState<DisparoFilter>((searchParams.get('disparo') as DisparoFilter) || 'todos');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [metricas, setMetricas] = useState({ total: 0, pendentes: 0, disparados: 0, vendas: 0 });
  const [isDisparandoIA, setIsDisparandoIA] = useState(false);
  const [disparandoContato, setDisparandoContato] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingContatos, setIsSyncingContatos] = useState(false);
  
  // Estados do modal de progresso
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressCount, setProgressCount] = useState(0);
  const [progressCompleted, setProgressCompleted] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para disparo personalizado
  const [customDispatchCount, setCustomDispatchCount] = useState<string>('');

  // Buscar dados do evento
  useEffect(() => {
    const fetchProspeccao = async () => {
      if (!eventoId || !activeCompany?.id) return;

      const { data, error } = await supabase
        .from('prospeccoes')
        .select('id, titulo, canal, data_inicio, data_fim, meta_convites, meta_confirmacoes, meta_checkins, event_id_pri')
        .eq('id', eventoId)
        .eq('empresa_id', activeCompany.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar prospeccao:', error);
        toast({ title: "Erro", description: "Evento não encontrado", variant: "destructive" });
        navigate('/prospeccao/eventos');
        return;
      }

      if (!data) {
        toast({ title: "Erro", description: "Evento não encontrado", variant: "destructive" });
        navigate('/prospeccao/eventos');
        return;
      }

      setProspeccao(data);
    };

    fetchProspeccao();
  }, [eventoId, activeCompany?.id, navigate, toast]);

  // Buscar métricas usando função SQL otimizada (sem carregar todos os IDs)
  const fetchMetricas = useCallback(async () => {
    if (!eventoId || !activeCompany?.id) return;

    try {
      // Usar função SQL otimizada para contagens
      const { data: metricasData, error: metricasError } = await supabase
        .rpc('get_prospeccao_metricas' as any, {
          p_prospeccao_id: eventoId,
          p_empresa_id: activeCompany.id
        });

      if (metricasError) {
        console.error('Erro ao buscar métricas:', metricasError);
        return;
      }

      if (metricasData && Array.isArray(metricasData) && metricasData.length > 0) {
        const m = metricasData[0] as { total: number; pendentes: number; disparados: number; vendas: number };
        setMetricas({
          total: Number(m.total) || 0,
          pendentes: Number(m.pendentes) || 0,
          disparados: Number(m.disparados) || 0,
          vendas: Number(m.vendas) || 0
        });
        setTotalCount(Number(m.total) || 0);
      }

      // Buscar opções de status
      const { data: statusData } = await supabase
        .rpc('get_prospeccao_status_options' as any, {
          p_prospeccao_id: eventoId,
          p_empresa_id: activeCompany.id
        });

      if (statusData && Array.isArray(statusData)) {
        setStatusOptions(statusData.map((s: { status: string }) => s.status).filter(Boolean));
      }
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    }
  }, [eventoId, activeCompany?.id]);

  // Carregar métricas iniciais
  useEffect(() => {
    fetchMetricas().finally(() => setLoading(false));
  }, [fetchMetricas]);

  // Buscar contatos paginados diretamente (sem carregar todos os IDs primeiro)
  const fetchContatos = useCallback(async () => {
    if (!eventoId || !activeCompany?.id) {
      setContatos([]);
      setLoadingPage(false);
      return;
    }

    setLoadingPage(true);

    try {
      const offset = (currentPage - 1) * PAGE_SIZE;

      // Query base: join entre eventos_prospeccao e contatos
      // Aplicar filtros diretamente na query
      let query = supabase
        .from('contatos')
        .select(`
          id, lead_id, nome, telefone, email, status, origem, 
          created_at, updated_at, 
          responsavel_email, vendedor_nome,
          eventos_prospeccao!inner(prospeccao_id, data_disparo_ia)
        `)
        .eq('empresa_id', activeCompany.id)
        .eq('eventos_prospeccao.prospeccao_id', eventoId);

      // Aplicar filtros
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter as any);
      }
      if (disparoFilter === 'pendente') {
        query = query.is('eventos_prospeccao.data_disparo_ia', null);
      } else if (disparoFilter === 'disparado') {
        query = query.not('eventos_prospeccao.data_disparo_ia', 'is', null);
      }

      // Ordenar e paginar
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      // Mapear dados extraindo data_disparo_ia de eventos_prospeccao
      const cleanData = (data || []).map(({ eventos_prospeccao, ...rest }) => {
        // eventos_prospeccao é um array (inner join), pegamos o primeiro que corresponde ao evento
        const evento = Array.isArray(eventos_prospeccao) ? eventos_prospeccao[0] : eventos_prospeccao;
        return {
          ...rest,
          data_disparo_ia: evento?.data_disparo_ia || null
        };
      }) as ContatoEvento[];
      setContatos(cleanData);

      // Se temos filtros, precisamos contar o total filtrado
      if (searchTerm || statusFilter !== 'todos' || disparoFilter !== 'todos') {
        let countQuery = supabase
          .from('contatos')
          .select('id, eventos_prospeccao!inner(prospeccao_id, data_disparo_ia)', { count: 'exact', head: true })
          .eq('empresa_id', activeCompany.id)
          .eq('eventos_prospeccao.prospeccao_id', eventoId);

        if (searchTerm) {
          countQuery = countQuery.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }
        if (statusFilter !== 'todos') {
          countQuery = countQuery.eq('status', statusFilter as any);
        }
        if (disparoFilter === 'pendente') {
          countQuery = countQuery.is('eventos_prospeccao.data_disparo_ia', null);
        } else if (disparoFilter === 'disparado') {
          countQuery = countQuery.not('eventos_prospeccao.data_disparo_ia', 'is', null);
        }

        const { count: filteredCount } = await countQuery;
        setTotalCount(filteredCount || 0);
      } else {
        // Sem filtros, usar a contagem das métricas
        setTotalCount(metricas.total);
      }
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({ title: "Erro", description: "Erro ao carregar contatos", variant: "destructive" });
    } finally {
      setLoadingPage(false);
    }
  }, [eventoId, activeCompany?.id, searchTerm, statusFilter, disparoFilter, currentPage, metricas.total, toast]);

  // Executar busca quando filtros mudarem
  useEffect(() => {
    fetchContatos();
  }, [fetchContatos]);

  // Atualizar URL quando filtros mudarem
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (statusFilter !== 'todos') params.set('status', statusFilter);
    if (disparoFilter !== 'todos') params.set('disparo', disparoFilter);
    if (currentPage > 1) params.set('page', currentPage.toString());
    setSearchParams(params, { replace: true });
  }, [searchTerm, statusFilter, disparoFilter, currentPage, setSearchParams]);

  // Reset page quando filtros mudarem
  const handleFilterChange = (type: 'search' | 'status' | 'disparo', value: string) => {
    setCurrentPage(1);
    if (type === 'search') setSearchTerm(value);
    if (type === 'status') setStatusFilter(value as StatusFilter);
    if (type === 'disparo') setDisparoFilter(value as DisparoFilter);
  };

  // Exportar dados - carrega sob demanda
  const handleExport = async () => {
    if (metricas.total === 0) {
      toast({ title: "Atenção", description: "Nenhum contato para exportar" });
      return;
    }

    setIsExporting(true);
    toast({ title: "Exportando...", description: "Preparando arquivo CSV, isso pode levar alguns segundos..." });

    try {
      // Buscar todos os contatos para export (com paginação interna)
      const EXPORT_BATCH_SIZE = 1000;
      let allContatos: ContatoEvento[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('contatos')
          .select(`
            id, nome, telefone, email, status, origem, 
            created_at, updated_at, 
            responsavel_email, vendedor_nome,
            eventos_prospeccao!inner(prospeccao_id, data_disparo_ia)
          `)
          .eq('empresa_id', activeCompany!.id)
          .eq('eventos_prospeccao.prospeccao_id', eventoId!);

        // Aplicar mesmos filtros
        if (searchTerm) {
          query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }
        if (statusFilter !== 'todos') {
          query = query.eq('status', statusFilter as any);
        }
        if (disparoFilter === 'pendente') {
          query = query.is('eventos_prospeccao.data_disparo_ia', null);
        } else if (disparoFilter === 'disparado') {
          query = query.not('eventos_prospeccao.data_disparo_ia', 'is', null);
        }

        query = query
          .order('created_at', { ascending: false })
          .range(offset, offset + EXPORT_BATCH_SIZE - 1);

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          const cleanData = data.map(({ eventos_prospeccao, ...rest }) => {
            const evento = Array.isArray(eventos_prospeccao) ? eventos_prospeccao[0] : eventos_prospeccao;
            return {
              ...rest,
              data_disparo_ia: evento?.data_disparo_ia || null
            };
          }) as ContatoEvento[];
          allContatos = [...allContatos, ...cleanData];
          offset += EXPORT_BATCH_SIZE;
          hasMore = data.length === EXPORT_BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      if (allContatos.length === 0) {
        toast({ title: "Atenção", description: "Nenhum contato para exportar com os filtros aplicados" });
        return;
      }

      const csvContent = [
        'Nome,Telefone,Email,Status,Origem,Vendedor,Data Criação,Último Update,Disparo IA',
        ...allContatos.map(c => 
          `"${c.nome || ''}","${c.telefone || ''}","${c.email || ''}","${c.status || ''}","${c.origem || ''}","${c.vendedor_nome || ''}","${c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy HH:mm') : ''}","${c.updated_at ? format(new Date(c.updated_at), 'dd/MM/yyyy HH:mm') : ''}","${c.data_disparo_ia ? format(new Date(c.data_disparo_ia), 'dd/MM/yyyy HH:mm') : 'Pendente'}"`
        )
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${prospeccao?.titulo || 'evento'}_base_contatos.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({ title: "Sucesso", description: `${allContatos.length} contatos exportados` });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: "Erro", description: "Erro ao exportar contatos", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Função para buscar contagem atualizada de disparados (para polling)
  const fetchDisparadosCount = useCallback(async (): Promise<number> => {
    if (!activeCompany?.id || !eventoId) return 0;
    
    try {
      const { data } = await supabase
        .rpc('get_prospeccao_metricas' as any, {
          p_prospeccao_id: eventoId,
          p_empresa_id: activeCompany.id
        });
      
      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0] as { total: number; pendentes: number; disparados: number; vendas: number };
        return Number(result.disparados) || 0;
      }
    } catch (error) {
      console.error('Erro ao buscar contagem de disparados:', error);
    }
    return 0;
  }, [activeCompany?.id, eventoId]);

  // Buscar contatos pendentes para disparo - usando abordagem em 2 etapas para evitar limite de 1000
  const fetchContatosPendentes = async (): Promise<ContatoEvento[]> => {
    if (!activeCompany?.id || !eventoId) return [];
    
    console.log('🔍 Buscando contatos pendentes para disparo...');
    console.log('   ├─ empresa_id:', activeCompany.id);
    console.log('   └─ prospeccao_id:', eventoId);
    
    // ETAPA 1: Buscar TODOS os contato_ids pendentes da tabela eventos_prospeccao
    // Essa abordagem evita o problema de limit com joins
    const BATCH_SIZE = 1000;
    let allContatoIds: string[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: eventosData, error: eventosError } = await supabase
        .from('eventos_prospeccao')
        .select('contato_id')
        .eq('prospeccao_id', eventoId)
        .is('data_disparo_ia', null)
        .not('contato_id', 'is', null)
        .range(offset, offset + BATCH_SIZE - 1);

      if (eventosError) {
        console.error('❌ Erro ao buscar eventos pendentes:', eventosError);
        break;
      }

      if (eventosData && eventosData.length > 0) {
        const ids = eventosData.map(e => e.contato_id).filter(Boolean) as string[];
        allContatoIds = [...allContatoIds, ...ids];
        offset += BATCH_SIZE;
        hasMore = eventosData.length === BATCH_SIZE;
        console.log(`   📊 Batch ${Math.ceil(offset / BATCH_SIZE)}: ${ids.length} IDs encontrados (total: ${allContatoIds.length})`);
      } else {
        hasMore = false;
      }
    }

    console.log(`📋 Total de contato_ids pendentes: ${allContatoIds.length}`);

    if (allContatoIds.length === 0) {
      console.log('⚠️ Nenhum contato pendente encontrado');
      return [];
    }

    // ETAPA 2: Buscar dados completos dos contatos em batches de 500
    const CONTATO_BATCH_SIZE = 500;
    let allContatos: ContatoEvento[] = [];

    for (let i = 0; i < allContatoIds.length; i += CONTATO_BATCH_SIZE) {
      const batchIds = allContatoIds.slice(i, i + CONTATO_BATCH_SIZE);
      
      const { data: contatosData, error: contatosError } = await supabase
        .from('contatos')
        .select('id, lead_id, nome, telefone, email, status, origem, created_at, updated_at, responsavel_email, vendedor_nome')
        .eq('empresa_id', activeCompany.id)
        .in('id', batchIds);

      if (contatosError) {
        console.error(`❌ Erro ao buscar contatos batch ${Math.ceil(i / CONTATO_BATCH_SIZE) + 1}:`, contatosError);
        continue;
      }

      if (contatosData && contatosData.length > 0) {
        const cleanData = contatosData.map(c => ({
          ...c,
          data_disparo_ia: null
        })) as ContatoEvento[];
        allContatos = [...allContatos, ...cleanData];
        console.log(`   ✅ Batch ${Math.ceil(i / CONTATO_BATCH_SIZE) + 1}: ${contatosData.length} contatos carregados (total: ${allContatos.length})`);
      }
    }

    console.log(`🎯 Total de contatos pendentes carregados: ${allContatos.length}`);
    return allContatos;
  };

  // Iniciar polling para atualizar progresso
  const startProgressPolling = useCallback((totalToDispatch: number) => {
    // Limpar polling anterior se existir
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      const currentDisparados = await fetchDisparadosCount();
      setProgressCount(currentDisparados);
      
      // Verificar se completou
      if (currentDisparados >= metricas.total) {
        setProgressCompleted(true);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        // Atualizar métricas locais
        setMetricas(prev => ({
          ...prev,
          pendentes: 0,
          disparados: prev.total
        }));
        // Recarregar lista
        fetchContatos();
      }
    }, 5000); // A cada 5 segundos
  }, [fetchDisparadosCount, metricas.total, fetchContatos]);

  // Cleanup do polling
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Fechar modal de progresso
  const handleCloseProgressModal = () => {
    setShowProgressModal(false);
    // Não para o polling - continua em segundo plano
    // Atualizar dados e métricas quando fechar
    fetchMetricas();
    fetchContatos();
  };

  // Disparar IA com quantidade customizada ou todos - em batches de 1000 para evitar timeout
  const handleDispararIA = async (quantidade?: number) => {
    if (!prospeccao || !activeCompany?.id) return;

    setIsDisparandoIA(true);
    try {
      console.log('🚀 Iniciando disparo em massa...');
      
      // Buscar todos os contatos pendentes
      const contatosPendentes = await fetchContatosPendentes();
      
      if (contatosPendentes.length === 0) {
        toast({ title: "Atenção", description: "Nenhum contato pendente para disparar" });
        setIsDisparandoIA(false);
        return;
      }

      // Aplicar limite de quantidade se especificado
      let leadsParaDisparar = contatosPendentes;
      if (quantidade && quantidade > 0) {
        // Respeitar limite máximo de 5000
        const limitedQuantidade = Math.min(quantidade, MAX_DISPATCH_LIMIT, contatosPendentes.length);
        leadsParaDisparar = contatosPendentes.slice(0, limitedQuantidade);
        console.log(`📊 Quantidade customizada: ${limitedQuantidade} de ${contatosPendentes.length} pendentes`);
      } else {
        // Sem quantidade especificada, mas respeitando limite de 5000
        leadsParaDisparar = contatosPendentes.slice(0, MAX_DISPATCH_LIMIT);
        if (contatosPendentes.length > MAX_DISPATCH_LIMIT) {
          console.log(`⚠️ Limitando disparo a ${MAX_DISPATCH_LIMIT} (total pendente: ${contatosPendentes.length})`);
        }
      }

      console.log(`📊 Total para disparar: ${leadsParaDisparar.length}`);

      // Configurar modal de progresso
      const batchCount = Math.ceil(leadsParaDisparar.length / BATCH_SIZE);
      setProgressTotal(leadsParaDisparar.length);
      setProgressCount(0);
      setProgressCompleted(false);
      setCurrentBatch(0);
      setTotalBatches(batchCount);
      setShowProgressModal(true);

      // Formatar leads no formato esperado pela edge function
      const allLeads = leadsParaDisparar.map(c => ({
        id: c.id,
        lead_id: c.lead_id,
        nome: c.nome,
        telefone: c.telefone,
        email: c.email,
        status: c.status,
        origem: c.origem
      }));

      console.log('🚀 Disparando para IA:', { 
        total: allLeads.length, 
        empresa_id: activeCompany.id, 
        prospeccao_id: prospeccao.id,
        canal: prospeccao.canal 
      });

      // DIVIDIR EM BATCHES DE 1000 PARA EVITAR TIMEOUT DA EDGE FUNCTION
      let totalErros = 0;
      let totalSucessos = 0;

      console.log(`📦 Dividindo em ${batchCount} batches de até ${BATCH_SIZE} leads cada`);

      for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
        const batchStart = batchIndex * BATCH_SIZE;
        const leads = allLeads.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = batchIndex + 1;

        setCurrentBatch(batchNum);
        console.log(`📤 Enviando batch ${batchNum}/${batchCount} (${leads.length} leads)`);

        try {
          const { data, error } = await supabase.functions.invoke('dispatch-leads-webhook', {
            body: {
              leads,
              empresa_id: activeCompany.id,
              prospeccao_id: prospeccao.id,
              prospeccao_data: {
                titulo: prospeccao.titulo,
                canal: prospeccao.canal,
                event_id_pri: prospeccao.event_id_pri || null,
                data_inicio: prospeccao.data_inicio || null,
                data_fim: prospeccao.data_fim || null,
                template_prospeccao: (prospeccao as any).template_prospeccao || null
              }
            }
          });

          if (error) {
            console.error(`❌ Erro no batch ${batchNum}:`, error);
            totalErros += leads.length;
          } else {
            console.log(`✅ Batch ${batchNum} concluído:`, data);
            totalSucessos += data?.estatisticas?.sucessos || leads.length;
            
            // Marcar contatos como disparados na tabela eventos_prospeccao
            const leadIds = leads.map(l => l.id);
            const { error: updateError } = await supabase
              .from('eventos_prospeccao')
              .update({ data_disparo_ia: new Date().toISOString() })
              .eq('prospeccao_id', prospeccao.id)
              .in('contato_id', leadIds);

            if (updateError) {
              console.error(`Erro ao marcar batch ${batchNum} como disparados:`, updateError);
            }
          }

          // Atualizar contagem após cada batch
          setProgressCount(batchStart + leads.length);

        } catch (batchError) {
          console.error(`❌ Exceção no batch ${batchNum}:`, batchError);
          totalErros += leads.length;
        }
      }

      console.log(`📊 Disparo concluído: ${totalSucessos} sucessos, ${totalErros} erros`);

      // Marcar como completo após todos os batches
      setProgressCount(leadsParaDisparar.length);
      setProgressCompleted(true);
      
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      // Atualizar métricas do banco
      await fetchMetricas();

      // Recarregar dados
      fetchContatos();

      // Limpar campo de quantidade personalizada
      setCustomDispatchCount('');

      if (totalErros > 0) {
        toast({ 
          title: "Parcialmente concluído", 
          description: `${totalSucessos} disparados, ${totalErros} erros`,
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Sucesso", 
          description: `${totalSucessos} contatos disparados com sucesso!`
        });
      }
    } catch (error) {
      console.error('Erro ao disparar IA:', error);
      toast({ title: "Erro", description: "Erro ao iniciar disparo: " + (error as Error).message, variant: "destructive" });
      setShowProgressModal(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } finally {
      setIsDisparandoIA(false);
    }
  };

  // Função wrapper para disparar todos (até o limite de 5000)
  const handleDispararTodos = () => handleDispararIA();

  // Função para disparar quantidade personalizada
  const handleDispararPersonalizado = () => {
    const quantidade = parseInt(customDispatchCount, 10);
    if (isNaN(quantidade) || quantidade <= 0) {
      toast({ title: "Atenção", description: "Digite uma quantidade válida maior que zero" });
      return;
    }
    if (quantidade > MAX_DISPATCH_LIMIT) {
      toast({ title: "Atenção", description: `Quantidade máxima permitida: ${MAX_DISPATCH_LIMIT}` });
      return;
    }
    handleDispararIA(quantidade);
  };

  // Disparar IA para contato individual
  const handleDispararContato = async (contato: ContatoEvento) => {
    if (!prospeccao || !activeCompany?.id) return;

    setDisparandoContato(contato.id);
    try {
      // Formatar lead no formato esperado
      const leads = [{
        id: contato.id,
        lead_id: contato.lead_id,
        nome: contato.nome,
        telefone: contato.telefone,
        email: contato.email,
        status: contato.status,
        origem: contato.origem
      }];

      console.log('🚀 Disparando contato individual:', { 
        contato: contato.nome,
        empresa_id: activeCompany.id, 
        prospeccao_id: prospeccao.id,
        canal: prospeccao.canal 
      });

      const { data, error } = await supabase.functions.invoke('dispatch-leads-webhook', {
        body: {
          leads,
          empresa_id: activeCompany.id,
          prospeccao_id: prospeccao.id,
          prospeccao_data: {
            titulo: prospeccao.titulo,
            canal: prospeccao.canal,
            event_id_pri: prospeccao.event_id_pri || null,
            data_inicio: prospeccao.data_inicio || null,
            data_fim: prospeccao.data_fim || null,
            template_prospeccao: (prospeccao as any).template_prospeccao || null
          }
        }
      });

      if (error) throw error;

      console.log('✅ Resposta do disparo individual:', data);

      // Marcar disparo na tabela eventos_prospeccao (por evento, não global)
      await supabase
        .from('eventos_prospeccao')
        .update({ data_disparo_ia: new Date().toISOString() })
        .eq('prospeccao_id', prospeccao.id)
        .eq('contato_id', contato.id);

      toast({ title: "Sucesso", description: `Disparo enviado para ${contato.nome}` });

      // Atualizar contato na lista
      setContatos(prev => prev.map(c => 
        c.id === contato.id ? { ...c, data_disparo_ia: new Date().toISOString() } : c
      ));

      // Atualizar métricas
      setMetricas(prev => ({
        ...prev,
        pendentes: prev.pendentes - 1,
        disparados: prev.disparados + 1
      }));
    } catch (error) {
      console.error('Erro ao disparar IA:', error);
      toast({ title: "Erro", description: "Erro ao enviar disparo", variant: "destructive" });
    } finally {
      setDisparandoContato(null);
    }
  };

  // Redisparar contato individual (apenas Admin)
  const handleRedispararContato = async (contato: ContatoEvento) => {
    if (!prospeccao || !activeCompany?.id) return;

    setDisparandoContato(contato.id);
    try {
      // Formatar lead no formato esperado
      const leads = [{
        id: contato.id,
        lead_id: contato.lead_id,
        nome: contato.nome,
        telefone: contato.telefone,
        email: contato.email,
        status: contato.status,
        origem: contato.origem
      }];

      console.log('🔄 Redisparando contato:', { 
        contato: contato.nome,
        empresa_id: activeCompany.id, 
        prospeccao_id: prospeccao.id,
        canal: prospeccao.canal 
      });

      const { data, error } = await supabase.functions.invoke('dispatch-leads-webhook', {
        body: {
          leads,
          empresa_id: activeCompany.id,
          prospeccao_id: prospeccao.id,
          prospeccao_data: {
            titulo: prospeccao.titulo,
            canal: prospeccao.canal,
            event_id_pri: prospeccao.event_id_pri || null,
            data_inicio: prospeccao.data_inicio || null,
            data_fim: prospeccao.data_fim || null,
            template_prospeccao: (prospeccao as any).template_prospeccao || null
          }
        }
      });

      if (error) throw error;

      console.log('✅ Resposta do redisparo:', data);

      // Atualizar data_disparo_ia na tabela eventos_prospeccao
      await supabase
        .from('eventos_prospeccao')
        .update({ data_disparo_ia: new Date().toISOString() })
        .eq('prospeccao_id', prospeccao.id)
        .eq('contato_id', contato.id);

      toast({ title: "Sucesso", description: `Redisparo enviado para ${contato.nome}` });

      // Atualizar contato na lista
      setContatos(prev => prev.map(c => 
        c.id === contato.id ? { ...c, data_disparo_ia: new Date().toISOString() } : c
      ));
    } catch (error) {
      console.error('Erro ao redisparar:', error);
      toast({ title: "Erro", description: "Erro ao enviar redisparo", variant: "destructive" });
    } finally {
      setDisparandoContato(null);
    }
  };

  const syncContatosLigacao = useCallback(async (showToast = true) => {
    const canalAtual = prospeccao?.canal?.toLowerCase() || '';
    const isLigacao = canalAtual.includes('liga');
    if (!prospeccao || !activeCompany?.id || !isLigacao) return;

    setIsSyncingContatos(true);
    try {
      console.log('🔄 Iniciando sincronização automática de contatos para evento Ligação...');

      // Buscar telefone do agente Pri(Ligação) para esta empresa via agente_empresas
      let telefonePri: string | null = null;
      
      const { data: agenteEmpresa, error: aeError } = await supabase
        .from('agente_empresas')
        .select('agente_id, agentes_ia(id, telefone, nome)')
        .eq('empresa_id', activeCompany.id);

      if (aeError) {
        console.error('Erro ao buscar agentes:', aeError);
      }

      if (agenteEmpresa) {
        // Buscar especificamente Pri(Ligação)
        const agenteLigacao = agenteEmpresa.find((ae: any) => {
          const nome = ae.agentes_ia?.nome?.toLowerCase() || '';
          return nome.includes('pri') && nome.includes('liga');
        });
        
        if (agenteLigacao) {
          telefonePri = (agenteLigacao as any).agentes_ia?.telefone;
          console.log(`📞 Encontrado agente Pri(Ligação): ${(agenteLigacao as any).agentes_ia?.nome} - Tel: ${telefonePri}`);
        }
      }

      if (!telefonePri) {
        if (showToast) {
          toast({ 
            title: "Agente não configurado", 
            description: "Configure um agente Pri(Ligação) com telefone para sincronizar contatos",
            variant: "destructive" 
          });
        }
        console.warn('⚠️ Não foi possível encontrar o telefone do agente de Ligação para esta empresa');
        setIsSyncingContatos(false);
        return;
      }

      // Usar event_id_pri do evento ou o ID local
      const idEvento = prospeccao.event_id_pri || eventoId;

      console.log('📞 Sincronizando com telefone_pri:', telefonePri, 'id_evento:', idEvento);

      const { data, error } = await supabase.functions.invoke('sync-contatos-ligacao', {
        body: {
          telefone_pri: telefonePri,
          id_evento: idEvento,
          empresa_id: activeCompany.id,
          prospeccao_id: prospeccao.id,
          dry_run: false
        }
      });

      if (error) throw error;

      console.log('✅ Resultado da sincronização:', data);

      if (showToast) {
        const summary = data?.summary || {};
        toast({ 
          title: "Sincronização concluída", 
          description: `Criados: ${summary.criados || 0}, Removidos: ${summary.deletados || 0}, Mantidos: ${summary.mantidos || 0}` 
        });
      }

      // Recarregar dados
      await fetchMetricas();
      await fetchContatos();

    } catch (error) {
      console.error('Erro ao sincronizar contatos:', error);
      if (showToast) {
        toast({ 
          title: "Erro", 
          description: "Erro ao sincronizar contatos: " + (error as Error).message, 
          variant: "destructive" 
        });
      }
    } finally {
      setIsSyncingContatos(false);
    }
  }, [prospeccao, activeCompany?.id, eventoId, fetchMetricas, fetchContatos, toast]);

  // Sincronização automática de contatos para eventos de Ligação
  useEffect(() => {
    if (prospeccao && activeCompany?.id) {
      const canalAtual = prospeccao.canal?.toLowerCase() || '';
      const isLigacao = canalAtual.includes('liga');
      if (isLigacao) {
        // Sincronizar automaticamente sem toast
        syncContatosLigacao(false);
      }
    }
  }, [prospeccao?.id, activeCompany?.id]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  // Verifica se é evento de IA (WhatsApp ou Ligação)
  const canalLower = prospeccao?.canal?.toLowerCase() || '';
  const isIAWhatsApp = canalLower.includes('whatsapp');
  const isIALigacao = canalLower.includes('liga');
  const isIA = isIAWhatsApp || isIALigacao;
  
  // Permissão para disparar:
  // WhatsApp = ADM, TI, Gerente de Leads, CRM
  // Ligação = apenas ADM/TI
  const canDispatchWhatsApp = isAdmin || isTI || isGerenteLeads || isCRM;
  const canDispatchLigacao = isAdminOrTI;
  const canDispatch = loadingAccess ? false : (isIAWhatsApp ? canDispatchWhatsApp : (isIALigacao ? canDispatchLigacao : false));

  // Log para debug
  console.log('🔍 Canal:', prospeccao?.canal, '| isIALigacao:', isIALigacao, '| isIAWhatsApp:', isIAWhatsApp, '| canDispatch:', canDispatch, '| loadingAccess:', loadingAccess);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (loading && !prospeccao) {
    return (
      <DashboardLayout title="Base do Evento">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Base: ${prospeccao?.titulo || 'Evento'}`}>
      <div className="space-y-6">
        {/* Header com navegação */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/prospeccao/eventos')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                {prospeccao?.titulo}
              </h1>
              {(prospeccao?.data_inicio || prospeccao?.data_fim) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Calendar className="h-4 w-4" />
                  {prospeccao.data_inicio ? formatDate(prospeccao.data_inicio) : ''} 
                  {prospeccao.data_inicio && prospeccao.data_fim ? ' até ' : ''} 
                  {prospeccao.data_fim ? formatDate(prospeccao.data_fim) : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchContatos} disabled={loadingPage || isSyncingContatos}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingPage ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExporting ? 'Exportando...' : 'Exportar'}
            </Button>
          </div>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-foreground">{metricas.total}</p>
              <p className="text-sm text-muted-foreground">Total de Contatos</p>
            </CardContent>
          </Card>
          {isIA && (
            <>
              <Card className="border-amber-200 dark:border-amber-900">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">{metricas.pendentes}</p>
                  <p className="text-sm text-amber-600/80">Pendentes IA</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 dark:border-green-900">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{metricas.disparados}</p>
                  <p className="text-sm text-green-600/80">Disparados</p>
                </CardContent>
              </Card>
            </>
          )}
          <Card className="border-primary/30">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{metricas.vendas}</p>
              <p className="text-sm text-primary/80">Vendas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Disparo */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Linha de filtros */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou email..."
                  value={searchTerm}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => handleFilterChange('status', v)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isIA && (
                <Select value={disparoFilter} onValueChange={(v) => handleFilterChange('disparo', v)}>
                  <SelectTrigger className="w-[160px]">
                    <Send className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Disparo IA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes ({metricas.pendentes})</SelectItem>
                    <SelectItem value="disparado">Disparados ({metricas.disparados})</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Seção de Disparo IA */}
            {isIA && metricas.pendentes > 0 && (
              <div className="border-t pt-4 space-y-3">
                {/* Observação sobre lotes */}
                <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <Send className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground">
                      <strong>Como funciona:</strong> Os disparos são enviados em lotes de <strong>{BATCH_SIZE.toLocaleString()}</strong> contatos por vez.
                      {metricas.pendentes > MAX_DISPATCH_LIMIT && (
                        <> O limite máximo por disparo é <strong>{MAX_DISPATCH_LIMIT.toLocaleString()}</strong> contatos.</>
                      )}
                    </p>
                    {metricas.pendentes > BATCH_SIZE && (
                      <p className="text-muted-foreground mt-1">
                        Para {Math.min(metricas.pendentes, MAX_DISPATCH_LIMIT).toLocaleString()} contatos, serão <strong>{Math.ceil(Math.min(metricas.pendentes, MAX_DISPATCH_LIMIT) / BATCH_SIZE)} lotes</strong> enviados automaticamente em sequência.
                      </p>
                    )}
                  </div>
                </div>

                {/* Botões de disparo */}
                <div className="flex flex-wrap items-center gap-3">
                  {loadingAccess ? (
                    <Button variant="outline" size="sm" disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </Button>
                  ) : canDispatch ? (
                    <>
                      {/* Botão principal - Disparar Todos (até o limite) */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleDispararTodos}
                              disabled={isDisparandoIA}
                              className={isIALigacao ? 'bg-orange-600 hover:bg-orange-700' : ''}
                            >
                              {isDisparandoIA ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Enviando lote {currentBatch}/{totalBatches}...
                                </>
                              ) : (
                                <>
                                  {isIALigacao ? (
                                    <PhoneCall className="mr-2 h-4 w-4" />
                                  ) : (
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                  )}
                                  Disparar {isIALigacao ? 'Ligações' : 'WhatsApp'} ({Math.min(metricas.pendentes, MAX_DISPATCH_LIMIT).toLocaleString()})
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Dispara até {MAX_DISPATCH_LIMIT.toLocaleString()} contatos em lotes de {BATCH_SIZE.toLocaleString()}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Separador */}
                      <div className="h-8 w-px bg-border" />

                      {/* Input + Botão personalizado */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Qtd"
                          value={customDispatchCount}
                          onChange={(e) => setCustomDispatchCount(e.target.value)}
                          className="w-24 h-9"
                          min={1}
                          max={MAX_DISPATCH_LIMIT}
                          disabled={isDisparandoIA}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDispararPersonalizado}
                          disabled={isDisparandoIA || !customDispatchCount}
                          className={isIALigacao ? 'border-orange-600 text-orange-600 hover:bg-orange-50' : ''}
                        >
                          {isIALigacao ? (
                            <PhoneCall className="mr-2 h-4 w-4" />
                          ) : (
                            <MessageCircle className="mr-2 h-4 w-4" />
                          )}
                          Disparar {customDispatchCount ? parseInt(customDispatchCount, 10).toLocaleString() : 'X'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="opacity-60"
                          >
                            <Lock className="mr-2 h-4 w-4" />
                            {isIALigacao ? (
                              <PhoneCall className="mr-2 h-4 w-4" />
                            ) : (
                              <MessageCircle className="mr-2 h-4 w-4" />
                            )}
                            Disparar {isIALigacao ? 'Ligações' : 'WhatsApp'} ({metricas.pendentes.toLocaleString()})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {isIALigacao 
                              ? 'Apenas Administradores e TI podem disparar IA de Ligação'
                              : 'Apenas Administradores, TI, Gerente de Leads e CRM podem disparar WhatsApp'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela de contatos */}
        <Card>
          <CardContent className="p-0">
            {loadingPage && contatos.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : contatos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {metricas.total === 0 ? 'Nenhum contato importado' : 'Nenhum contato encontrado'}
                </p>
                <p className="text-sm">
                  {metricas.total === 0 
                    ? 'Importe uma base de contatos para este evento'
                    : 'Tente ajustar os filtros de busca'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Nome</TableHead>
                        <TableHead className="w-[140px]">Telefone</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[110px]">Status</TableHead>
                        <TableHead className="w-[100px]">Origem</TableHead>
                        <TableHead className="w-[130px]">Vendedor</TableHead>
                        {isIA && <TableHead className="w-[130px]">Disparo IA</TableHead>}
                        <TableHead className="w-[100px]">Criação</TableHead>
                        {isIA && <TableHead className="w-[100px]">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contatos.map((contato) => (
                        <TableRow key={contato.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{contato.nome || '-'}</TableCell>
                          <TableCell>
                            {contato.telefone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {contato.telefone}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {contato.email ? (
                              <span className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate max-w-[180px]">{contato.email}</span>
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[contato.status || ''] || 'bg-gray-100 text-gray-800'}>
                              {contato.status || 'Sem Status'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {contato.origem || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {contato.vendedor_nome || '-'}
                          </TableCell>
                          {isIA && (
                            <TableCell>
                              {contato.data_disparo_ia ? (
                                <span className="flex items-center gap-1 text-green-600 text-xs">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {format(new Date(contato.data_disparo_ia), 'dd/MM HH:mm')}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-600 text-xs">
                                  <Clock className="h-3.5 w-3.5" />
                                  Pendente
                                </span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground">
                            {contato.created_at ? format(new Date(contato.created_at), 'dd/MM/yy') : '-'}
                          </TableCell>
                          {isIA && (
                            <TableCell>
                              {/* Contato já disparado - mostrar botão de redisparo apenas para Admin */}
                              {contato.data_disparo_ia ? (
                                isAdmin ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRedispararContato(contato)}
                                    disabled={disparandoContato === contato.id}
                                    className="h-8 px-2"
                                    title="Disparar novamente (Admin)"
                                  >
                                    {disparandoContato === contato.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-4 w-4 text-amber-600" />
                                    )}
                                  </Button>
                                ) : null
                              ) : (
                                /* Contato pendente - mostrar botão de disparo normal */
                                loadingAccess ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : canDispatch ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDispararContato(contato)}
                                    disabled={disparandoContato === contato.id}
                                    className="h-8 px-2"
                                    title={isIALigacao ? 'Disparar Ligação' : 'Disparar WhatsApp'}
                                  >
                                    {disparandoContato === contato.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isIALigacao ? (
                                      <PhoneCall className="h-4 w-4 text-orange-600" />
                                    ) : (
                                      <MessageCircle className="h-4 w-4 text-primary" />
                                    )}
                                  </Button>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                                          <Lock className="h-3 w-3" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          {isIALigacao 
                                            ? 'Apenas ADM/TI podem disparar' 
                                            : 'Apenas ADM, TI, Gerente de Leads e CRM'}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount} contatos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loadingPage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || loadingPage}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Progresso do Disparo */}
      <DispararProgressModal
        isOpen={showProgressModal}
        onClose={handleCloseProgressModal}
        totalContatos={progressTotal}
        disparadosCount={progressCount}
        isCompleted={progressCompleted}
        isProcessing={isDisparandoIA}
        currentBatch={currentBatch}
        totalBatches={totalBatches}
      />
    </DashboardLayout>
  );
}
