import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Users, Filter, Database, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

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

interface BaseImportada {
  id: string;
  nome: string;
  total_contatos: number;
  created_at: string;
}

interface BaseExistenteProps {
  onClientesSelected: (campanha: string, clientes: Cliente[]) => void;
  prospeccoes: Prospeccao[];
}

export const BaseExistente = ({ onClientesSelected, prospeccoes }: BaseExistenteProps) => {
  const { activeCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string>('');
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [bases, setBases] = useState<BaseImportada[]>([]);
  const [filtros, setFiltros] = useState<FiltrosBase>({});
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBases, setIsLoadingBases] = useState(false);
  const { toast } = useToast();

  // Buscar bases importadas quando abrir o modal
  useEffect(() => {
    const fetchBases = async () => {
      if (!isOpen || !activeCompany?.id) return;
      
      setIsLoadingBases(true);
      try {
        const { data, error } = await supabase
          .from('bases_importadas')
          .select('id, nome, total_contatos, created_at')
          .eq('empresa_id', activeCompany.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setBases(data || []);
      } catch (error) {
        console.error('Erro ao buscar bases:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as bases importadas",
          variant: "destructive",
        });
      } finally {
        setIsLoadingBases(false);
      }
    };
    
    fetchBases();
  }, [isOpen, activeCompany?.id, toast]);

  // Buscar contatos da base selecionada
  const buscarContatosDaBase = async () => {
    if (!selectedBase) {
      toast({
        title: "Selecione uma base",
        description: "Você deve escolher uma base para buscar os contatos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Buscar contatos vinculados à base selecionada
      let query = supabase
        .from('contatos')
        .select('id, nome, telefone, email')
        .eq('base_id', selectedBase);

      // Aplicar filtro de nome se houver
      if (filtros.nome) {
        query = query.ilike('nome', `%${filtros.nome}%`);
      }

      const { data, error } = await query.limit(5000);

      if (error) throw error;

      const clientes: Cliente[] = (data || []).map(c => ({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone || '',
        email: c.email || undefined,
      }));

      setClientesFiltrados(clientes);
      setSelectedClientes([]);
      
      toast({
        title: "Busca realizada",
        description: `${clientes.length} clientes encontrados`,
      });
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar os contatos da base",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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

  const handleConfirmSelection = async () => {
    if (!selectedCampanha) {
      toast({
        title: "Selecione uma campanha",
        description: "Você deve escolher uma campanha para adicionar os contatos",
        variant: "destructive",
      });
      return;
    }

    if (selectedClientes.length === 0) {
      toast({
        title: "Selecione os contatos",
        description: "Você deve selecionar pelo menos um contato",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1) Verificar quais contatos já estão vinculados a este evento
      const { data: vinculosExistentes, error: checkError } = await supabase
        .from('eventos_prospeccao')
        .select('contato_id')
        .eq('prospeccao_id', selectedCampanha)
        .in('contato_id', selectedClientes);

      if (checkError) {
        console.error('Erro ao verificar vínculos existentes:', checkError);
      }

      const jaVinculadosSet = new Set((vinculosExistentes || []).map(v => v.contato_id));
      const contatosParaVincular = selectedClientes.filter(id => !jaVinculadosSet.has(id));
      const jaVinculadosCount = jaVinculadosSet.size;

      console.log(`📊 ${contatosParaVincular.length} novos, ${jaVinculadosCount} já vinculados`);

      // 2) Se não há novos para vincular, apenas informar
      if (contatosParaVincular.length === 0) {
        toast({
          title: "Nenhum novo contato",
          description: `Todos os ${jaVinculadosCount} contatos selecionados já estão vinculados a este evento`,
        });
        setIsLoading(false);
        return;
      }

      // 3) Vincular apenas os novos
      const vinculos = contatosParaVincular.map(contatoId => ({
        contato_id: contatoId,
        prospeccao_id: selectedCampanha
      }));

      const BATCH_SIZE = 500;
      let inseridos = 0;
      
      for (let i = 0; i < vinculos.length; i += BATCH_SIZE) {
        const batch = vinculos.slice(i, i + BATCH_SIZE);
        
        const { error, data } = await supabase
          .from('eventos_prospeccao')
          .insert(batch)
          .select();
        
        if (error) {
          console.error('Erro ao vincular contatos:', error);
          // Se o erro for de unique constraint, continua (já existe)
          if (!error.message?.includes('duplicate') && !error.message?.includes('unique') && !error.code?.includes('23505')) {
            throw error;
          }
        }
        
        inseridos += data?.length || 0;
      }

      console.log(`✅ ${inseridos} contatos vinculados ao evento ${selectedCampanha}`);

      const clientesSelecionados = clientesFiltrados.filter(c => selectedClientes.includes(c.id));
      onClientesSelected(selectedCampanha, clientesSelecionados);
      setIsOpen(false);
      setSelectedCampanha('');
      setSelectedBase('');
      setClientesFiltrados([]);
      setSelectedClientes([]);
      
      const descricao = jaVinculadosCount > 0
        ? `${inseridos} novos vinculados. ${jaVinculadosCount} já estavam no evento.`
        : `${inseridos} clientes vinculados ao evento com sucesso`;

      toast({
        title: "Clientes adicionados",
        description: descricao,
      });
    } catch (error) {
      console.error('Erro ao vincular contatos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível vincular os contatos ao evento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
                {prospeccoes.map((prospeccao) => (
                  <SelectItem key={prospeccao.id} value={prospeccao.id}>
                    {prospeccao.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Seleção de Base Importada */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-blue-700" />
              <Label className="text-blue-800 font-medium">Selecione uma Base Importada</Label>
            </div>
            {isLoadingBases ? (
              <div className="flex items-center gap-2 text-blue-600 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando bases...</span>
              </div>
            ) : bases.length === 0 ? (
              <p className="text-sm text-blue-600 py-2">
                Nenhuma base importada ainda. Use "Upload de Planilha" para criar uma base.
              </p>
            ) : (
              <Select value={selectedBase} onValueChange={setSelectedBase}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Escolha uma base de contatos..." />
                </SelectTrigger>
                <SelectContent>
                  {bases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.nome} ({base.total_contatos} contatos) - {format(new Date(base.created_at), 'dd/MM/yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            
            <Button onClick={buscarContatosDaBase} disabled={isLoading || !selectedBase}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                "Buscar Contatos da Base"
              )}
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
                  disabled={selectedClientes.length === 0 || isLoading || !selectedCampanha}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    `Adicionar Selecionados (${selectedClientes.length})`
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};