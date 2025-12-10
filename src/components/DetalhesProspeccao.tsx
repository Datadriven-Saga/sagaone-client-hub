import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { Eye, Download, Calendar, Target, Users, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ClienteProspectado {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  status: 'Enviado' | 'Recebido' | 'Respondido' | 'Agendado' | 'Confirmado' | 'Cancelado' | 'Opt-Out' | 'Venda';
  dataContato: string;
  ultimaInteracao: string;
}

interface Prospeccao {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  brand: string;
  objective: number;
  status: string;
  metrics: {
    enviados: number;
    recebidos: number;
    respondidos: number;
    agendados: number;
    confirmados: number;
    cancelados: number;
    optOut: number;
    vendas: number;
  };
}

interface DetalhesProspeccaoProps {
  prospeccao: Prospeccao;
}

export const DetalhesProspeccao = ({ prospeccao }: DetalhesProspeccaoProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Mock de dados de clientes prospectados
  const clientesProspectados: ClienteProspectado[] = [
    {
      id: '1',
      nome: 'João Silva',
      telefone: '(11) 99999-1111',
      email: 'joao@email.com',
      status: 'Venda',
      dataContato: '15/01/2025',
      ultimaInteracao: '20/01/2025'
    },
    {
      id: '2',
      nome: 'Maria Santos',
      telefone: '(11) 99999-2222',
      email: 'maria@email.com',
      status: 'Confirmado',
      dataContato: '16/01/2025',
      ultimaInteracao: '18/01/2025'
    },
    {
      id: '3',
      nome: 'Pedro Costa',
      telefone: '(11) 99999-3333',
      status: 'Agendado',
      dataContato: '17/01/2025',
      ultimaInteracao: '17/01/2025'
    },
    {
      id: '4',
      nome: 'Ana Paula',
      telefone: '(11) 99999-4444',
      email: 'ana@email.com',
      status: 'Respondido',
      dataContato: '18/01/2025',
      ultimaInteracao: '19/01/2025'
    },
    {
      id: '5',
      nome: 'Carlos Oliveira',
      telefone: '(11) 99999-5555',
      status: 'Opt-Out',
      dataContato: '19/01/2025',
      ultimaInteracao: '19/01/2025'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Venda':
        return 'bg-green-100 text-green-800';
      case 'Confirmado':
        return 'bg-blue-100 text-blue-800';
      case 'Agendado':
        return 'bg-purple-100 text-purple-800';
      case 'Respondido':
        return 'bg-yellow-100 text-yellow-800';
      case 'Recebido':
        return 'bg-indigo-100 text-indigo-800';
      case 'Enviado':
        return 'bg-gray-100 text-gray-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      case 'Opt-Out':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExportData = () => {
    // Simular exportação (aqui você implementaria a exportação real)
    const csvContent = [
      'Nome,Telefone,Email,Status,Data Contato,Última Interação',
      ...clientesProspectados.map(cliente => 
        `${cliente.nome},${cliente.telefone},${cliente.email || ''},${cliente.status},${cliente.dataContato},${cliente.ultimaInteracao}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prospeccao.name}_clientes_prospectados.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: "Base de clientes exportada com sucesso",
    });
  };

  const taxaConversao = ((prospeccao.metrics.vendas / prospeccao.metrics.enviados) * 100).toFixed(1);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          Ver Detalhes
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Detalhes da Prospecção: {prospeccao.name}</span>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollIndicator className="flex-1 min-h-0">
          <div className="space-y-6 pr-2">
          {/* Informações Gerais */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Informações da Campanha</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="font-medium">{prospeccao.startDate} - {prospeccao.endDate}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Meta</p>
                  <p className="font-medium">{prospeccao.objective} vendas</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="font-medium">{taxaConversao}%</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={prospeccao.status === 'Ativa' ? 'default' : 'secondary'}>
                    {prospeccao.status}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Métricas Resumidas */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Resumo de Performance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{prospeccao.metrics.enviados}</p>
                <p className="text-sm text-muted-foreground">Enviados</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{prospeccao.metrics.respondidos}</p>
                <p className="text-sm text-muted-foreground">Respondidos</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{prospeccao.metrics.agendados}</p>
                <p className="text-sm text-muted-foreground">Agendados</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-2xl font-bold text-green-600">{prospeccao.metrics.vendas}</p>
                <p className="text-sm text-muted-foreground">Vendas</p>
              </div>
            </div>
          </Card>

          {/* Lista de Clientes Prospectados */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Clientes Prospectados ({clientesProspectados.length})</h3>
              <Button onClick={handleExportData} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar Base
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[180px]">Nome</TableHead>
                      <TableHead className="w-[140px]">Telefone</TableHead>
                      <TableHead className="w-[180px]">E-mail</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[110px]">Data Contato</TableHead>
                      <TableHead className="w-[110px]">Últ. Interação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesProspectados.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell>{cliente.telefone}</TableCell>
                        <TableCell>{cliente.email || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(cliente.status)}>
                            {cliente.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{cliente.dataContato}</TableCell>
                        <TableCell>{cliente.ultimaInteracao}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            </Card>
          </div>
        </ScrollIndicator>

        <div className="flex-shrink-0 flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};