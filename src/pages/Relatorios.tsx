import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileText, Download, Filter, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ReportModule = "eventos" | "atendimentos" | "vendas" | "usuarios" | "templates";

interface ReportFilters {
  dataInicio: string;
  dataFim: string;
  status?: string;
  responsavel?: string;
  canal?: string;
}

const Relatorios = () => {
  const { activeCompany } = useCompany();
  const [selectedModule, setSelectedModule] = useState<ReportModule | "">("");
  const [filters, setFilters] = useState<ReportFilters>({
    dataInicio: "",
    dataFim: "",
  });
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const modules = [
    {
      id: "eventos" as ReportModule,
      name: "Eventos",
      description: "Lista de eventos/prospecções",
      fields: ["Título", "Data Início", "Data Fim", "Canal", "Responsável", "Leads Gerados", "Status"]
    },
    {
      id: "atendimentos" as ReportModule,
      name: "Atendimentos",
      description: "Leads presentes em cada evento",
      fields: ["Nome", "Telefone", "E-mail", "Evento", "Status", "Origem", "Responsável", "Data Criação"]
    },
    {
      id: "vendas" as ReportModule,
      name: "Vendas",
      description: "Vendas realizadas por evento",
      fields: ["Cliente", "Evento", "Produto", "Valor", "Data Venda", "Vendedor", "Departamento"]
    },
    {
      id: "usuarios" as ReportModule,
      name: "Usuários",
      description: "Lista de usuários do sistema",
      fields: ["Nome", "E-mail", "Celular", "Departamento", "Tipo de Acesso", "Status", "Data Cadastro"]
    },
    {
      id: "templates" as ReportModule,
      name: "Templates",
      description: "Templates de mensagens",
      fields: ["Nome", "Tipo", "Agente", "Ativo", "Data Criação", "Última Atualização"]
    }
  ];

  const fetchEventos = async () => {
    let query = supabase
      .from("prospeccoes")
      .select(`
        id,
        titulo,
        data_inicio,
        data_fim,
        canal,
        leads_gerados,
        created_at,
        responsavel:profiles!prospeccoes_responsavel_id_fkey(nome_completo)
      `)
      .eq("empresa_id", activeCompany?.id);

    if (filters.dataInicio) {
      query = query.gte("data_inicio", filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte("data_fim", filters.dataFim);
    }
    if (filters.canal) {
      query = query.eq("canal", filters.canal);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return data?.map(item => ({
      titulo: item.titulo,
      data_inicio: item.data_inicio ? format(new Date(item.data_inicio), "dd/MM/yyyy") : "-",
      data_fim: item.data_fim ? format(new Date(item.data_fim), "dd/MM/yyyy") : "-",
      canal: item.canal || "-",
      responsavel: item.responsavel?.nome_completo || "-",
      leads_gerados: item.leads_gerados || 0,
      status: item.data_fim && new Date(item.data_fim) < new Date() ? "Encerrado" : "Ativo"
    })) || [];
  };

  const fetchAtendimentos = async () => {
    let query = supabase
      .from("contatos")
      .select(`
        id,
        nome,
        telefone,
        email,
        status,
        origem,
        vendedor_nome,
        created_at,
        eventos_prospeccao(
          prospeccao:prospeccoes(titulo)
        )
      `)
      .eq("empresa_id", activeCompany?.id);

    if (filters.dataInicio) {
      query = query.gte("created_at", filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte("created_at", filters.dataFim + "T23:59:59");
    }
    if (filters.status) {
      query = query.eq("status", filters.status as any);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return data?.map(item => ({
      nome: item.nome,
      telefone: item.telefone || "-",
      email: item.email || "-",
      evento: item.eventos_prospeccao?.[0]?.prospeccao?.titulo || "-",
      status: item.status || "-",
      origem: item.origem || "-",
      responsavel: item.vendedor_nome || "-",
      data_criacao: format(new Date(item.created_at!), "dd/MM/yyyy")
    })) || [];
  };
  const fetchVendas = async () => {
    let query = supabase
      .from("vendas_prospeccao")
      .select(`
        id,
        cliente_nome,
        valor_venda,
        data_venda,
        prospeccao:prospeccoes(titulo),
        produto:produtos(nome),
        responsavel:profiles!vendas_prospeccao_responsavel_id_fkey(nome_completo),
        departamento:departamentos(nome)
      `)
      .eq("empresa_id", activeCompany?.id);

    if (filters.dataInicio) {
      query = query.gte("data_venda", filters.dataInicio);
    }
    if (filters.dataFim) {
      query = query.lte("data_venda", filters.dataFim);
    }

    const { data, error } = await query.order("data_venda", { ascending: false });
    if (error) throw error;

    return data?.map(item => ({
      cliente: item.cliente_nome || "-",
      evento: item.prospeccao?.titulo || "-",
      produto: item.produto?.nome || "-",
      valor: item.valor_venda ? `R$ ${item.valor_venda.toLocaleString("pt-BR")}` : "-",
      data_venda: item.data_venda ? format(new Date(item.data_venda), "dd/MM/yyyy") : "-",
      vendedor: item.responsavel?.nome_completo || "-",
      departamento: item.departamento?.nome || "-"
    })) || [];
  };

  const fetchUsuarios = async () => {
    let query = supabase
      .from("profiles")
      .select(`
        id,
        nome_completo,
        celular,
        departamento,
        tipo_acesso,
        status,
        created_at
      `)
      .eq("empresa_id", activeCompany?.id);

    if (filters.status) {
      query = query.eq("status", filters.status as any);
    }

    const { data, error } = await query.order("nome_completo");
    if (error) throw error;

    return data?.map(item => ({
      nome: item.nome_completo,
      email: "-", // Email não está disponível no profiles
      celular: item.celular || "-",
      departamento: item.departamento || "-",
      tipo_acesso: item.tipo_acesso || "-",
      status: item.status || "-",
      data_cadastro: item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy") : "-"
    })) || [];
  };

  const fetchTemplates = async () => {
    let query = supabase
      .from("agente_cadencias_steps")
      .select(`
        id,
        nome_cadencia,
        tipo_mensagem,
        ativa,
        created_at,
        updated_at,
        agente:agentes_ia(nome)
      `)
      .eq("empresa_id", activeCompany?.id);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return data?.map(item => ({
      nome: item.nome_cadencia,
      tipo: item.tipo_mensagem || "-",
      agente: item.agente?.nome || "-",
      ativo: item.ativa ? "Sim" : "Não",
      data_criacao: item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy") : "-",
      ultima_atualizacao: item.updated_at ? format(new Date(item.updated_at), "dd/MM/yyyy") : "-"
    })) || [];
  };

  const handleGenerateReport = async () => {
    if (!selectedModule || !activeCompany?.id) {
      toast.error("Selecione um módulo para gerar o relatório");
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      let result: any[] = [];

      switch (selectedModule) {
        case "eventos":
          result = await fetchEventos();
          break;
        case "atendimentos":
          result = await fetchAtendimentos();
          break;
        case "vendas":
          result = await fetchVendas();
          break;
        case "usuarios":
          result = await fetchUsuarios();
          break;
        case "templates":
          result = await fetchTemplates();
          break;
      }

      setData(result);
      toast.success(`${result.length} registros encontrados`);
    } catch (error: any) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar relatório: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (data.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    
    const moduleName = modules.find(m => m.id === selectedModule)?.name || "Relatorio";
    XLSX.writeFile(wb, `${moduleName}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    
    toast.success("Arquivo Excel exportado com sucesso!");
  };

  const selectedModuleData = modules.find(m => m.id === selectedModule);

  return (
    <DashboardLayout title="Relatórios">
      <div className="space-y-6">
        {/* Header */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Construtor de Relatórios</h2>
          </div>
          <p className="text-muted-foreground">
            Selecione um tipo de relatório e aplique os filtros desejados para gerar seu relatório.
          </p>
        </Card>

        {/* Construtor */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* Seleção do Módulo */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Tipo de Relatório
              </label>
              <Select value={selectedModule} onValueChange={(value) => {
                setSelectedModule(value as ReportModule);
                setData([]);
                setHasSearched(false);
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha o tipo de relatório" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      <div className="flex flex-col">
                        <span>{module.name}</span>
                        <span className="text-xs text-muted-foreground">{module.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtros */}
            {selectedModule && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4" />
                  <label className="text-sm font-medium">Filtros</label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(selectedModule !== "usuarios" && selectedModule !== "templates") && (
                    <>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Data Início</label>
                        <Input 
                          type="date" 
                          value={filters.dataInicio}
                          onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Data Fim</label>
                        <Input 
                          type="date"
                          value={filters.dataFim}
                          onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  {selectedModule === "eventos" && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Canal</label>
                      <Select 
                        value={filters.canal || "__all__"} 
                        onValueChange={(value) => setFilters(prev => ({ ...prev, canal: value === "__all__" ? undefined : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos</SelectItem>
                          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          <SelectItem value="Ligação">Ligação</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedModule === "atendimentos" && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Status</label>
                      <Select 
                        value={filters.status || "__all__"} 
                        onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "__all__" ? undefined : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos</SelectItem>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="em_andamento">Em Andamento</SelectItem>
                          <SelectItem value="convertido">Convertido</SelectItem>
                          <SelectItem value="perdido">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedModule === "usuarios" && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Status</label>
                      <Select 
                        value={filters.status || "__all__"} 
                        onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "__all__" ? undefined : value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos</SelectItem>
                          <SelectItem value="Ativo">Ativo</SelectItem>
                          <SelectItem value="Inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3 pt-4">
              <Button 
                className="flex items-center gap-2" 
                onClick={handleGenerateReport}
                disabled={!selectedModule || loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Gerar Relatório
              </Button>
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                onClick={handleExportExcel}
                disabled={data.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </Card>

        {/* Resultado do Relatório */}
        {hasSearched && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Resultado: {selectedModuleData?.name}
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro encontrado com os filtros aplicados.
              </div>
            ) : (
              <ScrollArea className="h-[400px] w-full">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {selectedModuleData?.fields.map((field) => (
                          <TableHead key={field}>{field}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((row, index) => (
                        <TableRow key={index}>
                          {Object.values(row).map((value: any, cellIndex) => (
                            <TableCell key={cellIndex}>{value}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}

            <div className="mt-4 text-sm text-muted-foreground">
              Total: {data.length} registros
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Relatorios;