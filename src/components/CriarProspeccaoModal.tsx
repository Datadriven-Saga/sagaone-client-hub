import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";

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
  const [canal, setCanal] = useState<'Whatsapp' | 'Ligação'>('Whatsapp');
  const [templateProspeccao, setTemplateProspeccao] = useState("");
  const [templateAgendado, setTemplateAgendado] = useState("");
  const [templateNaoAgendado, setTemplateNaoAgendado] = useState("");
  const [convite, setConvite] = useState("");
  const [imagemDivulgacao, setImagemDivulgacao] = useState("");
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCompany } = useCompany();

  // Preencher campos quando estiver editando
  useEffect(() => {
    if (editingProspeccao && isOpen) {
      setTitulo(editingProspeccao.titulo || "");
      setDescricao(editingProspeccao.descricao || "");
      setDataInicio(editingProspeccao.data_inicio || "");
      setDataFim(editingProspeccao.data_fim || "");
      setCanal(editingProspeccao.canal || 'Whatsapp');
      setTemplateProspeccao(editingProspeccao.template_prospeccao || "");
      setTemplateAgendado(editingProspeccao.template_agendado || "");
      setTemplateNaoAgendado(editingProspeccao.template_nao_agendado || "");
      setConvite((editingProspeccao as any).convite || "");
      setImagemDivulgacao(editingProspeccao.imagem_divulgacao_url || "");
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
    setCanal('Whatsapp');
    setTemplateProspeccao("");
    setTemplateAgendado("");
    setTemplateNaoAgendado("");
    setConvite("");
    setImagemDivulgacao("");
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
      const dadosProspeccao: any = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        canal: canal,
        imagem_divulgacao_url: imagemDivulgacao.trim() || null,
      };

      // Adicionar campos específicos do canal
      if (canal === 'Whatsapp') {
        dadosProspeccao.template_prospeccao = templateProspeccao.trim() || null;
        dadosProspeccao.template_agendado = templateAgendado.trim() || null;
        dadosProspeccao.template_nao_agendado = templateNaoAgendado.trim() || null;
        dadosProspeccao.convite = null;
      } else {
        dadosProspeccao.template_prospeccao = null;
        dadosProspeccao.template_agendado = null;
        dadosProspeccao.template_nao_agendado = null;
        dadosProspeccao.convite = convite.trim() || null;
      }

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

        // Chamar webhook após atualização
        await callWebhook(data);

        toast({
          title: "Sucesso",
          description: "Prospecção atualizada com sucesso!"
        });
      } else {
        // Criando nova prospecção
        if (!activeCompany?.id) {
          toast({
            title: "Erro de configuração",
            description: "Nenhuma empresa ativa selecionada. Selecione uma empresa.",
            variant: "destructive"
          });
          return;
        }

        const { data, error } = await supabase
          .from('prospeccoes')
          .insert([{
            ...dadosProspeccao,
            responsavel_id: user.id,
            empresa_id: activeCompany.id,
            leads_gerados: 0
          }])
          .select()
          .single();

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }

        // Chamar webhook após criação
        await callWebhook(data);

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

  const callWebhook = async (prospeccaoData: any) => {
    try {
      // Buscar dados da empresa para pegar o crm_id e telefone da Pri
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('crm_id')
        .eq('id', activeCompany?.id)
        .single();

      // Buscar telefone do agente IA (Pri) da empresa
      const { data: agenteData } = await supabase
        .from('agentes_ia')
        .select('telefone')
        .eq('empresa_id', activeCompany?.id)
        .eq('nome', 'Pri')
        .single();

      // Formatar telefone: remover +55 e o 9 adicional, deixar apenas DD + número
      const formatarTelefone = (telefone: string) => {
        if (!telefone) return "";
        // Remove todos os caracteres não numéricos
        const numeros = telefone.replace(/\D/g, '');
        // Remove o código do país (55) se existir
        let telefoneFormatado = numeros.startsWith('55') ? numeros.substring(2) : numeros;
        // Se tiver 11 dígitos (DD + 9 + 8 dígitos), remove o 9
        if (telefoneFormatado.length === 11) {
          telefoneFormatado = telefoneFormatado.substring(0, 2) + telefoneFormatado.substring(3);
        }
        return telefoneFormatado;
      };

      // Formatar data para ISO 8601
      const formatarDataISO = (data: string) => {
        if (!data) return "";
        // Converte YYYY-MM-DD para ISO 8601
        return new Date(data + 'T11:00:00.000Z').toISOString();
      };

      const webhookPayload = {
        maia_id: formatarTelefone(agenteData?.telefone || ""),
        nome_evento: prospeccaoData.titulo || "",
        data_inicio: formatarDataISO(prospeccaoData.data_inicio || ""),
        data_fim: formatarDataISO(prospeccaoData.data_fim || ""),
        descricao: prospeccaoData.descricao || "",
        dealerid: empresaData?.crm_id || "",
        template_descoberta: prospeccaoData.template_prospeccao || "",
        template_conf_agendado: prospeccaoData.template_agendado || "",
        template_conf_nao_agendado: prospeccaoData.template_nao_agendado || ""
      };

      console.log('📤 Enviando webhook:', webhookPayload);

      const response = await fetch('https://automatemaiawh.sagadatadriven.com.br/webhook/pri-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        console.error('Erro na resposta do webhook:', response.status);
      } else {
        console.log('✅ Webhook enviado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao enviar webhook:', error);
      // Não mostramos erro ao usuário para não interromper o fluxo
    }
  };

  const aplicarModeloDescricao = () => {
    const modeloDescricao = `🔥 Noite RAM na Saga BR-153!
Potência, exclusividade e oportunidades imperdíveis. 🚗💨

Chegou o momento que todo apaixonado por RAM esperava!
A Saga RAM BR-153 convida você para uma noite exclusiva de vendas, com atendimento VIP e condições únicas válidas apenas neste evento especial.

🌙 Evento noturno exclusivo
🛞 Chassis selecionados com preços imperdíveis
🤝 Atendimento personalizado com o gerente
🚗 Oportunidades disponíveis só no dia

🗓️ 28 de outubro, a partir das 18h
📍 Saga RAM BR-153

Viva uma experiência premium, com atendimento prioritário e condições feitas sob medida para quem valoriza potência e sofisticação.
Garanta sua presença e não perca essa oportunidade única de sair de RAM nova!

A PRI deve apenas convidar, confirmar interesse, e confirmar o endereço da loja.
Ela não deve falar sobre valores, taxas, entrada, financiamento, simulações ou detalhes técnicos de veículos.`;
    
    setDescricao(modeloDescricao);
    toast({
      title: "Modelo aplicado",
      description: "Descrição padrão foi inserida no campo"
    });
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
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={aplicarModeloDescricao}
              >
                <FileText className="h-3 w-3 mr-1" />
                Aplicar modelo
              </Button>
            </div>
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

          {canal === 'Whatsapp' && (
            <>
              <div>
                <Label htmlFor="template_prospeccao">Template Prospecção</Label>
                <Textarea
                  id="template_prospeccao"
                  placeholder="Mensagem de prospecção (máx. 120 caracteres)"
                  rows={2}
                  maxLength={120}
                  value={templateProspeccao}
                  onChange={(e) => setTemplateProspeccao(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {templateProspeccao.length}/120 caracteres
                </p>
              </div>

              <div>
                <Label htmlFor="template_agendado">Template Agendado</Label>
                <Textarea
                  id="template_agendado"
                  placeholder="Mensagem para agendamentos (máx. 120 caracteres)"
                  rows={2}
                  maxLength={120}
                  value={templateAgendado}
                  onChange={(e) => setTemplateAgendado(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {templateAgendado.length}/120 caracteres
                </p>
              </div>

              <div>
                <Label htmlFor="template_nao_agendado">Template Não Agendado</Label>
                <Textarea
                  id="template_nao_agendado"
                  placeholder="Mensagem para não agendamentos (máx. 120 caracteres)"
                  rows={2}
                  maxLength={120}
                  value={templateNaoAgendado}
                  onChange={(e) => setTemplateNaoAgendado(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {templateNaoAgendado.length}/120 caracteres
                </p>
              </div>
            </>
          )}

          {canal === 'Ligação' && (
            <div>
              <Label htmlFor="convite">Convite</Label>
              <Input
                id="convite"
                placeholder="Nome do convite para campanhas de ligação"
                value={convite}
                onChange={(e) => setConvite(e.target.value)}
              />
            </div>
          )}

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