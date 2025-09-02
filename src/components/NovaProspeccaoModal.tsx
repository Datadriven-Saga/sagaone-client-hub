import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NovaProspeccaoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProspeccaoCriada: () => void;
  criarProspeccao: (dados: {
    titulo: string;
    descricao?: string;
    data_inicio?: string;
    data_fim?: string;
    local_evento?: string;
    condicoes_especiais?: string;
    objetivo_vendas?: string;
    imagem_divulgacao_url?: string;
  }) => Promise<any>;
}

export const NovaProspeccaoModal = ({ isOpen, onOpenChange, onProspeccaoCriada, criarProspeccao }: NovaProspeccaoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    data_inicio: "",
    data_fim: "",
    local_evento: "",
    condicoes_especiais: "",
    objetivo_vendas: "",
    imagem_divulgacao_url: ""
  });
  
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit called');
    
    if (!formData.titulo.trim()) {
      toast({
        title: "Erro",
        description: "O título da prospecção é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    console.log('Starting submission with data:', formData);
    
    try {
      const dadosProspeccao = {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || undefined,
        data_inicio: formData.data_inicio || undefined,
        data_fim: formData.data_fim || undefined,
        local_evento: formData.local_evento.trim() || undefined,
        condicoes_especiais: formData.condicoes_especiais.trim() || undefined,
        objetivo_vendas: formData.objetivo_vendas.trim() || undefined,
        imagem_divulgacao_url: formData.imagem_divulgacao_url.trim() || undefined
      };

      console.log('Calling criarProspeccao with:', dadosProspeccao);

      await criarProspeccao(dadosProspeccao);

      console.log('Prospecção criada com sucesso');

      // Resetar form
      setFormData({
        titulo: "",
        descricao: "",
        data_inicio: "",
        data_fim: "",
        local_evento: "",
        condicoes_especiais: "",
        objetivo_vendas: "",
        imagem_divulgacao_url: ""
      });

      onOpenChange(false);
      onProspeccaoCriada();

    } catch (error) {
      console.error('Erro no handleSubmit:', error);
      // O toast já é mostrado pela função criarProspeccao
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
      local_evento: "",
      condicoes_especiais: "",
      objetivo_vendas: "",
      imagem_divulgacao_url: ""
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Prospecção</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
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
            <Label htmlFor="local_evento">Local do Evento</Label>
            <Input
              id="local_evento"
              placeholder="Ex: Centro de Convenções SP"
              value={formData.local_evento}
              onChange={(e) => setFormData({...formData, local_evento: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="condicoes_especiais">Condições Especiais</Label>
            <Textarea
              id="condicoes_especiais"
              placeholder="Condições especiais do evento..."
              rows={3}
              value={formData.condicoes_especiais}
              onChange={(e) => setFormData({...formData, condicoes_especiais: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="objetivo_vendas">Objetivo de Vendas</Label>
            <Input
              id="objetivo_vendas"
              placeholder="Ex: Aumentar vendas em 30%"
              value={formData.objetivo_vendas}
              onChange={(e) => setFormData({...formData, objetivo_vendas: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="imagem_divulgacao_url">Imagem de Divulgação (Opcional)</Label>
            <Input
              id="imagem_divulgacao_url"
              type="url"
              placeholder="https://exemplo.com/imagem.jpg"
              value={formData.imagem_divulgacao_url}
              onChange={(e) => setFormData({...formData, imagem_divulgacao_url: e.target.value})}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
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