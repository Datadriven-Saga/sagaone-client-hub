import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, BarChart3, Calendar } from "lucide-react";

interface DesempenhoTabProps {
  prospeccaoIds?: string[];
  prospeccaoId?: string | null; // backward compat
  empresaId: string | null;
}

interface VendedorDesempenho {
  userId: string;
  nomeCompleto: string;
  tipoAcesso: string;
  atribuidos: number;
  emEspera: number;
  convidados: number;
  agendados: number;
  confirmados: number;
  checkins: number;
  vendas: number;
  descartes: number;
}

type SortColumn = 'nomeCompleto' | 'atribuidos' | 'emEspera' | 'convidados' | 'agendados' | 'confirmados' | 'checkins' | 'vendas' | 'descartes' | 'pontuacao';
type SortDirection = 'asc' | 'desc';

const calcularPontuacao = (v: VendedorDesempenho): number => {
  const taxaConf = v.convidados > 0 ? Math.min((v.confirmados / v.convidados) * 200, 200) : 0;
  const taxaCheckin = v.confirmados > 0 ? Math.min((v.checkins / v.confirmados) * 600, 600) : 0;
  const taxaVendas = v.confirmados > 0 ? Math.min((v.vendas / v.confirmados) * 200, 200) : 0;
  return Math.round(taxaConf + taxaCheckin + taxaVendas + v.confirmados * 10 + v.checkins * 50 + v.vendas * 200);
};

