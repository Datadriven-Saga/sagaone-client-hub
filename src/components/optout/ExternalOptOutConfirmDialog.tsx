import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type OptOutCanalKey =
  | "whatsapp"
  | "call"
  | "sms"
  | "email"
  | "pesquisa";

const CANAL_OPTIONS: { key: OptOutCanalKey; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "call", label: "Ligação" },
  { key: "sms", label: "SMS" },
  { key: "email", label: "E-mail" },
  { key: "pesquisa", label: "Pesquisa" },
];

export const OPTOUT_MOTIVO_OPTIONS = [
  { value: "Cliente faleceu", label: "Cliente faleceu" },
  { value: "Experiência negativa com a empresa ou colaborador", label: "Experiência negativa com a empresa ou colaborador" },
  { value: "Não possui mais o veículo", label: "Não possui mais o veículo" },
  { value: "Não quer mais receber ofertas", label: "Não quer mais receber ofertas" },
  { value: "Recebe ligações em excesso", label: "Recebe ligações em excesso" },
  { value: "Telefone não é da pessoa", label: "Telefone não é da pessoa" },
  { value: "Outros", label: "Outros (especificar)" },
];
const MOTIVO_OPTIONS = OPTOUT_MOTIVO_OPTIONS;

export interface ExternalOptOutContatoInput {
  telefone: string;
  nome: string;
  email?: string | null;
  cpf?: string | null;
  documento?: string | null;
}

interface ExternalOptOutConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Disparado SOMENTE após sucesso no POST da API externa. */
  onConfirmed: () => void;
  contato: ExternalOptOutContatoInput;
  marca: string;
  uf: string;
  /** Pré-seleciona canais (operador pode alterar). */
  canaisSugeridos?: OptOutCanalKey[];
  /** Texto inicial da justificativa (ex: anotação já preenchida). */
  justificativaInicial?: string;
  /** Pré-seleciona o motivo do opt-out (deve ser um dos OPTOUT_MOTIVO_OPTIONS). */
  motivoInicial?: string;
  /** Permite editar marca/UF (quando não vêm do contexto). */
  allowMarcaUfEdit?: boolean;
}

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

