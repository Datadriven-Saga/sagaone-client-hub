import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Download, Users, Search, Filter, Send, Loader2, CheckCircle, Phone, Mail, 
  Calendar, Clock, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContatoEvento {
  id: string;
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

const PAGE_SIZE = 50;

export default function EventoBase() {
  const { eventoId } = useParams<{ eventoId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { activeCompany } = useCompany();

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
  const [contatoIds, setContatoIds] = useState<string[]>([]);

  // Buscar dados do evento
  useEffect(() => {
    const fetchProspeccao = async () => {
      if (!eventoId || !activeCompany?.id) return;

      const { data, error } = await supabase
        .from('prospeccoes')
        .select('id, titulo, canal, data_inicio, data_fim, meta_convites, meta_confirmacoes, meta_checkins')
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

  // Buscar IDs dos contatos do evento e métricas
  useEffect(() => {
    const fetchContatoIds = async () => {
      if (!eventoId || !activeCompany?.id) return;

      // Buscar todos os IDs de contatos vinculados ao evento com paginação
      // Usando 500 por página para evitar limite de 1000 do Supabase
      const PAGE_SIZE_IDS = 500;
      let allIds: string[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const from = page * PAGE_SIZE_IDS;
        const to = from + PAGE_SIZE_IDS - 1;
        
        const { data: eventosData, error: eventosError } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', eventoId)
          .range(from, to);

        if (eventosError) {
          console.error('Erro ao buscar contatos:', eventosError);
          break;
        }

        const ids = (eventosData || []).map(e => e.contato_id).filter(Boolean) as string[];
        allIds = [...allIds, ...ids];
        
        // Se retornou menos que o tamanho da página, não há mais dados
        hasMore = eventosData && eventosData.length === PAGE_SIZE_IDS;
        page++;
        
        // Limite de segurança para evitar loops infinitos
        if (page > 100) {
          console.warn('⚠️ Limite de páginas atingido (100)');
          break;
        }
      }
      
      console.log(`📊 Total de contatos no evento: ${allIds.length}`);
      setContatoIds(allIds);

      if (allIds.length === 0) {
        setMetricas({ total: 0, pendentes: 0, disparados: 0, vendas: 0 });
        setStatusOptions([]);
        return;
      }

      // Buscar métricas gerais (contagem por status e disparo)
      // Fazer em lotes para evitar limite de array
      const BATCH_SIZE = 200;
      let allContatos: { status: string | null; data_disparo_ia: string | null }[] = [];
      const uniqueStatuses = new Set<string>();

      for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
        const batchIds = allIds.slice(i, i + BATCH_SIZE);
        const { data: contatosData } = await supabase
          .from('contatos')
          .select('status, data_disparo_ia')
          .in('id', batchIds)
          .eq('empresa_id', activeCompany.id);

        if (contatosData) {
          allContatos = [...allContatos, ...contatosData];
          contatosData.forEach(c => {
            if (c.status) uniqueStatuses.add(c.status);
          });
        }
      }

      // Calcular métricas
      const total = allContatos.length;
      const pendentes = allContatos.filter(c => !c.data_disparo_ia).length;
      const disparados = total - pendentes;
      const vendas = allContatos.filter(c => c.status === 'Venda').length;

      setMetricas({ total, pendentes, disparados, vendas });
      setStatusOptions(Array.from(uniqueStatuses).sort());
      setTotalCount(total);
    };

    fetchContatoIds();
  }, [eventoId, activeCompany?.id]);

  // Buscar contatos paginados - usando lotes para consultas com muitos IDs
  const fetchContatos = useCallback(async () => {
    if (!eventoId || !activeCompany?.id || contatoIds.length === 0) {
      setContatos([]);
      setLoadingPage(false);
      setLoading(false);
      return;
    }

    setLoadingPage(true);

    try {
      // Para evitar URL longa, vamos usar paginação manual sobre os IDs
      // Primeiro, filtrar os IDs relevantes usando lotes menores
      const IN_BATCH_SIZE = 200;
      
      // Se não há filtro de busca/status, podemos paginar diretamente sobre os IDs
      // Se há filtro, precisamos buscar todos os IDs filtrados primeiro
      
      if (!searchTerm && statusFilter === 'todos' && disparoFilter === 'todos') {
        // Paginação simples: pegar slice dos IDs e buscar
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = Math.min(from + PAGE_SIZE, contatoIds.length);
        const pageIds = contatoIds.slice(from, to);
        
        if (pageIds.length === 0) {
          setContatos([]);
          setTotalCount(contatoIds.length);
          setLoadingPage(false);
          setLoading(false);
          return;
        }
        
        const { data, error } = await supabase
          .from('contatos')
          .select('id, nome, telefone, email, status, origem, created_at, updated_at, data_disparo_ia, responsavel_email, vendedor_nome')
          .in('id', pageIds)
          .eq('empresa_id', activeCompany.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setContatos(data || []);
        setTotalCount(contatoIds.length);
      } else {
        // Com filtros: buscar IDs filtrados em lotes, depois paginar
        let filteredContatos: ContatoEvento[] = [];
        
        for (let i = 0; i < contatoIds.length; i += IN_BATCH_SIZE) {
          const batchIds = contatoIds.slice(i, i + IN_BATCH_SIZE);
          let query = supabase
            .from('contatos')
            .select('id, nome, telefone, email, status, origem, created_at, updated_at, data_disparo_ia, responsavel_email, vendedor_nome')
            .in('id', batchIds)
            .eq('empresa_id', activeCompany.id);
          
          if (searchTerm) {
            query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
          }
          if (statusFilter !== 'todos') {
            query = query.eq('status', statusFilter as any);
          }
          if (disparoFilter === 'pendente') {
            query = query.is('data_disparo_ia', null);
          } else if (disparoFilter === 'disparado') {
            query = query.not('data_disparo_ia', 'is', null);
          }
          
          const { data } = await query;
          if (data) filteredContatos = [...filteredContatos, ...data];
        }
        
        // Ordenar por data de criação (mais recentes primeiro)
        filteredContatos.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        
        // Aplicar paginação
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = Math.min(from + PAGE_SIZE, filteredContatos.length);
        
        setContatos(filteredContatos.slice(from, to));
        setTotalCount(filteredContatos.length);
      }
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({ title: "Erro", description: "Erro ao carregar contatos", variant: "destructive" });
    } finally {
      setLoadingPage(false);
      setLoading(false);
    }
  }, [eventoId, activeCompany?.id, contatoIds, searchTerm, statusFilter, disparoFilter, currentPage, toast]);

  // Executar busca quando filtros mudarem
  useEffect(() => {
    if (contatoIds.length > 0) {
      fetchContatos();
    }
  }, [fetchContatos, contatoIds]);

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

  // Exportar dados
  const handleExport = async () => {
    if (contatoIds.length === 0) {
      toast({ title: "Atenção", description: "Nenhum contato para exportar" });
      return;
    }

    toast({ title: "Exportando...", description: "Preparando arquivo CSV" });

    try {
      // Buscar todos os contatos (sem paginação) para export
      const BATCH_SIZE = 500;
      let allContatos: ContatoEvento[] = [];

      for (let i = 0; i < contatoIds.length; i += BATCH_SIZE) {
        const batchIds = contatoIds.slice(i, i + BATCH_SIZE);
        let query = supabase
          .from('contatos')
          .select('id, nome, telefone, email, status, origem, created_at, updated_at, data_disparo_ia, responsavel_email, vendedor_nome')
          .in('id', batchIds)
          .eq('empresa_id', activeCompany!.id);

        // Aplicar mesmos filtros
        if (searchTerm) {
          query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }
        if (statusFilter !== 'todos') {
          query = query.eq('status', statusFilter as any);
        }
        if (disparoFilter === 'pendente') {
          query = query.is('data_disparo_ia', null);
        } else if (disparoFilter === 'disparado') {
          query = query.not('data_disparo_ia', 'is', null);
        }

        const { data } = await query;
        if (data) allContatos = [...allContatos, ...data];
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
    }
  };

  // Buscar contatos pendentes para disparo
  const fetchContatosPendentes = async (idsToFetch?: string[]): Promise<ContatoEvento[]> => {
    if (!activeCompany?.id) return [];
    
    const targetIds = idsToFetch || contatoIds;
    if (targetIds.length === 0) return [];
    
    const BATCH_SIZE = 500;
    let allContatos: ContatoEvento[] = [];

    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
      const batchIds = targetIds.slice(i, i + BATCH_SIZE);
      const { data } = await supabase
        .from('contatos')
        .select('id, nome, telefone, email, status, origem, created_at, updated_at, data_disparo_ia, responsavel_email, vendedor_nome')
        .in('id', batchIds)
        .eq('empresa_id', activeCompany.id)
        .is('data_disparo_ia', null); // Apenas pendentes

      if (data) allContatos = [...allContatos, ...data];
    }

    return allContatos;
  };

  // Disparar IA para todos os pendentes
  const handleDispararTodos = async () => {
    if (!prospeccao || !activeCompany?.id) return;

    setIsDisparandoIA(true);
    try {
      // Buscar todos os contatos pendentes
      const contatosPendentes = await fetchContatosPendentes();
      
      if (contatosPendentes.length === 0) {
        toast({ title: "Atenção", description: "Nenhum contato pendente para disparar" });
        return;
      }

      // Formatar leads no formato esperado pela edge function
      const leads = contatosPendentes.map(c => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        email: c.email,
        status: c.status,
        origem: c.origem
      }));

      console.log('🚀 Disparando para IA:', { 
        total: leads.length, 
        empresa_id: activeCompany.id, 
        prospeccao_id: prospeccao.id,
        canal: prospeccao.canal 
      });

      const { data, error } = await supabase.functions.invoke('dispatch-leads-webhook', {
        body: {
          leads,
          empresa_id: activeCompany.id,
          prospeccao_id: prospeccao.id,
          canal: prospeccao.canal
        }
      });

      if (error) throw error;

      console.log('✅ Resposta do disparo:', data);

      toast({
        title: "Sucesso",
        description: `Disparo iniciado para ${leads.length} contatos pendentes`
      });

      // Recarregar dados
      fetchContatos();
    } catch (error) {
      console.error('Erro ao disparar IA:', error);
      toast({ title: "Erro", description: "Erro ao iniciar disparo", variant: "destructive" });
    } finally {
      setIsDisparandoIA(false);
    }
  };

  // Disparar IA para contato individual
  const handleDispararContato = async (contato: ContatoEvento) => {
    if (!prospeccao || !activeCompany?.id) return;

    setDisparandoContato(contato.id);
    try {
      // Formatar lead no formato esperado
      const leads = [{
        id: contato.id,
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
          canal: prospeccao.canal
        }
      });

      if (error) throw error;

      console.log('✅ Resposta do disparo individual:', data);

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  const isIA = prospeccao?.canal?.toLowerCase().includes('whatsapp') || 
               prospeccao?.canal?.toLowerCase().includes('liga');

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
            <Button variant="outline" size="sm" onClick={fetchContatos} disabled={loadingPage}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingPage ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
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

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
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

              {isIA && metricas.pendentes > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDispararTodos}
                  disabled={isDisparandoIA}
                >
                  {isDisparandoIA ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Disparar Todos ({metricas.pendentes})
                    </>
                  )}
                </Button>
              )}
            </div>
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
                              {!contato.data_disparo_ia && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDispararContato(contato)}
                                  disabled={disparandoContato === contato.id}
                                  className="h-8 px-2"
                                >
                                  {disparandoContato === contato.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
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
    </DashboardLayout>
  );
}
