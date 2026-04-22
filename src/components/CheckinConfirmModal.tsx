import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, User, Phone, Calendar, Loader2 } from "lucide-react";

interface CheckinConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (nomeVisitante?: string) => Promise<void>;
  data: {
    nome: string;
    telefone: string;
    evento: string;
    isNewContact: boolean;
  } | null;
  loading?: boolean;
}

export function CheckinConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  data,
  loading = false 
}: CheckinConfirmModalProps) {
  const [nomeVisitante, setNomeVisitante] = useState("");

  // Pré-preencher quando vier nome via deep link / QR (algo diferente do placeholder padrão)
  useEffect(() => {
    if (!isOpen) {
      setNomeVisitante("");
      return;
    }
    if (data?.isNewContact) {
      const placeholder = !data.nome || data.nome === "Novo Visitante" || data.nome === "Visitante";
      setNomeVisitante(placeholder ? "" : data.nome);
    }
  }, [isOpen, data?.isNewContact, data?.nome]);

  if (!data) return null;

  const nomeTrim = nomeVisitante.trim();
  const confirmDisabled = loading || (data.isNewContact && !nomeTrim);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Confirmar Check-in
          </DialogTitle>
          <DialogDescription>
            {data.isNewContact 
              ? "Novo visitante será registrado no sistema"
              : "Visitante encontrado no sistema"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Badge de novo visitante */}
          {data.isNewContact && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
              <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                Novo Visitante
              </span>
            </div>
          )}

          {/* Campo de nome para visitante novo */}
          {data.isNewContact && (
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
                    onConfirm(nomeTrim);
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
                  {data.isNewContact ? (nomeTrim || "—") : data.nome}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium">{data.telefone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Evento</p>
                <p className="font-medium">{data.evento}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
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
            onClick={() => onConfirm(data.isNewContact ? nomeTrim : undefined)}
            disabled={confirmDisabled}
            className="w-full sm:w-auto order-1 sm:order-2 gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Check-in
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