export function DesempenhoTab({ prospeccaoIds, prospeccaoId, empresaId }: DesempenhoTabProps) {
  const activeIds = prospeccaoIds || (prospeccaoId ? [prospeccaoId] : []);
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState<VendedorDesempenho[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>('vendas');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const fetchDesempenho = async () => {
      if (activeIds.length === 0 || !empresaId) {
        setVendedores([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase.rpc('get_desempenho_vendedores', {
          p_prospeccao_ids: activeIds,
          p_empresa_id: empresaId,
          p_date_start: dateStart ? new Date(dateStart).toISOString() : null,
          p_date_end: dateEnd ? new Date(dateEnd + 'T23:59:59').toISOString() : null,
        });

        if (error) {
          console.error('Erro ao buscar desempenho:', error);
          setVendedores([]);
        } else if (data && Array.isArray(data)) {
          setVendedores(
            (data as Array<{
              user_id: string; nome_completo: string; tipo_acesso: string;
              atribuidos: number; em_espera: number; convidados: number; agendados: number;
              confirmados: number; checkins: number; vendas: number; descartes: number;
            }>).map((row) => ({
              userId: row.user_id,
              nomeCompleto: row.nome_completo || 'Sem nome',
              tipoAcesso: row.tipo_acesso || 'Vendedor',
              atribuidos: Number(row.atribuidos),
              emEspera: Number(row.em_espera),
              convidados: Number(row.convidados),
              agendados: Number(row.agendados),
              confirmados: Number(row.confirmados),
              checkins: Number(row.checkins),
              vendas: Number(row.vendas),
              descartes: Number(row.descartes),
            }))
          );
        }
      } catch (error) {
        console.error('Erro ao buscar desempenho:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDesempenho();
  }, [activeIds.join(','), empresaId, dateStart, dateEnd]);

  const sortedAndFilteredVendedores = useMemo(() => {
    let filtered = vendedores.filter(v =>
      v.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === 'nomeCompleto') {
        comparison = a.nomeCompleto.localeCompare(b.nomeCompleto);
      } else if (sortColumn === 'pontuacao') {
        comparison = calcularPontuacao(a) - calcularPontuacao(b);
      } else {
        comparison = a[sortColumn] - b[sortColumn];
      }
      if (comparison === 0 && sortColumn !== 'nomeCompleto') {
        comparison = a.nomeCompleto.localeCompare(b.nomeCompleto);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [vendedores, searchTerm, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'nomeCompleto' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  if (activeIds.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Desempenho</h3>
        <p className="text-sm text-muted-foreground">Selecione um evento para visualizar o desempenho dos vendedores</p>
      </Card>
    );
  }

  const columns: { key: SortColumn; label: string; highlight?: boolean }[] = [
    { key: 'atribuidos', label: 'Atrib.' },
    { key: 'emEspera', label: 'Espera' },
    { key: 'convidados', label: 'Conv.' },
    { key: 'agendados', label: 'Agend.' },
    { key: 'confirmados', label: 'Conf.' },
    { key: 'checkins', label: 'Check-In' },
    { key: 'vendas', label: 'Vendas', highlight: true },
    { key: 'descartes', label: 'Desc.' },
  ];

  return (
    <div className="space-y-4 overflow-hidden">
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px] max-w-[250px]">
            <label className="text-sm font-medium mb-1.5 block">Buscar Vendedor</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nome do vendedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="w-[150px]">
            <label className="text-sm font-medium mb-1.5 block">Data Início</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="w-[150px]">
            <label className="text-sm font-medium mb-1.5 block">Data Fim</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="pl-9" />
            </div>
          </div>
          {(dateStart || dateEnd) && (
            <Button variant="outline" size="sm" onClick={() => { setDateStart(""); setDateEnd(""); }}>
              Limpar Datas
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando desempenho...</div>
        ) : sortedAndFilteredVendedores.length === 0 ? (
          <div className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
            <p className="text-muted-foreground">Nenhum vendedor encontrado nas equipes deste evento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-sm w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap" onClick={() => handleSort('nomeCompleto')}>
                    <div className="flex items-center">Vendedor<SortIcon column="nomeCompleto" /></div>
                  </TableHead>
                  {columns.map(col => (
                    <TableHead key={col.key} className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 whitespace-nowrap" onClick={() => handleSort(col.key)}>
                      <div className={`flex items-center justify-center text-xs ${col.highlight ? 'font-semibold text-primary' : ''}`}>
                        {col.label}<SortIcon column={col.key} />
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 whitespace-nowrap" onClick={() => handleSort('pontuacao')}>
                    <div className="flex items-center justify-center text-xs font-semibold text-amber-600">Pontos<SortIcon column="pontuacao" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredVendedores.map((vendedor) => (
                  <TableRow key={vendedor.userId}>
                    <TableCell className="py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate max-w-[200px]">{vendedor.nomeCompleto}</span>
                        <span className="text-xs text-muted-foreground">{vendedor.tipoAcesso}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium py-2 px-2">{vendedor.atribuidos}</TableCell>
                    <TableCell className="text-center py-2 px-2">{vendedor.emEspera}</TableCell>
                    <TableCell className="text-center py-2 px-2">{vendedor.convidados}</TableCell>
                    <TableCell className="text-center py-2 px-2">{vendedor.agendados}</TableCell>
                    <TableCell className="text-center py-2 px-2">{vendedor.confirmados}</TableCell>
                    <TableCell className="text-center py-2 px-2">{vendedor.checkins}</TableCell>
                    <TableCell className="text-center font-semibold text-primary py-2 px-2">{vendedor.vendas}</TableCell>
                    <TableCell className="text-center text-muted-foreground py-2 px-2">{vendedor.descartes}</TableCell>
                    <TableCell className="text-center font-bold text-amber-600 py-2 px-2">{calcularPontuacao(vendedor).toLocaleString('pt-BR')}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell className="py-3"><span className="font-bold">TOTAL</span></TableCell>
                {columns.map(col => (
                    <TableCell key={col.key} className={`text-center py-3 px-2 ${col.key === 'vendas' ? 'text-primary' : col.key === 'descartes' ? 'text-muted-foreground' : ''}`}>
                      {sortedAndFilteredVendedores.reduce((sum, v) => sum + Number(v[col.key as keyof VendedorDesempenho] || 0), 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-center py-3 px-2 text-amber-600">
                    {sortedAndFilteredVendedores.reduce((sum, v) => sum + calcularPontuacao(v), 0).toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {!loading && sortedAndFilteredVendedores.length > 0 && (
        <div className="text-sm text-muted-foreground text-right">
          Exibindo {sortedAndFilteredVendedores.length} vendedor{sortedAndFilteredVendedores.length !== 1 ? 'es' : ''}
        </div>
      )}
    </div>
  );
}
