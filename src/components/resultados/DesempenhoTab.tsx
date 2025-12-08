import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, BarChart3, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DesempenhoTabProps {
  prospeccaoId: string | null;
  empresaId: string | null;
}

interface VendedorDesempenho {
  userId: string;
  nomeCompleto: string;
  tipoAcesso: string;
  atribuidos: number;
  convidados: number;
  agendados: number;
  confirmados: number;
  checkins: number;
  vendas: number;
  descartes: number;
}

type SortColumn = 'nomeCompleto' | 'atribuidos' | 'convidados' | 'agendados' | 'confirmados' | 'checkins' | 'vendas' | 'descartes' | 'pontuacao';

// Função para calcular pontuação
const calcularPontuacao = (vendedor: VendedorDesempenho): number => {
  // Taxa de conversão de Confirmações: (confirmados / convidados) * 200. (Máximo: 200 pontos)
  const taxaConfirmacoes = vendedor.convidados > 0 
    ? Math.min((vendedor.confirmados / vendedor.convidados) * 200, 200)
    : 0;
  
  // Taxa de Check-in: (check-in / confirmados) * 600. (Máximo: 600 pontos)
  const taxaCheckin = vendedor.confirmados > 0 
    ? Math.min((vendedor.checkins / vendedor.confirmados) * 600, 600)
    : 0;
  
  // Taxa de Vendas: (vendas / confirmados) * 200. (Máximo: 200 pontos)
  const taxaVendas = vendedor.confirmados > 0 
    ? Math.min((vendedor.vendas / vendedor.confirmados) * 200, 200)
    : 0;
  
  // Quantidade de Confirmados: Cada confirmação é 10 pontos
  const pontosConfirmados = vendedor.confirmados * 10;
  
  // Quantidade de Check-ins: Cada check-in é 50 pontos
  const pontosCheckins = vendedor.checkins * 50;
  
  // Quantidade de Vendas: Cada venda é 200 pontos
  const pontosVendas = vendedor.vendas * 200;
  
  return Math.round(taxaConfirmacoes + taxaCheckin + taxaVendas + pontosConfirmados + pontosCheckins + pontosVendas);
};
type SortDirection = 'asc' | 'desc';

