import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Building2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Bot,
  Check,
  X,
  Plus,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Empresa {
  id: string;
  nome_empresa: string;
  cnpj: string;
  marca: string | null;
  uf: string | null;
  cidade: string | null;
}

interface AgenteVisao {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

interface AgenteIA {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
}

interface AgenteEmpresa {
  id: string;
  agente_id: string;
  empresa_id: string;
  status: string;
}

const ITEMS_PER_PAGE = 15;

export function ControleEmpresasTab() {
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [filterUF, setFilterUF] = useState("");
  
  // Modal de detalhes
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [agentesVisao, setAgentesVisao] = useState<AgenteVisao[]>([]);
  const [agentesEmpresa, setAgentesEmpresa] = useState<AgenteEmpresa[]>([]);
  const [loadingAgentes, setLoadingAgentes] = useState(false);
  
  // Seleção de agente específico
  const [selectedAgenteVisao, setSelectedAgenteVisao] = useState<AgenteVisao | null>(null);
  const [agentesIADisponiveis, setAgentesIADisponiveis] = useState<AgenteIA[]>([]);
  const [loadingAgentesIA, setLoadingAgentesIA] = useState(false);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("empresas")
        .select("id, nome_empresa, cnpj, marca, uf, cidade", { count: "exact" });

      // Aplicar filtros
      if (searchTerm) {
        query = query.or(`nome_empresa.ilike.%${searchTerm}%,cnpj.ilike.%${searchTerm}%`);
      }
      if (filterMarca) {
        query = query.ilike("marca", `%${filterMarca}%`);
      }
      if (filterUF) {
        query = query.ilike("uf", `%${filterUF}%`);
      }

      // Paginação
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to).order("nome_empresa");

      const { data, error, count } = await query;
      if (error) throw error;
      
