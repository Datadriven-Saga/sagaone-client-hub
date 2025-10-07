import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

interface CadenciaModalProps {
  open: boolean;
  onClose: () => void;
  cadencia: Cadencia | null;
  agenteId: string;
  proximaOrdem: number;
}

export function CadenciaModal({ open, onClose, cadencia, agenteId, proximaOrdem }: CadenciaModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [webhookPayload, setWebhookPayload] = useState<any>(null);
  const [formData, setFormData] = useState({
    nome_cadencia: "",
    descricao: "",
    tipo_disparo: "whatsapp" as 'whatsapp' | 'ligacao',
    tipo_mensagem: "dinamica" as 'dinamica' | 'pre-definida',
    mensagem_enviada: "",
    intervalo_minutos: 60,
  });

  useEffect(() => {
    if (cadencia) {
      setFormData({
        nome_cadencia: cadencia.nome_cadencia,
        descricao: cadencia.descricao || "",
        tipo_disparo: cadencia.tipo_disparo,
        tipo_mensagem: cadencia.tipo_mensagem,
        mensagem_enviada: cadencia.mensagem_enviada || "",
        intervalo_minutos: cadencia.intervalo_minutos,
      });
    } else {
      setFormData({
        nome_cadencia: "",
        descricao: "",
        tipo_disparo: "whatsapp",
        tipo_mensagem: "dinamica",
        mensagem_enviada: "",
        intervalo_minutos: 60,
      });
    }
  }, [cadencia, open]);

  const handleSave = async () => {
    if (!formData.nome_cadencia) {
      toast({
        title: "Erro",
        description: "O nome da cadência é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (formData.tipo_mensagem === 'pre-definida' && !formData.mensagem_enviada) {
      toast({
        title: "Erro",
        description: "A mensagem é obrigatória para cadências pré-definidas",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      if (cadencia) {
        // Atualizar cadência existente
        const { error } = await supabase
          .from('agente_cadencias_steps')
          .update({
            nome_cadencia: formData.nome_cadencia,
            descricao: formData.descricao,
            tipo_disparo: formData.tipo_disparo,
            tipo_mensagem: formData.tipo_mensagem,
            mensagem_enviada: formData.tipo_mensagem === 'pre-definida' ? formData.mensagem_enviada : '',
            intervalo_minutos: formData.intervalo_minutos,
          })
          .eq('id', cadencia.id);

        if (error) throw error;

        toast({
          title: "Cadência atualizada",
          description: "A cadência foi atualizada com sucesso"
        });
      } else {
        // Criar nova cadência
        const { error } = await supabase
          .from('agente_cadencias_steps')
          .insert({
            agente_id: agenteId,
            ordem: proximaOrdem,
            nome_cadencia: formData.nome_cadencia,
            descricao: formData.descricao,
            tipo_disparo: formData.tipo_disparo,
            tipo_mensagem: formData.tipo_mensagem,
            mensagem_enviada: formData.tipo_mensagem === 'pre-definida' ? formData.mensagem_enviada : '',
            intervalo_minutos: formData.intervalo_minutos,
            ativa: true,
          });

        if (error) throw error;

        toast({
          title: "Cadência criada",
          description: "A cadência foi criada com sucesso"
        });
      }

      // Sincronizar com o webhook após salvar
      await syncWebhook();

      onClose();
    } catch (error) {
      console.error('Erro ao salvar cadência:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a cadência",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const syncWebhook = async () => {
    try {
      // Buscar dados do agente
      const { data: agenteData, error: agenteError } = await supabase
        .from('agentes_ia')
        .select('telefone, dealer_id, nome')
        .eq('id', agenteId)
        .single();

      if (agenteError) throw agenteError;

      if (!agenteData?.telefone || !agenteData?.dealer_id) {
        console.warn('Agente sem telefone ou dealer_id configurado');
        return;
      }

      // Buscar todas as cadências do agente
      const { data: cadenciasData, error: cadenciasError } = await supabase
        .from('agente_cadencias_steps')
        .select('*')
        .eq('agente_id', agenteId)
        .order('ordem', { ascending: true });

      if (cadenciasError) throw cadenciasError;

      // Mapear as cadências/steps conforme o modelo
      const steps = (cadenciasData || []).map(cad => {
        const step: any = {
          step_order: cad.ordem,
          label: cad.nome_cadencia,
          channel: cad.tipo_disparo,
          message_type: cad.tipo_mensagem,
          interval_minutes: cad.intervalo_minutos,
          enabled: cad.ativa
        };

        if (cad.tipo_mensagem === 'pre-definida' && cad.mensagem_enviada) {
          step.static_content = cad.mensagem_enviada;
        }

        if (cad.tipo_mensagem === 'dinamica') {
          step.template_key = cad.nome_cadencia.replace(/\s+/g, '');
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
          agent_phone: agenteData.telefone.replace(/\D/g, ''),
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

      // Salvar o payload para exibir no popup
      setWebhookPayload(payload);

      // Fazer a chamada para o webhook
      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/8275b29e-b3b1-494d-a604-b285a8cc0d56', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-token': 'ISVm0pIpF27jfQLP9LCYhnB9eK6rREog'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json().catch(() => ({ 
        status: response.status, 
        statusText: response.statusText 
      }));

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
          title: "Aviso",
          description: "Cadência salva, mas houve um problema na sincronização",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar webhook:', error);
      setWebhookResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      setWebhookDialogOpen(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cadencia ? "Editar Cadência" : "Nova Cadência"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome_cadencia">Nome da Cadência *</Label>
              <Input
                id="nome_cadencia"
                value={formData.nome_cadencia}
                onChange={(e) => setFormData(prev => ({ ...prev, nome_cadencia: e.target.value }))}
                placeholder="Ex: Cadência 1"
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição opcional da cadência"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="tipo_disparo">Tipo de Disparo *</Label>
              <Select
                value={formData.tipo_disparo}
                onValueChange={(value: 'whatsapp' | 'ligacao') =>
                  setFormData(prev => ({ ...prev, tipo_disparo: value }))
                }
              >
                <SelectTrigger id="tipo_disparo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tipo_mensagem">Tipo da Mensagem *</Label>
              <Select
                value={formData.tipo_mensagem}
                onValueChange={(value: 'dinamica' | 'pre-definida') =>
                  setFormData(prev => ({
                    ...prev,
                    tipo_mensagem: value,
                    mensagem_enviada: value === 'dinamica' ? '' : prev.mensagem_enviada
                  }))
                }
              >
                <SelectTrigger id="tipo_mensagem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinamica">Dinâmica</SelectItem>
                  <SelectItem value="pre-definida">Pré-Definida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="mensagem_enviada">
                Mensagem Pré-Definida {formData.tipo_mensagem === 'pre-definida' && '*'}
              </Label>
              <Textarea
                id="mensagem_enviada"
                value={formData.mensagem_enviada}
                onChange={(e) => setFormData(prev => ({ ...prev, mensagem_enviada: e.target.value }))}
                placeholder={
                  formData.tipo_mensagem === 'pre-definida'
                    ? "Digite a mensagem..."
                    : "Campo bloqueado para mensagens dinâmicas"
                }
                disabled={formData.tipo_mensagem === 'dinamica'}
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="intervalo_minutos">Intervalo da Última Mensagem (minutos) *</Label>
              <Input
                id="intervalo_minutos"
                type="number"
                min="1"
                value={formData.intervalo_minutos}
                onChange={(e) => setFormData(prev => ({ ...prev, intervalo_minutos: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Resultado da Sincronização do Webhook
            </DialogTitle>
            <DialogDescription>
              Dados enviados e resposta recebida do webhook
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
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

                <div>
                  <h3 className="font-semibold text-lg mb-2">Payload Enviado:</h3>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(webhookPayload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">Resposta Recebida:</h3>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(webhookResponse.data || webhookResponse.error, null, 2)}
                    </pre>
                  </div>
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