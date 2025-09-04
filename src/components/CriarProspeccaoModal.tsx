import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CriarProspeccaoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProspeccaoCriada: () => void;
  editingProspeccao?: any;
}

export const CriarProspeccaoModal = ({ isOpen, onOpenChange, onProspeccaoCriada, editingProspeccao }: CriarProspeccaoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [localEvento, setLocalEvento] = useState("");
  const [condicoesEspeciais, setCondicoesEspeciais] = useState("");
  const [objetivoVendas, setObjetivoVendas] = useState("");
  const [imagemDivulgacao, setImagemDivulgacao] = useState("");
  const [canal, setCanal] = useState<'Whatsapp' | 'Ligação'>('Whatsapp');
  
  const { toast } = useToast();
  const { user } = useAuth();

  // Preencher campos quando estiver editando
  useEffect(() => {
    if (editingProspeccao && isOpen) {
      setTitulo(editingProspeccao.titulo || "");
      setDescricao(editingProspeccao.descricao || "");
      setDataInicio(editingProspeccao.data_inicio || "");
      setDataFim(editingProspeccao.data_fim || "");
      setLocalEvento(editingProspeccao.local_evento || "");
      setCondicoesEspeciais(editingProspeccao.condicoes_especiais || "");
      setObjetivoVendas(editingProspeccao.objetivo_vendas || "");
      setImagemDivulgacao(editingProspeccao.imagem_divulgacao_url || "");
      setCanal(editingProspeccao.canal || 'Whatsapp');
    } else if (!editingProspeccao && isOpen) {
      // Limpar campos quando criar nova prospecção
      clearForm();
    }
  }, [editingProspeccao, isOpen]);

  const clearForm = () => {
    setTitulo("");
    setDescricao("");
    setDataInicio("");
    setDataFim("");
    setLocalEvento("");
    setCondicoesEspeciais("");
    setObjetivoVendas("");
    setImagemDivulgacao("");
    setCanal('Whatsapp');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim()) {
      toast({
        title: "Erro",
        description: "O título é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const dadosProspeccao = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        local_evento: localEvento.trim() || null,
        condicoes_especiais: condicoesEspeciais.trim() || null,
        objetivo_vendas: objetivoVendas.trim() || null,
        imagem_divulgacao_url: imagemDivulgacao.trim() || null,
        canal: canal,
      };

      if (editingProspeccao) {
        // Editando prospecção existente
        const { data, error } = await supabase
          .from('prospeccoes')
          .update(dadosProspeccao)
          .eq('id', editingProspeccao.id)
          .select()
          .single();

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "Prospecção atualizada com sucesso!"
        });
      } else {
        // Criando nova prospecção
        // Primeiro, verificar se o usuário tem um perfil com empresa_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.empresa_id) {
          toast({
            title: "Erro de configuração",
            description: "Seu perfil não está associado a uma empresa. Entre em contato com o administrador.",
            variant: "destructive"
          });
          return;
        }

        const { data, error } = await supabase
          .from('prospeccoes')
          .insert([{
            ...dadosProspeccao,
            responsavel_id: user.id,
            empresa_id: profile.empresa_id,
            leads_gerados: 0
          }])
          .select()
          .single();

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "Prospecção criada com sucesso!"
        });
      }

      // Limpar form e fechar modal
      clearForm();
      onOpenChange(false);
      onProspeccaoCriada();

    } catch (error: any) {
      console.error('Erro ao processar prospecção:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar prospecção",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    clearForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProspeccao ? 'Editar Prospecção' : 'Nova Prospecção'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Campanha Black Friday 2024"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Descrição da campanha..."
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_inicio">Data de Início</Label>
              <Input
                id="data_inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="data_fim">Data de Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="local_evento">Local do Evento</Label>
            <Input
              id="local_evento"
              placeholder="Ex: Centro de Convenções SP"
              value={localEvento}
              onChange={(e) => setLocalEvento(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="condicoes_especiais">Condições Especiais</Label>
            <Textarea
              id="condicoes_especiais"
              placeholder="Condições especiais do evento..."
              rows={3}
              value={condicoesEspeciais}
              onChange={(e) => setCondicoesEspeciais(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="objetivo_vendas">Objetivo de Vendas</Label>
            <Input
              id="objetivo_vendas"
              placeholder="Ex: Aumentar vendas em 30%"
              value={objetivoVendas}
              onChange={(e) => setObjetivoVendas(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="canal">Canal *</Label>
            <Select value={canal} onValueChange={(value: 'Whatsapp' | 'Ligação') => setCanal(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Whatsapp">Whatsapp</SelectItem>
                <SelectItem value="Ligação">Ligação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="imagem_divulgacao">Imagem de Divulgação (Opcional)</Label>
            <Input
              id="imagem_divulgacao"
              type="url"
              placeholder="https://exemplo.com/imagem.jpg"
              value={imagemDivulgacao}
              onChange={(e) => setImagemDivulgacao(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading 
                ? (editingProspeccao ? "Salvando..." : "Criando...") 
                : (editingProspeccao ? "Salvar Alterações" : "Criar Prospecção")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};