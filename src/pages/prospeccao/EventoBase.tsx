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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Download, Users, Search, Filter, Send, Loader2, CheckCircle, Phone, Mail, 
  Calendar, Clock, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, MessageCircle, 
  PhoneCall, Lock, RotateCcw, CalendarCheck, PhoneMissed, PhoneOutgoing, FileSpreadsheet, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserAccessType } from '@/hooks/useUserAccessType';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DispararProgressModal from '@/components/DispararProgressModal';
import { SimulacaoEventoModal } from '@/components/SimulacaoEventoModal';
import { EventoBaseSkeleton } from '@/components/EventoBaseSkeleton';

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
  // Campos do webhook externo (IA Ligação)
  status_agendado?: boolean;
  enviado_whatsapp?: boolean;
  ligacao_atendida?: boolean;
  ligacao_erro?: boolean;
  num_tentativas?: number;
}

// Estado do lead para IA Ligação (baseado no webhook externo)
interface MetricasLigacaoExternas {
  total: number;
  pendentes: number;        // 0 tentativas
  disparados1: number;      // 1 tentativa
  disparados2: number;      // 2+ tentativas
  emFila: number;           // ligacao_erro=true E tentativas < 2 E não encerrado
  encerrados: number;       // tentativas >= 2 OU (agendado/atendido/whatsapp)
  agendados: number;        // status_agendado = true
  whatsappEnviado: number;  // enviado_whatsapp = true
  atendidos: number;        // ligacao_atendida = true
  elegiveisDisparo: number; // pendentes + emFila (o que realmente pode disparar)
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
type DisparoFilter = 'todos' | 'pendente' | 'em_fila' | 'disparado' | 'encerrado';
type StatusLigacaoFilter = 'todos' | 'agendado' | 'whatsapp' | 'atendido' | 'em_fila' | 'elegivel';
type TentativasFilter = 'todos' | '0' | '1' | '2' | '3+';

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
  const { permissions, loading: loadingAccess } = useUserAccessType();
  const canRedispatch = permissions.canRedispararEventos ?? false;

  // Constantes de configuração de disparo
  const BATCH_SIZE = 1000; // Tamanho do lote por chamada ao webhook

  // Estados
  const [prospeccao, setProspeccao] = useState<Prospeccao | null>(null);
  const [contatos, setContatos] = useState<ContatoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(searchParams.get('status') || 'todos');
  const [disparoFilter, setDisparoFilter] = useState<DisparoFilter>((searchParams.get('disparo') as DisparoFilter) || 'todos');
  const [statusLigacaoFilter, setStatusLigacaoFilter] = useState<StatusLigacaoFilter>((searchParams.get('statusLigacao') as StatusLigacaoFilter) || 'todos');
  const [tentativasFilter, setTentativasFilter] = useState<TentativasFilter>((searchParams.get('tentativas') as TentativasFilter) || 'todos');
  const [dataInicioFilter, setDataInicioFilter] = useState(searchParams.get('dataInicio') || '');
  const [dataFimFilter, setDataFimFilter] = useState(searchParams.get('dataFim') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [metricas, setMetricas] = useState({ total: 0, pendentes: 0, disparados: 0, vendas: 0 });
  const [metricasLigacao, setMetricasLigacao] = useState<MetricasLigacaoExternas | null>(null);
  const [contatosExternos, setContatosExternos] = useState<Map<string, any>>(new Map()); // telefone -> dados externos
  const [isDisparandoIA, setIsDisparandoIA] = useState(false);
  const [disparandoContato, setDisparandoContato] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingContatos, setIsSyncingContatos] = useState(false);
  const [isLoadingExternalMetrics, setIsLoadingExternalMetrics] = useState(false);
  
  // Estados do modal de progresso (server-side jobs)
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  
  // Estado para disparo personalizado
  const [customDispatchCount, setCustomDispatchCount] = useState<string>('');
  
  // Estado para modal de custo
  const [custoModal, setCustoModal] = useState<{
    isOpen: boolean;
    quantidade?: number;
  }>({ isOpen: false });
  
  // Cache do telefone do agente Pri(Ligação) 
  const [telefonePriLigacao, setTelefonePriLigacao] = useState<string | null>(null);

