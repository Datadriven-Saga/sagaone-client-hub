import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Database, Loader2, Filter, Save, History, Trash2, X, Search, CheckSquare, ChevronDown, AlertTriangle, Lock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAccessType } from '@/hooks/useUserAccessType';
import { formatPhone } from '@/lib/utils';

interface Prospeccao {
  id: string;
  titulo: string;
}

interface PoolCliente {
  id: string;
  empresa_id: string;
  codigo_proposta: string | null;
  telefone: string;
  nome_cliente: string | null;
  email_cliente: string | null;
  origem: string | null;
  canal: string | null;
  veiculo_interesse: string | null;
  motivo_nao_venda: string | null;
  status_crm: string | null;
  lead_maia: string | null;
  lead_pri: string | null;
  loja_nome: string | null;
  criado_em_origem?: string | null;
}

interface Facets {
  marca: string;
  uf: string;
  total: number;
  ddds: string[];
  motivos: string[];
  status_crm: string[];
  origens: string[];
  canais: string[];
  veiculos: string[];
  lojas: string[];
  data_min?: string | null;
  data_max?: string | null;
}

interface Filtros {
  ddds: string[];
  motivos: string[];
  status_crm: string[];
  origens: string[];
  canais: string[];
  veiculos: string[];
  lojas: string[];
  lead_maia?: boolean;
  lead_pri?: boolean;
}

interface SegmentacaoSalva {
  id: string;
  nome: string;
  marca: string;
  uf: string;
  filtros: Filtros;
  total_resultados: number;
  created_at: string;
}

interface ImportarDoDataLakeProps {
  prospeccoes: Prospeccao[];
  onImportComplete?: () => void;
}

const emptyFiltros: Filtros = {
  ddds: [], motivos: [], status_crm: [], origens: [], canais: [], veiculos: [], lojas: [],
};

function buildFiltrosPayload(f: Filtros): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.ddds.length) out.ddds = f.ddds;
  if (f.motivos.length) out.motivos = f.motivos;
  if (f.status_crm.length) out.status_crm = f.status_crm;
  if (f.origens.length) out.origens = f.origens;
  if (f.canais.length) out.canais = f.canais;
  if (f.veiculos.length) out.veiculos = f.veiculos;
  if (f.lojas.length) out.lojas = f.lojas;
  if (f.lead_maia !== undefined) out.lead_maia = f.lead_maia;
  if (f.lead_pri !== undefined) out.lead_pri = f.lead_pri;
  return out;
}

/**
 * Multi-select chip-style for an array of options.
 */
