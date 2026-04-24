import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Clock, X } from "lucide-react";
import {
  montarMensagemConvite,
  montarUrlWhatsapp,
} from "@/lib/conviteUtils";

interface EnviarConfirmacaoModalProps {
  open: boolean;
  contatoNome: string;
  contatoTelefone: string;
  eventoNome: string;
  token: string;
  templatePadrao?: string | null;
  onEnviar: () => void;
  onDepois: () => void;
  onCancelar: () => void;
}

export function EnviarConfirmacaoModal({
  open,
  contatoNome,
  contatoTelefone,
  eventoNome,
  token,
  templatePadrao,
  onEnviar,
  onDepois,
  onCancelar,
}: EnviarConfirmacaoModalProps) {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) {
      setMensagem(
        montarMensagemConvite({
          template: templatePadrao,
          nome: contatoNome,
          evento: eventoNome,
          token,
        })
      );
      setEnviando(false);
    }
  }, [open, templatePadrao, contatoNome, eventoNome, token]);

  const handleEnviar = () => {
    setEnviando(true);
    const url = montarUrlWhatsapp(contatoTelefone, mensagem);
    window.open(url, "_blank", "noopener,noreferrer");
    onEnviar();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancelar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar confirmação de presença?</DialogTitle>
          <DialogDescription>
            Será aberto o WhatsApp com a mensagem abaixo para{" "}
            <strong>{contatoNome}</strong>
            {contatoTelefone ? ` (${contatoTelefone})` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="mensagem-convite">Mensagem</Label>
          <Textarea
            id="mensagem-convite"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            O link de confirmação já está incluído na mensagem.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancelar} disabled={enviando}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button variant="outline" onClick={onDepois} disabled={enviando}>
            <Clock className="w-4 h-4 mr-1" /> Depois
          </Button>
          <Button onClick={handleEnviar} disabled={enviando || !contatoTelefone}>
            {enviando ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
