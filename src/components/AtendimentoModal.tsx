import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
import { KanbanItem } from './KanbanBoard';
import { User, Phone, Mail, MessageSquare, Package, Thermometer, Clock, Settings, History } from 'lucide-react';
import { ContatoTimeline } from './ContatoTimeline';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface AtendimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: KanbanItem | null;
  columnId: string;
}

interface TemperaturaOption {
  id: string;
  nome: string;
  cor: string;
}

export function AtendimentoModal({ isOpen, onClose, item, columnId }: AtendimentoModalProps) {
  const { activeCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('dados-pessoais');
  const [novaAnotacao, setNovaAnotacao] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const [temperaturasDisponiveis, setTemperaturasDisponiveis] = useState<TemperaturaOption[]>([]);

  // Buscar temperaturas da empresa
  useEffect(() => {
    const fetchTemperaturas = async () => {
      if (!isOpen || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('temperaturas_lead')
        .select('id, nome, cor')
        .eq('empresa_id', activeCompany.id)
        .eq('ativo', true)
        .order('ordem');
      
      if (!error && data) {
        setTemperaturasDisponiveis(data);
      }
    };
    
    fetchTemperaturas();
  }, [isOpen, activeCompany?.id]);

  // Mock data - substituir por dados reais
  const dadosCliente = {
    nome: item?.title || '',
    cpf: '123.456.789-00',
    celular: '(11) 99999-9999',
    email: 'cliente@exemplo.com',
    historicoProdutos: ['Plano Família', 'Seguro Auto'],
    historicoProspeccoes: ['Campanha Black Friday', 'Prospecção Q1'],
    historicoLeads: ['Lead Facebook', 'Lead Google Ads']
  };

  const responsavel = {
    nome: 'Ana Silva',
    id: 'SDR001'
  };

  const anotacoes = [
    {
      id: '1',
      texto: 'Cliente demonstrou interesse no plano familiar',
      usuario: 'João Santos',
      horario: '10:30 - 15/01/2024'
    },
    {
      id: '2',
      texto: 'Agendado retorno para próxima semana',
      usuario: 'Ana Silva',
      horario: '14:15 - 15/01/2024'
    }
  ];

  const produtosDisponiveis = [
    'Plano Individual',
    'Plano Família',
    'Plano Empresarial',
    'Seguro Auto',
    'Seguro Residencial'
  ];

  const logAuditoria = [
    { acao: 'Card criado', usuario: 'Sistema', data: '15/01/2024 09:00' },
    { acao: 'Responsável atribuído', usuario: 'Ana Silva', data: '15/01/2024 10:00' },
    { acao: 'Anotação adicionada', usuario: 'João Santos', data: '15/01/2024 10:30' }
  ];

  const handleAdicionarAnotacao = () => {
    if (novaAnotacao.trim()) {
      toast.success('Anotação adicionada com sucesso!');
      setNovaAnotacao('');
    }
  };

  const handleAtribuirResponsavel = () => {
    if (columnId === 'novo') {
      toast.success('Responsável atribuído com sucesso!');
    } else {
      toast.error('Só é possível se atribuir em cards da coluna "Novo"');
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Detalhes do Atendimento - {item.title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-6 h-[70vh]">
          {/* Menu lateral */}
          <div className="w-64 border-r pr-4">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('dados-pessoais')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'dados-pessoais' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <User className="h-4 w-4" />
                Dados Pessoais
              </button>
              <button
                onClick={() => setActiveTab('responsavel')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'responsavel' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <User className="h-4 w-4" />
                Responsável
              </button>
              <button
                onClick={() => setActiveTab('origem-canal')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'origem-canal' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Origem/Canal
              </button>
              <button
                onClick={() => setActiveTab('anotacoes')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'anotacoes' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Anotações
              </button>
              <button
                onClick={() => setActiveTab('produtos')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'produtos' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <Package className="h-4 w-4" />
                Produtos
              </button>
              <button
                onClick={() => setActiveTab('temperatura')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'temperatura' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <Thermometer className="h-4 w-4" />
                Temperatura
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'whatsapp' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <Phone className="h-4 w-4" />
                WhatsApp
              </button>
              <button
                onClick={() => setActiveTab('auditoria')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'auditoria' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <Clock className="h-4 w-4" />
                Log de Auditoria
              </button>
              <button
                onClick={() => setActiveTab('historico')}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-2 ${
                  activeTab === 'historico' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <History className="h-4 w-4" />
                Histórico
              </button>
            </nav>
          </div>

          {/* Conteúdo principal */}
          <ScrollIndicator className="flex-1">
            {activeTab === 'dados-pessoais' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nome do Cliente</Label>
                      <p className="text-sm font-medium">{dadosCliente.nome}</p>
                    </div>
                    <div>
                      <Label>CPF</Label>
                      <p className="text-sm font-medium">{dadosCliente.cpf}</p>
                    </div>
                    <div>
                      <Label>Celular</Label>
                      <p className="text-sm font-medium">{dadosCliente.celular}</p>
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <p className="text-sm font-medium">{dadosCliente.email}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Histórico de Produtos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {dadosCliente.historicoProdutos.map((produto, index) => (
                        <Badge key={index} variant="outline">{produto}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Histórico de Prospecções</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {dadosCliente.historicoProspeccoes.map((prospeccao, index) => (
                        <Badge key={index} variant="secondary">{prospeccao}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Histórico de Leads</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {dadosCliente.historicoLeads.map((lead, index) => (
                        <Badge key={index}>{lead}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'responsavel' && (
              <Card>
                <CardHeader>
                  <CardTitle>Responsável</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>SDR Responsável</Label>
                    <p className="text-sm font-medium">{responsavel.nome} (ID: {responsavel.id})</p>
                  </div>
                  {columnId === 'novo' && (
                    <Button onClick={handleAtribuirResponsavel}>
                      Tomar Posse desta Prospecção
                    </Button>
                  )}
                  {columnId !== 'novo' && (
                    <p className="text-sm text-muted-foreground">
                      Só é possível se atribuir em cards da coluna "Novo"
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'origem-canal' && (
              <Card>
                <CardHeader>
                  <CardTitle>Origem e Canal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Canal</Label>
                    <p className="text-sm font-medium">{item.channel || 'WhatsApp'}</p>
                  </div>
                  <div>
                    <Label>Origem</Label>
                    <p className="text-sm font-medium">Site Institucional</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'anotacoes' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Nova Anotação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Digite sua anotação..."
                      value={novaAnotacao}
                      onChange={(e) => setNovaAnotacao(e.target.value)}
                      maxLength={1000}
                      style={{ backgroundColor: '#FFFFFF' }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {novaAnotacao.length}/1000 caracteres
                    </p>
                    <Button onClick={handleAdicionarAnotacao}>
                      Adicionar Anotação
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Anotações Existentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {anotacoes.map((anotacao) => (
                        <div key={anotacao.id} className="border-l-4 border-primary pl-4">
                          <p className="text-sm">{anotacao.texto}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Por {anotacao.usuario} • {anotacao.horario}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'produtos' && (
              <Card>
                <CardHeader>
                  <CardTitle>Produtos de Interesse</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select>
                    <SelectTrigger style={{ backgroundColor: '#FFFFFF' }}>
                      <SelectValue placeholder="Selecionar produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosDisponiveis.map((produto) => (
                        <SelectItem key={produto} value={produto}>
                          {produto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button>Adicionar Produto</Button>
                  
                  <div>
                    <Label>Produtos Vinculados</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge>Plano Família</Badge>
                      <Badge>Seguro Auto</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'temperatura' && (
              <Card>
                <CardHeader>
                  <CardTitle>Temperatura do Lead</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={temperatura} onValueChange={setTemperatura}>
                    <SelectTrigger style={{ backgroundColor: '#FFFFFF' }}>
                      <SelectValue placeholder="Selecionar temperatura..." />
                    </SelectTrigger>
                    <SelectContent>
                      {temperaturasDisponiveis.map((temp) => (
                        <SelectItem key={temp.id} value={temp.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: temp.cor }}
                            ></div>
                            {temp.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {temperatura && (
                    <p className="text-sm text-muted-foreground">
                      Temperatura selecionada alterará a cor do card no Kanban
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'whatsapp' && (
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Cliente</Label>
                      <p className="text-sm font-medium">{dadosCliente.nome}</p>
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <p className="text-sm font-medium">{dadosCliente.celular}</p>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <p className="text-center text-muted-foreground">
                      WhatsApp Web não vinculado. 
                      <br />
                      Acesse o módulo de Configurações para vincular o WhatsApp.
                    </p>
                    <Button variant="outline" className="w-full mt-2">
                      <Settings className="h-4 w-4 mr-2" />
                      Ir para Configurações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'auditoria' && (
              <Card>
                <CardHeader>
                  <CardTitle>Log de Auditoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {logAuditoria.map((log, index) => (
                      <div key={index} className="flex justify-between items-center border-b pb-2">
                        <div>
                          <p className="text-sm font-medium">{log.acao}</p>
                          <p className="text-xs text-muted-foreground">Por {log.usuario}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{log.data}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {activeTab === 'historico' && item && (
              <ContatoTimeline contatoId={item.id} />
            )}
          </ScrollIndicator>
        </div>
      </DialogContent>
    </Dialog>
  );
}