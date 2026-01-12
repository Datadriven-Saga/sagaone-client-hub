import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Zap, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateWebhookUrl } from "@/lib/security";

interface Followup {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  webhook_url: string;
  ativo: boolean;
}

interface AgenteFollowupsProps {
  agenteId: string;
}

export function AgenteFollowups({ agenteId }: AgenteFollowupsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [followups, setFollowups] = useState<Followup[]>([]);
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

  // Tipos de gatilho (mesmos do módulo original)
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
    }
  ];

  const carregarFollowups = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('agente_followups')
        .select('*')
        .eq('agente_id', agenteId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const followupsFormatados = (data || []).map(f => ({
        id: f.id,
        nome: f.nome,
        descricao: f.descricao || '',
        tipo: (f.acoes as any)?.tipo_evento || f.tipo || '',
        webhook_url: (f.acoes as any)?.webhook_url || f.webhook_url || '',
        ativo: f.ativo
      }));
      
      setFollowups(followupsFormatados);
    } catch (error) {
      console.error('Erro ao carregar follow-ups:', error);
      toast({
        title: "Erro ao carregar follow-ups",
        description: "Não foi possível carregar os follow-ups do agente",
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

  const handleEdit = (followup: Followup) => {
    setFormData({
      nome: followup.nome,
      descricao: followup.descricao,
      tipo: followup.tipo,
      webhook_url: followup.webhook_url,
      ativo: followup.ativo
    });
    setEditingId(followup.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.tipo || !formData.webhook_url) return;
    
    try {
      setLoading(true);

      const followupData = {
        agente_id: agenteId,
        nome: formData.nome,
        descricao: formData.descricao,
        tipo: formData.tipo,
        webhook_url: formData.webhook_url,
        ativo: formData.ativo,
        acoes: {
          webhook_url: formData.webhook_url,
          tipo_evento: formData.tipo
        } as any,
        criado_por: user?.id
      };

      if (editingId) {
        // Atualizar follow-up existente
        const { error } = await supabase
          .from('agente_followups')
          .update(followupData)
          .eq('id', editingId);
        
        if (error) throw error;
        
        toast({
          title: "Follow-up atualizado",
          description: "O follow-up foi atualizado com sucesso"
        });
      } else {
        // Criar novo follow-up
        const { error } = await supabase
          .from('agente_followups')
          .insert(followupData);
        
        if (error) throw error;
        
        toast({
          title: "Follow-up criado",
          description: "O follow-up foi criado com sucesso"
        });
      }
      
      await carregarFollowups();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar follow-up:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o follow-up",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agente_followups')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Follow-up excluído",
        description: "O follow-up foi excluído com sucesso"
      });
      
      await carregarFollowups();
    } catch (error) {
      console.error('Erro ao excluir follow-up:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o follow-up",
        variant: "destructive"
      });
    }
  };

  const handleTest = async (followup: Followup) => {
    try {
      setLoading(true);
      
      // Dados de teste baseados no tipo de gatilho
      let dadosTeste;
      
      switch (followup.tipo) {
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
        default:
          dadosTeste = {
            teste: true,
            timestamp: new Date().toISOString(),
            followup_id: followup.id
          };
      }

      // Validar URL antes de fazer requisição (prevenir SSRF)
      const urlValidation = validateWebhookUrl(followup.webhook_url);
      if (!urlValidation.valid) {
        toast({
          title: "URL inválida",
          description: urlValidation.error,
          variant: "destructive"
        });
        return;
      }

      // Enviar requisição para o webhook configurado
      const response = await fetch(followup.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dadosTeste)
      });

      if (response.ok) {
        toast({
          title: "Teste realizado com sucesso!",
          description: `Follow-up "${followup.nome}" foi testado e respondeu com status ${response.status}`,
        });
      } else {
        toast({
          title: "Teste falhou",
          description: `O webhook respondeu com status ${response.status}. Verifique a configuração.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao testar follow-up:', error);
      toast({
        title: "Erro no teste",
        description: "Não foi possível conectar com o webhook. Verifique a URL e conexão.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFollowups();
  }, [agenteId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Follow-up - Ação Ativa</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure follow-ups automáticos para este agente
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Follow-up
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar Follow-up" : "Novo Follow-up"}</CardTitle>
            <CardDescription>
              Configure um follow-up para disparar webhooks automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Follow-up</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Follow-up novo contato"
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

                <div className="md:col-span-2">
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
                  placeholder="Descreva quando este follow-up deve ser disparado..."
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
                <Label htmlFor="ativo">Follow-up ativo</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : editingId ? "Atualizar" : "Criar"} Follow-up
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {followups.map((followup) => (
          <Card key={followup.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Zap className="h-6 w-6 text-primary" />
                  <div className="space-y-2">
                    <h3 className="font-semibold">{followup.nome}</h3>
                    <p className="text-sm text-muted-foreground">{followup.descricao}</p>
                    <div className="flex flex-col gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Tipo: {tiposGatilho.find(t => t.value === followup.tipo)?.label || followup.tipo}
                      </span>
                      <span className="text-muted-foreground">Webhook: {followup.webhook_url}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    className={followup.ativo 
                      ? "bg-green-500 hover:bg-green-600 text-white" 
                      : "bg-red-500 hover:bg-red-600 text-white"
                    }
                  >
                    {followup.ativo ? "Ativo" : "Desativado"}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleTest(followup)}
                    disabled={loading}
                    title="Testar webhook"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(followup)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(followup.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {followups.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum follow-up configurado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro follow-up para automatizar ações deste agente
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Follow-up
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}