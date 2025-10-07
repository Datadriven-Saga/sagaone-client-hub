import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUp, ArrowDown, Edit, Trash2, Power, PowerOff, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CadenciaModal } from "./CadenciaModal";

interface Cadencia {
  id: string;
  agente_id: string;
  ordem: number;
  nome_cadencia: string;
  descricao?: string;
  tipo_disparo: 'whatsapp' | 'ligacao';
  tipo_mensagem: 'dinamica' | 'pre-definida';
  mensagem_enviada?: string;
  intervalo_minutos: number;
  ativa: boolean;
  empresa_id?: string;
}

interface AgenteCadenciasNovaProps {
  agenteId: string;
}

export function AgenteCadenciasNova({ agenteId }: AgenteCadenciasNovaProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cadencias, setCadencias] = useState<Cadencia[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCadencia, setSelectedCadencia] = useState<Cadencia | null>(null);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [syncingWebhook, setSyncingWebhook] = useState(false);

  const carregarCadencias = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agente_cadencias_steps')
        .select('*')
        .eq('agente_id', agenteId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setCadencias((data || []) as Cadencia[]);
    } catch (error) {
      console.error('Erro ao carregar cadências:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as cadências",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCadencias();
  }, [agenteId]);

  const handleMoveUp = async (cadencia: Cadencia) => {
    if (cadencia.ordem === 1) return;
    
    const cadenciaAcima = cadencias.find(c => c.ordem === cadencia.ordem - 1);
    if (!cadenciaAcima) return;

    try {
      const { error: error1 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem })
        .eq('id', cadenciaAcima.id);

      const { error: error2 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem - 1 })
        .eq('id', cadencia.id);

      if (error1 || error2) throw error1 || error2;

      toast({ title: "Ordem atualizada", description: "A ordem das cadências foi atualizada" });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao mover cadência:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover a cadência",
        variant: "destructive"
      });
    }
  };

  const handleMoveDown = async (cadencia: Cadencia) => {
    const maxOrdem = Math.max(...cadencias.map(c => c.ordem));
    if (cadencia.ordem === maxOrdem) return;
    
    const cadenciaAbaixo = cadencias.find(c => c.ordem === cadencia.ordem + 1);
    if (!cadenciaAbaixo) return;

    try {
      const { error: error1 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem })
        .eq('id', cadenciaAbaixo.id);

      const { error: error2 } = await supabase
        .from('agente_cadencias_steps')
        .update({ ordem: cadencia.ordem + 1 })
        .eq('id', cadencia.id);

      if (error1 || error2) throw error1 || error2;

      toast({ title: "Ordem atualizada", description: "A ordem das cadências foi atualizada" });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao mover cadência:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover a cadência",
        variant: "destructive"
      });
    }
  };

  const handleToggleStatus = async (cadencia: Cadencia) => {
    try {
      const { error } = await supabase
        .from('agente_cadencias_steps')
        .update({ ativa: !cadencia.ativa })
        .eq('id', cadencia.id);

      if (error) throw error;

      toast({
        title: cadencia.ativa ? "Cadência inativada" : "Cadência ativada",
        description: `A cadência foi ${cadencia.ativa ? 'inativada' : 'ativada'} com sucesso`
      });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status da cadência",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (cadencia: Cadencia) => {
    if (!confirm(`Tem certeza que deseja excluir a cadência "${cadencia.nome_cadencia}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agente_cadencias_steps')
        .delete()
        .eq('id', cadencia.id);

      if (error) throw error;

      toast({
        title: "Cadência excluída",
        description: "A cadência foi excluída com sucesso"
      });
      carregarCadencias();
    } catch (error) {
      console.error('Erro ao excluir cadência:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a cadência",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cadencia: Cadencia) => {
    setSelectedCadencia(cadencia);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedCadencia(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedCadencia(null);
    carregarCadencias();
  };

  const handleSyncWebhook = async () => {
    try {
      setSyncingWebhook(true);
      
      // Buscar dados do agente
      const { data: agenteData, error: agenteError } = await supabase
        .from('agentes_ia')
        .select('telefone, dealer_id, nome')
        .eq('id', agenteId)
        .single();

      if (agenteError) throw agenteError;

      if (!agenteData?.telefone) {
        toast({
          title: "Erro",
          description: "O agente não possui telefone configurado",
          variant: "destructive"
        });
        return;
      }

      if (!agenteData?.dealer_id) {
        toast({
          title: "Erro",
          description: "O agente não possui DealerID configurado",
          variant: "destructive"
        });
        return;
      }

      // Mapear as cadências/steps conforme o modelo
      const steps = cadencias.map(cadencia => {
        const step: any = {
          step_order: cadencia.ordem,
          label: cadencia.nome_cadencia,
          channel: cadencia.tipo_disparo,
          message_type: cadencia.tipo_mensagem,
          interval_minutes: cadencia.intervalo_minutos,
          enabled: cadencia.ativa
        };

        if (cadencia.tipo_mensagem === 'pre-definida' && cadencia.mensagem_enviada) {
          step.static_content = cadencia.mensagem_enviada;
        }

        if (cadencia.tipo_mensagem === 'dinamica') {
          // Template key é o nome da etapa sem espaços
          step.template_key = cadencia.nome_cadencia.replace(/\s+/g, '');
        }

        return step;
      });

      // Montar o payload
      const now = new Date();
      const idempotencyKey = `maia-cfg-v4-${now.toISOString().split('T')[0]}-${Date.now()}`;
      const configId = `maia-cfg-${agenteId.substring(0, 8)}`;

      const payload = {
        action: "save_cadence_config",
        idempotency_key: idempotencyKey,
        config: {
          config_id: configId,
          agent_phone: agenteData.telefone.replace(/\D/g, ''), // Remove caracteres não numéricos
          dealerid: parseInt(agenteData.dealer_id),
          name: `Cadência ${agenteData.nome}`,
          timezone: "America/Sao_Paulo",
          valid_from: now.toISOString(),
          valid_to: null,
          active: true,
          default_expire_days: 14,
          steps: steps
        }
      };

      // Fazer a chamada para o webhook
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/8275b29e-b3b1-494d-a604-b285a8cc0d56', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-token': 'ISVm0pIpF27jfQLP9LCYhnB9eK6rREog'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json().catch(() => ({ status: response.status, statusText: response.statusText }));

      setWebhookResponse({
        success: response.ok,
        status: response.status,
        data: responseData
      });
      setWebhookDialogOpen(true);

      if (response.ok) {
        toast({
          title: "Sincronização concluída",
          description: "As cadências foram sincronizadas com sucesso"
        });
      } else {
        toast({
          title: "Erro na sincronização",
          description: "Houve um problema ao sincronizar as cadências",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar webhook:', error);
      toast({
        title: "Erro",
        description: "Não foi possível sincronizar as cadências",
        variant: "destructive"
      });
      setWebhookResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      setWebhookDialogOpen(true);
    } finally {
      setSyncingWebhook(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cadência</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure as cadências de mensagens do agente
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Cadência
              </Button>
              <Button 
                onClick={handleSyncWebhook} 
                disabled={syncingWebhook || cadencias.length === 0}
                variant="secondary"
              >
                <Send className="h-4 w-4 mr-2" />
                {syncingWebhook ? "Sincronizando..." : "Sincronizar Webhook"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : cadencias.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma cadência cadastrada. Clique em "Nova Cadência" para adicionar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Ordem</TableHead>
                    <TableHead>Nome da Etapa</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Tipo da Mensagem</TableHead>
                    <TableHead>Mensagem Enviada</TableHead>
                    <TableHead className="text-right">Intervalo (min)</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cadencias.map((cadencia) => (
                    <TableRow key={cadencia.id} className={!cadencia.ativa ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{cadencia.ordem}</TableCell>
                      <TableCell>{cadencia.nome_cadencia}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cadencia.tipo_disparo === 'whatsapp' ? 'WhatsApp' : 'Ligação'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cadencia.tipo_mensagem === 'dinamica' ? 'Dinâmica' : 'Pré-Definida'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {cadencia.mensagem_enviada || '-'}
                      </TableCell>
                      <TableCell className="text-right">{cadencia.intervalo_minutos}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveUp(cadencia)}
                            disabled={cadencia.ordem === 1}
                            title="Mover para cima"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveDown(cadencia)}
                            disabled={cadencia.ordem === Math.max(...cadencias.map(c => c.ordem))}
                            title="Mover para baixo"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(cadencia)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(cadencia)}
                            title={cadencia.ativa ? "Inativar" : "Ativar"}
                          >
                            {cadencia.ativa ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cadencia)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CadenciaModal
        open={modalOpen}
        onClose={handleModalClose}
        cadencia={selectedCadencia}
        agenteId={agenteId}
        proximaOrdem={cadencias.length + 1}
      />

      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Resultado da Sincronização do Webhook
            </DialogTitle>
            <DialogDescription>
              Resposta recebida do webhook de sincronização
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {webhookResponse && (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Status:</span>
                  <span className={webhookResponse.success ? "text-green-600" : "text-red-600"}>
                    {webhookResponse.success ? "✓ Sucesso" : "✗ Erro"}
                  </span>
                  {webhookResponse.status && (
                    <span className="text-muted-foreground">
                      (HTTP {webhookResponse.status})
                    </span>
                  )}
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(webhookResponse.data || webhookResponse.error, null, 2)}
                  </pre>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setWebhookDialogOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}