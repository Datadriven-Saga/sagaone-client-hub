import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { NovaVisita } from "@/hooks/useRecepcaoData";
import { UserPlus, Loader2 } from "lucide-react";

interface RecepcaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (visita: NovaVisita) => Promise<void>;
  initialData?: {
    nome_cliente?: string;
    telefone_cliente?: string;
    nome_campanha?: string;
    empresa_id?: string;
    id_maia?: string;
  } | null;
}

export const RecepcaoModal = ({ isOpen, onClose, onSave, initialData }: RecepcaoModalProps) => {
  const { activeCompany } = useCompany();
  const [formData, setFormData] = useState({
    nome_cliente: "",
    telefone_cliente: "",
    nome_campanha: "",
    empresa_id: activeCompany?.id || "",
    id_maia: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome_cliente: initialData.nome_cliente || "",
        telefone_cliente: initialData.telefone_cliente || "",
        nome_campanha: initialData.nome_campanha || "",
        empresa_id: initialData.empresa_id || activeCompany?.id || "",
        id_maia: initialData.id_maia || "",
      });
    } else if (activeCompany) {
      setFormData(prev => ({ ...prev, empresa_id: activeCompany.id }));
    }
  }, [initialData, activeCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_cliente || !formData.telefone_cliente || !formData.nome_campanha || !formData.empresa_id) {
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      setFormData({
        nome_cliente: "",
        telefone_cliente: "",
        nome_campanha: "",
        empresa_id: activeCompany?.id || "",
        id_maia: "",
      });
      
      // Recarregar a página para atualizar o Kanban
      window.location.reload();
    } catch (error) {
      console.error("Erro ao salvar visita:", error);
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
            Preencha os dados do cliente para registrar a visita
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome_cliente" className="text-sm font-medium">
                Nome do Cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome_cliente"
                value={formData.nome_cliente}
                onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
                placeholder="Digite o nome completo"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone_cliente" className="text-sm font-medium">
                Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="telefone_cliente"
                value={formData.telefone_cliente}
                onChange={(e) => setFormData({ ...formData, telefone_cliente: e.target.value })}
                placeholder="(00) 00000-0000"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_campanha" className="text-sm font-medium">
                Campanha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome_campanha"
                value={formData.nome_campanha}
                onChange={(e) => setFormData({ ...formData, nome_campanha: e.target.value })}
                placeholder="Nome do evento ou campanha"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_maia" className="text-sm font-medium">
                ID Maia <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                id="id_maia"
                value={formData.id_maia}
                onChange={(e) => setFormData({ ...formData, id_maia: e.target.value })}
                placeholder="Identificador no sistema Maia"
                className="h-11"
              />
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
              disabled={loading}
              className="w-full sm:w-auto order-1 sm:order-2 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Registrar Visita"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
