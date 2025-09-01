import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FileText, Download, Filter } from "lucide-react";

const Relatorios = () => {
  const modules = [
    {
      name: "Carteira de Clientes",
      fields: ["ID", "Nome", "Telefone", "E-mail", "Sexo", "Data de Nascimento", "CPF/CNPJ", "Já comprou", "Responsável", "Produtos", "Última compra"]
    },
    {
      name: "Notificações", 
      fields: ["ID", "Tipo", "Cliente", "Data do Evento", "Data Última Compra", "Último Veículo", "Status"]
    },
    {
      name: "Prospecção",
      fields: ["ID", "Nome da Prospecção", "Cliente", "Status", "Responsável", "Data de Criação", "Temperatura", "Anotações"]
    },
    {
      name: "Central de Atendimento",
      fields: ["ID", "Cliente", "Origem", "Canal", "Status", "Responsável", "Data de Criação", "Produtos de Interesse"]
    },
    {
      name: "Loja",
      fields: ["ID", "Cliente", "Origem", "Canal", "Status", "Responsável", "Valor da Venda", "ID do ERP", "Data de Fechamento"]
    },
    {
      name: "Busca & Resgate", 
      fields: ["ID", "Cliente", "Origem", "Canal", "Status", "Responsável", "Data do Evento", "Motivo"]
    }
  ];

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
            Selecione um módulo e as colunas desejadas para gerar seu relatório personalizado.
          </p>
        </Card>

        {/* Construtor */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* Seleção do Módulo */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Selecione o Módulo
              </label>
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um módulo do sistema" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.name} value={module.name}>
                      {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seleção das Colunas */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Selecione as Colunas (Carteira de Clientes)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {modules[0].fields.map((field) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox id={field} defaultChecked />
                    <label
                      htmlFor={field}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {field}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4" />
                <label className="text-sm font-medium">Filtros (Opcional)</label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data Início</label>
                  <Input type="date" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data Fim</label>
                  <Input type="date" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Responsável</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os responsáveis</SelectItem>
                      <SelectItem value="maria">Maria Santos</SelectItem>
                      <SelectItem value="carlos">Carlos Lima</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3 pt-4">
              <Button className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Visualizar Relatório
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </Card>

        {/* Histórico de Relatórios */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Relatórios Recentes
          </h3>
          
          <div className="space-y-3">
            {[
              { name: "Clientes - Janeiro 2025", module: "Carteira de Clientes", date: "15/01/2025", status: "Concluído" },
              { name: "Prospecção - Q4 2024", module: "Prospecção", date: "10/01/2025", status: "Concluído" },
              { name: "Leads - Dezembro", module: "Central de Atendimento", date: "08/01/2025", status: "Processando" }
            ].map((report, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div>
                  <p className="font-medium">{report.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {report.module} • Gerado em {report.date}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    report.status === 'Concluído' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {report.status}
                  </span>
                  {report.status === 'Concluído' && (
                    <Button size="sm" variant="outline">
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Relatorios;