      setEmpresas(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
      toast({ title: "Erro ao carregar empresas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, filterMarca, filterUF, toast]);

  const fetchAgentesData = useCallback(async (empresaId: string) => {
    setLoadingAgentes(true);
    try {
      // Buscar catálogo de agentes ativos
      const { data: visaoData, error: visaoError } = await supabase
        .from("agentes_visao")
        .select("id, nome, tipo, ativo")
        .eq("ativo", true)
        .order("nome");
      
      if (visaoError) throw visaoError;
      setAgentesVisao(visaoData || []);

      // Buscar agentes atribuídos à empresa
      const { data: atribuicoes, error: atribError } = await supabase
        .from("agente_empresas")
        .select("id, agente_id, empresa_id, status")
        .eq("empresa_id", empresaId);
      
      if (atribError) throw atribError;
      setAgentesEmpresa(atribuicoes || []);
    } catch (error) {
      console.error("Erro ao carregar agentes:", error);
      toast({ title: "Erro ao carregar agentes", variant: "destructive" });
    } finally {
      setLoadingAgentes(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  useEffect(() => {
    if (selectedEmpresa) {
      fetchAgentesData(selectedEmpresa.id);
    }
  }, [selectedEmpresa, fetchAgentesData]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchEmpresas();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterMarca("");
    setFilterUF("");
    setCurrentPage(1);
  };

  // Busca agentes_ia pelo nome do agente do catálogo
  const fetchAgentesIAByName = useCallback(async (nomeAgente: string) => {
    setLoadingAgentesIA(true);
    try {
      const { data, error } = await supabase
        .from("agentes_ia")
        .select("id, nome, telefone, ativo")
        .ilike("nome", `%${nomeAgente}%`)
        .eq("ativo", true)
        .order("telefone");
      
      if (error) throw error;
      setAgentesIADisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao buscar agentes IA:", error);
      setAgentesIADisponiveis([]);
    } finally {
      setLoadingAgentesIA(false);
    }
  }, []);

  const handleOpenAtribuirPopover = async (agente: AgenteVisao) => {
    setSelectedAgenteVisao(agente);
    setOpenPopoverId(agente.id);
    await fetchAgentesIAByName(agente.nome);
  };

  const handleAtribuirAgenteIA = async (agenteIAId: string) => {
    if (!selectedEmpresa) return;
    
    try {
      const { error } = await supabase
        .from("agente_empresas")
        .insert({
          agente_id: agenteIAId,
          empresa_id: selectedEmpresa.id,
          status: "pendente"
        });
      
      if (error) throw error;
      toast({ title: "Agente atribuído com sucesso!" });
      setOpenPopoverId(null);
      setSelectedAgenteVisao(null);
      fetchAgentesData(selectedEmpresa.id);
    } catch (error: any) {
      console.error("Erro ao atribuir agente:", error);
      toast({ 
        title: "Erro ao atribuir agente", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const handleRemoverAgente = async (atribuicaoId: string) => {
    if (!confirm("Tem certeza que deseja remover este agente da empresa?")) return;
    
    try {
      const { error } = await supabase
        .from("agente_empresas")
        .delete()
        .eq("id", atribuicaoId);
      
      if (error) throw error;
      toast({ title: "Agente removido com sucesso!" });
      if (selectedEmpresa) {
        fetchAgentesData(selectedEmpresa.id);
      }
    } catch (error: any) {
      console.error("Erro ao remover agente:", error);
      toast({ 
        title: "Erro ao remover agente", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const getAgentesAtribuidos = () => {
    return agentesVisao.filter(av => 
      agentesEmpresa.some(ae => ae.agente_id === av.id)
    );
  };

  const getAgentesNaoAtribuidos = () => {
    return agentesVisao.filter(av => 
      !agentesEmpresa.some(ae => ae.agente_id === av.id)
    );
  };

  const getAtribuicaoId = (agenteVisaoId: string) => {
    return agentesEmpresa.find(ae => ae.agente_id === agenteVisaoId)?.id;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Controle de Empresas
              </CardTitle>
              <CardDescription>
                Gerencie a cobertura de agentes por empresa
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchEmpresas} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-[120px]">
              <Input
                placeholder="Marca"
                value={filterMarca}
                onChange={(e) => setFilterMarca(e.target.value)}
              />
            </div>
            <div className="w-[80px]">
              <Input
                placeholder="UF"
                value={filterUF}
                onChange={(e) => setFilterUF(e.target.value)}
                maxLength={2}
              />
            </div>
            <Button onClick={handleSearch} size="sm">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>

          {/* Tabela de empresas */}
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : empresas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma empresa encontrada</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((empresa) => (
                    <TableRow key={empresa.id}>
                      <TableCell className="font-medium">{empresa.nome_empresa}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{empresa.cnpj}</TableCell>
                      <TableCell>
                        {empresa.marca ? (
                          <Badge variant="outline">{empresa.marca}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{empresa.uf || "-"}</TableCell>
                      <TableCell>{empresa.cidade || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEmpresa(empresa)}
                        >
                          <Bot className="h-4 w-4 mr-2" />
                          Agentes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount.toLocaleString('pt-BR')} empresas
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes da empresa */}
      <Dialog open={!!selectedEmpresa} onOpenChange={(open) => !open && setSelectedEmpresa(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedEmpresa?.nome_empresa}
            </DialogTitle>
          </DialogHeader>

          {selectedEmpresa && (
            <div className="space-y-6">
              {/* Informações básicas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="text-sm font-medium">{selectedEmpresa.cnpj}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Marca</p>
                  <p className="text-sm font-medium">{selectedEmpresa.marca || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">UF</p>
                  <p className="text-sm font-medium">{selectedEmpresa.uf || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cidade</p>
                  <p className="text-sm font-medium">{selectedEmpresa.cidade || "-"}</p>
                </div>
              </div>

              {/* Cobertura de agentes */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{agentesVisao.length}</p>
                      <p className="text-xs text-muted-foreground">Total Catálogo</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500">{getAgentesAtribuidos().length}</p>
                      <p className="text-xs text-muted-foreground">Atribuídos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-500">{getAgentesNaoAtribuidos().length}</p>
                      <p className="text-xs text-muted-foreground">Faltando</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {loadingAgentes ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Agentes atribuídos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Agentes Atribuídos ({getAgentesAtribuidos().length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
                      {getAgentesAtribuidos().length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum agente atribuído
                        </p>
                      ) : (
                        getAgentesAtribuidos().map((agente) => (
                          <div 
                            key={agente.id} 
                            className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20"
                          >
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-green-500" />
                              <div>
                                <p className="text-sm font-medium">{agente.nome}</p>
                                <p className="text-xs text-muted-foreground">{agente.tipo}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                const atribId = getAtribuicaoId(agente.id);
                                if (atribId) handleRemoverAgente(atribId);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Agentes não atribuídos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Plus className="h-4 w-4 text-yellow-500" />
                        Agentes Disponíveis ({getAgentesNaoAtribuidos().length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
                      {getAgentesNaoAtribuidos().length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Todos os agentes já estão atribuídos! ✓
                        </p>
                      ) : (
                        getAgentesNaoAtribuidos().map((agente) => (
                          <div 
                            key={agente.id} 
                            className="flex items-center justify-between p-2 rounded-lg bg-muted border"
                          >
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{agente.nome}</p>
                                <p className="text-xs text-muted-foreground">{agente.tipo}</p>
                              </div>
                            </div>
                            <Popover 
                              open={openPopoverId === agente.id} 
                              onOpenChange={(open) => {
                                if (!open) {
                                  setOpenPopoverId(null);
                                  setSelectedAgenteVisao(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAtribuirPopover(agente)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Atribuir
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-0" align="end">
                                <div className="p-3 border-b bg-muted/50">
                                  <p className="font-medium text-sm">Selecione o agente {agente.nome}</p>
                                  <p className="text-xs text-muted-foreground">Escolha a instância com o telefone correto</p>
                                </div>
                                <div className="max-h-[250px] overflow-y-auto">
                                  {loadingAgentesIA ? (
                                    <div className="flex justify-center py-4">
                                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : agentesIADisponiveis.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      Nenhum agente encontrado
                                    </p>
                                  ) : (
                                    agentesIADisponiveis.map((agenteIA) => (
                                      <div
                                        key={agenteIA.id}
                                        className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer border-b last:border-0"
                                        onClick={() => handleAtribuirAgenteIA(agenteIA.id)}
                                      >
                                        <div className="flex items-center gap-2">
                                          <Bot className="h-4 w-4 text-primary" />
                                          <div>
                                            <p className="text-sm font-medium">{agenteIA.nome}</p>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                              <Phone className="h-3 w-3" />
                                              <span>{agenteIA.telefone || "Sem telefone"}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <Check className="h-4 w-4 text-green-500 opacity-0 hover:opacity-100" />
                                      </div>
                                    ))
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
