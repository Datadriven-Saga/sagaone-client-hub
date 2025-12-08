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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Target, Users, MapPin, ThumbsUp, Phone, Info, Trophy, Award, Gift, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CriarProspeccaoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProspeccaoCriada: () => void;
  editingProspeccao?: any;
}

export const CriarProspeccaoModal = ({ isOpen, onOpenChange, onProspeccaoCriada, editingProspeccao }: CriarProspeccaoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados-gerais");
  
  // Dados Gerais
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
  
  // Metas
  const [metaNovos, setMetaNovos] = useState<number | "">("");
  const [metaSeminovos, setMetaSeminovos] = useState<number | "">("");
  const [metaDiretas, setMetaDiretas] = useState<number | "">("");
  const [metaCheckins, setMetaCheckins] = useState<number | "">("");
  const [metaConfirmacoes, setMetaConfirmacoes] = useState<number | "">("");
  const [metaConvites, setMetaConvites] = useState<number | "">("");
  const [tamanhoBase, setTamanhoBase] = useState<number>(0);
  
  // Premiações - Estado com ativo/valor
  const [premiacoes, setPremiacoes] = useState<Record<string, { ativo: boolean; valor: number | "" }>>({
    equipe_campea: { ativo: false, valor: "" },
    equipe_2lugar: { ativo: false, valor: "" },
    equipe_3lugar: { ativo: false, valor: "" },
    vendedor_ouro: { ativo: false, valor: "" },
    vendedor_prata: { ativo: false, valor: "" },
    vendedor_bronze: { ativo: false, valor: "" },
    prospector_ouro: { ativo: false, valor: "" },
    prospector_prata: { ativo: false, valor: "" },
    prospector_bronze: { ativo: false, valor: "" },
    checkin_ouro: { ativo: false, valor: "" },
    checkin_prata: { ativo: false, valor: "" },
    checkin_bronze: { ativo: false, valor: "" },
    participacao_apoio: { ativo: false, valor: "" },
    indicacao_venda: { ativo: false, valor: "" },
  });
  
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
      
      // Metas
      setMetaNovos(editingProspeccao.meta_novos ?? "");
      setMetaSeminovos(editingProspeccao.meta_seminovos ?? "");
      setMetaDiretas(editingProspeccao.meta_diretas ?? "");
      setMetaCheckins(editingProspeccao.meta_checkins ?? "");
      setMetaConfirmacoes(editingProspeccao.meta_confirmacoes ?? "");
      setMetaConvites(editingProspeccao.meta_convites ?? "");
      
      // Premiações
      setPremiacoes({
        equipe_campea: { ativo: !!editingProspeccao.premio_equipe_campea, valor: editingProspeccao.premio_equipe_campea ?? "" },
        equipe_2lugar: { ativo: !!editingProspeccao.premio_equipe_2lugar, valor: editingProspeccao.premio_equipe_2lugar ?? "" },
        equipe_3lugar: { ativo: !!editingProspeccao.premio_equipe_3lugar, valor: editingProspeccao.premio_equipe_3lugar ?? "" },
        vendedor_ouro: { ativo: !!editingProspeccao.premio_vendedor_ouro, valor: editingProspeccao.premio_vendedor_ouro ?? "" },
        vendedor_prata: { ativo: !!editingProspeccao.premio_vendedor_prata, valor: editingProspeccao.premio_vendedor_prata ?? "" },
        vendedor_bronze: { ativo: !!editingProspeccao.premio_vendedor_bronze, valor: editingProspeccao.premio_vendedor_bronze ?? "" },
        prospector_ouro: { ativo: !!editingProspeccao.premio_prospector_ouro, valor: editingProspeccao.premio_prospector_ouro ?? "" },
        prospector_prata: { ativo: !!editingProspeccao.premio_prospector_prata, valor: editingProspeccao.premio_prospector_prata ?? "" },
        prospector_bronze: { ativo: !!editingProspeccao.premio_prospector_bronze, valor: editingProspeccao.premio_prospector_bronze ?? "" },
        checkin_ouro: { ativo: !!editingProspeccao.premio_checkin_ouro, valor: editingProspeccao.premio_checkin_ouro ?? "" },
        checkin_prata: { ativo: !!editingProspeccao.premio_checkin_prata, valor: editingProspeccao.premio_checkin_prata ?? "" },
        checkin_bronze: { ativo: !!editingProspeccao.premio_checkin_bronze, valor: editingProspeccao.premio_checkin_bronze ?? "" },
        participacao_apoio: { ativo: !!editingProspeccao.premio_participacao_apoio, valor: editingProspeccao.premio_participacao_apoio ?? "" },
        indicacao_venda: { ativo: !!editingProspeccao.premio_indicacao_venda, valor: editingProspeccao.premio_indicacao_venda ?? "" },
      });
    } else if (!editingProspeccao && isOpen) {
      // Limpar campos quando criar nova prospecção
      clearForm();
    }
  }, [editingProspeccao, isOpen]);

  // Buscar tamanho da base quando editando
  useEffect(() => {
    const fetchTamanhoBase = async () => {
      if (editingProspeccao?.id && activeCompany?.id) {
        const { count } = await supabase
          .from('contatos')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', activeCompany.id);
        
        setTamanhoBase(count || 0);
      }
    };
    
    if (isOpen && editingProspeccao) {
      fetchTamanhoBase();
    }
  }, [editingProspeccao, activeCompany?.id, isOpen]);

  // Reset aba ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab("dados-gerais");
    }
  }, [isOpen]);

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
    setMetaNovos("");
    setMetaSeminovos("");
    setMetaDiretas("");
    setMetaCheckins("");
    setMetaConfirmacoes("");
    setMetaConvites("");
    setTamanhoBase(0);
    setPremiacoes({
      equipe_campea: { ativo: false, valor: "" },
      equipe_2lugar: { ativo: false, valor: "" },
      equipe_3lugar: { ativo: false, valor: "" },
      vendedor_ouro: { ativo: false, valor: "" },
      vendedor_prata: { ativo: false, valor: "" },
      vendedor_bronze: { ativo: false, valor: "" },
      prospector_ouro: { ativo: false, valor: "" },
      prospector_prata: { ativo: false, valor: "" },
      prospector_bronze: { ativo: false, valor: "" },
      checkin_ouro: { ativo: false, valor: "" },
      checkin_prata: { ativo: false, valor: "" },
      checkin_bronze: { ativo: false, valor: "" },
      participacao_apoio: { ativo: false, valor: "" },
      indicacao_venda: { ativo: false, valor: "" },
    });
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
        meta_novos: metaNovos === "" ? null : metaNovos,
        meta_seminovos: metaSeminovos === "" ? null : metaSeminovos,
        meta_diretas: metaDiretas === "" ? null : metaDiretas,
        meta_checkins: metaCheckins === "" ? null : metaCheckins,
        meta_confirmacoes: metaConfirmacoes === "" ? null : metaConfirmacoes,
        meta_convites: metaConvites === "" ? null : metaConvites,
        // Premiações
        premio_equipe_campea: premiacoes.equipe_campea.ativo && premiacoes.equipe_campea.valor !== "" ? Number(premiacoes.equipe_campea.valor) : null,
        premio_equipe_2lugar: premiacoes.equipe_2lugar.ativo && premiacoes.equipe_2lugar.valor !== "" ? Number(premiacoes.equipe_2lugar.valor) : null,
        premio_equipe_3lugar: premiacoes.equipe_3lugar.ativo && premiacoes.equipe_3lugar.valor !== "" ? Number(premiacoes.equipe_3lugar.valor) : null,
        premio_vendedor_ouro: premiacoes.vendedor_ouro.ativo && premiacoes.vendedor_ouro.valor !== "" ? Number(premiacoes.vendedor_ouro.valor) : null,
        premio_vendedor_prata: premiacoes.vendedor_prata.ativo && premiacoes.vendedor_prata.valor !== "" ? Number(premiacoes.vendedor_prata.valor) : null,
        premio_vendedor_bronze: premiacoes.vendedor_bronze.ativo && premiacoes.vendedor_bronze.valor !== "" ? Number(premiacoes.vendedor_bronze.valor) : null,
        premio_prospector_ouro: premiacoes.prospector_ouro.ativo && premiacoes.prospector_ouro.valor !== "" ? Number(premiacoes.prospector_ouro.valor) : null,
        premio_prospector_prata: premiacoes.prospector_prata.ativo && premiacoes.prospector_prata.valor !== "" ? Number(premiacoes.prospector_prata.valor) : null,
        premio_prospector_bronze: premiacoes.prospector_bronze.ativo && premiacoes.prospector_bronze.valor !== "" ? Number(premiacoes.prospector_bronze.valor) : null,
        premio_checkin_ouro: premiacoes.checkin_ouro.ativo && premiacoes.checkin_ouro.valor !== "" ? Number(premiacoes.checkin_ouro.valor) : null,
        premio_checkin_prata: premiacoes.checkin_prata.ativo && premiacoes.checkin_prata.valor !== "" ? Number(premiacoes.checkin_prata.valor) : null,
        premio_checkin_bronze: premiacoes.checkin_bronze.ativo && premiacoes.checkin_bronze.valor !== "" ? Number(premiacoes.checkin_bronze.valor) : null,
        premio_participacao_apoio: premiacoes.participacao_apoio.ativo && premiacoes.participacao_apoio.valor !== "" ? Number(premiacoes.participacao_apoio.valor) : null,
        premio_indicacao_venda: premiacoes.indicacao_venda.ativo && premiacoes.indicacao_venda.valor !== "" ? Number(premiacoes.indicacao_venda.valor) : null,
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

  // Calcular meta total de vendas
  const metaTotalVendas = (Number(metaNovos) || 0) + (Number(metaSeminovos) || 0) + (Number(metaDiretas) || 0);

  // Calcular metas automaticamente com base nas vendas
  // Check-in: 30% dos comparecimentos são convertidos em vendas → check-in = vendas / 0.30
  // Confirmações: 30% dos confirmados comparecem → confirmações = check-in / 0.30
  // Agendamentos: 33% dos agendados confirmam → agendamentos = confirmações / 0.33
  const calcularMetasFunil = (totalVendas: number) => {
    if (totalVendas <= 0) return { checkins: 0, confirmacoes: 0, convites: 0 };
    
    const checkins = Math.ceil(totalVendas / 0.30);
    const confirmacoes = Math.ceil(checkins / 0.30);
    const convites = Math.ceil(confirmacoes / 0.33);
    
    return { checkins, confirmacoes, convites };
  };

  // Handler para alteração de metas de vendas - recalcula as metas de funil
  const handleMetaVendaChange = (
    setter: React.Dispatch<React.SetStateAction<number | "">>,
    value: string,
    otherMetas: { novos?: number | ""; seminovos?: number | ""; diretas?: number | "" }
  ) => {
    const numValue = value === "" ? "" : Number(value);
    setter(numValue);
    
    // Calcular total considerando o novo valor
    const novoTotal = 
      (otherMetas.novos !== undefined ? (Number(otherMetas.novos) || 0) : (Number(metaNovos) || 0)) +
      (otherMetas.seminovos !== undefined ? (Number(otherMetas.seminovos) || 0) : (Number(metaSeminovos) || 0)) +
      (otherMetas.diretas !== undefined ? (Number(otherMetas.diretas) || 0) : (Number(metaDiretas) || 0));
    
    if (novoTotal > 0) {
      const calculado = calcularMetasFunil(novoTotal);
      setMetaCheckins(calculado.checkins);
      setMetaConfirmacoes(calculado.confirmacoes);
      setMetaConvites(calculado.convites);
    }
  };

  // Tooltip configs para cada meta
  const tooltipConfigs = {
    novos: {
      title: "Meta de Novos",
      description: "Quantidade de veículos novos que você espera vender durante a prospecção.",
      exemplo: "Ex: Para um evento de 2 dias, meta de 4-6 novos é comum."
    },
    seminovos: {
      title: "Meta de Seminovos",
      description: "Quantidade de veículos seminovos/usados que você espera vender durante a prospecção.",
      exemplo: "Ex: Para um evento de 2 dias, meta de 6-10 seminovos é comum."
    },
    diretas: {
      title: "Meta de Vendas Diretas",
      description: "Quantidade de vendas diretas (frotistas, PJ, vendas corporativas) esperadas.",
      exemplo: "Ex: Para eventos B2B, meta de 2-4 diretas é comum."
    },
    checkins: {
      title: "Meta de Check-ins",
      description: "Quantidade de clientes que devem comparecer ao evento. Em média, 30% dos check-ins resultam em vendas.",
      exemplo: "Ex: Para vender 10 carros, você precisa de ~34 check-ins."
    },
    confirmacoes: {
      title: "Meta de Confirmações",
      description: "Quantidade de clientes que devem confirmar presença. Em média, 30% dos confirmados comparecem.",
      exemplo: "Ex: Para ter 34 check-ins, você precisa de ~112 confirmações."
    },
    convites: {
      title: "Meta de Convites/Agendamentos",
      description: "Quantidade de clientes que devem ser convidados/agendados. Em média, 33% dos convidados confirmam.",
      exemplo: "Ex: Para ter 112 confirmações, você precisa de ~340 convites."
    }
  };

  const MetaTooltip = ({ config }: { config: typeof tooltipConfigs.novos }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px] p-3">
          <p className="font-medium text-sm mb-1">{config.title}</p>
          <p className="text-xs text-muted-foreground mb-2">{config.description}</p>
          <p className="text-xs text-primary font-medium">{config.exemplo}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Config das premiações
  const premiacaoConfigs = {
    // Equipes
    equipe_campea: { nome: "Equipe Campeã", tooltip: "Premiação para a Equipe com mais vendas. Prêmio válido por Nº de vendas e desempate pelo VGV." },
    equipe_2lugar: { nome: "Equipe 2º Lugar", tooltip: "Premiação para a Equipe com a segunda maior quantidade de vendas." },
    equipe_3lugar: { nome: "Equipe 3º Lugar", tooltip: "Premiação para a Equipe com a terceira maior quantidade de vendas." },
    // Vendedores
    vendedor_ouro: { nome: "Vendedor Ouro", tooltip: "Premiação para o melhor vendedor do evento, considerando o número de vendas e desempate pelo VGV." },
    vendedor_prata: { nome: "Vendedor Prata", tooltip: "Premiação para o segundo melhor vendedor do evento." },
    vendedor_bronze: { nome: "Vendedor Bronze", tooltip: "Premiação para o terceiro melhor vendedor do evento." },
    // Prospectors
    prospector_ouro: { nome: "Prospector Ouro", tooltip: "Premiação destinada ao vendedor que mais prospectar clientes com presença registrada no evento." },
    prospector_prata: { nome: "Prospector Prata", tooltip: "Premiação destinada ao vendedor que possuir o segundo maior número de prospecções com presença registrada no evento." },
    prospector_bronze: { nome: "Prospector Bronze", tooltip: "Premiação destinada ao vendedor que possuir o terceiro maior número de prospecções com presença registrada no evento." },
    // Check-ins
    checkin_ouro: { nome: "Check-ins Ouro", tooltip: "Premiação destinada à pessoa que mais possuir registro de comparecimento no dia do evento (exceto vendedor)." },
    checkin_prata: { nome: "Check-ins Prata", tooltip: "Premiação destinada à pessoa que possuir o segundo maior registro de comparecimento no dia do evento (exceto vendedor)." },
    checkin_bronze: { nome: "Check-ins Bronze", tooltip: "Premiação destinada à pessoa que possuir o terceiro maior registro de comparecimento no dia do evento (exceto vendedor)." },
    // Participação
    participacao_apoio: { nome: "Participação Equipe de Apoio", tooltip: "Premiação destinada à cada membro da equipe de apoio." },
    indicacao_venda: { nome: "Indicação de Venda", tooltip: "Premiação destinada à cada indicação de venda." },
  };

  // Calcular total de premiações ativas
  const totalPremiacoes = Object.values(premiacoes).reduce((acc, p) => {
    if (p.ativo && p.valor !== "") {
      return acc + Number(p.valor);
    }
    return acc;
  }, 0);

  const handlePremiacaoToggle = (key: string, checked: boolean) => {
    setPremiacoes(prev => ({
      ...prev,
      [key]: { ...prev[key], ativo: checked, valor: checked ? prev[key].valor : "" }
    }));
  };

  const handlePremiacaoValorChange = (key: string, valor: string) => {
    setPremiacoes(prev => ({
      ...prev,
      [key]: { ...prev[key], valor: valor === "" ? "" : Number(valor) }
    }));
  };

  const PremiacaoField = ({ premioKey, icon: Icon }: { premioKey: keyof typeof premiacaoConfigs; icon: React.ElementType }) => {
    const config = premiacaoConfigs[premioKey];
    const premiacao = premiacoes[premioKey];
    
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${premiacao.ativo ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent'}`}>
        <Switch
          checked={premiacao.ativo}
          onCheckedChange={(checked) => handlePremiacaoToggle(premioKey, checked)}
        />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 flex-shrink-0 ${premiacao.ativo ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm truncate ${premiacao.ativo ? 'font-medium' : 'text-muted-foreground'}`}>{config.nome}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] p-3">
                <p className="text-xs">{config.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="w-28 flex-shrink-0">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="R$ 0,00"
            disabled={!premiacao.ativo}
            value={premiacao.valor}
            onChange={(e) => handlePremiacaoValorChange(premioKey, e.target.value)}
            className="text-right text-sm h-8"
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
            {/* Header fixo */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b bg-background">
              <DialogHeader>
                <DialogTitle>
                  {editingProspeccao ? 'Editar Prospecção' : 'Nova Prospecção'}
                </DialogTitle>
              </DialogHeader>
              
              <TabsList className="grid w-full grid-cols-3 mt-4">
                <TabsTrigger value="dados-gerais">Dados Gerais</TabsTrigger>
                <TabsTrigger value="meta">Meta</TabsTrigger>
                <TabsTrigger value="premiacoes">Premiações</TabsTrigger>
              </TabsList>
            </div>
            
            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="dados-gerais" className="space-y-4 mt-0">
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
            </TabsContent>

            <TabsContent value="meta" className="space-y-4 mt-0">
              {/* Meta Total de Vendas */}
              <Card className="p-4 bg-gradient-to-r from-primary/80 to-primary text-primary-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-medium">Meta Total de Vendas</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold">{metaTotalVendas}</span>
                  <p className="text-xs opacity-80 mt-1">Soma das metas de Novos, Seminovos e Diretas</p>
                </div>
              </Card>

              {/* Grid de Metas de Vendas */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs font-medium text-muted-foreground">Meta de Novos</span>
                    <MetaTooltip config={tooltipConfigs.novos} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaNovos}
                    onChange={(e) => handleMetaVendaChange(setMetaNovos, e.target.value, { 
                      novos: e.target.value === "" ? 0 : Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Novos</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">Meta de Seminovos</span>
                    <MetaTooltip config={tooltipConfigs.seminovos} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaSeminovos}
                    onChange={(e) => handleMetaVendaChange(setMetaSeminovos, e.target.value, { 
                      seminovos: e.target.value === "" ? 0 : Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Seminovos</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-medium text-muted-foreground">Meta de Diretas</span>
                    <MetaTooltip config={tooltipConfigs.diretas} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaDiretas}
                    onChange={(e) => handleMetaVendaChange(setMetaDiretas, e.target.value, { 
                      diretas: e.target.value === "" ? 0 : Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Diretas</p>
                </Card>
              </div>

              {/* Grid de Metas de Funil */}
              <p className="text-xs text-muted-foreground text-center">
                Calculado automaticamente com base nas metas de vendas. Você pode editar manualmente.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="h-3 w-3 text-orange-500" />
                    <span className="text-xs font-medium text-muted-foreground">Check-ins</span>
                    <MetaTooltip config={tooltipConfigs.checkins} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaCheckins}
                    onChange={(e) => setMetaCheckins(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Check-ins</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ThumbsUp className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-medium text-muted-foreground">Confirmações</span>
                    <MetaTooltip config={tooltipConfigs.confirmacoes} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaConfirmacoes}
                    onChange={(e) => setMetaConfirmacoes(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Confirmados</p>
                </Card>

                <Card className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Phone className="h-3 w-3 text-green-500" />
                    <span className="text-xs font-medium text-muted-foreground">Convites</span>
                    <MetaTooltip config={tooltipConfigs.convites} />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={metaConvites}
                    onChange={(e) => setMetaConvites(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-center font-semibold"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">Convites</p>
                </Card>
              </div>

              {/* Tamanho da Base */}
              <Card className="p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Tamanho da Base</span>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold text-primary">{tamanhoBase.toLocaleString('pt-BR')}</span>
                  <p className="text-xs text-muted-foreground mt-1">Contatos Distribuídos</p>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Valor calculado com base nos contatos importados
                </p>
              </Card>
            </TabsContent>

            {/* Aba Premiações */}
            <TabsContent value="premiacoes" className="space-y-4 mt-0">
              {/* Total em Premiações */}
              <Card className="p-4 bg-gradient-to-r from-amber-500/80 to-amber-600 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4" />
                  <span className="text-sm font-medium">Total em Premiações</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold">
                    {totalPremiacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <p className="text-xs opacity-80 mt-1">Soma de todas as premiações ativas</p>
                </div>
              </Card>

              {/* Premiações para Equipes */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações para Equipes</span>
                </div>
                <div className="space-y-2">
                  <PremiacaoField premioKey="equipe_campea" icon={Trophy} />
                  <PremiacaoField premioKey="equipe_2lugar" icon={Award} />
                  <PremiacaoField premioKey="equipe_3lugar" icon={Award} />
                </div>
              </div>

              {/* Premiações para Vendedores */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações para Vendedores</span>
                </div>
                <div className="space-y-2">
                  <PremiacaoField premioKey="vendedor_ouro" icon={Trophy} />
                  <PremiacaoField premioKey="vendedor_prata" icon={Award} />
                  <PremiacaoField premioKey="vendedor_bronze" icon={Award} />
                </div>
              </div>

              {/* Premiação para Vendedor Prospector */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiação para Vendedor Prospector</span>
                </div>
                <div className="space-y-2">
                  <PremiacaoField premioKey="prospector_ouro" icon={Trophy} />
                  <PremiacaoField premioKey="prospector_prata" icon={Award} />
                  <PremiacaoField premioKey="prospector_bronze" icon={Award} />
                </div>
              </div>

              {/* Premiações para Equipe de Apoio */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações para Equipe de Apoio</span>
                </div>
                <div className="space-y-2">
                  <PremiacaoField premioKey="checkin_ouro" icon={Trophy} />
                  <PremiacaoField premioKey="checkin_prata" icon={Award} />
                  <PremiacaoField premioKey="checkin_bronze" icon={Award} />
                </div>
              </div>

              {/* Premiações por Participação ou Indicação */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Premiações por Participação ou Indicação</span>
                </div>
                <div className="space-y-2">
                  <PremiacaoField premioKey="participacao_apoio" icon={Gift} />
                  <PremiacaoField premioKey="indicacao_venda" icon={Gift} />
                </div>
              </div>
            </TabsContent>
            </div>

            {/* Footer fixo */}
            <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t bg-background">
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
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
};