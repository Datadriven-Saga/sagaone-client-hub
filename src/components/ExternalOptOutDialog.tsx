import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type OptOutCanal = "ligacao" | "whatsapp";

export interface ExternalOptOutContato {
  id?: string;
  nome: string;
  telefone: string;
  cpf?: string | null;
  email?: string | null;
}

export interface ExternalOptOutEmpresa {
  marca: string;
  uf: string;
}

interface ExternalOptOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contato: ExternalOptOutContato;
  empresa: ExternalOptOutEmpresa;
  canal: OptOutCanal;
  /** Quando true, permite ao operador escolher entre ligacao/whatsapp (sem contexto de evento). */
  allowCanalSelection?: boolean;
  onSuccess?: () => void;
}

const CANAL_LABEL: Record<OptOutCanal, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
};

function formatPhoneDisplay(value: string): string {
  const d = (value || "").replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return value || "";
}

export function ExternalOptOutDialog({
  open,
  onOpenChange,
  contato,
  empresa,
  canal: initialCanal,
  allowCanalSelection = false,
  onSuccess,
}: ExternalOptOutDialogProps) {
  const [canal, setCanal] = useState<OptOutCanal>(initialCanal);
  const [cpf, setCpf] = useState<string>(contato.cpf || "");
  const [email, setEmail] = useState<string>(contato.email || "");
  const [justificativa, setJustificativa] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (open) {
      setCanal(initialCanal);
      setCpf(contato.cpf || "");
      setEmail(contato.email || "");
      setJustificativa("");
      setAcknowledged(false);
      setSubmitting(false);
    }
  }, [open, initialCanal, contato.cpf, contato.email]);

  const justLen = justificativa.trim().length;
  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (justLen < 10 || justLen > 200) return false;
    if (!acknowledged) return false;
    if (!empresa.marca?.trim() || !empresa.uf?.trim()) return false;
    if (!contato.telefone) return false;
    return true;
  }, [submitting, justLen, acknowledged, empresa, contato.telefone]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "external-optout-register",
        {
          body: {
            telefone_cliente: contato.telefone,
            cpf_cliente: cpf?.trim() || null,
            email_cliente: email?.trim() || null,
            nome_completo_cliente: contato.nome,
            marca: empresa.marca,
            uf: empresa.uf,
            canal,
            justificativa: justificativa.trim(),
          },
        },
      );
      if (error) {
        // FunctionsHttpError contém context.json() com o body
        let msg = error.message || "Falha ao registrar opt-out";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const parsed = await ctx.json();
            if (parsed?.error) msg = parsed.error;
          }
        } catch { /* ignore */ }
        toast.error(msg);
        setSubmitting(false);
        return;
      }
      if ((data as any)?.error) {
        toast.error((data as any).error);
        setSubmitting(false);
        return;
      }
      toast.success("Opt-out externo registrado com sucesso");
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro inesperado ao registrar opt-out");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-destructive" />
            Registrar Opt-Out Externo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contexto do contato (readonly) */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Contato: </span>
              <span className="font-medium">{contato.nome}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Telefone: </span>
              <span className="font-mono">
                {formatPhoneDisplay(contato.telefone)}
              </span>
            </div>
            <div className="flex gap-4">
              <div>
                <span className="text-muted-foreground">Marca: </span>
                <span className="font-medium">{empresa.marca || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">UF: </span>
                <span className="font-medium">{empresa.uf || "—"}</span>
              </div>
            </div>
          </div>

          {/* Canal */}
          <div>
            <Label className="text-sm">Canal a bloquear *</Label>
            {allowCanalSelection ? (
              <div className="mt-2 flex gap-2">
                {(["ligacao", "whatsapp"] as OptOutCanal[]).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={canal === c ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCanal(c)}
                    disabled={submitting}
                  >
                    {CANAL_LABEL[c]}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="mt-2">
                <Badge variant="secondary" className="text-sm">
                  {CANAL_LABEL[canal]}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Herdado do canal do evento.
                </p>
              </div>
            )}
          </div>

          {/* CPF / E-mail (editáveis somente se vazios) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="optout-cpf" className="text-sm">
                CPF (opcional)
              </Label>
              <Input
                id="optout-cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                disabled={submitting || !!contato.cpf}
                placeholder="Somente dígitos"
                maxLength={14}
              />
            </div>
            <div>
              <Label htmlFor="optout-email" className="text-sm">
                E-mail (opcional)
              </Label>
              <Input
                id="optout-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || !!contato.email}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          {/* Justificativa */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="optout-just" className="text-sm">
                Justificativa *
              </Label>
              <span
                className={`text-xs ${
                  justLen > 200 || (justLen > 0 && justLen < 10)
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {justLen}/200
              </span>
            </div>
            <Textarea
              id="optout-just"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value.slice(0, 200))}
              placeholder="Descreva o motivo do opt-out (ex: cliente solicitou por ligação em DD/MM)"
              rows={3}
              disabled={submitting}
            />
            {justLen > 0 && justLen < 10 && (
              <p className="text-xs text-destructive mt-1">
                Mínimo de 10 caracteres.
              </p>
            )}
          </div>

          {/* Aviso regulatório */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção — efeito regulatório</AlertTitle>
            <AlertDescription className="text-xs">
              Ao registrar este opt-out, o contato <strong>NÃO</strong> será
              mais impactado no canal{" "}
              <strong>{CANAL_LABEL[canal]}</strong>{" "}
              até que um opt-in seja realizado manualmente. Esta ação não pode
              ser desfeita por este sistema.
            </AlertDescription>
          </Alert>

          {/* Confirmação */}
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              disabled={submitting}
            />
            <span>Entendo que esta ação tem efeito regulatório.</span>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting
              ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              )
              : (
                "Registrar Opt-Out"
              )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
