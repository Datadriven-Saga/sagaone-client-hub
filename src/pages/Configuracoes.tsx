import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Settings, Package, X, Users, MessageSquare, Thermometer, Phone } from "lucide-react";

const Configuracoes = () => {
  const mockProducts = [
    { id: "001", brand: "Honda", name: "Civic", version: "2024", stock: 5 },
    { id: "002", brand: "Toyota", name: "Corolla", version: "2024", stock: 3 },
    { id: "003", brand: "VW", name: "Jetta", version: "2023", stock: 8 }
  ];

  const mockReasons = [
    { id: "001", reason: "Cliente não tem interesse" },
    { id: "002", reason: "Cliente já realizou a compra" },
    { id: "003", reason: "Cliente com desejo para compra após 90 dias" },
    { id: "004", reason: "Cliente Incorreto" },
    { id: "005", reason: "Opt-Out" }
  ];

  const mockDepartments = [
    { id: "001", name: "Vendas", distribution: "Fila de Vendedores" },
    { id: "002", name: "Atendimento", distribution: "Manual" },
    { id: "003", name: "Gerência", distribution: "Para Gerentes" }
  ];

  const mockTemperatures = [
    { id: "001", name: "Alto", color: "Vermelho" },
    { id: "002", name: "Médio", color: "Amarelo" },
    { id: "003", name: "Baixo", color: "Cinza" }
  ];

  return (
    <DashboardLayout title="Configurações">
      <Tabs defaultValue="produtos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="motivos">Motivos</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="temperatura">Temperatura</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Produtos</h3>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.id}</TableCell>
                    <TableCell>{product.brand}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.version}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">Editar</Button>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="motivos" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <X className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Motivos de Insucesso</h3>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Motivo
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Motivo de Insucesso</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockReasons.map((reason) => (
                  <TableRow key={reason.id}>
                    <TableCell className="font-medium">{reason.id}</TableCell>
                    <TableCell>{reason.reason}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">Editar</Button>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="departamentos" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Departamentos</h3>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Departamento
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome do Departamento</TableHead>
                  <TableHead>Modelo de Distribuição</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDepartments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.id}</TableCell>
                    <TableCell>{dept.name}</TableCell>
                    <TableCell>{dept.distribution}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">Editar</Button>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="mensagens" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Mensagens Padrão</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                { type: "Aniversário", days: "0" },
                { type: "Recompra", days: "365" },
                { type: "Revisão", days: "180" },
                { type: "Financiamento", days: "30" },
                { type: "Entrega do Veículo", days: "7" }
              ].map((msg) => (
                <Card key={msg.type} className="p-4">
                  <h4 className="font-semibold mb-3">{msg.type}</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Mensagem</label>
                      <Textarea 
                        placeholder="Digite a mensagem padrão..."
                        className="min-h-[100px]"
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Máximo 500 caracteres</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Período (dias)</label>
                        <Input type="number" defaultValue={msg.days} />
                      </div>
                      <div className="flex items-end">
                        <Button className="w-full">Salvar</Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="temperatura" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Temperaturas</h3>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Temperatura
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockTemperatures.map((temp) => (
                  <TableRow key={temp.id}>
                    <TableCell className="font-medium">{temp.id}</TableCell>
                    <TableCell>{temp.name}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`${
                          temp.color === 'Vermelho' ? 'border-red-500 text-red-700' :
                          temp.color === 'Amarelo' ? 'border-yellow-500 text-yellow-700' :
                          'border-gray-500 text-gray-700'
                        }`}
                      >
                        {temp.color}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">Editar</Button>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">WhatsApp Vinculados</h3>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar WhatsApp
              </Button>
            </div>

            <div className="space-y-4">
              {[
                { phone: "+55 11 99999-9999", user: "Maria Santos", status: "Conectado" },
                { phone: "+55 11 88888-8888", user: "Carlos Lima", status: "Desconectado" }
              ].map((whats, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{whats.phone}</p>
                    <p className="text-sm text-muted-foreground">{whats.user}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={whats.status === 'Conectado' ? 'default' : 'secondary'}
                    >
                      {whats.status}
                    </Badge>
                    <Button size="sm" variant="outline">
                      {whats.status === 'Conectado' ? 'Desconectar' : 'Conectar'}
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Empty state */}
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum WhatsApp adicional vinculado</p>
                <p className="text-sm">Clique em "Adicionar WhatsApp" para vincular um novo número</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Configuracoes;