export function DesempenhoTab({ prospeccaoId, empresaId }: DesempenhoTabProps) {
  const [loading, setLoading] = useState(true);
  const [vendedores, setVendedores] = useState<VendedorDesempenho[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>('vendas');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const fetchDesempenho = async () => {
      if (!prospeccaoId || !empresaId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // 1. Buscar equipes da prospecção
        const { data: equipes } = await supabase
          .from('prospeccao_equipes')
          .select('id')
          .eq('prospeccao_id', prospeccaoId)
          .eq('ativo', true);

        if (!equipes || equipes.length === 0) {
          setVendedores([]);
          setLoading(false);
          return;
        }

        const equipeIds = equipes.map(e => e.id);

        // 2. Buscar membros das equipes
        const { data: membros } = await supabase
          .from('prospeccao_equipe_membros')
          .select('user_id')
          .in('equipe_id', equipeIds);

        if (!membros || membros.length === 0) {
          setVendedores([]);
          setLoading(false);
          return;
        }

        const userIds = [...new Set(membros.map(m => m.user_id))];

        // 3. Buscar perfis dos usuários (vendedores)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome_completo, tipo_acesso')
          .in('id', userIds)
          .eq('tipo_acesso', 'Vendedor');

        if (!profiles || profiles.length === 0) {
          setVendedores([]);
          setLoading(false);
          return;
        }

        // 4. Buscar contatos da prospecção com filtro de data
        let contatosQuery = supabase
          .from('contatos')
          .select('id, responsavel_email, status, created_at')
          .eq('empresa_id', empresaId);

        if (dateStart) {
          contatosQuery = contatosQuery.gte('created_at', dateStart);
        }
        if (dateEnd) {
          contatosQuery = contatosQuery.lte('created_at', dateEnd + 'T23:59:59');
        }

        const { data: contatos } = await contatosQuery;

        // 5. Mapear contatos por vendedor
        const desempenhoMap = new Map<string, VendedorDesempenho>();

        profiles.forEach(profile => {
          desempenhoMap.set(profile.id, {
            userId: profile.id,
            nomeCompleto: profile.nome_completo,
            tipoAcesso: profile.tipo_acesso || 'Vendedor',
            atribuidos: 0,
            convidados: 0,
            agendados: 0,
            confirmados: 0,
            checkins: 0,
            vendas: 0,
            descartes: 0
          });
        });

        // Contar status por vendedor
        if (contatos) {
          contatos.forEach(contato => {
            const responsavel = contato.responsavel_email;
            if (!responsavel) return;

            // Verificar se o responsável é um dos vendedores
            let vendedorId: string | null = null;
            
            // Verificar por UUID
            if (desempenhoMap.has(responsavel)) {
              vendedorId = responsavel;
            } else {
              // Verificar por email ou celular nos profiles
              const profile = profiles.find(p => 
                p.id === responsavel || 
                p.nome_completo.toLowerCase().includes(responsavel.toLowerCase())
              );
              if (profile) {
                vendedorId = profile.id;
              }
            }

            if (vendedorId && desempenhoMap.has(vendedorId)) {
              const vendedor = desempenhoMap.get(vendedorId)!;
              
              // Contar atribuídos (qualquer contato com responsável)
              vendedor.atribuidos++;
              
              // Contar por status
              switch (contato.status) {
                case 'Convidado':
                  vendedor.convidados++;
                  break;
                case 'Agendado':
                  vendedor.agendados++;
                  break;
                case 'Confirmado':
                  vendedor.confirmados++;
                  break;
                case 'Check-in':
                  vendedor.checkins++;
                  break;
                case 'Fechado':
                  vendedor.vendas++;
                  break;
                case 'Descartado':
                case 'Desperdício':
                  vendedor.descartes++;
                  break;
              }
            }
          });
        }

        setVendedores(Array.from(desempenhoMap.values()));
      } catch (error) {
        console.error('Erro ao buscar desempenho:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDesempenho();
  }, [prospeccaoId, empresaId, dateStart, dateEnd]);

  // Ordenação e filtro
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

      // Ordenação secundária por nome
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
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  if (!prospeccaoId) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-primary opacity-50 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Desempenho</h3>
        <p className="text-sm text-muted-foreground">
          Selecione um evento para visualizar o desempenho dos vendedores
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1.5 block">Buscar Vendedor</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome do vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-[180px]">
            <label className="text-sm font-medium mb-1.5 block">Data Início</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-[180px]">
            <label className="text-sm font-medium mb-1.5 block">Data Fim</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {(dateStart || dateEnd) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDateStart(""); setDateEnd(""); }}
            >
              Limpar Datas
            </Button>
          )}
        </div>
      </Card>

      {/* Tabela de Desempenho */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando desempenho...
          </div>
        ) : sortedAndFilteredVendedores.length === 0 ? (
          <div className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
            <p className="text-muted-foreground">
              Nenhum vendedor encontrado nas equipes deste evento
            </p>
          </div>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors min-w-[210px]"
                  onClick={() => handleSort('nomeCompleto')}
                >
                  <div className="flex items-center">
                    Vendedor
                    <SortIcon column="nomeCompleto" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[90px]"
                  onClick={() => handleSort('atribuidos')}
                >
                  <div className="flex items-center justify-center text-xs">
                    Atrib.
                    <SortIcon column="atribuidos" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[90px]"
                  onClick={() => handleSort('convidados')}
                >
                  <div className="flex items-center justify-center text-xs">
                    Conv.
                    <SortIcon column="convidados" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[90px]"
                  onClick={() => handleSort('agendados')}
                >
                  <div className="flex items-center justify-center text-xs">
                    Agend.
                    <SortIcon column="agendados" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[98px]"
                  onClick={() => handleSort('confirmados')}
                >
                  <div className="flex items-center justify-center text-xs">
                    Conf.
                    <SortIcon column="confirmados" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[105px]"
                  onClick={() => handleSort('checkins')}
                >
                  <div className="flex items-center justify-center text-xs">
                    Check-In
                    <SortIcon column="checkins" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[98px]"
                  onClick={() => handleSort('vendas')}
                >
                  <div className="flex items-center justify-center text-xs font-semibold text-primary">
                    Vendas
                    <SortIcon column="vendas" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[90px]"
                  onClick={() => handleSort('descartes')}
                >
                  <div className="flex items-center justify-center text-xs">
                    Desc.
                    <SortIcon column="descartes" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50 transition-colors px-2 w-[120px]"
                  onClick={() => handleSort('pontuacao')}
                >
                  <div className="flex items-center justify-center text-xs font-semibold text-amber-600">
                    Pontos
                    <SortIcon column="pontuacao" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredVendedores.map((vendedor) => (
                <TableRow key={vendedor.userId}>
                  <TableCell className="py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm truncate max-w-[200px]">{vendedor.nomeCompleto}</span>
                      <span className="text-xs text-muted-foreground">
                        {vendedor.tipoAcesso}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium py-2 px-2">
                    {vendedor.atribuidos}
                  </TableCell>
                  <TableCell className="text-center py-2 px-2">
                    {vendedor.convidados}
                  </TableCell>
                  <TableCell className="text-center py-2 px-2">
                    {vendedor.agendados}
                  </TableCell>
                  <TableCell className="text-center py-2 px-2">
                    {vendedor.confirmados}
                  </TableCell>
                  <TableCell className="text-center py-2 px-2">
                    {vendedor.checkins}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-primary py-2 px-2">
                    {vendedor.vendas}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground py-2 px-2">
                    {vendedor.descartes}
                  </TableCell>
                  <TableCell className="text-center font-bold text-amber-600 py-2 px-2">
                    {calcularPontuacao(vendedor).toLocaleString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
              {/* Linha de Totais */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell className="py-3">
                  <span className="font-bold">TOTAL</span>
                </TableCell>
                <TableCell className="text-center py-3 px-2">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + v.atribuidos, 0)}
                </TableCell>
                <TableCell className="text-center py-3 px-2">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + v.convidados, 0)}
                </TableCell>
                <TableCell className="text-center py-3 px-2">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + v.agendados, 0)}
                </TableCell>
                <TableCell className="text-center py-3 px-2">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + v.confirmados, 0)}
                </TableCell>
                <TableCell className="text-center py-3 px-2">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + v.checkins, 0)}
                </TableCell>
                <TableCell className="text-center py-3 px-2 text-primary">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + v.vendas, 0)}
                </TableCell>
                <TableCell className="text-center py-3 px-2 text-muted-foreground">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + v.descartes, 0)}
                </TableCell>
                <TableCell className="text-center py-3 px-2 text-amber-600">
                  {sortedAndFilteredVendedores.reduce((sum, v) => sum + calcularPontuacao(v), 0).toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Resumo */}
      {!loading && sortedAndFilteredVendedores.length > 0 && (
        <div className="text-sm text-muted-foreground text-right">
          Exibindo {sortedAndFilteredVendedores.length} vendedor{sortedAndFilteredVendedores.length !== 1 ? 'es' : ''}
        </div>
      )}
    </div>
  );
}
