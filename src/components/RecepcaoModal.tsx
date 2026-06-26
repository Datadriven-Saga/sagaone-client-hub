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
  onSearch: (input: string) => Promise<MultiCheckinData | null>;
  prospeccoes?: Prospeccao[]; // mantido por compat, não usado
}

// Máscara de telefone — aplicada apenas quando o usuário digita 5+ dígitos.
// Com 1-4 dígitos puros, mantemos sem máscara (busca por sufixo).
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
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
    // Aceita: 4 dígitos (sufixo) OU telefone completo (10-11)
    if (digitsOnly.length !== 4 && digitsOnly.length < 10) {
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

  const digits = telefone.replace(/\D/g, '');
  const isValid = digits.length === 4 || digits.length >= 10;
  const modoBusca: 'sufixo' | 'completo' | null =
    digits.length === 4 ? 'sufixo' : digits.length >= 10 ? 'completo' : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="w-5 h-5 text-primary" />
            Registrar Visita
          </DialogTitle>
          <DialogDescription>
            Informe o telefone completo ou apenas os 4 últimos dígitos do celular
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="telefone" className="text-sm font-medium">
                Telefone ou 4 últimos dígitos <span className="text-destructive">*</span>
              </Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={handleTelefoneChange}
                placeholder="(00) 00000-0000 ou 1234"
                className="h-11"
                required
                maxLength={16}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {modoBusca === 'sufixo' && '🔎 Buscando pelos 4 últimos dígitos — escolha o contato na próxima tela.'}
                {modoBusca === 'completo' && '🔎 Busca por telefone completo nas prospecções ativas.'}
                {!modoBusca && 'Use o telefone completo ou apenas os 4 últimos dígitos do celular.'}
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
              disabled={loading || !isValid}
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
