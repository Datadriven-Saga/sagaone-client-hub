import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Phone, Mail, UserCheck } from "lucide-react";

const Clientes = () => {
  // Mock data - replace with real data from API
  const kpis = [
    { title: "Quantidade de Clientes", value: "1,234", icon: Users },
    { title: "Clientes com Telefone", value: "1,100", subtitle: "89%", icon: Phone },
    { title: "Clientes com E-mail", value: "856", subtitle: "69%", icon: Mail },
    { title: "Já realizaram compra", value: "432", subtitle: "35%", icon: UserCheck }
  ];

  const mockClients = [
    {
      id: "001",
      name: "João Silva",
      phone: "(11) 99999-9999",
      email: "joao@email.com",
      gender: "Masculino",
      birthDate: "15/03/1985",
      document: "123.456.789-00",
      hasPurchased: "Sim",
      responsible: "Maria Santos",
      products: "Produto A, Produto B",
      lastPurchase: "15/12/2023"
    },
    {
      id: "002", 
      name: "Ana Costa",
      phone: "(11) 88888-8888",
      email: "ana@email.com",
      gender: "Feminino",
      birthDate: "22/07/1990",
      document: "987.654.321-00",
      hasPurchased: "Não",
      responsible: "Carlos Lima",
      products: "-",
      lastPurchase: "-"
    }
  ];

  return (
    <DashboardLayout title="Carteira de Clientes">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição por Sexo</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Masculino</span>
              <span className="font-medium">45%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Feminino</span>
              <span className="font-medium">42%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Não informado</span>
              <span className="font-medium">13%</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Tipo de Documento</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPF</span>
              <span className="font-medium">78%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPJ</span>
              <span className="font-medium">15%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Não informado</span>
              <span className="font-medium">7%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Clients Table */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-foreground">Lista de Clientes</h3>
          <div className="flex gap-3">
            <Input placeholder="Buscar cliente..." className="w-64" />
            <Button>Novo Cliente</Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Nascimento</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Já comprou?</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead>Última compra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockClients.map((client) => (
              <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium">{client.id}</TableCell>
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.phone}</TableCell>
                <TableCell>{client.email}</TableCell>
                <TableCell>{client.gender}</TableCell>
                <TableCell>{client.birthDate}</TableCell>
                <TableCell>{client.document}</TableCell>
                <TableCell>{client.hasPurchased}</TableCell>
                <TableCell>{client.responsible}</TableCell>
                <TableCell>{client.products}</TableCell>
                <TableCell>{client.lastPurchase}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </DashboardLayout>
  );
};

export default Clientes;