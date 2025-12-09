import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  History, 
  MessageSquare, 
  Package, 
  Thermometer, 
  MessageCircle, 
  FileText,
  Calendar,
  Trash2,
  UserCheck,
  Plus,
  Settings,
  PhoneCall
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Contato, statusKanbanMap } from '@/hooks/useContatoData';
import { supabase } from '@/integrations/supabase/client';
import { ContatoRealizadoDialog } from './ContatoRealizadoDialog';

interface ContatoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contato: Contato | null;
  columnId?: string;
  prospeccaoId?: string;
  onStatusChange?: (contatoId: string, novoStatus: Contato['status']) => void;
  onDelete?: (contatoId: string) => void;
  onAssignResponsible?: (contatoId: string, userId: string) => void;
  onCreateContact?: (novoContato: { nome: string; telefone: string; email?: string; }) => void;
}

interface Anotacao {
  id: string;
  texto: string;
  usuarioNome: string;
  usuarioCargo: string;
  timestamp: string;
}

interface Produto {
  id: string;
  nome: string;
  preco?: number;
  categoria?: string;
}

interface TemperaturaOption {
  id: string;
  nome: string;
  cor: string;
}

interface LogEntry {
  id: string;
  acao: string;
  usuario: string;
  timestamp: string;
  detalhes?: string;
}

