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
import { ScrollIndicator } from '@/components/ui/scroll-indicator';
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
  PhoneCall,
  Lock,
  AlertTriangle,
  Copy,
  Ban,
  Image
} from 'lucide-react';
import { ConviteTab } from './ConviteTab';
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
  requireProdutoVendido?: boolean;
  onConfirmVenda?: (contatoId: string, produtoVendidoId: string, departamentoId?: string, responsavelId?: string) => void;
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
  onCreateContact,
  requireProdutoVendido = false,
  onConfirmVenda
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
  const [produtoVendidoId, setProdutoVendidoId] = useState<string>('');
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<Array<{ id: string; nome: string; email: string; tipoAcesso: string | null }>>([]);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<string>('');
  const [responsavelAtualId, setResponsavelAtualId] = useState<string | null>(null);
  const [departamentosDisponiveis, setDepartamentosDisponiveis] = useState<Array<{ id: string; nome: string }>>([]);
  const [departamentoSelecionado, setDepartamentoSelecionado] = useState<string>('');
  const [vendaExistente, setVendaExistente] = useState<boolean>(false);

  const [temperaturas, setTemperaturas] = useState<TemperaturaOption[]>([]);
  const [motivoInsucesso, setMotivoInsucesso] = useState<{ descricao: string; justificativa: string } | null>(null);

  // Status de conclusão do lead
  const statusConclusao = ['Venda', 'Descartado', 'Opt Out'];
  
  // Verificar se o lead está bloqueado (concluído há mais de 24h)
  const isLeadBloqueado = (() => {
    if (!contato) return false;
    
    // Verificar se está em status de conclusão
    if (!statusConclusao.includes(contato.status)) return false;
    
    // Verificar se passou 24h desde o updated_at
    const updatedAt = new Date(contato.updated_at);
    const agora = new Date();
    const diffHoras = (agora.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
    
    return diffHoras > 24;
  })();

  // Mostrar card de confirmar venda quando: obrigatório OU (status Venda sem venda registrada)
  const mostrarConfirmarVenda = requireProdutoVendido || (contato?.status === 'Venda' && !vendaExistente && !isLeadBloqueado);

  // Abrir na aba produtos se requireProdutoVendido ou se precisa registrar venda
  // Abrir na aba convite se status for Confirmado
  useEffect(() => {
    if (isOpen && (requireProdutoVendido || (contato?.status === 'Venda' && !vendaExistente))) {
      setActiveTab('produtos');
    } else if (isOpen && contato?.status === 'Confirmado') {
      setActiveTab('convite');
    } else if (isOpen) {
      setActiveTab('dados-pessoais');
    }
  }, [isOpen, requireProdutoVendido, contato?.status, vendaExistente]);

  // Verificar se existe venda para este contato e pré-popular campos
  useEffect(() => {
    const verificarVenda = async () => {
      if (isOpen && contato?.id) {
        const { data, error } = await supabase
          .from('vendas_prospeccao')
          .select('id, departamento_id, produto_id, responsavel_id')
          .eq('contato_id', contato.id)
          .maybeSingle();
        
        if (data && !error) {
          setVendaExistente(true);
          // Pré-popular campos da venda existente
          if (data.departamento_id) {
            setDepartamentoSelecionado(data.departamento_id);
          }
          if (data.produto_id) {
            setProdutoVendidoId(data.produto_id);
          }
        } else {
          setVendaExistente(false);
          // Resetar campos apenas se não há venda
          if (!requireProdutoVendido) {
            setDepartamentoSelecionado('');
            setProdutoVendidoId('');
          }
        }
      } else {
        setVendaExistente(false);
      }
    };
    verificarVenda();
  }, [isOpen, contato?.id, requireProdutoVendido]);

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

          // Buscar departamentos da empresa
          const { data: departamentos, error: departamentosError } = await supabase
            .from('departamentos')
            .select('id, nome')
            .eq('ativo', true)
            .order('nome');

          if (!departamentosError && departamentos) {
            setDepartamentosDisponiveis(departamentos.map(d => ({
              id: d.id,
              nome: d.nome
            })));
          }

          // Buscar produtos disponíveis da empresa
          const { data: produtos, error: produtosError } = await supabase
            .from('produtos')
            .select('id, nome, preco, categoria')
            .eq('ativo', true)
            .order('nome');

          if (!produtosError && produtos) {
            setProdutosDisponiveis(produtos.map(p => ({
              id: p.id,
              nome: p.nome,
              preco: p.preco || undefined,
              categoria: p.categoria || undefined
            })));
          }

          // Buscar temperaturas configuradas da empresa
          const { data: temperaturasData, error: temperaturasError } = await supabase
            .from('temperaturas_lead')
            .select('id, nome, cor')
            .eq('ativo', true)
            .order('ordem');

          if (!temperaturasError && temperaturasData) {
            setTemperaturas(temperaturasData.map(t => ({
              id: t.id,
              nome: t.nome,
              cor: t.cor
            })));
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

            // Buscar motivo de insucesso se o lead foi descartado
            if (contato.status === 'Descartado') {
              const { data: logDescarte } = await supabase
                .from('logs_movimentacao_contatos')
                .select('observacoes')
                .eq('contato_id', contato.id)
                .eq('status_novo', 'descartados')
                .order('data_movimentacao', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (logDescarte?.observacoes) {
                // O formato salvo é: "Motivo: X | Justificativa: Y"
                const observacoes = logDescarte.observacoes;
                const motivoMatch = observacoes.match(/Motivo: ([^|]+)/);
                const justificativaMatch = observacoes.match(/Justificativa: (.+)$/);
                
                setMotivoInsucesso({
                  descricao: motivoMatch ? motivoMatch[1].trim() : 'Não informado',
                  justificativa: justificativaMatch ? justificativaMatch[1].trim() : 'Não informada'
                });
              } else {
                setMotivoInsucesso(null);
              }
            } else {
              setMotivoInsucesso(null);
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

  // Opções de status sincronizadas com as colunas do Kanban
  const statusOptions: Array<{ value: Contato['status']; label: string }> = [
    { value: 'Novo', label: 'Novos' },
    { value: 'Atribuído', label: 'Atribuídos' },
    { value: 'Em Espera', label: 'Em Espera' },
    { value: 'Convidado', label: 'Convidados' },
    { value: 'Confirmado', label: 'Confirmados' },
    { value: 'Check-in', label: 'Check-ins' },
    { value: 'Venda', label: 'Vendas' },
    { value: 'Descartado', label: 'Descartados' },
    { value: 'Opt Out', label: 'Opt Out' }
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

    // Se tentar mudar para Venda, exigir produto vendido
    if (novoStatus === 'Venda') {
      if (!produtoVendidoId) {
        setActiveTab('produtos');
        toast({
          title: "Produto Vendido Obrigatório",
          description: "Para registrar como Venda, selecione o produto vendido na aba Produtos.",
          variant: "destructive"
        });
        return;
      }
    }

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
    { id: 'convite', label: 'Convite', icon: Image }
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
    
    // Se tem 10 ou 11 caracteres, adiciona 55
    // Se tem 12 ou 13 caracteres, assume que já tem o 55
    if (phone.length === 10 || phone.length === 11) {
      phone = '55' + phone;
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
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-4 pr-12 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {isNewContact ? 'Novo Contato' : (contato?.nome || 'Sem nome')}
              </DialogTitle>
              {!isNewContact && contato && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">#{contato.id.substring(0, 8).toUpperCase()}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => {
                      navigator.clipboard.writeText(contato.id.substring(0, 8).toUpperCase());
                      toast({
                        title: "ID copiado",
                        description: "O ID do lead foi copiado para a área de transferência"
                      });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Botões de ação no header */}
            {!isNewContact && contato && (
              <div className="flex items-center gap-2 flex-shrink-0">
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
                  disabled={!prospeccaoId || isLeadBloqueado}
                  className="gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  Contato Realizado
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar - fixed height, scrollable */}
          <div className="w-56 border-r bg-muted/30 flex-shrink-0 h-full overflow-y-auto">
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
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content - scrollable independently */}
          <div className="flex-1 h-full overflow-y-auto">
            <div className="p-4">
              {/* Aviso de lead bloqueado */}
              {isLeadBloqueado && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Lead Bloqueado para Edição</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Este lead foi concluído há mais de 24 horas e não pode mais ser editado. 
                      Status final: <strong>{contato?.status}</strong>
                    </p>
                  </div>
                </div>
              )}
              
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
                        <Select 
                          onValueChange={(value) => handleStatusChange(value as Contato['status'])}
                          disabled={isLeadBloqueado}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o novo status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>

                  {/* Seção de Motivo de Insucesso - exibida apenas para leads descartados */}
                  {contato?.status === 'Descartado' && (
                    <Card className="p-6 border-destructive/50 bg-destructive/5">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
                        <Ban className="w-5 h-5" />
                        Motivo do Descarte
                      </h3>
                      {motivoInsucesso ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium mb-1 block text-muted-foreground">Motivo de Insucesso</label>
                            <p className="text-sm font-medium">{motivoInsucesso.descricao}</p>
                          </div>
                          <Separator />
                          <div>
                            <label className="text-sm font-medium mb-1 block text-muted-foreground">Justificativa</label>
                            <p className="text-sm">{motivoInsucesso.justificativa}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Informações de descarte não encontradas
                        </p>
                      )}
                    </Card>
                  )}
                </div>
              )}

              {/* Dialog Contato Realizado */}
              {contato && prospeccaoId && (
                <ContatoRealizadoDialog
                  isOpen={contatoRealizadoOpen}
                  onClose={() => setContatoRealizadoOpen(false)}
                  contatoId={contato.id}
                  prospeccaoId={prospeccaoId}
                  onSuccess={(novoStatus) => {
                    // Atualizar status no Kanban
                    if (onStatusChange && novoStatus) {
                      onStatusChange(contato.id, novoStatus as Contato['status']);
                    }
                    
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
                            disabled={isLeadBloqueado}
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

                        {/* Departamento */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">Departamento</label>
                          {departamentosDisponiveis.length > 0 ? (
                            <Select 
                              value={departamentoSelecionado} 
                              onValueChange={setDepartamentoSelecionado}
                              disabled={isLeadBloqueado}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione o departamento" />
                              </SelectTrigger>
                              <SelectContent>
                                {departamentosDisponiveis.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-3 border rounded-md bg-amber-50 border-amber-200">
                              <p className="text-sm text-amber-700">
                                Nenhum departamento cadastrado. Solicite ao administrador a criação de departamentos em Administração &gt; Empresas &gt; Configurações.
                              </p>
                            </div>
                          )}
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
                        placeholder={isLeadBloqueado ? "Lead bloqueado - não é possível adicionar anotações" : "Digite sua anotação aqui (máximo 1000 caracteres)..."}
                        value={novaAnotacao}
                        onChange={(e) => setNovaAnotacao(e.target.value)}
                        maxLength={1000}
                        disabled={isLeadBloqueado}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {novaAnotacao.length}/1000 caracteres
                        </span>
                        <Button onClick={handleAdicionarAnotacao} disabled={!novaAnotacao.trim() || isLeadBloqueado}>
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
                <div className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Produtos de Interesse</h3>
                    
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Selecione os produtos que podem interessar ao cliente:
                      </p>
                      
                      {produtosDisponiveis.length > 0 ? (
                        <>
                          <Select
                            value={produtosSelecionados.length > 0 ? produtosSelecionados[produtosSelecionados.length - 1] : ''}
                            onValueChange={(value) => {
                              if (!produtosSelecionados.includes(value)) {
                                setProdutosSelecionados(prev => [...prev, value]);
                              }
                            }}
                            disabled={isLeadBloqueado}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {produtosDisponiveis
                                .filter(p => !produtosSelecionados.includes(p.id))
                                .map((produto) => (
                                  <SelectItem key={produto.id} value={produto.id}>
                                    <div className="flex items-center gap-2">
                                      <span>{produto.nome}</span>
                                      {produto.categoria && (
                                        <span className="text-xs text-muted-foreground">({produto.categoria})</span>
                                      )}
                                      {produto.preco && (
                                        <span className="text-xs text-green-600 font-medium">
                                          R$ {produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          {produtosSelecionados.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Produtos selecionados:</p>
                              <div className="flex flex-wrap gap-2">
                                {produtosSelecionados.map((produtoId) => {
                                  const produto = produtosDisponiveis.find(p => p.id === produtoId);
                                  return produto ? (
                                    <Badge
                                      key={produtoId}
                                      variant="secondary"
                                      className="flex items-center gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                      onClick={() => setProdutosSelecionados(prev => prev.filter(id => id !== produtoId))}
                                    >
                                      {produto.nome}
                                      <span className="ml-1">×</span>
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum produto cadastrado. Cadastre produtos em Configurações.
                        </p>
                      )}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Produto Vendido</h3>
                    
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Registre o produto que foi efetivamente vendido ao cliente (pode ser diferente do interesse inicial):
                      </p>
                      
                      {produtosDisponiveis.length > 0 ? (
                        <>
                          <Select
                            value={produtoVendidoId}
                            onValueChange={(value) => setProdutoVendidoId(value === '__clear__' ? '' : value)}
                            disabled={isLeadBloqueado}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o produto vendido" />
                            </SelectTrigger>
                            <SelectContent>
                              {produtoVendidoId && (
                                <SelectItem value="__clear__" className="text-muted-foreground">
                                  Limpar seleção
                                </SelectItem>
                              )}
                              {produtosDisponiveis.map((produto) => (
                                <SelectItem key={produto.id} value={produto.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{produto.nome}</span>
                                    {produto.categoria && (
                                      <span className="text-xs text-muted-foreground">({produto.categoria})</span>
                                    )}
                                    {produto.preco && (
                                      <span className="text-xs text-green-600 font-medium">
                                        R$ {produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {produtoVendidoId && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-sm font-medium text-green-800">
                                Produto vendido: {produtosDisponiveis.find(p => p.id === produtoVendidoId)?.nome}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum produto cadastrado. Cadastre produtos em Configurações.
                        </p>
                      )}
                    </div>
                  </Card>

                  {/* Botão de confirmar venda quando obrigatório ou status Venda sem registro */}
                  {mostrarConfirmarVenda && (
                    <Card className="p-6 border-primary">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <Package className="w-5 h-5" />
                          <h3 className="text-lg font-semibold">Confirmar Venda</h3>
                        </div>
                        
                        {/* Lista de campos obrigatórios com status */}
                        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium">Campos obrigatórios:</p>
                          <div className="space-y-1">
                            <div className={`flex items-center gap-2 text-sm ${responsavelAtualId ? 'text-green-600' : 'text-destructive'}`}>
                              {responsavelAtualId ? '✓' : '✗'} Responsável atribuído
                            </div>
                            <div className={`flex items-center gap-2 text-sm ${departamentoSelecionado ? 'text-green-600' : 'text-destructive'}`}>
                              {departamentoSelecionado ? '✓' : '✗'} Departamento selecionado
                            </div>
                            <div className={`flex items-center gap-2 text-sm ${produtoVendidoId ? 'text-green-600' : 'text-destructive'}`}>
                              {produtoVendidoId ? '✓' : '✗'} Produto vendido selecionado
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => {
                            const camposFaltando: string[] = [];
                            if (!responsavelAtualId) camposFaltando.push('Responsável');
                            if (!departamentoSelecionado) camposFaltando.push('Departamento');
                            if (!produtoVendidoId) camposFaltando.push('Produto Vendido');
                            
                            if (camposFaltando.length > 0) {
                              toast({
                                title: "Campos obrigatórios",
                                description: `Preencha os seguintes campos: ${camposFaltando.join(', ')}`,
                                variant: "destructive"
                              });
                              return;
                            }
                            if (contato && onConfirmVenda && responsavelAtualId) {
                              onConfirmVenda(contato.id, produtoVendidoId, departamentoSelecionado, responsavelAtualId);
                            }
                          }}
                          disabled={!produtoVendidoId || !responsavelAtualId || !departamentoSelecionado}
                          className="w-full"
                        >
                          Confirmar Venda
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
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
                          onClick={() => !isLeadBloqueado && setTemperaturaAtual(temp.id)}
                          disabled={isLeadBloqueado}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            temperaturaAtual === temp.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          } ${isLeadBloqueado ? 'opacity-50 cursor-not-allowed' : ''}`}
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

              {activeTab === 'convite' && contato && (
                <ConviteTab 
                  contato={contato}
                  prospeccaoId={prospeccaoId || ''}
                  onStatusChange={onStatusChange}
                />
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
                      <p><strong>Cliente:</strong> {contato?.nome || 'Sem nome'}</p>
                      <p><strong>Telefone:</strong> {contato?.telefone || '-'}</p>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}