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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { OptOutCanalKey } from "./ExternalOptOutConfirmDialog";

const CANAL_OPTIONS: { key: OptOutCanalKey; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "call", label: "Ligação" },
  { key: "sms", label: "SMS" },
  { key: "email", label: "E-mail" },
  { key: "pesquisa", label: "Pesquisa" },
];

export interface BulkOptOutRow {
  telefone: string;
  nome?: string | null;
}

export interface BulkOptOutResult {
  success: number;
  failed: number;
  errors: { telefone: string; error: string }[];
}

interface ExternalOptOutBulkConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  rows: BulkOptOutRow[];
  marca: string;
  uf: string;
  allowMarcaUfEdit?: boolean;
  onConfirmed: (result: BulkOptOutResult, payload: {
    canais: OptOutCanalKey[];
    justificativa: string;
    marca: string;
    uf: string;
  }) => Promise<void> | void;
}

export function ExternalOptOutBulkConfirmDialog({
  open,
  onClose,
  rows,
  marca: marcaProp,
  uf: ufProp,
  allowMarcaUfEdit = false,
  onConfirmed,
}: ExternalOptOutBulkConfirmDialogProps) {
  const [selectedCanais, setSelectedCanais] = useState<OptOutCanalKey[]>([]);
  const [marca, setMarca] = useState(marcaProp || "");
  const [uf, setUf] = useState(ufProp || "");
  const [justificativa, setJustificativa] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!open) return;
    setSelectedCanais([]);
    setMarca(marcaProp || "");
    setUf(ufProp || "");
    setJustificativa("");
    setAcknowledged(false);
    setSubmitting(false);
    setProgress({ done: 0, total: 0 });
  }, [open, marcaProp, ufProp]);

  const justLen = justificativa.trim().length;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (rows.length === 0) return false;
    if (selectedCanais.length === 0) return false;
    if (justLen < 10 || justLen > 200) return false;
    if (!acknowledged) return false;
    if (!marca.trim() || !uf.trim()) return false;
    return true;
  }, [submitting, rows.length, selectedCanais, justLen, acknowledged, marca, uf]);

  const toggleCanal = (k: OptOutCanalKey) => {
    setSelectedCanais((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setProgress({ done: 0, total: rows.length });

    const result: BulkOptOutResult = { success: 0, failed: 0, errors: [] };
    const successful: BulkOptOutRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const { error } = await supabase.functions.invoke(
          "external-optout-register",
          {
            body: {
              telefone_cliente: row.telefone,
              cpf_cliente: null,
              email_cliente: null,
              nome_completo_cliente: row.nome?.trim() || "Não informado",
              marca: marca.trim(),
              uf: uf.trim(),
              canais_bloqueados: selectedCanais,
              justificativa: justificativa.trim(),
            },
          },
        );
        if (error) {
          let msg = error.message || "Erro desconhecido";
          try {
            const ctx: any = (error as any).context;
            if (ctx?.json) {
              const parsed = await ctx.json();
              if (parsed?.error) msg = parsed.error;
            }
          } catch { /* ignore */ }
          result.failed++;
          result.errors.push({ telefone: row.telefone, error: msg });
        } else {
          result.success++;
          successful.push(row);
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          telefone: row.telefone,
          error: err?.message ?? String(err),
        });
      }
      setProgress({ done: i + 1, total: rows.length });
    }

    try {
      await onConfirmed(result, {
        canais: selectedCanais,
        justificativa: justificativa.trim(),
        marca: marca.trim(),
        uf: uf.trim(),
      });
    } catch (e: any) {
      console.error("[BulkOptOut] onConfirmed callback failed", e);
    }

    if (result.failed === 0) {
      toast.success(`${result.success} registros enviados ao opt-out regulatório`);
    } else {
      toast.error(
        `${result.success} sucesso(s), ${result.failed} falha(s) ao registrar opt-out`,
      );
    }

    setSubmitting(false);
    onClose();
  };

  const showVolumeWarning = rows.length > 500;

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-destructive" />
            Confirmar Opt-Out em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            Você está prestes a registrar{" "}
            <strong>{rows.length}</strong> número(s) no opt-out regulatório
            externo. Cada registro será enviado individualmente.
          </div>

          {showVolumeWarning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Volume alto ({rows.length} registros). O processamento pode
                levar vários minutos. Mantenha esta aba aberta.
              </AlertDescription>
            </Alert>
          )}

          {allowMarcaUfEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bulk-marca" className="text-sm">Marca *</Label>
                <Input
                  id="bulk-marca"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  disabled={submitting}
                  placeholder="Ex: VOLKSWAGEN"
                />
              </div>
              <div>
                <Label htmlFor="bulk-uf" className="text-sm">UF *</Label>
                <Input
                  id="bulk-uf"
                  value={uf}
                  onChange={(e) =>
                    setUf(e.target.value.toUpperCase().slice(0, 2))
                  }
                  disabled={submitting}
                  placeholder="Ex: GO"
                  maxLength={2}
                />
              </div>
            </div>
          )}

          {!allowMarcaUfEdit && (
            <div className="text-sm text-muted-foreground">
              Marca: <span className="font-medium text-foreground">{marca || "—"}</span>{" "}
              · UF: <span className="font-medium text-foreground">{uf || "—"}</span>
            </div>
          )}

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

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-just" className="text-sm">
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
              id="bulk-just"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value.slice(0, 200))}
              placeholder="Ex: Importação de lista de opt-out recebida do compliance"
              rows={3}
              disabled={submitting}
            />
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção — efeito regulatório</AlertTitle>
            <AlertDescription className="text-xs">
              Todos os números serão registrados no opt-out regulatório
              externo nos canais selecionados. Apenas os registros que
              tiverem sucesso na API serão adicionados à lista negra interna.
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

          {submitting && progress.total > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Enviando…</span>
                <span>{progress.done}/{progress.total}</span>
              </div>
              <Progress
                value={(progress.done / progress.total) * 100}
              />
            </div>
          )}
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
                Processando...
              </>
            ) : (
              `Confirmar ${rows.length} registro(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}