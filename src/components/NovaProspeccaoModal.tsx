import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NovaProspeccaoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProspeccaoCriada: () => void;
}

export const NovaProspeccaoModal = ({ isOpen, onOpenChange, onProspeccaoCriada }: NovaProspeccaoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    data_inicio: "",
    data_fim: "",
    meta_leads: ""
  });
  
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo.trim()) {
      toast({
        title: "Erro",
        description: "O título da prospecção é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const prospeccaoData = {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null,
        meta_leads: formData.meta_leads ? parseInt(formData.meta_leads) : null,
        leads_gerados: 0,
        responsavel_id: user?.id,
        empresa_id: user?.user_metadata?.empresa_id || null
      };

      const { data, error } = await supabase
        .from('prospeccoes')
        .insert([prospeccaoData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Prospecção criada com sucesso!"
      });

      // Resetar form
      setFormData({
        titulo: "",
        descricao: "",
        data_inicio: "",
        data_fim: "",
        meta_leads: ""
      });

      onOpenChange(false);
      onProspeccaoCriada();

    } catch (error) {
      console.error('Erro ao criar prospecção:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a prospecção",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      titulo: "",
      descricao: "",
      data_inicio: "",
      data_fim: "",
      meta_leads: ""
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Prospecção</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Campanha Black Friday 2024"
              value={formData.titulo}
              onChange={(e) => setFormData({...formData, titulo: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Descrição da campanha..."
              rows={3}
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_inicio">Data de Início</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="data_fim">Data de Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="meta_leads">Meta de Leads</Label>
            <Input
              id="meta_leads"
              type="number"
              placeholder="Ex: 1000"
              min="0"
              value={formData.meta_leads}
              onChange={(e) => setFormData({...formData, meta_leads: e.target.value})}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Prospecção"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};