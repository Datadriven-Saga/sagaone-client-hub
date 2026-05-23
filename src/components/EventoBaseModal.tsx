import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Users, Search, Filter, Send, Loader2, CheckCircle, Phone, Mail, Calendar, Clock, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UploadPlanilha } from '@/components/UploadPlanilha';
import { useUserAccessType } from '@/hooks/useUserAccessType';

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
  evento_confirmacao?: boolean | null;
}

interface EventoBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospeccao: Prospeccao | null;
  onDispararParaIA?: (prospeccaoId: string, canal: string) => Promise<void>;
  isDisparandoIA?: boolean;
}

type StatusFilter = 'todos' | 'Novo' | 'Atribuído' | 'Convidado' | 'Agendado' | 'Confirmado' | 'Check-in' | 'Venda' | 'Descartado' | 'Opt Out' | 'Desperdício';
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

export const EventoBaseModal = ({ 
  isOpen, 
  onClose, 
  prospeccao,
  onDispararParaIA,
  isDisparandoIA = false
}: EventoBaseModalProps) => {
  const [contatos, setContatos] = useState<ContatoEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [disparoFilter, setDisparoFilter] = useState<DisparoFilter>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const PAGE_SIZE = 50;
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  const { canUploadBase } = useUserAccessType();

  // Buscar contatos vinculados ao evento com paginação server-side
  useEffect(() => {
    const fetchContatos = async () => {
      if (!isOpen || !prospeccao?.id || !activeCompany?.id) return;

      setLoading(true);
      try {
        // Primeiro, contar total para métricas (rápido)
        const { count: totalContatos, error: countError } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id', { count: 'exact', head: true })
          .eq('prospeccao_id', prospeccao.id)
          .not('contato_id', 'is', null);

        if (countError) throw countError;
        setTotalCount(totalContatos || 0);

        if (!totalContatos || totalContatos === 0) {
          setContatos([]);
          setLoading(false);
          return;
        }

        // Buscar IDs da página atual via eventos_prospeccao
        const offset = (currentPage - 1) * PAGE_SIZE;
        const { data: eventosData, error: eventosError } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', prospeccao.id)
          .not('contato_id', 'is', null)
          .range(offset, offset + PAGE_SIZE - 1);

        if (eventosError) throw eventosError;

        const contatoIds = (eventosData || [])
          .map(e => e.contato_id)
          .filter(Boolean) as string[];

        if (contatoIds.length === 0) {
          setContatos([]);
          setLoading(false);
          return;
        }

        // Buscar dados dos contatos da página
        const { data: contatosData, error: contatosError } = await supabase
          .from('contatos')
          .select('id, nome, telefone, email, status, origem, created_at, updated_at, data_disparo_ia, responsavel_email, vendedor_nome')
          .in('id', contatoIds)
          .eq('empresa_id', activeCompany.id);

        if (contatosError) throw contatosError;
        setContatos(contatosData || []);
      } catch (error) {
        console.error('Erro ao buscar contatos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os contatos do evento",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContatos();
  }, [isOpen, prospeccao?.id, activeCompany?.id, currentPage, toast, refreshKey]);

  // Reset página quando modal abre/fecha ou evento muda
  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm('');
    setStatusFilter('todos');
    setDisparoFilter('todos');
  }, [isOpen, prospeccao?.id]);

  // Filtrar contatos
  const filteredContatos = useMemo(() => {
    return contatos.filter(contato => {
      // Filtro de busca
      const matchesSearch = !searchTerm || 
        contato.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contato.telefone?.includes(searchTerm) ||
        contato.email?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de status
      const matchesStatus = statusFilter === 'todos' || contato.status === statusFilter;

      // Filtro de disparo
      const matchesDisparo = 
        disparoFilter === 'todos' ||
        (disparoFilter === 'pendente' && !contato.data_disparo_ia) ||
        (disparoFilter === 'disparado' && contato.data_disparo_ia);

      return matchesSearch && matchesStatus && matchesDisparo;
    });
  }, [contatos, searchTerm, statusFilter, disparoFilter]);

  // Calcular métricas (usando total do servidor, não da página)
  const metricas = useMemo(() => {
    // Para métricas de disparo, usar dados da página atual (aproximação)
    const pendentesNaPagina = contatos.filter(c => !c.data_disparo_ia).length;
    const disparadosNaPagina = contatos.length - pendentesNaPagina;
    
    const porStatus: Record<string, number> = {};
    contatos.forEach(c => {
      const status = c.status || 'Sem Status';
      porStatus[status] = (porStatus[status] || 0) + 1;
    });

    return { 
      total: totalCount, 
      pendentes: pendentesNaPagina, 
      disparados: disparadosNaPagina, 
      porStatus 
    };
  }, [contatos, totalCount]);

  // Calcular páginas
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Exportar dados
  const handleExport = () => {
    if (filteredContatos.length === 0) {
      toast({ title: "Atenção", description: "Nenhum contato para exportar" });
      return;
    }

    const csvContent = [
      'Nome,Telefone,Email,Status,Origem,Vendedor,Data Criação,Último Update,Disparo IA',
      ...filteredContatos.map(c => 
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

    toast({ title: "Sucesso", description: `${filteredContatos.length} contatos exportados` });
  };

  // Status únicos para o filtro
  const statusOptions = useMemo(() => {
    const statuses = new Set(contatos.map(c => c.status).filter(Boolean));
    return Array.from(statuses) as StatusFilter[];
  }, [contatos]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const isIA = prospeccao?.canal?.toLowerCase().includes('whatsapp') || 
               prospeccao?.canal?.toLowerCase().includes('liga');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Base do Evento: {prospeccao?.titulo}
          </DialogTitle>
          
          {/* Período do evento */}
          {(prospeccao?.data_inicio || prospeccao?.data_fim) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Calendar className="h-4 w-4" />
              <span>
                {prospeccao.data_inicio ? formatDate(prospeccao.data_inicio) : ''} 
                {prospeccao.data_inicio && prospeccao.data_fim ? ' até ' : ''} 
                {prospeccao.data_fim ? formatDate(prospeccao.data_fim) : ''}
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Métricas resumidas */}
        <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{metricas.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          {isIA && (
            <>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{metricas.pendentes}</p>
                <p className="text-xs text-amber-600/80">Pendentes IA</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{metricas.disparados}</p>
                <p className="text-xs text-green-600/80">Disparados</p>
              </div>
            </>
          )}
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{metricas.porStatus['Venda'] || 0}</p>
            <p className="text-xs text-primary/80">Vendas</p>
          </div>
        </div>

        {/* Filtros e ações */}
        <div className="flex-shrink-0 flex flex-wrap items-center gap-3 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>
                  {status} ({metricas.porStatus[status] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isIA && (
            <Select value={disparoFilter} onValueChange={(v) => setDisparoFilter(v as DisparoFilter)}>
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

          <div className="flex gap-2">
            {isIA && metricas.pendentes > 0 && onDispararParaIA && (
              <Button
                variant="default"
                size="sm"
                onClick={() => prospeccao && onDispararParaIA(prospeccao.id, prospeccao.canal)}
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
                    Disparar ({metricas.pendentes})
                  </>
                )}
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>

            {canUploadBase && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowImport(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar base
              </Button>
            )}
          </div>
        </div>

        {/* Tabela de contatos */}
        <ScrollIndicator className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredContatos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {contatos.length === 0 ? 'Nenhum contato importado' : 'Nenhum contato encontrado'}
              </p>
              <p className="text-sm">
                {contatos.length === 0 
                  ? 'Importe uma base de contatos para este evento'
                  : 'Tente ajustar os filtros de busca'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[200px]">Nome</TableHead>
                    <TableHead className="w-[140px]">Telefone</TableHead>
                    <TableHead className="w-[180px]">Email</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[100px]">Origem</TableHead>
                    <TableHead className="w-[130px]">Vendedor</TableHead>
                    {isIA && <TableHead className="w-[130px]">Disparo IA</TableHead>}
                    <TableHead className="w-[100px]">Criação</TableHead>
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
                        {contato.email ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{contato.email}</span>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ScrollIndicator>

        {/* Rodapé com paginação */}
        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
          <span>
            Página {currentPage} de {totalPages || 1} ({totalCount} contatos)
          </span>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2">{currentPage} / {totalPages || 1}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Importação travada neste evento — abre o UploadPlanilha em modo controlado */}
      {prospeccao && (
        <UploadPlanilha
          prospeccoes={[]}
          lockedProspeccao={{ id: prospeccao.id, titulo: prospeccao.titulo }}
          open={showImport}
          onOpenChange={setShowImport}
          hideTrigger
          onImportComplete={() => setRefreshKey(k => k + 1)}
        />
      )}
    </Dialog>
  );
};
