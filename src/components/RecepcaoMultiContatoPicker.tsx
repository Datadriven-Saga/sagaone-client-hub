import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Phone, Search } from "lucide-react";
import type { ContatoSufixoMatch } from "@/hooks/useRecepcaoData";
import { formatPhoneForDisplay } from "@/lib/phoneUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sufixo: string;
  contatos: ContatoSufixoMatch[];
  onSelect: (contato: ContatoSufixoMatch) => void;
}

// Mascara um telefone preservando apenas os 4 últimos dígitos.
const maskPhone = (phone: string, last4: string): string => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return `(**) *****-${last4}`;
  // Mostra DDD + último bloco
  const ddd = digits.slice(0, 2);
  return `(${ddd}) *****-${last4}`;
};

export function RecepcaoMultiContatoPicker({ isOpen, onClose, sufixo, contatos, onSelect }: Props) {
  const isEmpty = contatos.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[520px] p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Search className="w-5 h-5 text-primary" />
            Contatos com final {sufixo}
          </DialogTitle>
          <DialogDescription>
            {isEmpty
              ? "Nenhum contato encontrado com esses 4 últimos dígitos."
              : `Encontramos ${contatos.length} contato(s). Selecione qual fará o check-in.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto space-y-2 py-2">
          {contatos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted transition-colors p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium truncate">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{c.nome || "Sem nome"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Phone className="w-3 h-3" />
                  <span>{maskPhone(c.telefone, sufixo)}</span>
                  {c.status && <span className="ml-2 px-1.5 py-0.5 rounded bg-muted">{c.status}</span>}
                </div>
              </div>
              <span className="text-xs text-primary font-medium shrink-0">Selecionar</span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}