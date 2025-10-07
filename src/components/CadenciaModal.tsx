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

    </>
  );
}