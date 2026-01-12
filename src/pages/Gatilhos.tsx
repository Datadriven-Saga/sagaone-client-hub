import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Zap, Play, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { validateWebhookUrl } from "@/lib/security";

interface Gatilho {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  webhook_url: string;
  ativo: boolean;
}

const Gatilhos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  
  const tiposGatilho = [
    { 
      value: "novo_contato_prospeccao", 
      label: "Novo Contato Adicionado na Prospecção",
      modulo: "Prospecção"
    },
    { 
      value: "alteracao_status_contato", 
      label: "Alteração de Status do Contato na Prospecção",
      modulo: "Prospecção"
    },
    { 
      value: "adicao_anotacao_prospeccao", 
      label: "Adição de Anotação na Prospeção",
      modulo: "Prospecção"
    },
    { 
      value: "novo_template_whatsapp", 
      label: "Novo Template WhatsApp Criado",
      modulo: "Templates"
    },
    { 
      value: "novo_evento_criado", 
      label: "Novo Evento Criado/Alterado na Prospecção",
      modulo: "Prospecção"
    },
    { 
      value: "atualiza_status_meta", 
      label: "Atualiza Status Meta",
      modulo: "Templates"
    }
  ];

  const [gatilhos, setGatilhos] = useState<Gatilho[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    tipo: "",
    webhook_url: "",
    ativo: true
  });

  // Carregar gatilhos do banco
  const carregarGatilhos = async () => {
    if (!user || !activeCompany) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('gatilhos')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const gatilhosFormatados = (data || []).map(g => ({
        id: g.id,
        nome: g.nome,
        descricao: g.descricao || '',
        tipo: (g.acoes as any)?.tipo_evento || '',
        webhook_url: (g.acoes as any)?.webhook_url || '',
        ativo: g.status === 'Ativo'
      }));
      
      setGatilhos(gatilhosFormatados);
    } catch (error) {
      console.error('Erro ao carregar gatilhos:', error);
      toast({
        title: "Erro ao carregar gatilhos",
        description: "Não foi possível carregar os gatilhos do banco de dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      tipo: "",
      webhook_url: "",
      ativo: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (gatilho: Gatilho) => {
    setFormData({
      nome: gatilho.nome,
      descricao: gatilho.descricao,
      tipo: gatilho.tipo,
      webhook_url: gatilho.webhook_url,
      ativo: gatilho.ativo
    });
    setEditingId(gatilho.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação com mensagens de erro específicas
    if (!formData.nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, preencha o nome do gatilho.",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.tipo) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, selecione o tipo de gatilho.",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.webhook_url.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, preencha a URL do webhook.",
        variant: "destructive"
      });
      return;
    }
    
    if (!user || !activeCompany) return;
    
    try {
      setLoading(true);

      const gatilhoData = {
        nome: formData.nome,
        descricao: formData.descricao,
        tipo: "Evento" as "Temporal" | "Evento" | "Condicional",
        status: (formData.ativo ? 'Ativo' : 'Inativo') as "Ativo" | "Inativo" | "Pausado",
        acoes: {
          webhook_url: formData.webhook_url,
          tipo_evento: formData.tipo
        } as any,
        empresa_id: activeCompany.id,
        criado_por: user.id
      };

      if (editingId) {
        // Atualizar gatilho existente
        const { error } = await supabase
          .from('gatilhos')
          .update(gatilhoData)
          .eq('id', editingId);
        
        if (error) throw error;
        
        toast({
          title: "Gatilho atualizado",
          description: "O gatilho foi atualizado com sucesso"
        });
      } else {
        // Criar novo gatilho
        const { error } = await supabase
          .from('gatilhos')
          .insert(gatilhoData);
        
        if (error) throw error;
        
        toast({
          title: "Gatilho criado",
          description: "O gatilho foi criado com sucesso"
        });
      }
      
      // Recarregar lista
      await carregarGatilhos();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar gatilho:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o gatilho",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('gatilhos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Gatilho excluído",
        description: "O gatilho foi excluído com sucesso"
      });
      
      // Recarregar lista
      await carregarGatilhos();
    } catch (error) {
      console.error('Erro ao excluir gatilho:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o gatilho",
        variant: "destructive"
      });
    }
  };

  const handleTest = async (gatilho: Gatilho) => {
    try {
      setLoading(true);
      
      // Dados de teste baseados no tipo de gatilho
      let dadosTeste;
      
      switch (gatilho.tipo) {
        case 'novo_contato_prospeccao':
          dadosTeste = {
            nome: "João Silva (TESTE)",
            telefone: "(11) 99999-9999",
            email: "joao.teste@email.com",
            id: "test-contact-id",
            status: "Novo",
            prospeccao_id: "test-prospeccao-id"
          };
          break;
        case 'alteracao_status_contato':
          dadosTeste = {
            nome: "Maria Santos (TESTE)",
            telefone: "(11) 88888-8888",
            id: "test-contact-id",
            status_anterior: "Novo",
            status_novo: "Qualificado"
          };
          break;
        case 'adicao_anotacao_prospeccao':
          dadosTeste = {
            contato_nome: "Pedro Costa (TESTE)",
            anotacao: "Esta é uma anotação de teste do sistema",
            usuario_nome: "Sistema de Teste",
            data: new Date().toISOString()
          };
          break;
        case 'novo_template_whatsapp':
          dadosTeste = {
            template_nome: "Template de Teste",
            template_id: "test-template-id",
            categoria: "Marketing",
            formato: "Texto",
            status: "Pendente",
            empresa_id: "test-empresa-id",
            data: new Date().toISOString()
          };
          break;
        case 'novo_evento_criado':
          dadosTeste = {
            evento_id: "test-evento-id",
            titulo: "Evento de Teste",
            descricao: "Descrição do evento de teste",
            tipo_evento: "Grande Evento",
            data_inicio: new Date().toISOString().split('T')[0],
            data_fim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            canal: "Whatsapp",
            acao: "criado",
            empresa_id: "test-empresa-id",
            data: new Date().toISOString()
          };
          break;
        case 'atualiza_status_meta':
          dadosTeste = {
            pri_dealer_id: "test-dealer-id",
            data: new Date().toISOString()
          };
          break;
        default:
          dadosTeste = {
            teste: true,
            timestamp: new Date().toISOString(),
            gatilho_id: gatilho.id
          };
      }

      console.log('Testando gatilho:', gatilho.nome, 'com dados:', dadosTeste);

      // Criar o body baseado na descrição do gatilho
      let bodyEnvio;
      if (gatilho.tipo === 'novo_contato_prospeccao') {
        bodyEnvio = {
          nome: "Fabricio (TESTE)",
          telefone: "6292390133",
          email: "moreira.it@email.com",
          id: "test-contact-id",
          status: "Novo",
          prospeccao_id: "test-prospeccao-id"
        };
      } else {
        bodyEnvio = dadosTeste;
      }

      // Validar URL antes de fazer requisição (prevenir SSRF)
      const urlValidation = validateWebhookUrl(gatilho.webhook_url);
      if (!urlValidation.valid) {
        toast({
          title: "URL inválida",
          description: urlValidation.error,
          variant: "destructive"
        });
        return;
      }

      // Enviar requisição diretamente para o webhook configurado
      const response = await fetch(gatilho.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyEnvio)
      });

      if (response.ok) {
        toast({
          title: "Teste realizado com sucesso!",
          description: `Webhook "${gatilho.nome}" foi chamado e respondeu com status ${response.status}`,
        });
      } else {
        toast({
          title: "Teste falhou",
          description: `O webhook respondeu com status ${response.status}. Verifique a configuração.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao testar gatilho:', error);
      toast({
        title: "Erro no teste",
        description: "Não foi possível conectar com o webhook. Verifique a URL e conexão.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar gatilhos ao montar o componente
  useEffect(() => {
    if (user && activeCompany) {
      carregarGatilhos();
    }
  }, [user, activeCompany]);

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gatilhos</h1>
              <p className="text-sm text-muted-foreground">
                Configure gatilhos automáticos para ações da prospecção
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Gatilho
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Editar Gatilho" : "Novo Gatilho"}</CardTitle>
              <CardDescription>
                Configure um gatilho para disparar webhooks automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome do Gatilho</Label>
                    <Input
                      id="nome"
                      placeholder="Ex: Novo contato adicionado"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="tipo">Tipo de Gatilho</Label>
                    <Select 
                      value={formData.tipo} 
                      onValueChange={(value) => setFormData({...formData, tipo: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de gatilho" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposGatilho.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="webhook_url">URL do Webhook</Label>
                    <Input
                      id="webhook_url"
                      type="url"
                      placeholder="https://seu-webhook.com/endpoint"
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    placeholder="Descreva quando este gatilho deve ser disparado..."
                    rows={3}
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                  />
                  <Label htmlFor="ativo">Gatilho ativo</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="cursor-pointer">
                    {loading ? "Salvando..." : editingId ? "Atualizar" : "Criar"} Gatilho
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {gatilhos.map((gatilho) => (
            <Card key={gatilho.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-6 w-6 text-primary" />
                    <div className="space-y-2">
                      <h3 className="font-semibold">{gatilho.nome}</h3>
                      <p className="text-sm text-muted-foreground">{gatilho.descricao}</p>
                      <div className="flex flex-col gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Tipo: {tiposGatilho.find(t => t.value === gatilho.tipo)?.label || gatilho.tipo}
                        </span>
                        <span className="text-muted-foreground">Webhook: {gatilho.webhook_url}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={gatilho.ativo 
                        ? "bg-green-500 hover:bg-green-600 text-white" 
                        : "bg-red-500 hover:bg-red-600 text-white"
                      }
                    >
                      {gatilho.ativo ? "Ativo" : "Desativado"}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleTest(gatilho)}
                      disabled={loading}
                      title="Testar webhook"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(gatilho)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(gatilho.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {gatilhos.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum gatilho configurado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro gatilho para automatizar ações da prospecção
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Gatilho
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default Gatilhos;