  // Buscar dados do evento
  useEffect(() => {
    const fetchProspeccao = async () => {
      if (!eventoId || !activeCompany?.id) return;

      const { data, error } = await supabase
        .from('prospeccoes')
        .select('id, titulo, canal, data_inicio, data_fim, meta_convites, meta_confirmacoes, meta_checkins, event_id_pri, template_prospeccao_id, template_agendado_id, template_nao_agendado_id, disparos_pausados')
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

  // Buscar telefone do agente Pri(Ligação) para esta empresa
  const fetchTelefonePriLigacao = useCallback(async (): Promise<string | null> => {
    if (!activeCompany?.id) return null;
    
    if (telefonePriLigacao) return telefonePriLigacao;
    
    try {
      const { data: agenteEmpresa, error } = await supabase
        .from('agente_empresas')
        .select('agente_id, agentes_ia(id, telefone, nome)')
        .eq('empresa_id', activeCompany.id);

      if (error) {
        console.error('Erro ao buscar agentes:', error);
        return null;
      }

      if (agenteEmpresa) {
        const agenteLigacao = agenteEmpresa.find((ae: any) => {
          const nome = ae.agentes_ia?.nome?.toLowerCase() || '';
          return nome.includes('pri') && nome.includes('liga');
        });
        
        if (agenteLigacao) {
          const tel = (agenteLigacao as any).agentes_ia?.telefone;
          setTelefonePriLigacao(tel);
          return tel;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar telefone Pri(Ligação):', error);
    }
    return null;
  }, [activeCompany?.id, telefonePriLigacao]);

  // Buscar métricas de IA Ligação DO SUPABASE (fonte primária)
  // Classifica leads por: num_tentativas, status_agendado, enviado_whatsapp, ligacao_atendida, ligacao_erro
  const fetchMetricasLigacao = useCallback(async (): Promise<MetricasLigacaoExternas | null> => {
    if (!eventoId || !activeCompany?.id || !prospeccao) return null;
    
    const canalAtual = prospeccao.canal?.toLowerCase() || '';
    const isLigacao = canalAtual.includes('liga');
    if (!isLigacao) return null;

    try {
      setIsLoadingExternalMetrics(true);
      
      const idEvento = prospeccao.event_id_pri || eventoId;
      
      console.log('📊 Buscando métricas do Supabase (fonte primária)...');
      console.log('   └─ id_evento:', idEvento);

      // Usar edge function que busca do Supabase
      const { data, error } = await supabase.functions.invoke('get-base-ligacao', {
        body: {
          id_evento: parseInt(String(idEvento), 10),
          empresa_id: activeCompany.id,
          prospeccao_id: eventoId,
          page: 1,
          page_size: 1, // Só precisamos das métricas
        }
      });

      if (error) {
        console.error('❌ Erro ao buscar métricas do Supabase:', error);
        return null;
      }

      console.log('📥 Resposta do get-base-ligacao:', data);

      if (data?.success && data?.metricas) {
        const metricsResult: MetricasLigacaoExternas = {
          total: data.metricas.total || 0,
          pendentes: data.metricas.pendentes || 0,
          disparados1: data.metricas.disparados1 || 0,
          disparados2: data.metricas.disparados2 || 0,
          emFila: data.metricas.emFila || 0,
          encerrados: data.metricas.encerrados || 0,
          agendados: data.metricas.agendados || 0,
          whatsappEnviado: data.metricas.whatsappEnviado || 0,
          atendidos: data.metricas.atendidos || 0,
          elegiveisDisparo: data.metricas.elegiveisDisparo || 0
        };

        console.log(`📊 Métricas do Supabase:`, metricsResult);
        return metricsResult;
      }

      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar métricas de ligação:', error);
      return null;
    } finally {
      setIsLoadingExternalMetrics(false);
    }
  }, [eventoId, activeCompany?.id, prospeccao]);

  // Buscar métricas usando função SQL otimizada (sem carregar todos os IDs)
  const fetchMetricas = useCallback(async () => {
    if (!eventoId || !activeCompany?.id) return;

    try {
      // Usar função SQL otimizada para contagens base
      const { data: metricasData, error: metricasError } = await supabase
        .rpc('get_prospeccao_metricas' as any, {
          p_prospeccao_id: eventoId,
          p_empresa_id: activeCompany.id
        });

      if (metricasError) {
        console.error('Erro ao buscar métricas:', metricasError);
        return;
      }

      let baseMetricas = { total: 0, pendentes: 0, disparados: 0, vendas: 0 };

      if (metricasData && Array.isArray(metricasData) && metricasData.length > 0) {
        const m = metricasData[0] as { total: number; pendentes: number; disparados: number; vendas: number };
        baseMetricas = {
          total: Number(m.total) || 0,
          pendentes: Number(m.pendentes) || 0,
          disparados: Number(m.disparados) || 0,
          vendas: Number(m.vendas) || 0
        };
      }

      // Para IA Ligação, sobrescrever pendentes/disparados com dados do webhook externo
      const canalAtual = prospeccao?.canal?.toLowerCase() || '';
      const isLigacao = canalAtual.includes('liga');
      
      if (isLigacao) {
        const metricasExternas = await fetchMetricasLigacao();
        if (metricasExternas && metricasExternas.total > 0) {
          console.log('✅ Usando métricas externas (classificação completa)');
          setMetricasLigacao(metricasExternas);
          baseMetricas.pendentes = metricasExternas.pendentes;
          baseMetricas.disparados = metricasExternas.disparados1 + metricasExternas.disparados2;
          baseMetricas.total = metricasExternas.total;
        } else if (metricasExternas && metricasExternas.total === 0 && baseMetricas.total > 0) {
          console.log('⚠️ Métricas externas retornaram 0 mas existem contatos locais, mantendo métricas base');
          // Não sobrescrever métricas base com zeros quando temos dados locais
        }
      }

      setMetricas(baseMetricas);
      setTotalCount(baseMetricas.total);

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
  }, [eventoId, activeCompany?.id, prospeccao, fetchMetricasLigacao]);

  // Carregar métricas iniciais (após prospeccao ser carregada)
  // Para IA Ligação, sincroniza com n8n primeiro para garantir dados atualizados
  useEffect(() => {
    const loadInitialData = async () => {
      if (!prospeccao) return;
      
      const canalAtual = prospeccao?.canal?.toLowerCase() || '';
      const isLigacao = canalAtual.includes('liga');
      
      // Para IA Ligação, sincroniza com n8n ANTES de mostrar dados
      if (isLigacao && prospeccao?.event_id_pri && activeCompany?.id) {
        try {
          console.log('🔄 Carregamento inicial: sincronizando com n8n...');
          const telefonePri = await fetchTelefonePriLigacao();
          if (telefonePri) {
            await supabase.functions.invoke('sync-pri-dashboard', {
              body: {
                telefone_pri: telefonePri.replace(/\D/g, ''),
                id_evento: parseInt(String(prospeccao.event_id_pri), 10),
                empresa_id: activeCompany.id,
              }
            });
            console.log('✅ Sincronização inicial n8n concluída');
          }
        } catch (error) {
          console.warn('⚠️ Falha na sincronização inicial com n8n, continuando com dados locais:', error);
        }
      }
      
      // Depois busca dados do Supabase
      await fetchMetricas();
      setLoading(false);
    };
    
    loadInitialData();
  }, [prospeccao, activeCompany?.id, fetchMetricas, fetchTelefonePriLigacao]);

  // Buscar contatos paginados - para IA Ligação usa prospect_pri_voz (Supabase)
  const fetchContatos = useCallback(async () => {
    if (!eventoId || !activeCompany?.id || !prospeccao) {
      setContatos([]);
      setLoadingPage(false);
      return;
    }

    setLoadingPage(true);

    try {
      const canalAtual = prospeccao?.canal?.toLowerCase() || '';
      const isLigacao = canalAtual.includes('liga');

      // Para IA Ligação, buscar de prospect_pri_voz via edge function
      // Se retornar 0 resultados, faz fallback para contatos locais (eventos_prospeccao)
      if (isLigacao && prospeccao?.event_id_pri) {
        console.log('📞 Buscando contatos de IA Ligação do Supabase (prospect_pri_voz)...');
        
        let usedFallback = false;
        
        try {
          const { data, error } = await supabase.functions.invoke('get-base-ligacao', {
            body: {
              id_evento: parseInt(String(prospeccao.event_id_pri), 10),
              empresa_id: activeCompany.id,
              prospeccao_id: eventoId,
              page: currentPage,
              page_size: PAGE_SIZE,
              filters: {
                search: searchTerm || undefined,
                status: disparoFilter !== 'todos' ? disparoFilter : undefined,
                status_ligacao: statusLigacaoFilter !== 'todos' ? statusLigacaoFilter : undefined,
                tentativas: tentativasFilter !== 'todos' ? tentativasFilter : undefined,
              }
            }
          });

          if (error) throw error;

          if (data?.success && data?.contatos && (data.contatos.length > 0 || data.pagination?.total > 0)) {
            // Dados encontrados em prospect_pri_voz
            const mappedContatos: ContatoEvento[] = (data.contatos || []).map((p: any) => ({
              id: p.id,
              lead_id: p.lead_id ? parseInt(p.lead_id, 10) : null,
              nome: p.nome || '',
              telefone: p.telefone_lead || '',
              email: null,
              status: p.status_calculado === 'encerrado' 
                ? (p.status_agendado ? 'Agendado' : p.ligacao_atendida ? 'Atendido' : 'Encerrado')
                : 'Novo',
              origem: 'Ligação',
              created_at: p.criado_em,
              updated_at: p.atualizado_em,
              data_disparo_ia: p.num_tentativas > 0 ? p.atualizado_em : null,
              responsavel_email: null,
              vendedor_nome: null,
              status_agendado: p.status_agendado,
              enviado_whatsapp: p.enviado_whatsapp,
              ligacao_atendida: p.ligacao_atendida,
              ligacao_erro: p.ligacao_erro,
              num_tentativas: p.num_tentativas,
            }));

            setContatos(mappedContatos);
            setTotalCount(data.pagination?.total || mappedContatos.length);
            
            const externalMap = new Map<string, any>();
            mappedContatos.forEach(c => {
              const telefone = (c.telefone || '').replace(/\D/g, '');
              if (telefone) {
                externalMap.set(telefone, {
                  status_agendado: c.status_agendado,
                  enviado_whatsapp: c.enviado_whatsapp,
                  ligacao_atendida: c.ligacao_atendida,
                  ligacao_erro: c.ligacao_erro,
                  num_tentativas: c.num_tentativas || 0
                });
              }
            });
            setContatosExternos(externalMap);
            
            if (data.metricas) {
              setMetricasLigacao({
                total: data.metricas.total || 0,
                pendentes: data.metricas.pendentes || 0,
                disparados1: data.metricas.disparados1 || 0,
                disparados2: data.metricas.disparados2 || 0,
                emFila: data.metricas.emFila || 0,
                encerrados: data.metricas.encerrados || 0,
                agendados: data.metricas.agendados || 0,
                whatsappEnviado: data.metricas.whatsappEnviado || 0,
                atendidos: data.metricas.atendidos || 0,
                elegiveisDisparo: data.metricas.elegiveisDisparo || 0
              });
            }

            setLoadingPage(false);
            return;
          } else {
            // prospect_pri_voz retornou 0 - fazer fallback para contatos locais
            console.log('⚠️ prospect_pri_voz retornou 0 contatos, usando fallback para contatos locais...');
            usedFallback = true;
          }
        } catch (err) {
          console.warn('⚠️ Erro ao buscar prospect_pri_voz, usando fallback local:', err);
          usedFallback = true;
        }

        // Fallback: se prospect_pri_voz está vazio, cai no fluxo padrão abaixo
        if (!usedFallback) {
          setLoadingPage(false);
          return;
        }
      }

      // Para outros tipos de evento, usar query tradicional (contatos + eventos_prospeccao)
      const offset = (currentPage - 1) * PAGE_SIZE;

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
  }, [eventoId, activeCompany?.id, searchTerm, statusFilter, disparoFilter, statusLigacaoFilter, tentativasFilter, currentPage, metricas.total, prospeccao, toast]);

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
    if (statusLigacaoFilter !== 'todos') params.set('statusLigacao', statusLigacaoFilter);
    if (tentativasFilter !== 'todos') params.set('tentativas', tentativasFilter);
    if (dataInicioFilter) params.set('dataInicio', dataInicioFilter);
    if (dataFimFilter) params.set('dataFim', dataFimFilter);
    if (currentPage > 1) params.set('page', currentPage.toString());
    setSearchParams(params, { replace: true });
  }, [searchTerm, statusFilter, disparoFilter, statusLigacaoFilter, tentativasFilter, dataInicioFilter, dataFimFilter, currentPage, setSearchParams]);

  // Reset page quando filtros mudarem
  const handleFilterChange = (type: 'search' | 'status' | 'disparo' | 'statusLigacao' | 'tentativas' | 'dataInicio' | 'dataFim', value: string) => {
    setCurrentPage(1);
    if (type === 'search') setSearchTerm(value);
    if (type === 'status') setStatusFilter(value as StatusFilter);
    if (type === 'disparo') setDisparoFilter(value as DisparoFilter);
    if (type === 'statusLigacao') setStatusLigacaoFilter(value as StatusLigacaoFilter);
    if (type === 'tentativas') setTentativasFilter(value as TentativasFilter);
    if (type === 'dataInicio') setDataInicioFilter(value);
    if (type === 'dataFim') setDataFimFilter(value);
  };
  
  // Limpar todos os filtros
  const handleClearFilters = () => {
    setCurrentPage(1);
    setSearchTerm('');
    setStatusFilter('todos');
    setDisparoFilter('todos');
    setStatusLigacaoFilter('todos');
    setTentativasFilter('todos');
    setDataInicioFilter('');
    setDataFimFilter('');
  };
  
  // Sincroniza com n8n primeiro (para IA Ligação), depois busca dados do Supabase
  // Isso garante que os dados exibidos estão sempre atualizados
  const syncAndRefresh = useCallback(async (showToast = false) => {
    const canalAtual = prospeccao?.canal?.toLowerCase() || '';
    const isLigacao = canalAtual.includes('liga');
    
    // Para IA Ligação, sincroniza com n8n primeiro
    if (isLigacao && prospeccao?.event_id_pri && activeCompany?.id) {
      try {
        console.log('🔄 Sincronizando com n8n antes de exibir dados...');
        
        // Buscar telefone_pri do agente de ligação
        const telefonePri = await fetchTelefonePriLigacao();
        if (telefonePri) {
          const { data, error } = await supabase.functions.invoke('sync-pri-dashboard', {
            body: {
              telefone_pri: telefonePri.replace(/\D/g, ''),
              id_evento: parseInt(String(prospeccao.event_id_pri), 10),
              empresa_id: activeCompany.id,
            }
          });

          if (error) {
            console.warn('⚠️ Erro ao sincronizar com n8n:', error);
          } else {
            console.log('✅ Sincronização n8n concluída:', data?.result);
            if (showToast && data?.result) {
              toast({ 
                title: "Sincronização concluída", 
                description: `${data.result.prospect_upserted || 0} prospects e ${data.result.cadencia_upserted || 0} cadências atualizados` 
              });
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Falha ao sincronizar com n8n, continuando com dados locais:', error);
      }
    }
    
    // Agora busca dados do Supabase (fonte primária)
    await fetchMetricas();
    await fetchContatos();
  }, [prospeccao, activeCompany?.id, fetchTelefonePriLigacao, fetchMetricas, fetchContatos, toast]);

  // Atualizar tudo: sincroniza n8n (IA Ligação) + métricas + contatos do Supabase
  const handleRefresh = useCallback(async () => {
    setLoadingPage(true);
    try {
      // Sincronizar com n8n (se aplicável) e depois buscar dados do Supabase
      await syncAndRefresh(false); // Sem toast para refresh simples
    } finally {
      setLoadingPage(false);
    }
  }, [syncAndRefresh]);
  
  // Verificar se tem filtros ativos
  const hasActiveFilters = searchTerm || statusFilter !== 'todos' || disparoFilter !== 'todos' || 
    statusLigacaoFilter !== 'todos' || tentativasFilter !== 'todos' || dataInicioFilter || dataFimFilter;
  
  // Verifica se é evento de IA (WhatsApp ou Ligação) - declarado cedo para uso nos filtros
  const canalLower = prospeccao?.canal?.toLowerCase() || '';
  const isIAWhatsAppLocal = canalLower.includes('whatsapp');
  const isIALigacaoLocal = canalLower.includes('liga');
  const isIALocal = isIAWhatsAppLocal || isIALigacaoLocal;
    
  // Filtrar contatos localmente com base nos filtros de IA Ligação
  // IMPORTANTE: Para IA Ligação, os filtros já são aplicados no servidor (edge function)
  // então não aplicamos filtros locais para evitar filtragem dupla
  const filteredContatos = useMemo(() => {
    // Para IA Ligação, os dados já vêm filtrados do servidor
    // Retornar contatos diretamente sem filtros locais
    if (isIALigacaoLocal) {
      return contatos;
    }
    
    // Para outros canais, não há filtros locais específicos
    return contatos;
  }, [contatos, isIALigacaoLocal]);

  // Exportar dados - suporta CSV e XLS
  const handleExport = async (exportFormat: 'csv' | 'xls') => {
    if (metricas.total === 0) {
      toast({ title: "Atenção", description: "Nenhum contato para exportar" });
      return;
    }

    setIsExporting(true);
    toast({ title: "Exportando...", description: `Preparando arquivo ${exportFormat.toUpperCase()}, isso pode levar alguns segundos...` });

    try {
      const canalAtual = prospeccao?.canal?.toLowerCase() || '';
      const isLigacao = canalAtual.includes('liga');
      
      let exportData: any[] = [];
      
      // Para IA Ligação, buscar de prospect_pri_voz
      if (isLigacao && prospeccao?.event_id_pri) {
        const { data, error } = await supabase.functions.invoke('get-base-ligacao', {
          body: {
            id_evento: parseInt(String(prospeccao.event_id_pri), 10),
            empresa_id: activeCompany!.id,
            prospeccao_id: eventoId!,
            page: 1,
            page_size: 100000, // Buscar todos para export
            filters: {
              search: searchTerm || undefined,
              status: disparoFilter !== 'todos' ? disparoFilter : undefined,
              status_ligacao: statusLigacaoFilter !== 'todos' ? statusLigacaoFilter : undefined,
              tentativas: tentativasFilter !== 'todos' ? tentativasFilter : undefined,
            }
          }
        });

        if (error) throw error;

        if (data?.success && data?.contatos) {
          exportData = data.contatos.map((c: any) => ({
            Nome: c.nome || '',
            Telefone: c.telefone_lead || '',
            Status: c.status_calculado === 'encerrado' 
              ? (c.status_agendado ? 'Agendado' : c.ligacao_atendida ? 'Atendido' : 'Encerrado')
              : c.status_calculado === 'em_fila' ? 'Em Fila' 
              : c.status_calculado === 'disparado' ? 'Disparado' : 'Pendente',
            Loja: c.loja || '',
            Tentativas: c.num_tentativas || 0,
            Agendado: c.status_agendado ? 'Sim' : 'Não',
            'WhatsApp Enviado': c.enviado_whatsapp ? 'Sim' : 'Não',
            Atendido: c.ligacao_atendida ? 'Sim' : 'Não',
            'Primeira Tentativa': c.hora_primeira_tentativa ? format(new Date(c.hora_primeira_tentativa), 'dd/MM/yyyy HH:mm') : '',
            'Última Tentativa': c.hora_ultima_tentativa ? format(new Date(c.hora_ultima_tentativa), 'dd/MM/yyyy HH:mm') : '',
            'Data Criação': c.criado_em ? format(new Date(c.criado_em), 'dd/MM/yyyy HH:mm') : '',
          }));
        }
      } else {
        // Para outros canais, buscar de contatos
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

        exportData = allContatos.map(c => ({
          Nome: c.nome || '',
          Telefone: c.telefone || '',
          Email: c.email || '',
          Status: c.status || '',
          Origem: c.origem || '',
          Vendedor: c.vendedor_nome || '',
          'Data Criação': c.created_at ? format(new Date(c.created_at), 'dd/MM/yyyy HH:mm') : '',
          'Último Update': c.updated_at ? format(new Date(c.updated_at), 'dd/MM/yyyy HH:mm') : '',
          'Disparo IA': c.data_disparo_ia ? format(new Date(c.data_disparo_ia), 'dd/MM/yyyy HH:mm') : 'Pendente',
        }));
      }

      if (exportData.length === 0) {
        toast({ title: "Atenção", description: "Nenhum contato para exportar com os filtros aplicados" });
        setIsExporting(false);
        return;
      }

      const fileName = `${prospeccao?.titulo || 'evento'}_base_contatos`;

      if (exportFormat === 'csv') {
        // Export CSV
        const headers = Object.keys(exportData[0]);
        const csvContent = [
          headers.join(','),
          ...exportData.map(row => 
            headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
          )
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Export XLS
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
      }

      toast({ title: "Sucesso", description: `${exportData.length} contatos exportados` });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ title: "Erro", description: "Erro ao exportar contatos", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Buscar contatos PENDENTES para disparo (apenas pendentes, não Em Fila)
  // Pendentes: data_disparo_ia IS NULL e não encerrados (nunca disparados)
  const fetchContatosPendentes = async (): Promise<ContatoEvento[]> => {
    if (!activeCompany?.id || !eventoId) return [];
    
    const canalAtual = prospeccao?.canal?.toLowerCase() || '';
    const isLigacao = canalAtual.includes('liga');
    
    console.log('🔍 Buscando contatos PENDENTES para disparo...');
    console.log('   ├─ empresa_id:', activeCompany.id);
    console.log('   ├─ prospeccao_id:', eventoId);
    console.log('   └─ canal:', prospeccao?.canal, '(isLigação:', isLigacao, ')');
    
    // ETAPA 1: Buscar contato_ids da tabela eventos_prospeccao
    // Para IA Ligação: buscar TODOS os contatos (a filtragem real é feita com dados externos na ETAPA 3)
    // Para WhatsApp: buscar apenas pendentes (data_disparo_ia IS NULL)
    const BATCH_SIZE = 1000;
    let allContatoIds: string[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('eventos_prospeccao')
        .select('contato_id')
        .eq('prospeccao_id', eventoId)
        .not('contato_id', 'is', null);
      
      // Para WhatsApp, filtrar por data_disparo_ia IS NULL (fonte de verdade local)
      // Para IA Ligação, NÃO filtrar aqui - a fonte de verdade são os dados externos
      if (!isLigacao) {
        query = query.is('data_disparo_ia', null);
      }
      
      const { data: eventosData, error: eventosError } = await query
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

    console.log(`📋 Total de contato_ids pendentes (local): ${allContatoIds.length}`);

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

    // ETAPA 3: Para IA Ligação, filtrar contatos que já estão encerrados ou em fila
    // Apenas pendentes reais (nunca disparados e não encerrados)
    if (isLigacao && contatosExternos.size > 0) {
      const totalAntes = allContatos.length;
      allContatos = allContatos.filter(contato => {
        const telefoneNormalizado = contato.telefone?.replace(/\D/g, '') || '';
        let telSem55 = telefoneNormalizado;
        if (telefoneNormalizado.length > 11 && telefoneNormalizado.startsWith('55')) {
          telSem55 = telefoneNormalizado.slice(2);
        }
        
        const dadosExternos = contatosExternos.get(telefoneNormalizado) || contatosExternos.get(telSem55);
        
        if (!dadosExternos) return true; // Sem dados externos = nunca disparado = pendente
        
        // Encerrado se: status_agendado || enviado_whatsapp || ligacao_atendida
        const isEncerrado = dadosExternos.status_agendado || 
                            dadosExternos.enviado_whatsapp || 
                            dadosExternos.ligacao_atendida;
        
        // Em Fila se: ligacao_erro = true E não encerrado (já foi tentado, aguardando retry)
        const isEmFila = dadosExternos.ligacao_erro === true && !isEncerrado;
        
        // Só é pendente se: num_tentativas = 0 E não encerrado E não em fila
        const numTentativas = dadosExternos.num_tentativas || 0;
        const isPendente = numTentativas === 0 && !isEncerrado && !isEmFila;
        
        return isPendente;
      });
      
      const filtrados = totalAntes - allContatos.length;
      if (filtrados > 0) {
        console.log(`🚫 ${filtrados} contatos removidos (encerrados ou já tentados/em fila)`);
      }
    }

    console.log(`🎯 Total de contatos PENDENTES para disparo: ${allContatos.length}`);
    return allContatos;
  };

  // Fechar modal de progresso
  const handleCloseProgressModal = () => {
    setShowProgressModal(false);
    // Atualizar dados e métricas quando fechar
    fetchMetricas();
    fetchContatos();
  };

  // Retry job: reprocessar batches pendentes/falhos
  const handleRetryJob = async (jobId: string) => {
    try {
      toast({ title: "Retomando...", description: "Reprocessando lotes com falha" });
      await supabase.functions.invoke('process-campaign-job', {
        body: { job_id: jobId }
      });
    } catch (error) {
      console.error('Erro ao retomar job:', error);
      toast({ title: "Erro", description: "Erro ao retomar processamento", variant: "destructive" });
    }
  };

  // Disparar IA com quantidade customizada ou todos - AGORA VIA SERVER-SIDE JOB
  const handleDispararIA = async (quantidade?: number) => {
    if (!prospeccao || !activeCompany?.id) return;

    setIsDisparandoIA(true);
    try {
      console.log('🚀 Iniciando disparo em massa (server-side)...');
      
      // Para IA Ligação: sincronizar com n8n ANTES de disparar
      const canalAtual = prospeccao.canal?.toLowerCase() || '';
      const isLigacao = canalAtual.includes('liga');
      
      if (isLigacao) {
        console.log('🔄 Sincronizando com n8n antes de disparar...');
        toast({ title: "Sincronizando...", description: "Atualizando dados antes do disparo" });
        
        try {
          const telefonePri = await fetchTelefonePriLigacao();
          if (telefonePri) {
            await supabase.functions.invoke('sync-pri-dashboard', {
              body: {
                telefone_pri: telefonePri.replace(/\D/g, ''),
                id_evento: parseInt(String(prospeccao.event_id_pri || eventoId), 10),
                empresa_id: activeCompany.id,
              }
            });
            await fetchMetricas();
          }
        } catch (syncErr) {
          console.warn('⚠️ Erro ao sincronizar antes do disparo:', syncErr);
        }
      }
      
      // Buscar todos os contatos pendentes
      let contatosPendentes = await fetchContatosPendentes();
      
      if (contatosPendentes.length === 0) {
        toast({ title: "Atenção", description: "Nenhum contato pendente para disparar" });
        setIsDisparandoIA(false);
        return;
      }

      // Para IA Ligação: filtrar leads encerrados
      if (isLigacao && contatosExternos.size > 0) {
        const totalAntes = contatosPendentes.length;
        contatosPendentes = contatosPendentes.filter(contato => {
          const telefoneNormalizado = contato.telefone?.replace(/\D/g, '') || '';
          const dadosExternos = contatosExternos.get(telefoneNormalizado);
          if (!dadosExternos) return true;
          return !(dadosExternos.status_agendado || dadosExternos.enviado_whatsapp || dadosExternos.ligacao_atendida);
        });
        const encerrados = totalAntes - contatosPendentes.length;
        if (encerrados > 0) {
          toast({ title: "Leads filtrados", description: `${encerrados} leads encerrados removidos` });
        }
      }

      if (contatosPendentes.length === 0) {
        toast({ title: "Atenção", description: "Todos os contatos elegíveis estão encerrados" });
        setIsDisparandoIA(false);
        return;
      }

      // Aplicar limite de quantidade
      let leadsParaDisparar = contatosPendentes;
      if (quantidade && quantidade > 0) {
        leadsParaDisparar = contatosPendentes.slice(0, Math.min(quantidade, contatosPendentes.length));
      }

      console.log(`📊 Total para disparar: ${leadsParaDisparar.length}`);

      // CRIAR JOB NO BANCO (server-side processing)
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        toast({ title: "Erro", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
        setIsDisparandoIA(false);
        return;
      }

      // Dividir leads em batches de 1000
      const batchCount = Math.ceil(leadsParaDisparar.length / BATCH_SIZE);

      // 1. Criar o job
      const { data: jobData, error: jobError } = await supabase
        .from('campaign_jobs')
        .insert({
          prospeccao_id: prospeccao.id,
          empresa_id: activeCompany.id,
          user_id: userId,
          canal: prospeccao.canal || '',
          total_records: leadsParaDisparar.length,
          quantidade_solicitada: quantidade || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (jobError || !jobData) {
        console.error('Erro ao criar job:', jobError);
        toast({ title: "Erro", description: "Erro ao criar job de disparo", variant: "destructive" });
        setIsDisparandoIA(false);
        return;
      }

      const jobId = jobData.id;
      console.log(`✅ Job criado: ${jobId}`);

      // 2. Criar batches com lead_ids
      const batchInserts = [];
      for (let i = 0; i < batchCount; i++) {
        const batchLeads = leadsParaDisparar.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        batchInserts.push({
          job_id: jobId,
          batch_index: i,
          total_leads: batchLeads.length,
          lead_ids: batchLeads.map(l => l.id),
          status: 'pending',
        });
      }

      const { error: batchError } = await supabase
        .from('campaign_batches')
        .insert(batchInserts);

      if (batchError) {
        console.error('Erro ao criar batches:', batchError);
        await supabase.from('campaign_jobs').update({ status: 'failed', error_message: 'Erro ao criar batches' }).eq('id', jobId);
        toast({ title: "Erro", description: "Erro ao preparar lotes", variant: "destructive" });
        setIsDisparandoIA(false);
        return;
      }

      console.log(`✅ ${batchCount} batches criados`);

      // 3. Abrir modal de progresso e acionar Edge Function ASSÍNCRONAMENTE
      setActiveJobId(jobId);
      setShowProgressModal(true);

      // Fire-and-forget: a Edge Function processa em background
      supabase.functions.invoke('process-campaign-job', {
        body: { job_id: jobId }
      }).catch(err => {
        console.error('Erro ao invocar process-campaign-job:', err);
      });

      toast({ title: "Disparo iniciado!", description: `${leadsParaDisparar.length} contatos sendo processados no servidor` });
      setCustomDispatchCount('');

    } catch (error) {
      console.error('Erro ao disparar IA:', error);
      toast({ title: "Erro", description: "Erro ao iniciar disparo: " + (error as Error).message, variant: "destructive" });
      setShowProgressModal(false);
    } finally {
      setIsDisparandoIA(false);
    }
  };

  // Função wrapper para disparar todos - abre modal de custo primeiro
  const handleDispararTodos = () => {
    setCustoModal({ isOpen: true, quantidade: undefined });
  };

  // Função para redisparar todos (Admin/Master) - reseta data_disparo_ia dos já disparados
  const handleRedisparoEmMassa = async () => {
    if (!prospeccao || !activeCompany?.id || !canRedispatch) return;
    
    // Resetar data_disparo_ia de todos os contatos do evento para torná-los "pendentes" novamente
    const { error } = await supabase
      .from('eventos_prospeccao')
      .update({ data_disparo_ia: null })
      .eq('prospeccao_id', prospeccao.id);
    
    if (error) {
      toast({ title: "Erro", description: "Erro ao resetar disparos", variant: "destructive" });
      return;
    }
    
    toast({ title: "Disparos resetados", description: "Todos os contatos estão pendentes novamente. Clique em Disparar." });
    await fetchMetricas();
    await fetchContatos();
  };

  // Função para disparar quantidade personalizada - abre modal de custo primeiro
  const handleDispararPersonalizado = () => {
    const quantidade = parseInt(customDispatchCount, 10);
    if (isNaN(quantidade) || quantidade <= 0) {
      toast({ title: "Atenção", description: "Digite uma quantidade válida maior que zero" });
      return;
    }
    setCustoModal({ isOpen: true, quantidade });
  };

  // Executar disparo real após confirmação no modal de custo
  const executarDisparoConfirmado = () => {
    setCustoModal({ isOpen: false });
    handleDispararIA(custoModal.quantidade);
  };

  // Disparar IA para contato individual
  const handleDispararContato = async (contato: ContatoEvento) => {
    if (!prospeccao || !activeCompany?.id) return;

    // Para IA Ligação: verificar se o contato está bloqueado
    const canalAtual = prospeccao.canal?.toLowerCase() || '';
    const isLigacao = canalAtual.includes('liga');
    
    if (isLigacao && contatosExternos.size > 0) {
      const telefoneNormalizado = contato.telefone?.replace(/\D/g, '') || '';
      const dadosExternos = contatosExternos.get(telefoneNormalizado);
      
      if (dadosExternos) {
        if (dadosExternos.status_agendado) {
          toast({ title: "Bloqueado", description: "Este lead já está agendado e não pode receber ligação", variant: "destructive" });
          return;
        }
        if (dadosExternos.enviado_whatsapp) {
          toast({ title: "Bloqueado", description: "Este lead já recebeu WhatsApp e não pode receber ligação", variant: "destructive" });
          return;
        }
        if (dadosExternos.ligacao_atendida) {
          toast({ title: "Bloqueado", description: "Este lead já teve ligação atendida", variant: "destructive" });
          return;
        }
      }
    }

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

      // Garantir que o template_prospeccao_id exista no payload (algumas telas/listagens não carregam esse campo)
      let templateProspeccaoId = (prospeccao as any).template_prospeccao_id as string | null | undefined;
      if (!templateProspeccaoId) {
        const { data: pData, error: pError } = await supabase
          .from('prospeccoes')
          .select('template_prospeccao_id')
          .eq('id', prospeccao.id)
          .maybeSingle();
        if (pError) throw pError;
        templateProspeccaoId = (pData as any)?.template_prospeccao_id || null;
      }

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
            template_prospeccao_id: templateProspeccaoId || null
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

      // Garantir que o template_prospeccao_id exista no payload (algumas telas/listagens não carregam esse campo)
      let templateProspeccaoId = (prospeccao as any).template_prospeccao_id as string | null | undefined;
      if (!templateProspeccaoId) {
        const { data: pData, error: pError } = await supabase
          .from('prospeccoes')
          .select('template_prospeccao_id')
          .eq('id', prospeccao.id)
          .maybeSingle();
        if (pError) throw pError;
        templateProspeccaoId = (pData as any)?.template_prospeccao_id || null;
      }

      // Para IA WhatsApp, template é obrigatório
      const isWhatsapp = prospeccao.canal === 'Whatsapp' || prospeccao.canal === 'IA Whatsapp';
      if (isWhatsapp && !templateProspeccaoId) {
        toast({ 
          title: "Template não configurado", 
          description: "Este evento não possui template de prospecção. Edite o evento e configure um template antes de redisparar.", 
          variant: "destructive" 
        });
        setDisparandoContato(null);
        return;
      }

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
            template_prospeccao_id: templateProspeccaoId || null
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

  // Sincronização de contatos IA Ligação - agora apenas recarrega do Supabase (fonte primária)
  // A sincronização com o sistema externo é feita no momento do upload/disparo
  const syncContatosLigacao = useCallback(async (showToast = true) => {
    const canalAtual = prospeccao?.canal?.toLowerCase() || '';
    const isLigacao = canalAtual.includes('liga');
    if (!prospeccao || !activeCompany?.id || !isLigacao) return;

    setIsSyncingContatos(true);
    try {
      console.log('🔄 Recarregando contatos do Supabase (fonte primária)...');

      // Recarregar dados do Supabase
      await fetchMetricas();
      await fetchContatos();

      if (showToast) {
        toast({ 
          title: "Dados atualizados", 
          description: "Contatos recarregados do banco de dados" 
        });
      }

    } catch (error) {
      console.error('Erro ao recarregar contatos:', error);
      if (showToast) {
        toast({ 
          title: "Erro", 
          description: "Erro ao recarregar contatos: " + (error as Error).message, 
          variant: "destructive" 
        });
      }
    } finally {
      setIsSyncingContatos(false);
    }
  }, [prospeccao, activeCompany?.id, fetchMetricas, fetchContatos, toast]);

  // Sincronizar com n8n (sistema externo) - usa a função centralizada
  const handleSyncN8N = useCallback(async () => {
    const canalAtual = prospeccao?.canal?.toLowerCase() || '';
    const isLigacao = canalAtual.includes('liga');
    if (!prospeccao || !activeCompany?.id || !isLigacao) return;

    setIsSyncingContatos(true);
    setLoadingPage(true);
    try {
      // Usa a função centralizada com toast
      await syncAndRefresh(true);
    } catch (error) {
      console.error('Erro ao sincronizar com n8n:', error);
      toast({ 
        title: "Erro", 
        description: "Erro ao sincronizar com n8n: " + (error as Error).message, 
        variant: "destructive" 
      });
    } finally {
      setIsSyncingContatos(false);
      setLoadingPage(false);
    }
  }, [prospeccao, activeCompany?.id, syncAndRefresh, toast]);

  // Não precisa mais de sincronização automática - dados já estão no Supabase
  // useEffect removido para evitar chamadas desnecessárias

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  // Verifica se é evento de IA (WhatsApp ou Ligação) - usar variáveis já definidas acima
  const isIAWhatsApp = isIAWhatsAppLocal;
  const isIALigacao = isIALigacaoLocal;
  const isIA = isIALocal;
  
  // Permissão para disparar - driven by permission flags
  const canDispatchWhatsApp = permissions.canDispararEventos ?? false;
  const canDispatchLigacao = permissions.canDispararIALigacao ?? false;
  const canDispatch = loadingAccess ? false : (isIAWhatsApp ? canDispatchWhatsApp : (isIALigacao ? canDispatchLigacao : false));

  // Log para debug
  console.log('🔍 Canal:', prospeccao?.canal, '| isIALigacao:', isIALigacao, '| isIAWhatsApp:', isIAWhatsApp, '| canDispatch:', canDispatch, '| loadingAccess:', loadingAccess);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Mostrar skeleton enquanto carrega os dados iniciais (prospeccao e métricas)
  if (loading || !prospeccao || (isIALigacaoLocal && !metricasLigacao && isLoadingExternalMetrics)) {
    return (
      <DashboardLayout title="Carregando evento...">
        <EventoBaseSkeleton />
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
            {/* Botão Sincronizar com n8n - apenas para IA Ligação */}
            {isIALigacao && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSyncN8N} 
                      disabled={loadingPage || isSyncingContatos || isLoadingExternalMetrics}
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      {isSyncingContatos ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {isSyncingContatos ? 'Sincronizando...' : 'Sincronizar n8n'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sincroniza dados de ligação com o sistema n8n antes de exibir ou disparar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loadingPage || isSyncingContatos || isLoadingExternalMetrics}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingPage || isLoadingExternalMetrics ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? 'Exportando...' : 'Exportar'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('xls')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Excel (XLS)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Cards de métricas - IA Ligação */}
        {isIALigacao && metricasLigacao ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
            {/* 1. Total */}
            <Card>
              <CardContent className="p-4 text-center">
                {isLoadingExternalMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
                ) : (
                  <p className="text-3xl font-bold text-foreground">{metricasLigacao.total.toLocaleString('pt-BR')}</p>
                )}
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xs text-muted-foreground mt-1">(base completa)</p>
              </CardContent>
            </Card>
            
            {/* 2. Pendentes (0 tentativas) */}
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4 text-center">
                {isLoadingExternalMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto" />
                ) : (
                  <p className="text-3xl font-bold text-slate-600">{metricasLigacao.pendentes.toLocaleString('pt-BR')}</p>
                )}
                <p className="text-sm text-slate-600/80">Pendentes</p>
                <p className="text-xs text-muted-foreground mt-1">(0 tentativas)</p>
              </CardContent>
            </Card>
            
            {/* 3. Disparados 1ª tentativa */}
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardContent className="p-4 text-center">
                {isLoadingExternalMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin text-yellow-600 mx-auto" />
                ) : (
                  <p className="text-3xl font-bold text-yellow-600">{metricasLigacao.disparados1.toLocaleString('pt-BR')}</p>
                )}
                <p className="text-sm text-yellow-600/80">1ª Tentativa</p>
                <p className="text-xs text-muted-foreground mt-1">(disparados)</p>
              </CardContent>
            </Card>
            
            {/* 4. Disparados 2ª tentativa */}
            <Card className="border-orange-200 dark:border-orange-900">
              <CardContent className="p-4 text-center">
                {isLoadingExternalMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
                ) : (
                  <p className="text-3xl font-bold text-orange-600">{metricasLigacao.disparados2.toLocaleString('pt-BR')}</p>
                )}
                <p className="text-sm text-orange-600/80">2ª+ Tentativa</p>
                <p className="text-xs text-muted-foreground mt-1">(disparados)</p>
              </CardContent>
            </Card>
            
            {/* 5. Em Fila */}
            <Card className="border-blue-200 dark:border-blue-900">
              <CardContent className="p-4 text-center">
                {isLoadingExternalMetrics ? (
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                ) : (
                  <p className="text-3xl font-bold text-blue-600">{metricasLigacao.emFila.toLocaleString('pt-BR')}</p>
                )}
                <p className="text-sm text-blue-600/80">Em Fila</p>
                <p className="text-xs text-muted-foreground mt-1">(aguardando retry)</p>
              </CardContent>
            </Card>
            
            {/* 6. Encerrados */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="border-green-200 dark:border-green-900 cursor-help">
                    <CardContent className="p-4 text-center">
                      {isLoadingExternalMetrics ? (
                        <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto" />
                      ) : (
                        <p className="text-3xl font-bold text-green-600">{metricasLigacao.encerrados.toLocaleString('pt-BR')}</p>
                      )}
                      <p className="text-sm text-green-600/80">Encerrados</p>
                      <p className="text-xs text-muted-foreground mt-1">(≥2 tent. ou sucesso)</p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    <p><strong>Motivos do encerramento:</strong></p>
                    <p>• ≥2 tentativas (limite atingido)</p>
                    <p>• Agendados: {metricasLigacao.agendados.toLocaleString('pt-BR')}</p>
                    <p>• WhatsApp enviado: {metricasLigacao.whatsappEnviado.toLocaleString('pt-BR')}</p>
                    <p>• Ligação atendida: {metricasLigacao.atendidos.toLocaleString('pt-BR')}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          /* Cards de métricas - IA WhatsApp ou Não-IA */
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{metricas.total.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-muted-foreground">Total de Contatos</p>
              </CardContent>
            </Card>
            {isIA && (
              <>
                <Card className="border-green-200 dark:border-green-900">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{metricas.disparados.toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-green-600/80">Disparados</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 dark:border-amber-900">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">{metricas.pendentes.toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-amber-600/80">Pendentes IA</p>
                  </CardContent>
                </Card>
              </>
            )}
            <Card className="border-primary/30">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{metricas.vendas.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-primary/80">Vendas</p>
              </CardContent>
            </Card>
          </div>
        )}

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
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status Lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isIA && (
                <Select value={disparoFilter} onValueChange={(v) => handleFilterChange('disparo', v)}>
                  <SelectTrigger className="w-[140px]">
                    <Send className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Disparo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    {isIALigacao && <SelectItem value="em_fila">Em Fila</SelectItem>}
                    <SelectItem value="disparado">Disparados</SelectItem>
                    <SelectItem value="encerrado">Encerrados</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {/* Filtros específicos IA Ligação */}
              {isIALigacao && (
                <>
                  <Select value={statusLigacaoFilter} onValueChange={(v) => handleFilterChange('statusLigacao', v)}>
                    <SelectTrigger className="w-[150px]">
                      <PhoneCall className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Ligação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp Enviado</SelectItem>
                      <SelectItem value="atendido">Atendido</SelectItem>
                      <SelectItem value="em_fila">Em Fila</SelectItem>
                      <SelectItem value="elegivel">Elegível</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={tentativasFilter} onValueChange={(v) => handleFilterChange('tentativas', v)}>
                    <SelectTrigger className="w-[130px]">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tentativas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      <SelectItem value="0">0 tentativas</SelectItem>
                      <SelectItem value="1">1 tentativa</SelectItem>
                      <SelectItem value="2">2 tentativas</SelectItem>
                      <SelectItem value="3+">3+ tentativas</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              
              {/* Filtro por data de criação */}
              <Input
                type="date"
                placeholder="Data início"
                value={dataInicioFilter}
                onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
                className="w-[140px]"
              />
              <Input
                type="date"
                placeholder="Data fim"
                value={dataFimFilter}
                onChange={(e) => handleFilterChange('dataFim', e.target.value)}
                className="w-[140px]"
              />
              
              {/* Botão limpar filtros */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-9">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            {/* Seção de Disparo IA */}
            {isIA && (isIALigacaoLocal ? (metricasLigacao ? metricasLigacao.total > 0 : (metricas.total > 0 || contatos.length > 0)) : (metricas.pendentes > 0 || canRedispatch)) && (
              <div className="border-t pt-4 space-y-3">
                {/* Observação sobre lotes */}
                <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <Send className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground">
                      <strong>Como funciona:</strong> Os disparos são enviados em lotes de <strong>{BATCH_SIZE.toLocaleString()}</strong> contatos por vez.
                    </p>
                    {metricas.pendentes > BATCH_SIZE && (
                      <p className="text-muted-foreground mt-1">
                        Para {metricas.pendentes.toLocaleString()} contatos, serão <strong>{Math.ceil(metricas.pendentes / BATCH_SIZE)} lotes</strong> enviados automaticamente em sequência.
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
                                  Preparando disparo...
                                </>
                              ) : (
                                <>
                                  {isIALigacao ? (
                                    <PhoneCall className="mr-2 h-4 w-4" />
                                  ) : (
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                  )}
                                  Disparar {isIALigacao ? 'Ligações' : 'WhatsApp'} ({(
                                    isIALigacao && metricasLigacao 
                                      ? metricasLigacao.pendentes 
                                      : metricas.pendentes
                                  ).toLocaleString()})
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {isIALigacao 
                                ? `Dispara pendentes em lotes de ${BATCH_SIZE.toLocaleString()}`
                                : `Dispara em lotes de ${BATCH_SIZE.toLocaleString()}`}
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

                      {/* Botão Redisparar Todos - apenas Admin/Master */}
                      {canRedispatch && metricas.disparados > 0 && (
                        <>
                          <div className="h-8 w-px bg-border" />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleRedisparoEmMassa}
                                  disabled={isDisparandoIA}
                                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Redisparar Todos ({metricas.disparados.toLocaleString()})
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reseta todos os contatos já disparados para pendente e permite redisparar</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
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
                            Disparar {isIALigacao ? 'Ligações' : 'WhatsApp'} ({(
                              isIALigacao && metricasLigacao 
                                ? metricasLigacao.pendentes 
                                : metricas.pendentes
                            ).toLocaleString()})
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
                        <TableHead className="w-[110px]">Status Lead</TableHead>
                        <TableHead className="w-[100px]">Origem</TableHead>
                        {isIA && <TableHead className="w-[130px]">Disparo IA</TableHead>}
                        {isIALigacao && <TableHead className="w-[80px] text-center">Tent.</TableHead>}
                        <TableHead className="w-[100px]">Criação</TableHead>
                        {isIA && <TableHead className="w-[100px] text-center">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContatos.map((contato) => (
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
                            <Badge className={statusColors[contato.status || ''] || 'bg-gray-100 text-gray-800'}>
                              {contato.status || 'Sem Status'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {contato.origem || '-'}
                          </TableCell>
                          {isIA && (
                            <TableCell>
                              {(() => {
                                // Normalizar telefone removendo +55
                                let telefoneNormalizado = contato.telefone?.replace(/\D/g, '') || '';
                                if (telefoneNormalizado.length > 11 && telefoneNormalizado.startsWith('55')) {
                                  telefoneNormalizado = telefoneNormalizado.substring(2);
                                }
                                const dadosExternos = isIALigacao ? contatosExternos.get(telefoneNormalizado) : null;
                                
                                // Para IA Ligação: usar dados externos
                                if (isIALigacao && dadosExternos) {
                                  const isEncerrado = dadosExternos.status_agendado || dadosExternos.enviado_whatsapp || dadosExternos.ligacao_atendida;
                                  const numTentativas = dadosExternos.num_tentativas || 0;
                                  const isEmFila = dadosExternos.ligacao_erro === true && !isEncerrado;
                                  
                                  if (isEncerrado) {
                                    return (
                                      <span className="flex items-center gap-1 text-orange-600 text-xs">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Encerrado
                                      </span>
                                    );
                                  }
                                  if (isEmFila) {
                                    return (
                                      <span className="flex items-center gap-1 text-blue-600 text-xs">
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Em Fila
                                      </span>
                                    );
                                  }
                                  if (numTentativas > 0) {
                                    return (
                                      <span className="flex items-center gap-1 text-green-600 text-xs">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Disparado
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="flex items-center gap-1 text-amber-600 text-xs">
                                      <Clock className="h-3.5 w-3.5" />
                                      Pendente
                                    </span>
                                  );
                                }
                                
                                // Para IA WhatsApp: usar data_disparo_ia local
                                if (contato.data_disparo_ia) {
                                  return (
                                    <span className="flex items-center gap-1 text-green-600 text-xs">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      {format(new Date(contato.data_disparo_ia), 'dd/MM HH:mm')}
                                    </span>
                                  );
                                }
                                return (
                                  <span className="flex items-center gap-1 text-amber-600 text-xs">
                                    <Clock className="h-3.5 w-3.5" />
                                    Pendente
                                  </span>
                                );
                              })()}
                            </TableCell>
                          )}
                          {/* Coluna Tentativas - apenas para IA Ligação */}
                          {isIALigacao && (
                            <TableCell className="text-center">
                              {(() => {
                                // Normalizar telefone removendo +55
                                let telefoneNormalizado = contato.telefone?.replace(/\D/g, '') || '';
                                if (telefoneNormalizado.length > 11 && telefoneNormalizado.startsWith('55')) {
                                  telefoneNormalizado = telefoneNormalizado.substring(2);
                                }
                                const dadosExternos = contatosExternos.get(telefoneNormalizado);
                                const tentativas = dadosExternos?.num_tentativas || 0;
                                
                                if (tentativas === 0) {
                                  return <span className="text-muted-foreground text-sm">0</span>;
                                }
                                
                                // Cor baseada no número de tentativas
                                const bgColor = tentativas >= 3 
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100' 
                                  : tentativas === 2 
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-100'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100';
                                
                                return (
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${bgColor}`}>
                                    {tentativas}
                                  </span>
                                );
                              })()}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground">
                            {contato.created_at ? format(new Date(contato.created_at), 'dd/MM/yy') : '-'}
                          </TableCell>
                          {/* Coluna Ações - disparo individual */}
                          {isIA && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {isIAWhatsApp && !contato.data_disparo_ia && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => handleDispararContato(contato)}
                                          disabled={disparandoContato === contato.id}
                                        >
                                          {disparandoContato === contato.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <MessageCircle className="h-4 w-4 text-green-600" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Disparar WhatsApp</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {isIALigacao && (
                                  (() => {
                                    let telefoneNormalizado = contato.telefone?.replace(/\D/g, '') || '';
                                    if (telefoneNormalizado.length > 11 && telefoneNormalizado.startsWith('55')) {
                                      telefoneNormalizado = telefoneNormalizado.substring(2);
                                    }
                                    const dadosExternos = contatosExternos.get(telefoneNormalizado);
                                    const isEncerrado = dadosExternos?.status_agendado || dadosExternos?.enviado_whatsapp || dadosExternos?.ligacao_atendida;
                                    const numTentativas = dadosExternos?.num_tentativas || 0;
                                    
                                    // Só mostrar botão se elegível (não encerrado e < 2 tentativas)
                                    // Admin/Master podem redisparar mesmo com tentativas >= 2
                                    if (!isEncerrado && (numTentativas < 2 || canRedispatch)) {
                                      return (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                onClick={() => handleDispararContato(contato)}
                                                disabled={disparandoContato === contato.id}
                                              >
                                                {disparandoContato === contato.id ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  <PhoneCall className="h-4 w-4 text-blue-600" />
                                                )}
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Disparar Ligação</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      );
                                    }
                                    return <span className="text-muted-foreground text-xs">-</span>;
                                  })()
                                )}
                                {isIAWhatsApp && contato.data_disparo_ia && (
                                  canRedispatch ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0"
                                            onClick={() => handleRedispararContato(contato)}
                                            disabled={disparandoContato === contato.id}
                                          >
                                            {disparandoContato === contato.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <RotateCcw className="h-4 w-4 text-orange-600" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Redisparar WhatsApp</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )
                                )}
                              </div>
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
                    Mostrando {(((currentPage - 1) * PAGE_SIZE) + 1).toLocaleString('pt-BR')} - {Math.min(currentPage * PAGE_SIZE, totalCount).toLocaleString('pt-BR')} de {totalCount.toLocaleString('pt-BR')} contatos
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
        jobId={activeJobId}
        onRetry={handleRetryJob}
      />

      {/* Modal de Simulação/Custo do Disparo */}
      <SimulacaoEventoModal
        isOpen={custoModal.isOpen}
        onClose={() => setCustoModal({ isOpen: false })}
        mode="disparo"
        onConfirm={executarDisparoConfirmado}
        eventoNome={prospeccao?.titulo || 'Evento'}
        canalEvento={prospeccao?.canal || ''}
        totalContatos={custoModal.quantidade || (isIALigacaoLocal && metricasLigacao ? metricasLigacao.pendentes : metricas.pendentes)}
      />
    </DashboardLayout>
  );
}
