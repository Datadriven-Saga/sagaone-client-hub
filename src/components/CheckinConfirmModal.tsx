import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, User, Phone, Calendar, Loader2, Sparkles } from "lucide-react";
import type { MultiCheckinData } from "@/hooks/useRecepcaoData";

interface CheckinConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Fluxo antigo (single) — mantido para QR Code
  onConfirm?: (nomeVisitante?: string) => Promise<void>;
  data: {
    nome: string;
    telefone: string;
    evento: string;
    isNewContact: boolean;
  } | null;
  loading?: boolean;
  // Fluxo novo (multi-prospecção)
  multiData?: MultiCheckinData | null;
  onConfirmMulti?: (
    selectedProspeccaoIds: string[],
    nomeVisitanteNovo?: string
  ) => Promise<void>;
}

export function CheckinConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  data,
  loading = false,
  multiData,
  onConfirmMulti,
}: CheckinConfirmModalProps) {
  const [nomeVisitante, setNomeVisitante] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isMulti = !!multiData;

  // ===== Pré-preenchimento do nome =====
  useEffect(() => {
    if (!isOpen) { setNomeVisitante(""); return; }

    if (isMulti && multiData) {
      // Reusa nome existente (de outra prospecção) se houver
      const existing = multiData.matches.find(m => !m.isNewContact && m.contatoNome);
      setNomeVisitante(existing?.contatoNome ?? "");
      return;
    }

    if (data?.isNewContact) {
      const placeholder = !data.nome || data.nome === "Novo Visitante" || data.nome === "Visitante";
      setNomeVisitante(placeholder ? "" : data.nome);
    }
  }, [isOpen, data?.isNewContact, data?.nome, isMulti, multiData]);

  // ===== Seleção default de prospecções =====
  useEffect(() => {
    if (!isOpen || !multiData) { setSelectedIds([]); return; }
    // "Só onde já existe": pré-marca apenas matches existentes.
    // Se NENHUMA existir (visitante 100% novo), pré-marca TODAS para o recepcionista revisar.
    const existing = multiData.matches.filter(m => !m.isNewContact).map(m => m.prospeccao.id);
    if (existing.length > 0) {
      setSelectedIds(existing);
    } else {
      setSelectedIds(multiData.matches.map(m => m.prospeccao.id));
    }
  }, [isOpen, multiData]);

  if (!isMulti && !data) return null;
  if (isMulti && !multiData) return null;

  const nomeTrim = nomeVisitante.trim();

  // ===== Multi: derivações =====
  const selectedMatches = isMulti
    ? multiData!.matches.filter(m => selectedIds.includes(m.prospeccao.id))
    : [];
  const hasSelectedNew = selectedMatches.some(m => m.isNewContact);
  const multiConfirmDisabled =
    loading ||
    selectedMatches.length === 0 ||
    (hasSelectedNew && !nomeTrim);

  const singleConfirmDisabled =
    !!data && (loading || (data.isNewContact && !nomeTrim));

  const confirmDisabled = isMulti ? multiConfirmDisabled : singleConfirmDisabled;

  const toggleId = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConfirmClick = () => {
    if (isMulti) {
      onConfirmMulti?.(selectedIds, hasSelectedNew ? nomeTrim : undefined);
    } else if (data) {
      onConfirm?.(data.isNewContact ? nomeTrim : undefined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[480px] p-4 sm:p-6 rounded-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Confirmar Check-in
          </DialogTitle>
          <DialogDescription>
            {isMulti
              ? (multiData!.hasAnyExisting
                  ? "Visitante encontrado em prospecções ativas"
                  : "Visitante novo — selecione em quais prospecções registrar")
              : (data!.isNewContact
                  ? "Novo visitante será registrado no sistema"
                  : "Visitante encontrado no sistema")}
          </DialogDescription>
        </DialogHeader>

        {isMulti ? (
          <div className="space-y-4 py-4">
            {/* Telefone destacado */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium">{multiData!.telefone}</p>
              </div>
            </div>

            {/* Campo de nome — exige se houver pelo menos uma seleção "novo" */}
            {hasSelectedNew && (
              <div className="space-y-2">
                <Label htmlFor="nome-visitante-multi">
                  Nome do visitante <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome-visitante-multi"
                  value={nomeVisitante}
                  onChange={(e) => setNomeVisitante(e.target.value)}
                  placeholder="Digite o nome completo"
                  autoFocus
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Será usado para criar o contato nas prospecções selecionadas em que ele ainda não existe.
                </p>
              </div>
            )}

            {/* Lista de prospecções */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Prospecções ativas ({multiData!.matches.length})
              </Label>
              <div className="space-y-2">
                {multiData!.matches.map((m) => {
                  const checked = selectedIds.includes(m.prospeccao.id);
                  const dataFim = m.prospeccao.data_fim ? new Date(m.prospeccao.data_fim) : null;
                  const isEncerrado = !!dataFim && dataFim.getTime() < Date.now();
                  return (
                    <label
                      key={m.prospeccao.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleId(m.prospeccao.id)}
                        disabled={loading}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm break-words">
                          {m.prospeccao.titulo}
                          {isEncerrado && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              (encerrado)
                            </span>
                          )}
                        </p>
                        {m.isNewContact ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 shrink-0" /> Novo visitante nesta prospecção
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 min-w-0">
                            <User className="w-3 h-3 shrink-0" /> <span className="truncate">{m.contatoNome}</span>
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
        <div className="space-y-4 py-4">
          {/* Badge de novo visitante */}
          {data!.isNewContact && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
              <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                Novo Visitante
              </span>
            </div>
          )}

          {/* Campo de nome para visitante novo */}
          {data!.isNewContact && (
            <div className="space-y-2">
              <Label htmlFor="nome-visitante">
                Nome do visitante <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome-visitante"
                value={nomeVisitante}
                onChange={(e) => setNomeVisitante(e.target.value)}
                placeholder="Digite o nome completo"
                autoFocus
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !confirmDisabled) {
                    e.preventDefault();
                    onConfirm?.(nomeTrim);
                  }
                }}
              />
            </div>
          )}

          {/* Dados do visitante */}
          <div className="space-y-3 bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="font-medium">
                  {data!.isNewContact ? (nomeTrim || "—") : data!.nome}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium">{data!.telefone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Evento</p>
                <p className="font-medium">{data!.evento}</p>
              </div>
            </div>
          </div>
        </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 w-full">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onClose} 
            disabled={loading}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmClick}
            disabled={confirmDisabled}
            className="w-full sm:w-auto order-1 sm:order-2 gap-2 whitespace-normal text-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {isMulti
                  ? `Confirmar em ${selectedMatches.length} evento${selectedMatches.length === 1 ? "" : "s"}`
                  : "Confirmar Check-in"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
