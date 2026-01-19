import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";
import { Prospeccao, CheckinData } from "@/hooks/useRecepcaoData";
import { UserPlus, Loader2, Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecepcaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (telefone: string, eventoId: string) => Promise<CheckinData | null>;
  prospeccoes: Prospeccao[];
}

// Máscara de telefone
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const RecepcaoModal = ({ isOpen, onClose, onSearch, prospeccoes }: RecepcaoModalProps) => {
  const { activeCompany } = useCompany();
  const [telefone, setTelefone] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTelefone("");
      setEventoId("");
    }
  }, [isOpen]);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setTelefone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const digitsOnly = telefone.replace(/\D/g, '');
    if (digitsOnly.length < 10 || !eventoId) {
      return;
    }

    setLoading(true);
    try {
      await onSearch(digitsOnly, eventoId);
      onClose();
    } catch (error) {
      console.error("Erro ao buscar contato:", error);
    } finally {
      setLoading(false);
    }
  };

  // Formatar data do evento para exibição
  const formatEventDate = (dataInicio: string | null, dataFim: string | null): string => {
    if (!dataInicio) return "";
    try {
      const inicio = format(new Date(dataInicio), "dd/MM", { locale: ptBR });
      if (dataFim) {
        const fim = format(new Date(dataFim), "dd/MM", { locale: ptBR });
        return `${inicio} - ${fim}`;
      }
      return inicio;
    } catch {
      return "";
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
            Selecione o evento e informe o telefone do visitante
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {/* Seleção de Evento */}
            <div className="space-y-2">
              <Label htmlFor="evento" className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Evento / Prospecção <span className="text-destructive">*</span>
              </Label>
              <Select value={eventoId} onValueChange={setEventoId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {prospeccoes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum evento encontrado
                    </div>
                  ) : (
                    prospeccoes.map((prospeccao) => (
                      <SelectItem key={prospeccao.id} value={prospeccao.id}>
                        <div className="flex flex-col">
                          <span>{prospeccao.titulo}</span>
                          {prospeccao.data_inicio && (
                            <span className="text-xs text-muted-foreground">
                              {formatEventDate(prospeccao.data_inicio, prospeccao.data_fim)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

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
              />
              <p className="text-xs text-muted-foreground">
                O sistema buscará o contato pelo telefone no evento selecionado
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
              disabled={loading || telefone.replace(/\D/g, '').length < 10 || !eventoId}
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
