import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Users, Filter } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  sexo?: 'M' | 'F';
  dataNascimento?: Date;
  ultimaCompra?: Date;
}

interface FiltrosBase {
  nome?: string;
  sexo?: 'M' | 'F' | '';
  dataNascimentoInicio?: Date;
  dataNascimentoFim?: Date;
  ultimaCompraInicio?: Date;
  ultimaCompraFim?: Date;
}

interface Prospeccao {
  id: string;
  titulo: string;
  descricao?: string;
  data_fim?: string | null;
}

interface BaseExistenteProps {
  onClientesSelected: (campanha: string, clientes: Cliente[]) => void;
  prospeccoes: Prospeccao[];
}

export const BaseExistente = ({ onClientesSelected, prospeccoes }: BaseExistenteProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string>('');
  const [filtros, setFiltros] = useState<FiltrosBase>({});
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();


  // Mock de dados de clientes
  const mockClientes: Cliente[] = [
    {
      id: '1',
      nome: 'João Silva',
      telefone: '(11) 99999-1111',
      email: 'joao@email.com',
      cpf: '123.456.789-01',
      sexo: 'M',
      dataNascimento: new Date('1985-05-15'),
      ultimaCompra: new Date('2024-12-15')
    },
    {
      id: '2',
      nome: 'Maria Santos',
      telefone: '(11) 99999-2222',
      email: 'maria@email.com',
      sexo: 'F',
      dataNascimento: new Date('1990-08-22'),
      ultimaCompra: new Date('2024-11-10')
    },
    {
      id: '3',
      nome: 'Pedro Costa',
      telefone: '(11) 99999-3333',
      email: 'pedro@email.com',
      cpf: '987.654.321-02',
      sexo: 'M',
      dataNascimento: new Date('1978-03-10'),
      ultimaCompra: new Date('2024-10-05')
    },
    {
      id: '4',
      nome: 'Ana Paula',
      telefone: '(11) 99999-4444',
      email: 'ana@email.com',
      sexo: 'F',
      dataNascimento: new Date('1995-12-01'),
      ultimaCompra: new Date('2024-01-20')
    },
  ];

  const aplicarFiltros = () => {
    setIsLoading(true);
    
    // Simular busca com filtros
    setTimeout(() => {
      let resultado = [...mockClientes];
      
      if (filtros.nome) {
        resultado = resultado.filter(cliente => 
          cliente.nome.toLowerCase().includes(filtros.nome!.toLowerCase())
        );
      }
      
      if (filtros.sexo) {
        resultado = resultado.filter(cliente => cliente.sexo === filtros.sexo);
      }
      
      if (filtros.dataNascimentoInicio) {
        resultado = resultado.filter(cliente => 
          cliente.dataNascimento && cliente.dataNascimento >= filtros.dataNascimentoInicio!
        );
      }
      
      if (filtros.dataNascimentoFim) {
        resultado = resultado.filter(cliente => 
          cliente.dataNascimento && cliente.dataNascimento <= filtros.dataNascimentoFim!
        );
      }
      
      if (filtros.ultimaCompraInicio) {
        resultado = resultado.filter(cliente => 
          cliente.ultimaCompra && cliente.ultimaCompra >= filtros.ultimaCompraInicio!
        );
      }
      
      if (filtros.ultimaCompraFim) {
        resultado = resultado.filter(cliente => 
          cliente.ultimaCompra && cliente.ultimaCompra <= filtros.ultimaCompraFim!
        );
      }
      
      setClientesFiltrados(resultado);
      setSelectedClientes([]);
      setIsLoading(false);
      
      toast({
        title: "Busca realizada",
        description: `${resultado.length} clientes encontrados`,
      });
    }, 1000);
  };

  const handleClienteSelection = (clienteId: string, checked: boolean) => {
    if (checked) {
      setSelectedClientes(prev => [...prev, clienteId]);
    } else {
      setSelectedClientes(prev => prev.filter(id => id !== clienteId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientes(clientesFiltrados.map(c => c.id));
    } else {
      setSelectedClientes([]);
    }
  };

  const handleConfirmSelection = () => {
    if (!selectedCampanha) {
      toast({
        title: "Selecione uma campanha",
        description: "Você deve escolher uma campanha para adicionar os contatos",
        variant: "destructive",
      });
      return;
    }

    const clientesSelecionados = clientesFiltrados.filter(c => selectedClientes.includes(c.id));
    onClientesSelected(selectedCampanha, clientesSelecionados);
    setIsOpen(false);
    setSelectedCampanha('');
    
    toast({
      title: "Clientes selecionados",
      description: `${clientesSelecionados.length} clientes adicionados à prospecção`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="p-3 h-auto flex items-center gap-2">
          <Users size={18} />
          <span className="text-sm">Usar Base Existente</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Selecionar da Base Existente</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Seleção de Campanha */}
          <Card className="p-4 bg-green-50 border-green-200">
            <Label className="text-green-800 font-medium">Selecione a Campanha</Label>
            <Select value={selectedCampanha} onValueChange={setSelectedCampanha}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Escolha uma campanha para adicionar os contatos..." />
              </SelectTrigger>
              <SelectContent>
                {prospeccoes
                  .filter((p) => !p.data_fim || new Date(p.data_fim) >= new Date(new Date().toDateString()))
                  .map((prospeccao) => (
                    <SelectItem key={prospeccao.id} value={prospeccao.titulo}>
                      {prospeccao.titulo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Filtros */}
          <Card className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <Filter size={16} />
              <h4 className="font-medium">Filtros de Segmentação</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label>Nome</Label>
                <Input
                  placeholder="Filtrar por nome..."
                  value={filtros.nome || ''}
                  onChange={(e) => setFiltros({...filtros, nome: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Sexo</Label>
              <Select 
                  value={filtros.sexo || 'todos'} 
                  onValueChange={(value) => setFiltros({...filtros, sexo: value === 'todos' ? '' : value as 'M' | 'F'})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Data de Nascimento (Período)</Label>
                <div className="flex space-x-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.dataNascimentoInicio ? format(filtros.dataNascimentoInicio, "dd/MM/yyyy") : "De..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filtros.dataNascimentoInicio}
                        onSelect={(date) => setFiltros({...filtros, dataNascimentoInicio: date})}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.dataNascimentoFim ? format(filtros.dataNascimentoFim, "dd/MM/yyyy") : "Até..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filtros.dataNascimentoFim}
                        onSelect={(date) => setFiltros({...filtros, dataNascimentoFim: date})}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              <div>
                <Label>Última Compra (Período)</Label>
                <div className="flex space-x-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.ultimaCompraInicio ? format(filtros.ultimaCompraInicio, "dd/MM/yyyy") : "De..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filtros.ultimaCompraInicio}
                        onSelect={(date) => setFiltros({...filtros, ultimaCompraInicio: date})}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.ultimaCompraFim ? format(filtros.ultimaCompraFim, "dd/MM/yyyy") : "Até..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filtros.ultimaCompraFim}
                        onSelect={(date) => setFiltros({...filtros, ultimaCompraFim: date})}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            
            <Button onClick={aplicarFiltros} disabled={isLoading}>
              {isLoading ? "Buscando..." : "Aplicar Filtros"}
            </Button>
          </Card>

          {/* Resultados */}
          {clientesFiltrados.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Clientes Encontrados ({clientesFiltrados.length})</h4>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={selectedClientes.length === clientesFiltrados.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm">Selecionar todos</span>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[50px]">Sel.</TableHead>
                        <TableHead className="w-[180px]">Nome</TableHead>
                        <TableHead className="w-[140px]">Telefone</TableHead>
                        <TableHead className="w-[180px]">E-mail</TableHead>
                        <TableHead className="w-[80px]">Sexo</TableHead>
                        <TableHead className="w-[110px]">Nasc.</TableHead>
                        <TableHead className="w-[110px]">Últ. Compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesFiltrados.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedClientes.includes(cliente.id)}
                              onCheckedChange={(checked) => handleClienteSelection(cliente.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell>{cliente.nome}</TableCell>
                          <TableCell>{cliente.telefone}</TableCell>
                          <TableCell>{cliente.email || '-'}</TableCell>
                          <TableCell>{cliente.sexo || '-'}</TableCell>
                          <TableCell>
                            {cliente.dataNascimento ? format(cliente.dataNascimento, 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            {cliente.ultimaCompra ? format(cliente.ultimaCompra, 'dd/MM/yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="flex-shrink-0 border-t pt-4">
          {clientesFiltrados.length > 0 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedClientes.length} clientes selecionados
              </p>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmSelection}
                  disabled={selectedClientes.length === 0}
                >
                  Adicionar Selecionados
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};