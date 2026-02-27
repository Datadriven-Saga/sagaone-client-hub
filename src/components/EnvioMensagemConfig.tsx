import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Settings2, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface EnvioMensagemConfigProps {
  className?: string;
}

export function EnvioMensagemConfig({ className }: EnvioMensagemConfigProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  // Query filters
  const [idEvento, setIdEvento] = useState("249");
  const [eventIdMaia, setEventIdMaia] = useState("232");
  const [statusAgendado, setStatusAgendado] = useState(false);
  const [evtStatus, setEvtStatus] = useState(true);
  const [somenteSemProposta, setSomenteSemProposta] = useState(false);

  // Identification fields
  const [telefonePriWhatsapp, setTelefonePriWhatsapp] = useState("");
  const [dealerId, setDealerId] = useState("");

  const handleDisparo = async () => {
    if (!telefonePriWhatsapp.trim()) {
      toast({ title: "Informe o telefone_pri_whatsapp", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const payload = {
        id_evento: idEvento,
        event_id_maia: eventIdMaia,
        status_agendado: statusAgendado,
        evt_status: evtStatus,
        somente_sem_proposta: somenteSemProposta,
        telefone_pri_whatsapp: telefonePriWhatsapp.replace(/\D/g, ""),
        dealerid: dealerId.trim(),
      };

      const { error } = await supabase.functions.invoke("maia-webhook-proxy", {
        body: {
          ...payload,
          _webhook_url: "https://automatemaiawh.sagadatadriven.com.br/webhook/envia_mensagem",
        },
      });

      if (error) throw error;
      toast({ title: "Mensagens disparadas com sucesso!", description: "O processo de envio foi iniciado." });
    } catch (err: any) {
      toast({ title: "Erro ao disparar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Filtros da Query */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Configuração de Filtros</CardTitle>
              <CardDescription>Parâmetros da query para seleção de mensagens</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* IDs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ID do Evento Principal (p.id_evento)</Label>
              <Input
                value={idEvento}
                onChange={e => setIdEvento(e.target.value)}
                placeholder="249"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID do Evento Maia (m.event_id)</Label>
              <Input
                value={eventIdMaia}
                onChange={e => setEventIdMaia(e.target.value)}
                placeholder="232"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="msg-status-agendado" className="text-sm">status_agendado</Label>
              <Switch id="msg-status-agendado" checked={statusAgendado} onCheckedChange={setStatusAgendado} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="msg-evt-status" className="text-sm">evt_status</Label>
              <Switch id="msg-evt-status" checked={evtStatus} onCheckedChange={setEvtStatus} />
            </div>
          </div>

          {/* Proposta filter */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="sem-proposta"
              checked={somenteSemProposta}
              onCheckedChange={(checked) => setSomenteSemProposta(checked === true)}
            />
            <Label htmlFor="sem-proposta" className="text-sm cursor-pointer">
              Somente código_proposta nulo
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Campos de Identificação */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Campos de Identificação</CardTitle>
              <CardDescription>Referências de telefone e dealer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>telefone_pri_whatsapp</Label>
            <Input
              placeholder="Ex: 5511999999999"
              value={telefonePriWhatsapp}
              onChange={e => setTelefonePriWhatsapp(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>dealerid</Label>
            <Input
              placeholder="Ex: DEALER001"
              value={dealerId}
              onChange={e => setDealerId(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ação */}
      <Button
        onClick={handleDisparo}
        disabled={sending}
        size="lg"
        className="w-full sm:w-auto"
      >
        {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Disparar Mensagens em Massa
      </Button>
    </div>
  );
}
