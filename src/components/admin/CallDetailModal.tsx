import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  call: any;
  source: "vapi" | "twilio";
}

const fmtUSD = (v: number) => `US$ ${v.toFixed(4)}`;

const CallDetailModal = ({ open, onOpenChange, call, source }: CallDetailModalProps) => {
  if (!call) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Chamada
            <Badge variant="outline" className="text-xs">{source.toUpperCase()}</Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-muted-foreground">ID</div>
              <div className="font-mono text-xs break-all">{call.id || call.sid || "—"}</div>
              
              <div className="text-muted-foreground">Data</div>
              <div>{call.date ? new Date(call.date).toLocaleString("pt-BR") : "—"}</div>
              
              <div className="text-muted-foreground">Status</div>
              <div><Badge variant="outline" className="text-xs">{call.status}</Badge></div>
              
              <div className="text-muted-foreground">Duração</div>
              <div>{call.duration}s</div>
              
              <div className="text-muted-foreground">Custo</div>
              <div className="font-mono">{fmtUSD(call.cost ?? call.price ?? 0)}</div>

              {source === "twilio" && (
                <>
                  <div className="text-muted-foreground">Origem</div>
                  <div className="font-mono text-xs">{call.from || "—"}</div>
                  <div className="text-muted-foreground">Destino</div>
                  <div className="font-mono text-xs">{call.to || "—"}</div>
                  <div className="text-muted-foreground">Direção</div>
                  <div>{call.direction || "—"}</div>
                </>
              )}

              {source === "vapi" && call.costBreakdown && (
                <>
                  <div className="col-span-2 pt-2 font-medium border-t border-border">Composição de Custos</div>
                  <div className="text-muted-foreground">STT</div>
                  <div className="font-mono">{fmtUSD(call.costBreakdown.stt || 0)}</div>
                  <div className="text-muted-foreground">LLM</div>
                  <div className="font-mono">{fmtUSD(call.costBreakdown.llm || 0)}</div>
                  <div className="text-muted-foreground">TTS</div>
                  <div className="font-mono">{fmtUSD(call.costBreakdown.tts || 0)}</div>
                  <div className="text-muted-foreground">Transport</div>
                  <div className="font-mono">{fmtUSD(call.costBreakdown.transport || 0)}</div>
                  <div className="text-muted-foreground">Vapi</div>
                  <div className="font-mono">{fmtUSD(call.costBreakdown.vapi || 0)}</div>
                </>
              )}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-muted-foreground mb-1 text-xs">Metadados (JSON)</p>
              <pre className="bg-muted/50 rounded p-2 text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify(call, null, 2)}
              </pre>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CallDetailModal;
