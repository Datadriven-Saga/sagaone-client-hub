import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useProspectData } from "@/hooks/useProspectData";
import { Users, Plus, Search, Phone, Mail, DollarSign, User } from "lucide-react";
import { toast } from "sonner";

const statusConfig = {
  'Novo': { color: '#6645EB', label: 'Novo' },
  'Em Contato': { color: '#8B5FD6', label: 'Em Contato' }, 
  'Qualificado': { color: '#A679E1', label: 'Qualificado' },
  'Negociação': { color: '#C193EC', label: 'Negociação' },
  'Fechado': { color: '#10B981', label: 'Fechado' },
  'Perdido': { color: '#EF4444', label: 'Perdido' }
};

export default function ProspeccaoNew() {
  const { prospects, loading, createProspect, updateProspectStatus, syncProspectToCliente } = useProspectData();
  const [searchFilter, setSearchFilter] = useState("");
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Prospecção (New)</h1>
            <p className="text-muted-foreground">Módulo novo e independente de prospecção</p>
          </div>
          
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {getStatusStats().map((stat) => (
            <Card key={stat.status}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                  <div>
                    <p className="text-sm font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar prospects..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Prospects List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Prospects ({filteredProspects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProspects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {prospects.length === 0 
                  ? "Nenhum prospect cadastrado ainda." 
                  : "Nenhum prospect encontrado com os filtros aplicados."
                }
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProspects.map((prospect) => (
                  <div key={prospect.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{prospect.nome}</h3>
                          <Badge 
                            variant="secondary"
                            style={{ 
                              backgroundColor: statusConfig[prospect.status as keyof typeof statusConfig]?.color + '20',
                              color: statusConfig[prospect.status as keyof typeof statusConfig]?.color 
                            }}
                          >
                            {statusConfig[prospect.status as keyof typeof statusConfig]?.label || prospect.status}
                          </Badge>
                          {prospect.cliente_id && (
                            <Badge variant="outline">
                              Na Carteira
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {prospect.telefone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {prospect.telefone}
                            </div>
                          )}
                          {prospect.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {prospect.email}
                            </div>
                          )}
                          {prospect.valor_potencial && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              R$ {Number(prospect.valor_potencial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                          {prospect.origem && prospect.origem !== 'Outros' && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {prospect.origem}
                            </div>
                          )}
                        </div>
                        
                        {prospect.observacoes && (
                          <p className="text-sm text-muted-foreground">{prospect.observacoes}</p>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Select value={prospect.status} onValueChange={(value) => handleStatusChange(prospect.id, value)}>
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
                        
                        {!prospect.cliente_id && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleSyncToCliente(prospect)}
                          >
                            Adicionar à Carteira
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}