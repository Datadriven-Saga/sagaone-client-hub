import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Users, Phone, Mail, UserCheck } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { useClientesData } from "@/hooks/useClientesData";

const Clientes = () => {
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { clientes: clientesList, kpis: kpisData, distribuicaoGenero, distribuicaoDocumento, loading } = useClientesData();

  const kpis = [
    { title: "Clientes", value: loading ? "..." : kpisData.total.toString(), icon: Users },
    { 
      title: "Com Telefone", 
      value: loading ? "..." : kpisData.comTelefone.toString(), 
      subtitle: kpisData.total > 0 ? `${((kpisData.comTelefone / kpisData.total) * 100).toFixed(0)}%` : "0%", 
      icon: Phone 
    },
    { 
      title: "Com E-mail", 
      value: loading ? "..." : kpisData.comEmail.toString(), 
      subtitle: kpisData.total > 0 ? `${((kpisData.comEmail / kpisData.total) * 100).toFixed(0)}%` : "0%", 
      icon: Mail 
    },
    { 
      title: "Realizaram Compra", 
      value: loading ? "..." : kpisData.realizaramCompra.toString(), 
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Buscar cliente por nome, telefone ou email..." />

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Tipo do Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
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
            <h3 className="text-lg font-semibold text-foreground">Lista de Clientes</h3>
            <Button onClick={handleNewClient}>Novo Cliente</Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p>Carregando clientes...</p>
            </div>
          ) : clientesList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto mb-2" size={32} />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Comprou</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesList.map((client) => (
                  <TableRow 
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleClientRowClick(client)}
                  >
                    <TableCell className="font-medium">{client.name}</TableCell>
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