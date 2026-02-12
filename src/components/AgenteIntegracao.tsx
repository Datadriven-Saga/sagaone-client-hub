import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Send, Database, Webhook, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateWebhookUrl } from "@/lib/security";

interface Integracao {
  id: string;
  evolution_id: string;
  banco_dados_ia: string;
  tabela_historico_ia: string;
  webhook_metodo: string;
  webhook_url: string;
  ativo: boolean;
}

interface AgenteIntegracaoProps {
  agenteId: string;
}

export function AgenteIntegracao({ agenteId }: AgenteIntegracaoProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{
    success: boolean;
    status?: number;
    response?: any;
    error?: string;
  } | null>(null);
  
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [formData, setFormData] = useState({
    evolution_id: "",
    banco_dados_ia: "",
    tabela_historico_ia: "",
    webhook_metodo: "POST",
    webhook_url: "",
    ativo: true
  });

  const metodosWebhook = [
    { value: "POST", label: "POST" },
    { value: "GET", label: "GET" },
    { value: "PUT", label: "PUT" }
  ];

  const carregarIntegracao = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('agente_integracoes')
        .select('*')
        .eq('agente_id', agenteId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setIntegracao(data);
        setFormData({
          evolution_id: data.evolution_id || "",
          banco_dados_ia: data.banco_dados_ia || "",
          tabela_historico_ia: data.tabela_historico_ia || "",
          webhook_metodo: data.webhook_metodo || "POST",
          webhook_url: data.webhook_url || "",
          ativo: data.ativo
        });
      }
    } catch (error) {
      console.error('Erro ao carregar integração:', error);
      toast({
        title: "Erro ao carregar integração",
        description: "Não foi possível carregar a configuração de integração",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const integracaoData = {
        agente_id: agenteId,
        evolution_id: formData.evolution_id,
        banco_dados_ia: formData.banco_dados_ia,
        tabela_historico_ia: formData.tabela_historico_ia,
        webhook_metodo: formData.webhook_metodo,
        webhook_url: formData.webhook_url,
        ativo: formData.ativo
      };

      if (integracao) {
        // Atualizar integração existente
        const { error } = await supabase
          .from('agente_integracoes')
          .update(integracaoData)
          .eq('id', integracao.id);
        
        if (error) throw error;
        
        toast({
          title: "Integração atualizada",
          description: "A configuração de integração foi atualizada com sucesso"
        });
      } else {
        // Criar nova integração
        const { error } = await supabase
          .from('agente_integracoes')
          .insert(integracaoData);
        
        if (error) throw error;
        
        toast({
          title: "Integração criada",
          description: "A configuração de integração foi criada com sucesso"
        });
      }
      
      await carregarIntegracao();
    } catch (error) {
      console.error('Erro ao salvar integração:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração de integração",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!formData.webhook_url) {
      toast({
        title: "URL do webhook necessária",
        description: "Configure a URL do webhook antes de testá-lo",
        variant: "destructive"
      });
      return;
    }

    try {
      setTestingWebhook(true);
      setWebhookResult(null);

      // Buscar dados do agente para enviar no teste
      const { data: agenteData } = await supabase
        .from('agentes_ia')
        .select('*')
        .eq('id', agenteId)
        .single();

      // Buscar dados de follow-ups
      const { data: followupsData } = await supabase
        .from('agente_followups')
        .select('*')
        .eq('agente_id', agenteId);

      // Buscar dados de cadência
      const { data: cadenciaData } = await supabase
        .from('agente_cadencias')
        .select('*')
        .eq('agente_id', agenteId)
        .maybeSingle();

      // Corpo completo do webhook com todos os dados do agente
      const webhookBody = {
        teste: true,
        timestamp: new Date().toISOString(),
        agente: {
          id: agenteData?.id,
          nome: agenteData?.nome,
          persona: agenteData?.persona,
          cerebro: agenteData?.cerebro,
          telefone: agenteData?.telefone,
          foto_url: agenteData?.foto_url,
          ativo: agenteData?.ativo
        },
        followups: followupsData || [],
        cadencia: cadenciaData,
        integracao: {
          evolution_id: formData.evolution_id,
          banco_dados_ia: formData.banco_dados_ia,
          tabela_historico_ia: formData.tabela_historico_ia,
          webhook_metodo: formData.webhook_metodo,
          webhook_url: formData.webhook_url
        }
      };

      console.log('Testando webhook com dados:', webhookBody);

      // Validar URL antes de fazer requisição (prevenir SSRF)
      const urlValidation = validateWebhookUrl(formData.webhook_url);
      if (!urlValidation.valid) {
        toast({
          title: "URL inválida",
          description: urlValidation.error,
          variant: "destructive"
        });
        setTestingWebhook(false);
        return;
      }

      // Enviar requisição via proxy para evitar problemas de CSP
      const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('external-webhook-proxy', {
        body: {
          webhook_url: formData.webhook_url,
          webhook_method: formData.webhook_metodo,
          ...webhookBody
        }
      });

      if (proxyError) {
        console.error(`❌ Erro ao testar webhook da integração: ${proxyError.message}`);
        setWebhookResult({
          success: false,
          error: proxyError.message
        });
        toast({
          title: "Teste do webhook falhou",
          description: `Erro: ${proxyError.message}`,
          variant: "destructive"
        });
      } else {
        console.log(`✅ Webhook da integração testado com sucesso:`, proxyResponse);
        setWebhookResult({
          success: true,
          status: 200,
          response: proxyResponse
        });
        toast({
          title: "Webhook testado com sucesso!",
          description: "Webhook respondeu com sucesso",
        });
      }

    } catch (error) {
      console.error(`❌ Erro ao testar webhook da integração: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      
      setWebhookResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });

      toast({
        title: "Erro no teste do webhook",
        description: "Não foi possível conectar com o webhook. Verifique a URL e conexão.",
        variant: "destructive"
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  useEffect(() => {
    carregarIntegracao();
  }, [agenteId]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Integração</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure os webhooks e integrações para este agente
              </p>
            </div>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Integração"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configurações básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="evolution_id">ID do Evolution</Label>
              <Input
                id="evolution_id"
                value={formData.evolution_id}
                onChange={(e) => setFormData(prev => ({ ...prev, evolution_id: e.target.value }))}
                placeholder="ID do sistema Evolution"
              />
            </div>

            <div>
              <Label htmlFor="banco_dados_ia">Banco de Dados da IA</Label>
              <Input
                id="banco_dados_ia"
                value={formData.banco_dados_ia}
                onChange={(e) => setFormData(prev => ({ ...prev, banco_dados_ia: e.target.value }))}
                placeholder="Nome do banco de dados"
              />
            </div>

            <div>
              <Label htmlFor="tabela_historico_ia">Tabela de Histórico da IA</Label>
              <Input
                id="tabela_historico_ia"
                value={formData.tabela_historico_ia}
                onChange={(e) => setFormData(prev => ({ ...prev, tabela_historico_ia: e.target.value }))}
                placeholder="Nome da tabela de histórico"
              />
            </div>
          </div>

          {/* Configurações do Webhook */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook de Envio das Informações Globais
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="webhook_metodo">Método HTTP</Label>
                <Select 
                  value={formData.webhook_metodo} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, webhook_metodo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o método" />
                  </SelectTrigger>
                  <SelectContent>
                    {metodosWebhook.map((metodo) => (
                      <SelectItem key={metodo.value} value={metodo.value}>
                        {metodo.label}
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
                  value={formData.webhook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
                  placeholder="https://seu-webhook.com/endpoint"
                />
              </div>
            </div>

            {/* Botão de teste do webhook */}
            <div className="flex gap-4 items-center">
              <Button 
                onClick={handleTestWebhook}
                disabled={testingWebhook || !formData.webhook_url}
                variant="outline"
              >
                {testingWebhook ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {testingWebhook ? "Testando..." : "Executar Webhook"}
              </Button>
              
              {webhookResult && (
                <div className="flex items-center gap-2">
                  {webhookResult.success ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Sucesso ({webhookResult.status})
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Falha {webhookResult.status ? `(${webhookResult.status})` : ''}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Resultado do teste */}
            {webhookResult && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Resultado do Teste</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <strong>Status:</strong> {webhookResult.status || 'Erro de conexão'}
                    </div>
                    {webhookResult.error && (
                      <div>
                        <strong>Erro:</strong> {webhookResult.error}
                      </div>
                    )}
                    {webhookResult.response && (
                      <div>
                        <strong>Resposta:</strong>
                        <pre className="mt-2 p-3 bg-muted rounded-md text-sm overflow-x-auto">
                          {typeof webhookResult.response === 'string' 
                            ? webhookResult.response 
                            : JSON.stringify(webhookResult.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="integracao_ativa"
              checked={formData.ativo}
              onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
            />
            <Label htmlFor="integracao_ativa">Integração ativa</Label>
          </div>
        </CardContent>
      </Card>

      {/* Resumo da configuração */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resumo da Integração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Evolution ID:</strong> {formData.evolution_id || "Não configurado"}</p>
              <p><strong>Banco de dados:</strong> {formData.banco_dados_ia || "Não configurado"}</p>
              <p><strong>Tabela histórico:</strong> {formData.tabela_historico_ia || "Não configurado"}</p>
            </div>
            <div>
              <p><strong>Método webhook:</strong> {formData.webhook_metodo}</p>
              <p><strong>URL webhook:</strong> {formData.webhook_url || "Não configurado"}</p>
              <p><strong>Status:</strong> <span className={formData.ativo ? "text-green-600" : "text-red-600"}>{formData.ativo ? "Ativo" : "Desativado"}</span></p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> O webhook enviará todas as informações do agente (dados gerais, follow-ups, cadência e integração) 
              para o destino configurado quando executado.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}