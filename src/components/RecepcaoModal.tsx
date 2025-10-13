import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/contexts/CompanyContext";
import { NovaVisita } from "@/hooks/useRecepcaoData";

interface RecepcaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (visita: NovaVisita) => Promise<void>;
  initialData?: {
    nome_cliente?: string;
    telefone_cliente?: string;
    nome_campanha?: string;
    empresa_id?: string;
  };
}

export const RecepcaoModal = ({ isOpen, onClose, onSave, initialData }: RecepcaoModalProps) => {
  const { activeCompany } = useCompany();
  const [formData, setFormData] = useState({
    nome_cliente: "",
    telefone_cliente: "",
    nome_campanha: "",
    empresa_id: activeCompany?.id || "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome_cliente: initialData.nome_cliente || "",
        telefone_cliente: initialData.telefone_cliente || "",
        nome_campanha: initialData.nome_campanha || "",
        empresa_id: initialData.empresa_id || activeCompany?.id || "",
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar Visita na Recepção</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome_cliente">Nome do Cliente *</Label>
              <Input
                id="nome_cliente"
                value={formData.nome_cliente}
                onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
                placeholder="Digite o nome do cliente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone_cliente">Telefone do Cliente *</Label>
              <Input
                id="telefone_cliente"
                value={formData.telefone_cliente}
                onChange={(e) => setFormData({ ...formData, telefone_cliente: e.target.value })}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome_campanha">Nome da Campanha *</Label>
              <Input
                id="nome_campanha"
                value={formData.nome_campanha}
                onChange={(e) => setFormData({ ...formData, nome_campanha: e.target.value })}
                placeholder="Digite o nome da campanha"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="empresa_id">ID da Empresa *</Label>
              <Input
                id="empresa_id"
                value={formData.empresa_id}
                onChange={(e) => setFormData({ ...formData, empresa_id: e.target.value })}
                placeholder="ID da empresa"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
