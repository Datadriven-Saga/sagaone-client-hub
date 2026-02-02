import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Users, Phone, Mail, UserCheck, CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { useClientesData } from "@/hooks/useClientesData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";

interface Prospeccao {
  id: string;
  titulo: string;
}

const Clientes = () => {
  const { activeCompany } = useCompany();
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoCliente, setTipoCliente] = useState("todos");
  const [sexoFiltro, setSexoFiltro] = useState("todos");
  
  // SINCRONIZAÇÃO: Filtro por evento/prospecção (mesma lógica do Kanban e Funil)
  const [prospeccaoId, setProspeccaoId] = useState("todos");
  const [prospeccoes, setProspeccoes] = useState<Prospeccao[]>([]);
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Hook agora aceita prospeccaoId para filtrar
  const { clientes: clientesList, kpis: kpisData, distribuicaoGenero, distribuicaoDocumento, loading, refetch } = useClientesData({ prospeccaoId });

  // Carregar prospecções para o filtro
  useEffect(() => {
    const fetchProspeccoes = async () => {
      if (!activeCompany?.id) return;
      
      const { data } = await supabase
        .from("prospeccoes")
        .select("id, titulo")
        .eq("empresa_id", activeCompany.id)
        .order("titulo");
      
      setProspeccoes(data || []);
    };
    
    fetchProspeccoes();
  }, [activeCompany?.id]);

  const clientesFiltrados = useMemo(() => {
    if (!clientesList || clientesList.length === 0) return [];
    
    const searchLower = searchTerm.toLowerCase().trim();
    const searchDigits = searchTerm.replace(/\D/g, '');
    
    return clientesList.filter(cliente => {
      // Filtro de busca (nome, telefone, email) - mais robusto
      let matchSearch = true;
      if (searchTerm !== "") {
        const nameMatch = cliente.name?.toLowerCase().includes(searchLower);
        const phoneMatch = cliente.phone?.replace(/\D/g, '').includes(searchDigits);
        const emailMatch = cliente.email?.toLowerCase().includes(searchLower);
        matchSearch = nameMatch || phoneMatch || emailMatch;
      }

      // Filtro de tipo de documento (CPF/CNPJ) - ignorar se não houver dados
      let matchTipo = true;
      if (tipoCliente !== "todos") {
        const docDigits = cliente.document?.replace(/\D/g, '') || '';
        if (tipoCliente === "cpf") {
          matchTipo = docDigits.length === 11;
        } else if (tipoCliente === "cnpj") {
          matchTipo = docDigits.length === 14;
        }
      }

      // Filtro de sexo - ignorar "Não informado" se filtro específico
      let matchSexo = true;
      if (sexoFiltro !== "todos") {
        const genderLower = cliente.gender?.toLowerCase() || '';
        matchSexo = genderLower === sexoFiltro.toLowerCase() || 
          (sexoFiltro === "outro" && !["masculino", "feminino", "não informado"].includes(genderLower));
      }

      // Filtro de período (data de cadastro)
      let matchDate = true;
      if (dateRange?.from && cliente.createdAt) {
        const clienteDate = new Date(cliente.createdAt);
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        matchDate = clienteDate >= fromDate;
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          matchDate = matchDate && clienteDate <= toDate;
        }
      }

      return matchSearch && matchTipo && matchSexo && matchDate;
    });
  }, [clientesList, searchTerm, tipoCliente, sexoFiltro, dateRange]);

  // Reset para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, tipoCliente, sexoFiltro, dateRange, prospeccaoId]);

  // Paginação
  const totalPages = Math.ceil(clientesFiltrados.length / itemsPerPage);
  const paginatedClientes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return clientesFiltrados.slice(startIndex, startIndex + itemsPerPage);
  }, [clientesFiltrados, currentPage, itemsPerPage]);

  const kpis = [
    { title: "Clientes", value: loading ? "..." : kpisData.total.toLocaleString('pt-BR'), icon: Users },
    { 
      title: "Com Telefone", 
      value: loading ? "..." : kpisData.comTelefone.toLocaleString('pt-BR'), 
      subtitle: kpisData.total > 0 ? `${((kpisData.comTelefone / kpisData.total) * 100).toFixed(0)}%` : "0%", 
      icon: Phone 
    },
    { 
      title: "Com E-mail", 
      value: loading ? "..." : kpisData.comEmail.toLocaleString('pt-BR'), 
      subtitle: kpisData.total > 0 ? `${((kpisData.comEmail / kpisData.total) * 100).toFixed(0)}%` : "0%", 
      icon: Mail 
    },
    { 
      title: "Realizaram Compra", 
      value: loading ? "..." : kpisData.realizaramCompra.toLocaleString('pt-BR'), 
      subtitle: kpisData.total > 0 ? `${((kpisData.realizaramCompra / kpisData.total) * 100).toFixed(0)}%` : "0%", 
      icon: UserCheck 
    }
  ];

  const handleClientRowClick = (client: any) => {
    setSelectedClient(client);
    setIsNewClientDialogOpen(true);
  };

  const handleNewClient = () => {
    setSelectedClient(null);
    setIsNewClientDialogOpen(true);
  };


  return (
    <DashboardLayout title="Carteira de Clientes">
      <div className="space-y-3">
        {/* Filtros */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input 
              placeholder="Buscar cliente por nome" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* NOVO: Filtro por Evento/Prospecção - sincronizado com Kanban e Funil */}
            <Select value={prospeccaoId} onValueChange={setProspeccaoId}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Todos os Eventos" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Eventos</SelectItem>
                {prospeccoes.map((prosp) => (
                  <SelectItem key={prosp.id} value={prosp.id}>
                    {prosp.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoCliente} onValueChange={setTipoCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo do Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sexoFiltro} onValueChange={setSexoFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <DateRangePicker 
              date={dateRange}
              onDateChange={setDateRange}
              placeholder="Período"
            />
          </div>
        </Card>

        {/* KPIs Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi, index) => (
            <KPICard
              key={index}
              title={kpi.title}
              value={kpi.value}
              subtitle={kpi.subtitle}
              icon={kpi.icon}
            />
          ))}
        </div>

        {/* Gender/Document Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição por Sexo</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Masculino</span>
              <span className="font-medium">
                {kpisData.total > 0 
                  ? `${((distribuicaoGenero.masculino / kpisData.total) * 100).toFixed(0)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Feminino</span>
              <span className="font-medium">
                {kpisData.total > 0 
                  ? `${((distribuicaoGenero.feminino / kpisData.total) * 100).toFixed(0)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Não informado</span>
              <span className="font-medium">
                {kpisData.total > 0 
                  ? `${((distribuicaoGenero.naoInformado / kpisData.total) * 100).toFixed(0)}%`
                  : '0%'
                }
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Tipo de Documento</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPF</span>
              <span className="font-medium">
                {kpisData.total > 0 
                  ? `${((distribuicaoDocumento.cpf / kpisData.total) * 100).toFixed(0)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPJ</span>
              <span className="font-medium">
                {kpisData.total > 0 
                  ? `${((distribuicaoDocumento.cnpj / kpisData.total) * 100).toFixed(0)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Não informado</span>
              <span className="font-medium">
                {kpisData.total > 0 
                  ? `${((distribuicaoDocumento.naoInformado / kpisData.total) * 100).toFixed(0)}%`
                  : '0%'
                }
              </span>
            </div>
          </div>
        </Card>
        </div>

        {/* Clients Table */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">Lista de Clientes</h3>
              <span className="text-sm text-muted-foreground">
                ({clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'registro' : 'registros'})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
              <Button onClick={handleNewClient}>Novo Cliente</Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p>Carregando clientes...</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto mb-2" size={32} />
              <p>
                {clientesList.length === 0 
                  ? prospeccaoId === "todos" 
                    ? "Nenhum cliente vinculado a eventos" 
                    : "Nenhum cliente vinculado a este evento"
                  : "Nenhum cliente corresponde aos filtros aplicados"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Comprou</TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClientes.map((client) => (
                    <TableRow 
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleClientRowClick(client)}
                    >
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-muted-foreground">{client.phone || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{client.email || '-'}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          client.hasPurchased === 'Sim' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {client.hasPurchased}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{client.responsible}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, clientesFiltrados.length)} de {clientesFiltrados.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Dialog para Novo/Editar Cliente */}
        <Dialog open={isNewClientDialogOpen} onOpenChange={setIsNewClientDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedClient ? `Editar Cliente - ${selectedClient.name}` : 'Novo Cliente'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <Label htmlFor="name">Nome Completo</Label>
                 <Input 
                  id="name" 
                  defaultValue={selectedClient?.name || ''} 
                  placeholder="Digite o nome completo"
                  className="bg-white"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone" 
                  defaultValue={selectedClient?.phone || ''} 
                  placeholder="(11) 99999-9999"
                  className="bg-white"
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email"
                  defaultValue={selectedClient?.email || ''} 
                  placeholder="cliente@email.com"
                  className="bg-white"
                />
              </div>
              
              <div>
                <Label htmlFor="gender">Sexo</Label>
                <select 
                  id="gender" 
                  className="w-full p-2 border rounded-md bg-white"
                  defaultValue={selectedClient?.gender || ''}
                >
                  <option value="">Selecione</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input 
                  id="birthDate" 
                  type="date"
                  defaultValue={selectedClient?.birthDate ? 
                    selectedClient.birthDate.split('/').reverse().join('-') : ''} 
                  className="bg-white"
                />
              </div>
              
              <div>
                <Label htmlFor="document">CPF/CNPJ</Label>
                <Input 
                  id="document" 
                  defaultValue={selectedClient?.document || ''} 
                  placeholder="000.000.000-00"
                  className="bg-white"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsNewClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setIsNewClientDialogOpen(false)}>
                {selectedClient ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Clientes;