function ChipMultiSelect({ label, options, value, onChange, searchable }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };
  if (!options.length) return null;
  const filtered = searchable && query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  const allFilteredSelected = filtered.length > 0 && filtered.every(o => value.includes(o));
  const selectAllFiltered = () => {
    if (allFilteredSelected) {
      onChange(value.filter(v => !filtered.includes(v)));
    } else {
      const set = new Set(value);
      filtered.forEach(o => set.add(o));
      onChange(Array.from(set));
    }
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label} {value.length > 0 && <span className="text-muted-foreground">({value.length})</span>}</Label>
      {searchable && (
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            onClick={selectAllFiltered}
            disabled={filtered.length === 0}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1" />
            {allFilteredSelected ? 'Desmarcar' : 'Marcar'} {query.trim() ? `(${filtered.length})` : 'todos'}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-md border bg-muted/30">
        {filtered.length === 0 ? (
          <span className="text-xs text-muted-foreground">Nenhum resultado</span>
        ) : filtered.map(opt => (
          <Badge
            key={opt}
            variant={value.includes(opt) ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => toggle(opt)}
          >
            {opt}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const ImportarDoDataLake = ({ prospeccoes, onImportComplete }: ImportarDoDataLakeProps) => {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { getPermissionValor, permissions } = useUserAccessType();
  const isFull = !!permissions['canImportPoolFull'];
  const isReadOnly = !isFull && !!permissions['canImportPoolReadOnly'];
  const hasAccess = isFull || isReadOnly;
  const poolConfig = getPermissionValor(isFull ? 'canImportPoolFull' : 'canImportPoolReadOnly')
    || getPermissionValor('canImportPool');
  const diasMaxPermitido: number | null = poolConfig?.dias_max ?? null;
  const eventosPermitidosCfg: string = poolConfig?.eventos_permitidos ?? 'todos';

  const [isOpen, setIsOpen] = useState(false);
  const [selectedProspeccao, setSelectedProspeccao] = useState<string>('');
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loadingFacets, setLoadingFacets] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(emptyFiltros);
  const [diasAtras, setDiasAtras] = useState<number>(30);
  const [resultados, setResultados] = useState<PoolCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalServidor, setTotalServidor] = useState<number>(0);
  const [cursor, setCursor] = useState<{ data: string; id: string } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [autoLoadingAll, setAutoLoadingAll] = useState(false);
  const cancelAutoRef = useRef(false);
  // Filtros locais (Excel-like) sobre o conjunto carregado
  const [nomeFiltro, setNomeFiltro] = useState<{ termos: Set<string>; vazios: boolean; naoParece: boolean } | null>(null);
  const [telFiltro, setTelFiltro] = useState<{ termos: Set<string>; vazios: boolean } | null>(null);
  const [step, setStep] = useState<'filtros' | 'edicao'>('filtros');
  const [edits, setEdits] = useState<Record<string, { telefone: string; nome: string }>>({});
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const [historico, setHistorico] = useState<SegmentacaoSalva[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);

  // Carrega facets e histórico quando abre
  useEffect(() => {
    if (!isOpen || !activeCompany?.id) return;
    let cancelled = false;
    (async () => {
      setLoadingFacets(true);
      try {
        const { data, error } = await supabase.rpc('get_pool_facets_for_empresa', { p_empresa_id: activeCompany.id });
        if (error) throw error;
        if (!cancelled) setFacets(data as unknown as Facets);
      } catch (err: any) {
        toast({ title: 'Erro ao carregar filtros', description: err.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoadingFacets(false);
      }
    })();
    // histórico de segmentações da mesma marca/uf
    (async () => {
      const { data: emp } = await supabase.from('empresas').select('marca, uf').eq('id', activeCompany.id).single();
      if (!emp) return;
      const { data } = await supabase
        .from('pool_segmentacoes')
        .select('id, nome, marca, uf, filtros, total_resultados, created_at')
        .eq('marca', emp.marca)
        .eq('uf', emp.uf)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled && data) setHistorico(data as unknown as SegmentacaoSalva[]);
    })();
    return () => { cancelled = true; };
  }, [isOpen, activeCompany?.id, toast]);

  const PAGE_SIZE = 200;

  const fetchPage = useCallback(async (opts: { reset: boolean; cursor?: { data: string; id: string } | null }) => {
    if (!activeCompany?.id) return null;
    const payload = buildFiltrosPayload(filtros);
    (payload as any).dias_atras = diasAtras;
    const { data, error } = await supabase.rpc('get_pool_clientes_for_empresa', {
      p_empresa_id: activeCompany.id,
      p_filtros: payload as never,
      p_limit: PAGE_SIZE,
      p_cursor_data: opts.cursor?.data ?? null,
      p_cursor_id: opts.cursor?.id ?? null,
      p_with_total: opts.reset,
    } as any);
    if (error) throw error;
    const resp = data as unknown as { items: PoolCliente[]; total: number | null };
    return resp;
  }, [activeCompany?.id, filtros, diasAtras]);

  const buscar = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    cancelAutoRef.current = true; // cancela auto-load anterior
    try {
      const resp = await fetchPage({ reset: true, cursor: null });
      if (!resp) return;
      const list = resp.items || [];
      setResultados(list);
      setTotalServidor(resp.total ?? list.length);
      const last = list[list.length - 1];
      const more = list.length === PAGE_SIZE;
      setHasMore(more);
      setCursor(more && last && last.criado_em_origem ? { data: last.criado_em_origem, id: last.id } : null);
      const initial: Record<string, { telefone: string; nome: string }> = {};
      list.forEach(r => { initial[r.id] = { telefone: r.telefone || '', nome: r.nome_cliente || '' }; });
      setEdits(initial);
      setExcluidos(new Set());
      toast({ title: 'Busca realizada', description: `${list.length} de ~${resp.total ?? list.length} carregados` });
    } catch (err: any) {
      toast({ title: 'Erro na busca', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, fetchPage, toast]);

  const carregarMais = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const resp = await fetchPage({ reset: false, cursor });
      if (!resp) return;
      const list = resp.items || [];
      setResultados(prev => {
        const next = [...prev, ...list];
        setEdits(e => {
          const merged = { ...e };
          list.forEach(r => { if (!merged[r.id]) merged[r.id] = { telefone: r.telefone || '', nome: r.nome_cliente || '' }; });
          return merged;
        });
        return next;
      });
      const last = list[list.length - 1];
      const more = list.length === PAGE_SIZE;
      setHasMore(more);
      setCursor(more && last && last.criado_em_origem ? { data: last.criado_em_origem, id: last.id } : null);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar mais', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, fetchPage, toast]);

  // Auto-load até o fim quando filtro local está ativo
  const filtroLocalAtivo = !!nomeFiltro || !!telFiltro;
  useEffect(() => {
    if (!filtroLocalAtivo || !hasMore || autoLoadingAll || loading || loadingMore) return;
    cancelAutoRef.current = false;
    setAutoLoadingAll(true);
    (async () => {
      let curCursor = cursor;
      while (curCursor && !cancelAutoRef.current) {
        const resp = await fetchPage({ reset: false, cursor: curCursor }).catch(() => null);
        if (!resp) break;
        const list = resp.items || [];
        setResultados(prev => {
          setEdits(e => {
            const merged = { ...e };
            list.forEach(r => { if (!merged[r.id]) merged[r.id] = { telefone: r.telefone || '', nome: r.nome_cliente || '' }; });
            return merged;
          });
          return [...prev, ...list];
        });
        const last = list[list.length - 1];
        if (list.length < PAGE_SIZE || !last || !last.criado_em_origem) {
          curCursor = null;
          setHasMore(false);
          setCursor(null);
          break;
        }
        curCursor = { data: last.criado_em_origem, id: last.id };
        setCursor(curCursor);
      }
      setAutoLoadingAll(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroLocalAtivo]);

  const handleAvancar = async () => {
    if (!selectedProspeccao) {
      toast({ title: 'Selecione um evento', variant: 'destructive' });
      return;
    }
    if (resultados.length === 0) {
      toast({ title: 'Faça uma busca primeiro', variant: 'destructive' });
      return;
    }
    // Salva log de segmentação automaticamente (nome auto)
    if (user && facets) {
      const ts = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const nomeAuto = `SEG-${facets.marca?.toUpperCase()}-${facets.uf?.toUpperCase()}-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}`;
      await supabase.from('pool_segmentacoes').insert({
        empresa_id: activeCompany!.id,
        prospeccao_id: selectedProspeccao,
        criado_por: user.id,
        nome: nomeAuto,
        marca: facets.marca,
        uf: facets.uf,
        filtros: buildFiltrosPayload(filtros) as never,
        total_resultados: resultados.length,
      });
    }
    setStep('edicao');
  };

  const aplicarSegmentacaoAnterior = (seg: SegmentacaoSalva) => {
    setFiltros({ ...emptyFiltros, ...(seg.filtros || {}) });
    setShowHistorico(false);
    toast({ title: 'Segmentação carregada', description: seg.nome });
  };

  const importar = async () => {
    if (!selectedProspeccao || !activeCompany?.id) return;
    const itens = resultados
      .filter(r => !excluidos.has(r.id))
      .map(r => {
        const e = edits[r.id];
        return {
          pool_id: r.id,
          telefone: e?.telefone || r.telefone,
          nome: e?.nome || r.nome_cliente || '',
          email: r.email_cliente,
          codigo_proposta: r.codigo_proposta,
        };
      });
    if (itens.length === 0) {
      toast({ title: 'Nenhum cliente para importar', variant: 'destructive' });
      return;
    }
    setImportando(true);
    try {
      const { data, error } = await supabase.rpc('importar_pool_para_evento', {
        p_empresa_id: activeCompany.id,
        p_prospeccao_id: selectedProspeccao,
        p_itens: itens as any,
      });
      if (error) throw error;
      const r = data as any;
      toast({
        title: 'Importação concluída',
        description: `${r.linked} vinculados • ${r.already_linked} já existiam • ${r.errors} erros`,
      });
      setIsOpen(false);
      setStep('filtros');
      setResultados([]);
      setExcluidos(new Set());
      setFiltros(emptyFiltros);
      onImportComplete?.();
    } catch (err: any) {
      toast({ title: 'Erro ao importar', description: err.message, variant: 'destructive' });
    } finally {
      setImportando(false);
    }
  };

  const visiveis = useMemo(() => resultados.filter(r => !excluidos.has(r.id)), [resultados, excluidos]);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) { setStep('filtros'); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="p-3 h-auto flex items-center gap-2">
          <Database size={18} />
          <span className="text-sm">Segmentar Base</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {step === 'filtros' ? 'Segmentar Base' : 'Revisar e Importar'}
            {facets && (
              <Badge variant="secondary" className="ml-2">{facets.marca} / {facets.uf}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'filtros' ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Evento + histórico */}
            <Card className="p-4 space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Evento de destino</Label>
                  <Select value={selectedProspeccao} onValueChange={setSelectedProspeccao}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Escolha o evento..." /></SelectTrigger>
                    <SelectContent>
                      {prospeccoes.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={() => setShowHistorico(s => !s)}>
                  <History className="h-4 w-4 mr-2" /> Histórico ({historico.length})
                </Button>
              </div>

              {showHistorico && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {historico.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Nenhuma segmentação anterior para essa marca/UF.</p>
                  ) : historico.map(seg => (
                    <button
                      key={seg.id}
                      onClick={() => aplicarSegmentacaoAnterior(seg)}
                      className="w-full text-left p-2 hover:bg-muted border-b last:border-0 flex justify-between items-center text-xs"
                    >
                      <span className="font-mono">{seg.nome}</span>
                      <span className="text-muted-foreground">{seg.total_resultados} leads · {new Date(seg.created_at).toLocaleDateString('pt-BR')}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Filtros */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4" />
                <h4 className="font-medium text-sm">Filtros de segmentação</h4>
                {facets && <Badge variant="outline">Total na base: {facets.total}</Badge>}
              </div>

              {loadingFacets ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando filtros disponíveis...
                </div>
              ) : !facets || facets.total === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum cliente disponível no DataLake para {facets?.marca}/{facets?.uf}.</p>
              ) : (
                <>
                {(() => {
                  const dataMinDias = facets.data_min
                    ? Math.max(1, Math.floor((Date.now() - new Date(facets.data_min).getTime()) / 86400000))
                    : 365;
                  const sliderMax = diasMaxPermitido != null
                    ? Math.min(diasMaxPermitido, dataMinDias)
                    : dataMinDias;
                  const effectiveDias = Math.min(diasAtras, sliderMax);
                  const dataInicio = new Date(Date.now() - effectiveDias * 86400000);
                  return (
                    <div className="mb-4 p-3 rounded-md border bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">
                          Período: últimos <span className="text-foreground font-bold">{effectiveDias}</span> dias
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          A partir de {dataInicio.toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={sliderMax}
                        step={1}
                        value={[effectiveDias]}
                        onValueChange={(v) => setDiasAtras(v[0])}
                      />
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>1 dia</span>
                        <span>
                          {diasMaxPermitido != null
                            ? `Seu acesso permite até ${diasMaxPermitido} dias`
                            : `Disponível até ${sliderMax} dias`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ChipMultiSelect label="DDD" options={facets.ddds} value={filtros.ddds} onChange={v => setFiltros(f => ({ ...f, ddds: v }))} />
                  <ChipMultiSelect label="Motivo não-venda" options={facets.motivos} value={filtros.motivos} onChange={v => setFiltros(f => ({ ...f, motivos: v }))} />
                  <ChipMultiSelect label="Status CRM" options={facets.status_crm} value={filtros.status_crm} onChange={v => setFiltros(f => ({ ...f, status_crm: v }))} />
                  <ChipMultiSelect label="Origem" options={facets.origens} value={filtros.origens} onChange={v => setFiltros(f => ({ ...f, origens: v }))} />
                  <ChipMultiSelect label="Canal" options={facets.canais} value={filtros.canais} onChange={v => setFiltros(f => ({ ...f, canais: v }))} />
                  <ChipMultiSelect label="Veículo de interesse" options={facets.veiculos} value={filtros.veiculos} onChange={v => setFiltros(f => ({ ...f, veiculos: v }))} searchable />
                  <ChipMultiSelect label="Loja" options={facets.lojas || []} value={filtros.lojas} onChange={v => setFiltros(f => ({ ...f, lojas: v }))} />

                  <div className="flex items-center justify-between border rounded-md p-2.5">
                    <Label className="text-xs">Apenas Lead MAIA</Label>
                    <Switch checked={!!filtros.lead_maia} onCheckedChange={(c) => setFiltros(f => ({ ...f, lead_maia: c ? true : undefined }))} />
                  </div>
                  <div className="flex items-center justify-between border rounded-md p-2.5">
                    <Label className="text-xs">Apenas Lead PRI</Label>
                    <Switch checked={!!filtros.lead_pri} onCheckedChange={(c) => setFiltros(f => ({ ...f, lead_pri: c ? true : undefined }))} />
                  </div>
                </div>
                </>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <Button variant="ghost" size="sm" onClick={() => setFiltros(emptyFiltros)}>
                  <X className="h-4 w-4 mr-1" /> Limpar filtros
                </Button>
                <Button onClick={buscar} disabled={loading || !facets || facets.total === 0}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Filter className="h-4 w-4 mr-2" />}
                  Buscar leads
                </Button>
              </div>
            </Card>

            {/* Resultado prévia */}
            {resultados.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Pré-visualização ({resultados.length} leads)</h4>
                  <div className="flex items-center gap-2">
                    {!selectedProspeccao && (
                      <span className="text-xs text-amber-500">
                        Selecione um evento de destino acima para avançar
                      </span>
                    )}
                    <Button onClick={handleAvancar} disabled={!selectedProspeccao}>
                      Avançar para edição
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  No próximo passo você poderá editar telefone/nome e remover linhas antes da importação.
                </p>
                <div className="mt-3 border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 text-xs">Nome</TableHead>
                        <TableHead className="h-8 text-xs">Telefone</TableHead>
                        <TableHead className="h-8 text-xs">Loja</TableHead>
                        <TableHead className="h-8 text-xs">Origem</TableHead>
                        <TableHead className="h-8 text-xs">Status CRM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultados.slice(0, 5).map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="py-1.5 text-xs">{r.nome_cliente || '—'}</TableCell>
                          <TableCell className="py-1.5 text-xs font-mono">{formatPhone(r.telefone) || r.telefone}</TableCell>
                          <TableCell className="py-1.5 text-xs text-muted-foreground">{r.loja_nome || '—'}</TableCell>
                          <TableCell className="py-1.5 text-xs">{r.origem || '—'}</TableCell>
                          <TableCell className="py-1.5 text-xs">{r.status_crm || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {resultados.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando 5 de {resultados.length} resultados.
                  </p>
                )}
              </Card>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3">
              <div className="text-sm">
                <span className="font-medium">{visiveis.length}</span> de <span>{resultados.length}</span> serão importados
                {excluidos.size > 0 && <span className="text-muted-foreground"> • {excluidos.size} removidos</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('filtros')}>Voltar</Button>
                <Button onClick={importar} disabled={importando || visiveis.length === 0}>
                  {importando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Importar para o evento
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status CRM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map(r => {
                    const e = edits[r.id];
                    const isExcl = excluidos.has(r.id);
                    return (
                      <TableRow key={r.id} className={isExcl ? 'opacity-40' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={!isExcl}
                            onCheckedChange={(c) => {
                              setExcluidos(prev => {
                                const next = new Set(prev);
                                if (c) next.delete(r.id); else next.add(r.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={e?.nome ?? ''}
                            onChange={ev => setEdits(prev => ({ ...prev, [r.id]: { ...prev[r.id], nome: ev.target.value } }))}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={e?.telefone ?? ''}
                            onChange={ev => setEdits(prev => ({ ...prev, [r.id]: { ...prev[r.id], telefone: ev.target.value } }))}
                            className="h-8 text-xs font-mono"
                            placeholder={formatPhone(r.telefone) || ''}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.loja_nome}</TableCell>
                        <TableCell className="text-xs">{r.origem || '—'}</TableCell>
                        <TableCell className="text-xs">{r.motivo_nao_venda || '—'}</TableCell>
                        <TableCell className="text-xs">{r.status_crm || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
