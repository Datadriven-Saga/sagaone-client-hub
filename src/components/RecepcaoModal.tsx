import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { MultiCheckinData, Prospeccao } from "@/hooks/useRecepcaoData";
import { UserPlus, Loader2, Search } from "lucide-react";

interface RecepcaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (telefone: string) => Promise<MultiCheckinData | null>;
  prospeccoes?: Prospeccao[]; // mantido por compat, não usado
}

// Máscara de telefone
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const RecepcaoModal = ({ isOpen, onClose, onSearch }: RecepcaoModalProps) => {
  const { activeCompany } = useCompany();
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTelefone("");
    }
  }, [isOpen]);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setTelefone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const digitsOnly = telefone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return;
    }

    setLoading(true);
    try {
      await onSearch(digitsOnly);
      onClose();
    } catch (error) {
      console.error("Erro ao buscar contato:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="w-5 h-5 text-primary" />
            Registrar Visita
          </DialogTitle>
          <DialogDescription>
            Informe o telefone — o sistema identifica automaticamente as prospecções ativas
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="telefone" className="text-sm font-medium">
                Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={handleTelefoneChange}
                placeholder="(00) 00000-0000"
                className="h-11"
                required
                maxLength={16}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                O sistema buscará o contato em todas as prospecções ativas no momento
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
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
              type="submit" 
              disabled={loading || telefone.replace(/\D/g, '').length < 10}
              className="w-full sm:w-auto order-1 sm:order-2 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Buscar e Registrar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
