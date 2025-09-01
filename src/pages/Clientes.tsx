import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { FilterBar } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Phone, Mail, UserCheck } from "lucide-react";
import { useState } from "react";

const Clientes = () => {
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Mock data - replace with real data from API
  const kpis = [
    { title: "Quantidade de Clientes", value: "1,234", icon: Users },
    { title: "Clientes com Telefone", value: "1,100", subtitle: "89%", icon: Phone },
    { title: "Clientes com E-mail", value: "856", subtitle: "69%", icon: Mail },
    { title: "Já realizaram compra", value: "432", subtitle: "35%", icon: UserCheck }
  ];

  const clientFilters = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'ativo', label: 'Ativo' },
        { value: 'inativo', label: 'Inativo' }
      ]
    },
    {
      key: 'gender',
      label: 'Sexo',
      options: [
        { value: 'masculino', label: 'Masculino' },
        { value: 'feminino', label: 'Feminino' }
      ]
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
      <div className="space-y-3">
        {/* Filtros */}
        <FilterBar
          searchPlaceholder="Buscar cliente por nome, telefone ou email..."
          additionalFilters={clientFilters}
        />

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
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-foreground">Lista de Clientes</h3>
            <Button onClick={handleNewClient}>Novo Cliente</Button>
          </div>

          <div className="overflow-x-auto">
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
                  <TableRow 
                    key={client.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleClientRowClick(client)}
                  >
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
          </div>
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
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone" 
                  defaultValue={selectedClient?.phone || ''} 
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email"
                  defaultValue={selectedClient?.email || ''} 
                  placeholder="cliente@email.com"
                />
              </div>
              
              <div>
                <Label htmlFor="gender">Sexo</Label>
                <select 
                  id="gender" 
                  className="w-full p-2 border rounded-md"
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
                />
              </div>
              
              <div>
                <Label htmlFor="document">CPF/CNPJ</Label>
                <Input 
                  id="document" 
                  defaultValue={selectedClient?.document || ''} 
                  placeholder="000.000.000-00"
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