export function ContatoModal({ 
  isOpen, 
  onClose, 
  contato, 
  columnId,
  prospeccaoId, 
  onStatusChange,
  onDelete,
  onAssignResponsible,
  onCreateContact 
}: ContatoModalProps) {
  const [activeTab, setActiveTab] = useState('dados-pessoais');
  const [novaAnotacao, setNovaAnotacao] = useState('');
  const [temperaturaAtual, setTemperaturaAtual] = useState<string>('');
  const [novoContato, setNovoContato] = useState({
    nome: '',
    telefone: '',
    email: ''
  });
  const [contatoRealizadoOpen, setContatoRealizadoOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Dados mockados removidos - buscar dados reais do banco
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<Array<{ id: string; nome: string; email: string; tipoAcesso: string | null }>>([]);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<string>('');
  const [responsavelAtualId, setResponsavelAtualId] = useState<string | null>(null);

  const temperaturas: TemperaturaOption[] = [
    { id: 'frio', nome: 'Frio', cor: '#3b82f6' },
    { id: 'morno', nome: 'Morno', cor: '#f59e0b' },
    { id: 'quente', nome: 'Quente', cor: '#ef4444' }
  ];

  // Buscar dados reais ao abrir o modal
  useEffect(() => {
    const carregarDados = async () => {
      if (isOpen) {
        try {
          // Buscar usuários disponíveis da empresa com perfis adequados
          const { data: usuarios, error: usuariosError } = await supabase
            .from('profiles')
            .select('id, nome_completo, celular, tipo_acesso')
            .in('tipo_acesso', ['Administrador', 'Gerente de Leads', 'Gerente de Loja', 'Vendedor'])
            .eq('status', 'Ativo');

          if (!usuariosError && usuarios) {
            const usuariosFormatados = usuarios.map(u => ({
              id: u.id,
              nome: u.nome_completo,
              email: u.celular || '',
              tipoAcesso: u.tipo_acesso
            }));
            setUsuariosDisponiveis(usuariosFormatados);
          }

          // Se há um contato, buscar dados dele
          if (contato && prospeccaoId) {
            // Buscar anotações do contato
            const { data: eventos, error } = await supabase
              .from('eventos_prospeccao')
              .select('*')
              .eq('contato_id', contato.id)
              .eq('prospeccao_id', prospeccaoId)
              .eq('tipo_evento', 'Anotação')
              .order('created_at', { ascending: false });

            if (!error && eventos) {
              // Buscar informações do perfil do usuário que criou cada anotação
              const anotacoesFormatadas = await Promise.all(eventos.map(async (evento) => {
                let usuarioNome = 'Usuário';
                let usuarioCargo = '';
                
                // O campo observacoes contém o ID do usuário que criou a anotação
                if (evento.observacoes && evento.observacoes !== 'Adicionado via API') {
                  const { data: perfil } = await supabase
                    .from('profiles')
                    .select('nome_completo, tipo_acesso')
                    .eq('id', evento.observacoes)
                    .maybeSingle();
                  
                  if (perfil) {
                    usuarioNome = perfil.nome_completo || 'Usuário';
                    usuarioCargo = perfil.tipo_acesso || '';
                  }
                }
                
                return {
                  id: evento.id,
                  texto: evento.descricao || '',
                  usuarioNome,
                  usuarioCargo,
                  timestamp: evento.created_at || new Date().toISOString()
                };
              }));
              setAnotacoes(anotacoesFormatadas);
            }

            // Definir responsável atual se existir
            if (contato.responsavel_email) {
              // Buscar por id, email ou celular
              const responsavelAtual = usuarios?.find(u => 
                u.id === contato.responsavel_email ||
                u.celular === contato.responsavel_email ||
                u.celular?.replace(/\D/g, '') === contato.responsavel_email?.replace(/\D/g, '')
              );
              if (responsavelAtual) {
                setResponsavelAtualId(responsavelAtual.id);
              } else {
                // Se não encontrou por id/celular, pode ser um UUID diretamente
                setResponsavelAtualId(contato.responsavel_email);
              }
            } else {
              setResponsavelAtualId(null);
            }
            // Sempre iniciar o dropdown vazio
            setResponsavelSelecionado('');
          }
        } catch (error) {
          console.error('Erro ao carregar dados:', error);
        }
      }
    };

    carregarDados();
  }, [contato, isOpen, prospeccaoId, user]);

  const statusOptions = [
    'Novo', 'Negociação', 'Em Contato', 'Qualificado', 'Proposta', 'Fechado', 'Perdido'
  ];

  const handleAdicionarAnotacao = async () => {
    if (novaAnotacao.trim().length === 0) {
      toast({
        title: "Erro",
        description: "A anotação não pode estar vazia",
        variant: "destructive"
      });
      return;
    }

    if (novaAnotacao.length > 1000) {
      toast({
        title: "Erro",
        description: "A anotação não pode ter mais de 1000 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (!contato || !prospeccaoId) {
      toast({
        title: "Erro",
        description: "Dados do contato não disponíveis",
        variant: "destructive"
      });
      return;
    }

    try {
      // Salvar anotação no banco via edge function
      const { data, error } = await supabase.functions.invoke('prospeccao-anotacao', {
        body: {
          prospeccao_id: prospeccaoId,
          contato_id: contato.id,
          mensagem: novaAnotacao
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Anotação adicionada com sucesso"
      });

      // Buscar nome e cargo do usuário atual
      let usuarioNome = 'Usuário';
      let usuarioCargo = '';
      if (user?.id) {
        const { data: perfil } = await supabase
          .from('profiles')
          .select('nome_completo, tipo_acesso')
          .eq('id', user.id)
          .maybeSingle();
        
        if (perfil) {
          usuarioNome = perfil.nome_completo || 'Usuário';
          usuarioCargo = perfil.tipo_acesso || '';
        }
      }

      // Adicionar a nova anotação à lista local
      const novaAnotacaoObj: Anotacao = {
        id: data.evento_id,
        texto: novaAnotacao,
        usuarioNome,
        usuarioCargo,
        timestamp: new Date().toISOString()
      };

      setAnotacoes(prev => [novaAnotacaoObj, ...prev]);
      setNovaAnotacao('');
    } catch (error) {
      console.error('Erro ao adicionar anotação:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar anotação. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = (novoStatus: Contato['status']) => {
    if (!contato) return;

    // Regras especiais para status específicos
    if (novoStatus === 'Perdido') {
      // TODO: Abrir modal para escolher motivo de insucesso
      console.log('Selecionar motivo de insucesso');
    } else if (novoStatus === 'Fechado') {
      // TODO: Criar lead no Central de Atendimento
      console.log('Criar lead no Central de Atendimento');
    }

    onStatusChange?.(contato.id, novoStatus);
    
    toast({
      title: "Status atualizado",
      description: `Status alterado para ${novoStatus}`
    });
  };

  const handleAtribuirResponsavel = async (userId: string) => {
    if (!contato || !userId) return;
    
    try {
      const usuarioSelecionado = usuariosDisponiveis.find(u => u.id === userId);
      if (!usuarioSelecionado) {
        toast({
          title: "Erro",
          description: "Usuário não encontrado",
          variant: "destructive"
        });
        return;
      }

      // Atualizar no banco - salvar o ID do usuário (não o celular/email)
      await onAssignResponsible?.(contato.id, userId);
      
      // Atualizar o estado do responsável atual para refletir a mudança imediatamente
      setResponsavelAtualId(userId);
      // Limpar o dropdown de seleção
      setResponsavelSelecionado('');
      
      toast({
        title: "Responsável atribuído",
        description: `${usuarioSelecionado.nome} foi definido como responsável por este contato`
      });
    } catch (error) {
      console.error('Erro ao atribuir responsável:', error);
      toast({
        title: "Erro",
        description: "Erro ao atribuir responsável. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleExcluirContato = () => {
    if (!contato) return;
    
    if (window.confirm('Tem certeza que deseja excluir este contato da prospecção?')) {
      onDelete?.(contato.id);
      onClose();
      
      toast({
        title: "Contato excluído",
        description: "O contato foi removido da prospecção"
      });
    }
  };

  const toggleProduto = (produtoId: string) => {
    setProdutosSelecionados(prev => 
      prev.includes(produtoId) 
        ? prev.filter(id => id !== produtoId)
        : [...prev, produtoId]
    );
  };

  const isNewContact = !contato;

  const handleCreateContact = () => {
    if (!novoContato.nome.trim() || !novoContato.telefone.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive"
      });
      return;
    }
    
    onCreateContact?.(novoContato);
    setNovoContato({ nome: '', telefone: '', email: '' });
    onClose();
    
    toast({
      title: "Contato criado",
      description: "O contato foi adicionado com sucesso!"
    });
  };

  if (!contato && !isNewContact) return null;

  const sidebarItems = [
    { id: 'dados-pessoais', label: 'Dados Pessoais', icon: User },
    { id: 'status', label: 'Status', icon: Settings },
    { id: 'responsavel', label: 'Responsável', icon: UserCheck },
    { id: 'anotacoes', label: 'Anotações', icon: MessageSquare },
    { id: 'produtos', label: 'Produtos', icon: Package },
    { id: 'temperatura', label: 'Temperatura', icon: Thermometer },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'log-auditoria', label: 'Log de Auditoria', icon: FileText }
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Função para formatar telefone para WhatsApp
  const formatPhoneForWhatsApp = (telefone: string): string => {
    // Remove todos os caracteres não numéricos
    let phone = telefone.replace(/\D/g, '');
    
    // Adiciona 55 se não começar com 55
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }
    
    // Se tem 13 caracteres, remove o 9 que é o 5º dígito (índice 4)
    if (phone.length === 13) {
      phone = phone.slice(0, 4) + phone.slice(5);
    }
    
    return phone;
  };

  const handleChamarWhatsApp = () => {
    if (!contato?.telefone) return;
    const formattedPhone = formatPhoneForWhatsApp(contato.telefone);
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {isNewContact ? 'Novo Contato' : `Detalhes do Contato - ${contato?.nome || 'Sem nome'}`}
            </DialogTitle>
            
            {/* Botões de ação no header */}
            {!isNewContact && contato && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChamarWhatsApp}
                  disabled={!contato.telefone}
                  className="gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chamar no WhatsApp
                </Button>
                <Button
                  size="sm"
                  onClick={() => setContatoRealizadoOpen(true)}
                  disabled={!prospeccaoId}
                  className="gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  Contato Realizado
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r bg-muted/30 flex-shrink-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                <nav className="space-y-1">
                  {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                          activeTab === item.id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </ScrollArea>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
              {activeTab === 'dados-pessoais' && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {isNewContact ? 'Criar Novo Contato' : 'Informações Básicas'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Nome
                        </label>
                         <Input 
                           value={isNewContact ? novoContato.nome : (contato?.nome || '')} 
                           onChange={(e) => isNewContact && setNovoContato(prev => ({ ...prev, nome: e.target.value }))}
                           readOnly={!isNewContact}
                         />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Telefone
                        </label>
                         <Input 
                           value={isNewContact ? novoContato.telefone : (contato?.telefone || '')} 
                           onChange={(e) => isNewContact && setNovoContato(prev => ({ ...prev, telefone: e.target.value }))}
                           readOnly={!isNewContact}
                         />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          E-mail
                        </label>
                         <Input 
                           value={isNewContact ? novoContato.email : (contato?.email || 'Não informado')} 
                           onChange={(e) => isNewContact && setNovoContato(prev => ({ ...prev, email: e.target.value }))}
                           readOnly={!isNewContact}
                         />
                      </div>
                      {!isNewContact && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Segmentação
                          </label>
                           <Input 
                             value={contato?.observacoes || 'Não definida'} 
                             readOnly 
                           />
                        </div>
                      )}
                    </div>
                    
                    {isNewContact && (
                      <div className="flex justify-end gap-3 mt-6">
                        <Button variant="outline" onClick={onClose}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateContact}>
                          Criar Contato
                        </Button>
                      </div>
                    )}
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Históricos
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Produtos Adquiridos</h4>
                        <p className="text-sm text-muted-foreground">Nenhum produto adquirido ainda</p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h4 className="font-medium text-sm mb-2">Prospecções Anteriores</h4>
                        <p className="text-sm text-muted-foreground">Primeira participação em prospecção</p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h4 className="font-medium text-sm mb-2">Histórico de Leads</h4>
                        <p className="text-sm text-muted-foreground">
                          {contato?.created_at ? 
                            `Lead criado em ${new Date(contato.created_at).toLocaleDateString()}` : 
                            'Data de criação não disponível'
                          }
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'status' && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Alterar Status</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Status Atual (Coluna Kanban)</label>
                        <Badge variant="outline" className="mb-4">
                          {(() => {
                            if (!contato) return 'N/A';
                            const kanbanColumn = statusKanbanMap[contato.status];
                            const columnNames = {
                              'novo': 'Novo',
                              'enviados': 'Enviados', 
                              'recebidos': 'Recebidos',
                              'respondidos': 'Respondidos',
                              'agendados': 'Agendados',
                              'confirmados': 'Confirmados',
                              'cancelados': 'Cancelados'
                            };
                            return columnNames[kanbanColumn as keyof typeof columnNames] || contato.status;
                          })()}
                        </Badge>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Novo Status</label>
                        <Select onValueChange={(value) => handleStatusChange(value as Contato['status'])}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o novo status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 text-destructive">Zona de Perigo</h3>
                    <Button 
                      variant="destructive" 
                      onClick={handleExcluirContato}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir Contato da Prospecção
                    </Button>
                  </Card>
                </div>
              )}

              {/* Dialog Contato Realizado */}
              {contato && prospeccaoId && (
                <ContatoRealizadoDialog
                  isOpen={contatoRealizadoOpen}
                  onClose={() => setContatoRealizadoOpen(false)}
                  contatoId={contato.id}
                  prospeccaoId={prospeccaoId}
                  onSuccess={() => {
                    // Recarregar anotações após registro
                    const reloadAnotacoes = async () => {
                      const { data: eventos } = await supabase
                        .from('eventos_prospeccao')
                        .select('*')
                        .eq('contato_id', contato.id)
                        .eq('prospeccao_id', prospeccaoId)
                        .eq('tipo_evento', 'Anotação')
                        .order('created_at', { ascending: false });

                      if (eventos) {
                        const anotacoesFormatadas = await Promise.all(eventos.map(async (evento) => {
                          let usuarioNome = 'Usuário';
                          let usuarioCargo = '';
                          
                          if (evento.observacoes && evento.observacoes !== 'Adicionado via API') {
                            const { data: perfil } = await supabase
                              .from('profiles')
                              .select('nome_completo, tipo_acesso')
                              .eq('id', evento.observacoes)
                              .maybeSingle();
                            
                            if (perfil) {
                              usuarioNome = perfil.nome_completo || 'Usuário';
                              usuarioCargo = perfil.tipo_acesso || '';
                            }
                          }
                          
                          return {
                            id: evento.id,
                            texto: evento.descricao || '',
                            usuarioNome,
                            usuarioCargo,
                            timestamp: evento.created_at || new Date().toISOString()
                          };
                        }));
                        setAnotacoes(anotacoesFormatadas);
                      }
                    };
                    reloadAnotacoes();
                  }}
                />
              )}

              {activeTab === 'responsavel' && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Atribuir Responsável</h3>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Atribua este contato a um membro da equipe para acompanhamento.
                      </p>
                      <div className="space-y-4">
                        {/* Responsável atual */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">Responsável Atual</label>
                          {responsavelAtualId ? (() => {
                            // Buscar profile por id
                            const responsavelProfile = usuariosDisponiveis.find(u => u.id === responsavelAtualId);
                            
                            return (
                              <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>
                                    {getInitials(responsavelProfile?.nome || responsavelAtualId)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-sm">
                                    {responsavelProfile?.nome || responsavelAtualId}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {responsavelProfile?.tipoAcesso || 'Não informado'}
                                  </p>
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="p-3 border rounded-md bg-muted/30">
                              <p className="text-sm text-muted-foreground">Não informado</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Seletor de novo responsável */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            {responsavelAtualId ? 'Alterar Responsável' : 'Selecionar Responsável'}
                          </label>
                          <Select 
                            value={responsavelSelecionado} 
                            onValueChange={handleAtribuirResponsavel}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o usuário" />
                            </SelectTrigger>
                            <SelectContent>
                              {usuariosDisponiveis.map((usuario) => (
                                <SelectItem key={usuario.id} value={usuario.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-xs">
                                        {getInitials(usuario.nome)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium text-sm">{usuario.nome}</p>
                                      {usuario.email && (
                                        <p className="text-xs text-muted-foreground">{usuario.email}</p>
                                      )}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'anotacoes' && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Nova Anotação</h3>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Digite sua anotação aqui (máximo 1000 caracteres)..."
                        value={novaAnotacao}
                        onChange={(e) => setNovaAnotacao(e.target.value)}
                        maxLength={1000}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {novaAnotacao.length}/1000 caracteres
                        </span>
                        <Button onClick={handleAdicionarAnotacao} disabled={!novaAnotacao.trim()}>
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar Anotação
                        </Button>
                      </div>
                    </div>
                  </Card>

                   <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Anotações Existentes</h3>
                    <ScrollArea className="h-64">
                      <div className="space-y-4">
                        {anotacoes.length > 0 ? (
                          anotacoes.map((anotacao) => (
                            <div key={anotacao.id} className="border-l-4 border-primary pl-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="font-medium text-sm">{anotacao.usuarioNome}</span>
                                  {anotacao.usuarioCargo && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({anotacao.usuarioCargo})
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(anotacao.timestamp).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <p className="text-sm">{anotacao.texto}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Nenhuma anotação registrada ainda
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              )}

              {activeTab === 'produtos' && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Produtos de Interesse</h3>
                  
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Selecione os produtos que podem interessar ao cliente:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {produtosDisponiveis.map((produto) => (
                        <div
                          key={produto.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            produtosSelecionados.includes(produto.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => toggleProduto(produto.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{produto.nome}</h4>
                              <p className="text-sm text-muted-foreground">{produto.categoria}</p>
                              {produto.preco && (
                                <p className="text-sm font-medium text-green-600">
                                  R$ {produto.preco.toFixed(2)}
                                </p>
                              )}
                            </div>
                            {produtosSelecionados.includes(produto.id) && (
                              <Badge variant="default">Selecionado</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {produtosSelecionados.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          {produtosSelecionados.length} produto(s) selecionado(s)
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {activeTab === 'temperatura' && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Temperatura do Lead</h3>
                  
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Defina o nível de interesse do contato:
                    </p>
                    
                    <div className="space-y-3">
                      {temperaturas.map((temp) => (
                        <button
                          key={temp.id}
                          onClick={() => setTemperaturaAtual(temp.id)}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            temperaturaAtual === temp.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: temp.cor }}
                            />
                            <span className="font-medium">{temp.nome}</span>
                            {temperaturaAtual === temp.id && (
                              <Badge variant="default">Selecionado</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    {!temperaturaAtual && (
                      <p className="text-sm text-muted-foreground mt-4">
                        Nenhuma temperatura selecionada. O card ficará na cor padrão.
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {activeTab === 'whatsapp' && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">WhatsApp</h3>
                  
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="font-medium mb-2">WhatsApp Web não configurado</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Para conversar via WhatsApp, você precisa vincular o WhatsApp Web nas configurações.
                    </p>
                    <div className="space-y-2 text-sm text-left bg-muted p-3 rounded-lg">
                      <p><strong>Cliente:</strong> {contato.nome}</p>
                      <p><strong>Telefone:</strong> {contato.telefone}</p>
                    </div>
                    <Button variant="outline" className="mt-4">
                      <Settings className="w-4 h-4 mr-2" />
                      Ir para Configurações
                    </Button>
                  </div>
                </Card>
              )}

              {activeTab === 'log-auditoria' && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Log de Auditoria</h3>
                  
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      {logEntries.map((entry) => (
                        <div key={entry.id} className="flex gap-3 p-3 border rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-sm">{entry.acao}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{entry.usuario}</p>
                            {entry.detalhes && (
                              <p className="text-sm mt-1">{entry.detalhes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}