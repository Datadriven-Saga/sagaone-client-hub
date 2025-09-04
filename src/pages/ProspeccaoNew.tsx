import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, CheckCircle, Edit, Trash2, MoreVertical, Users, Plus, Search, Phone, Mail, DollarSign, User } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { useProspectData } from "@/hooks/useProspectData";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const statusConfig = {
  'Novo': { color: '#6645EB', label: 'Novo' },
  'Em Contato': { color: '#8B5FD6', label: 'Em Contato' }, 
  'Qualificado': { color: '#A679E1', label: 'Qualificado' },
  'Negociação': { color: '#C193EC', label: 'Negociação' },
  'Fechado': { color: '#10B981', label: 'Fechado' },
  'Perdido': { color: '#EF4444', label: 'Perdido' }
};

interface FunnelStage {
  id: string;
  title: string;
  value: number;
  color: string;
}

const Prospeccao = () => {
  const { prospects, loading, createProspect, updateProspectStatus, syncProspectToCliente } = useProspectData();
  const [selectedProspections, setSelectedProspections] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [editingProspeccao, setEditingProspeccao] = useState<any>(null);
  const [deleteProspeccaoId, setDeleteProspeccaoId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    origem: "Outros",
    valor_potencial: "",
    observacoes: ""
  });

  const filteredProspects = prospects.filter(prospect => {
    if (!searchFilter) return true;
    const searchLower = searchFilter.toLowerCase();
    return (
      prospect.nome?.toLowerCase().includes(searchLower) ||
      prospect.telefone?.includes(searchLower) ||
      prospect.email?.toLowerCase().includes(searchLower) ||
      prospect.origem?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const prospectData = {
      nome: formData.nome.trim(),
      telefone: formData.telefone.trim() || undefined,
      email: formData.email.trim() || undefined,
      origem: formData.origem,
      valor_potencial: formData.valor_potencial ? Number(formData.valor_potencial) : undefined,
      observacoes: formData.observacoes.trim() || undefined,
      status: 'Novo'
    };

    const result = await createProspect(prospectData);
    
    if (result) {
      setIsCreateModalOpen(false);
      setFormData({
        nome: "",
        telefone: "",
        email: "",
        origem: "Outros",
        valor_potencial: "",
        observacoes: ""
      });
    }
  };

  const handleStatusChange = async (prospectId: string, newStatus: string) => {
    await updateProspectStatus(prospectId, newStatus);
  };

  const handleSyncToCliente = async (prospect: any) => {
    const clienteId = await syncProspectToCliente(prospect);
    if (clienteId) {
      toast.success('Prospect sincronizado com carteira de clientes');
    }
  };

  const getStatusStats = () => {
    const stats = Object.keys(statusConfig).map(status => ({
      status,
      count: prospects.filter(p => p.status === status).length,
      ...statusConfig[status as keyof typeof statusConfig]
    }));
    return stats;
  };

  // Calcular métricas dos prospects
  const funnelData: FunnelStage[] = [
    {
      id: 'total-base',
      title: 'Total da Base',
      value: prospects.length,
      color: '#1f2937'
    },
    {
      id: 'novos',
      title: 'Novos',
      value: prospects.filter(p => p.status === 'Novo').length,
      color: '#6645EB'
    },
    {
      id: 'em-contato',
      title: 'Em Contato',
      value: prospects.filter(p => p.status === 'Em Contato').length,
      color: '#8B5FD6'
    },
    {
      id: 'qualificados',
      title: 'Qualificados',
      value: prospects.filter(p => p.status === 'Qualificado').length,
      color: '#A679E1'
    },
    {
      id: 'negociacao',
      title: 'Negociação',
      value: prospects.filter(p => p.status === 'Negociação').length,
      color: '#C193EC'
    },
    {
      id: 'fechados',
      title: 'Fechados',
      value: prospects.filter(p => p.status === 'Fechado').length,
      color: '#10b981'
    },
    {
      id: 'perdidos',
      title: 'Perdidos',
      value: prospects.filter(p => p.status === 'Perdido').length,
      color: '#ef4444'
    }
  ];

  const handleProspectionSelection = (prospectionId: string, checked: boolean) => {
    if (checked) {
      setSelectedProspections(prev => [...prev, prospectionId]);
    } else {
      setSelectedProspections(prev => prev.filter(id => id !== prospectionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProspections(prospects.map(p => p.id));
    } else {
      setSelectedProspections([]);
    }
  };

  const handleEditProspeccao = (prospeccao: any) => {
    setEditingProspeccao(prospeccao);
    setIsModalOpen(true);
  };

  const handleDeleteProspeccao = async (prospeccaoId: string) => {
    try {
      setDeleteProspeccaoId(null);
      toast.success("Prospecção excluída com sucesso");
    } catch (error) {
      console.error('Erro ao excluir prospecção:', error);
      toast.error("Erro ao excluir prospecção");
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Prospecção (New)">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Prospecção (New)">
      <Tabs defaultValue="visao-geral" className="space-y-3">
        <TabsList className="inline-flex">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="automacao">Adicionar Contatos</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-3">
          <FilterBar
            searchPlaceholder="Filtrar prospects por nome, telefone ou status..."
            onSearchChange={setSearchFilter}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funil de Vendas */}
            <div className="order-2 lg:order-1">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Funil de Vendas Geral</h3>
                <div className="space-y-4">
                  {funnelData.map((stage) => (
                    <div key={stage.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-sm font-medium">{stage.title}</span>
                      </div>
                      <span className="text-lg font-bold">{stage.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Lista de Prospecções */}
            <div className="order-1 lg:order-2 space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Prospects</h3>
                  <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Prospect
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Criar Novo Prospect</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateProspect} className="space-y-4">
                        <div>
                          <Label htmlFor="nome">Nome *</Label>
                          <Input
                            id="nome"
                            value={formData.nome}
                            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Nome do prospect"
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="telefone">Telefone</Label>
                          <Input
                            id="telefone"
                            value={formData.telefone}
                            onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="origem">Origem</Label>
                          <Select value={formData.origem} onValueChange={(value) => setFormData(prev => ({ ...prev, origem: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                              <SelectItem value="Instagram">Instagram</SelectItem>
                              <SelectItem value="Facebook">Facebook</SelectItem>
                              <SelectItem value="Site">Site</SelectItem>
                              <SelectItem value="Indicação">Indicação</SelectItem>
                              <SelectItem value="Outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="valor_potencial">Valor Potencial (R$)</Label>
                          <Input
                            id="valor_potencial"
                            type="number"
                            step="0.01"
                            value={formData.valor_potencial}
                            onChange={(e) => setFormData(prev => ({ ...prev, valor_potencial: e.target.value }))}
                            placeholder="0,00"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="observacoes">Observações</Label>
                          <Textarea
                            id="observacoes"
                            value={formData.observacoes}
                            onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                            placeholder="Observações sobre o prospect"
                          />
                        </div>
                        
                        <div className="flex gap-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                            Cancelar
                          </Button>
                          <Button type="submit" className="flex-1">
                            Criar Prospect
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {prospects.length > 0 ? (
                  <>
                    <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-muted">
                      <Checkbox 
                        id="select-all"
                        checked={selectedProspections.length === prospects.length}
                        onCheckedChange={handleSelectAll}
                      />
                      <label 
                        htmlFor="select-all" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Selecionar todos ({prospects.length})
                      </label>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredProspects.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50 border-t-4 border-t-primary">
                          <div className="flex items-start space-x-3">
                            <Checkbox 
                              id={`prospect-${item.id}`}
                              checked={selectedProspections.includes(item.id)}
                              onCheckedChange={(checked) => handleProspectionSelection(item.id, !!checked)}
                            />
                            
                             <div className="flex-1">
                               <div className="flex items-center justify-between gap-2 mb-1">
                                 <div className="flex items-center gap-2">
                                   <h4 className="font-semibold">{item.nome}</h4>
                                   <Badge 
                                     variant="secondary"
                                     style={{ 
                                       backgroundColor: statusConfig[item.status as keyof typeof statusConfig]?.color + '20',
                                       color: statusConfig[item.status as keyof typeof statusConfig]?.color 
                                     }}
                                   >
                                     {statusConfig[item.status as keyof typeof statusConfig]?.label || item.status}
                                   </Badge>
                                   {item.cliente_id && (
                                     <Badge variant="outline">
                                       Na Carteira
                                     </Badge>
                                   )}
                                 </div>
                                 
                                 {/* Menu de ações */}
                                 <DropdownMenu>
                                   <DropdownMenuTrigger asChild>
                                     <Button 
                                       variant="ghost" 
                                       size="sm"
                                       className="h-8 w-8 p-0"
                                     >
                                       <MoreVertical size={16} />
                                     </Button>
                                   </DropdownMenuTrigger>
                                   <DropdownMenuContent align="end">
                                     <DropdownMenuItem onClick={() => handleEditProspeccao(item)}>
                                       <Edit size={16} className="mr-2" />
                                       Editar
                                     </DropdownMenuItem>
                                     <DropdownMenuItem 
                                       onClick={() => setDeleteProspeccaoId(item.id)}
                                       className="text-red-600"
                                     >
                                       <Trash2 size={16} className="mr-2" />
                                       Excluir
                                     </DropdownMenuItem>
                                   </DropdownMenuContent>
                                 </DropdownMenu>
                               </div>
                               
                               <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                 {item.telefone && (
                                   <div className="flex items-center gap-1">
                                     <Phone className="h-3 w-3" />
                                     {item.telefone}
                                   </div>
                                 )}
                                 {item.email && (
                                   <div className="flex items-center gap-1">
                                     <Mail className="h-3 w-3" />
                                     {item.email}
                                   </div>
                                 )}
                                 {item.valor_potencial && (
                                   <div className="flex items-center gap-1">
                                     <DollarSign className="h-3 w-3" />
                                     R$ {Number(item.valor_potencial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                   </div>
                                 )}
                                 {item.origem && item.origem !== 'Outros' && (
                                   <div className="flex items-center gap-1">
                                     <User className="h-3 w-3" />
                                     {item.origem}
                                   </div>
                                 )}
                               </div>
                               
                               {item.observacoes && (
                                 <p className="text-xs text-muted-foreground mt-1">{item.observacoes}</p>
                               )}
                               
                               <div className="flex gap-2 mt-2">
                                 <Select value={item.status} onValueChange={(value) => handleStatusChange(item.id, value)}>
                                   <SelectTrigger className="w-32">
                                     <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent>
                                     {Object.entries(statusConfig).map(([status, config]) => (
                                       <SelectItem key={status} value={status}>
                                         {config.label}
                                       </SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                                 
                                 {!item.cliente_id && (
                                   <Button 
                                     size="sm" 
                                     variant="outline"
                                     onClick={() => handleSyncToCliente(item)}
                                   >
                                     Adicionar à Carteira
                                   </Button>
                                 )}
                               </div>
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   </>
                 ) : (
                   <div className="text-center py-8 text-muted-foreground">
                     <Target className="mx-auto mb-2" size={32} />
                     <p>Nenhum prospect encontrado</p>
                     <p className="text-sm">Crie seu primeiro prospect para começar</p>
                   </div>
                 )}
               </Card>
             </div>
           </div>
         </TabsContent>

         <TabsContent value="automacao" className="space-y-6">
           <Card className="p-6">
             <h3 className="text-lg font-semibold text-foreground mb-4">Adicionar Prospects à Prospecção</h3>
             
             {/* Contador de Prospects */}
             {prospects.length > 0 && (
               <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                 <div className="flex items-center space-x-2">
                   <CheckCircle className="text-green-600" size={20} />
                   <div>
                     <p className="font-medium text-green-800">
                       {prospects.length} prospects cadastrados no sistema
                     </p>
                     <p className="text-sm text-green-600">
                       Todos os prospects estão disponíveis para gestão
                     </p>
                   </div>
                 </div>
               </div>
             )}
             
             <div className="space-y-6">
               <div>
                 <h4 className="font-semibold mb-3">Carga de Prospects</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Card className="p-4">
                     <h5 className="font-medium mb-2">Importar da Base</h5>
                     <p className="text-sm text-muted-foreground mb-3">
                       Importar prospects existentes da carteira de clientes
                     </p>
                     <Button variant="outline" className="w-full">
                       Configurar Importação
                     </Button>
                   </Card>
                   <Card className="p-4">
                     <h5 className="font-medium mb-2">Upload de Planilha</h5>
                     <p className="text-sm text-muted-foreground mb-3">
                       Fazer upload de uma planilha com novos prospects
                     </p>
                     <Button variant="outline" className="w-full">
                       Fazer Upload
                     </Button>
                   </Card>
                 </div>
               </div>

               <div>
                 <h4 className="font-semibold mb-3">Configuração de Automação</h4>
                 <div className="border rounded-lg p-4">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="font-medium">Disparar via Meta Ads</p>
                       <p className="text-sm text-muted-foreground">
                         Configurar integração com gerenciador de anúncios
                       </p>
                     </div>
                     <Button>Configurar</Button>
                   </div>
                 </div>
               </div>
             </div>
           </Card>
         </TabsContent>

         <TabsContent value="kanban" className="flex flex-col h-[calc(100vh-200px)] overflow-hidden">
           <div className="flex-shrink-0 space-y-3">
             <FilterBar
               searchPlaceholder="Buscar por prospect, telefone ou status..."
               onSearchChange={setSearchFilter}
             />
             
             <Card className="p-4">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold text-foreground">Kanban - Gestão da Prospecção (New)</h3>
                 <div className="flex items-center space-x-4">
                   <div className="text-sm text-muted-foreground">
                     Total de prospects: {prospects.length}
                   </div>
                   <Button variant="outline" size="sm">
                     Atualizar Dados
                   </Button>
                 </div>
               </div>
             </Card>
           </div>
           
           <div className="flex-1 overflow-hidden">
             <Card className="p-6 h-full">
               <div className="text-center py-8 text-muted-foreground">
                 <Users className="mx-auto mb-2" size={32} />
                 <p>Kanban em desenvolvimento</p>
                 <p className="text-sm">Funcionalidade será implementada em breve</p>
               </div>
             </Card>
           </div>
         </TabsContent>
       </Tabs>

       {/* Modal de confirmação de exclusão */}
       <AlertDialog open={deleteProspeccaoId !== null} onOpenChange={() => setDeleteProspeccaoId(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Excluir Prospect</AlertDialogTitle>
             <AlertDialogDescription>
               Tem certeza que deseja excluir este prospect? Esta ação não pode ser desfeita.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancelar</AlertDialogCancel>
             <AlertDialogAction
               onClick={() => deleteProspeccaoId && handleDeleteProspeccao(deleteProspeccaoId)}
               className="bg-red-600 hover:bg-red-700"
             >
               Excluir
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </DashboardLayout>
   );
};

export default Prospeccao;