export function ExternalOptOutConfirmDialog({
  open,
  onClose,
  onConfirmed,
  contato,
  marca: marcaProp,
  uf: ufProp,
  canaisSugeridos,
  justificativaInicial,
  motivoInicial,
  allowMarcaUfEdit = false,
}: ExternalOptOutConfirmDialogProps) {
  const [selectedCanais, setSelectedCanais] = useState<OptOutCanalKey[]>([]);
  const [marca, setMarca] = useState(marcaProp || "");
  const [uf, setUf] = useState(ufProp || "");
  const [cpf, setCpf] = useState(contato.cpf || contato.documento || "");
  const [email, setEmail] = useState(contato.email || "");
  const [motivo, setMotivo] = useState<string>("Cliente faleceu");
  const [justificativaOutros, setJustificativaOutros] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOutros = motivo === "Outros";

  useEffect(() => {
    if (!open) return;
    setSelectedCanais(canaisSugeridos && canaisSugeridos.length > 0 ? [...canaisSugeridos] : []);
    setMarca(marcaProp || "");
    setUf(ufProp || "");
    setCpf(contato.cpf || contato.documento || "");
    setEmail(contato.email || "");
    const valid = motivoInicial && MOTIVO_OPTIONS.some((m) => m.value === motivoInicial);
    setMotivo(valid ? (motivoInicial as string) : "Cliente faleceu");
    setJustificativaOutros(justificativaInicial?.slice(0, 500) || "");
    setAcknowledged(false);
    setSubmitting(false);
  }, [
    open,
    canaisSugeridos,
    marcaProp,
    ufProp,
    contato.cpf,
    contato.documento,
    contato.email,
    justificativaInicial,
    motivoInicial,
  ]);

  const outrosLen = justificativaOutros.trim().length;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (selectedCanais.length === 0) return false;
    if (isOutros && outrosLen < 20) return false;
    if (!acknowledged) return false;
    if (!marca.trim() || !uf.trim()) return false;
    if (!contato.telefone) return false;
    return true;
  }, [submitting, selectedCanais, isOutros, outrosLen, acknowledged, marca, uf, contato.telefone]);

  const toggleCanal = (k: OptOutCanalKey) => {
    setSelectedCanais((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  };

  const buildJustificativa = (): string => {
    if (isOutros) {
      return `Outros: ${justificativaOutros.trim()}`;
    }
    return motivo;
  };

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
            nome_completo_cliente: contato.nome?.trim() || "Não informado",
            marca: marca.trim(),
            uf: uf.trim(),
            canais_bloqueados: selectedCanais,
            justificativa: buildJustificativa(),
          },
        },
      );

      if (error) {
        let msg = error.message || "Falha ao registrar opt-out regulatório.";
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

      toast.success("Opt-out regulatório registrado com sucesso");
      onConfirmed();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro inesperado ao registrar opt-out");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-destructive" />
            Confirmar Opt-Out Regulatório
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contexto */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Contato: </span>
              <span className="font-medium">{contato.nome || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Telefone: </span>
              <span className="font-mono">
                {formatPhoneDisplay(contato.telefone)}
              </span>
            </div>
            {!allowMarcaUfEdit && (
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Marca: </span>
                  <span className="font-medium">{marca || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">UF: </span>
                  <span className="font-medium">{uf || "—"}</span>
                </div>
              </div>
            )}
          </div>

          {allowMarcaUfEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ext-marca" className="text-sm">Marca *</Label>
                <Input
                  id="ext-marca"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  disabled={submitting}
                  placeholder="Ex: VOLKSWAGEN"
                />
              </div>
              <div>
                <Label htmlFor="ext-uf" className="text-sm">UF *</Label>
                <Input
                  id="ext-uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                  disabled={submitting}
                  placeholder="Ex: GO"
                  maxLength={2}
                />
              </div>
            </div>
          )}

          {/* Canais */}
          <div>
            <Label className="text-sm">Canais a bloquear *</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CANAL_OPTIONS.map((opt) => {
                const checked = selectedCanais.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                      checked
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleCanal(opt.key)}
                      disabled={submitting}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* CPF / E-mail opcionais */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ext-cpf" className="text-sm">
                CPF (opcional)
              </Label>
              <Input
                id="ext-cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                disabled={submitting || !!(contato.cpf || contato.documento)}
                placeholder="Somente dígitos"
                maxLength={14}
              />
            </div>
            <div>
              <Label htmlFor="ext-email" className="text-sm">
                E-mail (opcional)
              </Label>
              <Input
                id="ext-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || !!contato.email}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <Label htmlFor="ext-motivo" className="text-sm">
              Motivo do opt-out *
            </Label>
            <Select
              value={motivo}
              onValueChange={setMotivo}
              disabled={submitting}
            >
              <SelectTrigger id="ext-motivo" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Justificativa livre (apenas quando "Outros") */}
          {isOutros && (
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ext-just" className="text-sm">
                  Especificar motivo *
                </Label>
                <span
                  className={`text-xs ${
                    outrosLen > 0 && outrosLen < 20
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {outrosLen >= 20 ? "OK" : `mín. 20 (${outrosLen})`}
                </span>
              </div>
              <Textarea
                id="ext-just"
                value={justificativaOutros}
                onChange={(e) => setJustificativaOutros(e.target.value.slice(0, 500))}
                placeholder="Descreva o motivo do opt-out..."
                rows={3}
                disabled={submitting}
              />
              {outrosLen > 0 && outrosLen < 20 && (
                <p className="text-xs text-destructive mt-1">
                  Mínimo de 20 caracteres.
                </p>
              )}
            </div>
          )}

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção — efeito regulatório</AlertTitle>
            <AlertDescription className="text-xs">
              Ao confirmar, o contato <strong>NÃO</strong> será mais
              impactado nos canais selecionados até que um opt-in seja
              realizado manualmente. Esta ação tem efeito regulatório e
              não pode ser desfeita por este sistema.
            </AlertDescription>
          </Alert>

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
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              "Confirmar Opt-Out"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
