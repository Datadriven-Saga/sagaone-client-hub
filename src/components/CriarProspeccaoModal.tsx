import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeRead, XLSX } from '@/lib/xlsxSafe';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Target, Users, MapPin, ThumbsUp, Phone, Info, Trophy, Award, Gift, Star, Search, Plus, Edit2, Trash2, X, Check, UsersRound, Image, FileImage, Megaphone, Upload, QrCode, User, Building, CalendarDays, Clock, Link, Palette, ChevronLeft, ChevronRight, AlertTriangle, Maximize2, Minimize2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validatePhoneBatchForIALigacao } from "@/lib/phoneUtils";
import { sendCrmEventEmail } from "@/lib/sendCrmEventEmail";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";


interface CriarProspeccaoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProspeccaoCriada: () => void;
  editingProspeccao?: any;
}

// Tipos de evento disponíveis
type TipoEvento = 'Grande Evento' | 'Prospecção Mensal' | 'IA Whatsapp' | 'IA Ligação';

// Definir as etapas por tipo de evento
const getStepsByType = (tipo: TipoEvento): string[] => {
  switch (tipo) {
    case 'Grande Evento':
      return ['Dados Gerais', 'Equipes', 'Metas', 'Metas Individuais', 'Premiações', 'Convite', 'Marketing'];
    case 'Prospecção Mensal':
      return ['Dados Gerais', 'Equipes', 'Convite'];
    case 'IA Whatsapp':
      return ['Dados Gerais', 'Configuração IA', 'Convite'];
    case 'IA Ligação':
      return ['Dados Gerais', 'Configuração IA'];
    default:
      return ['Dados Gerais'];
  }
};

export const CriarProspeccaoModal = ({ isOpen, onOpenChange, onProspeccaoCriada, editingProspeccao }: CriarProspeccaoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const { canCreateIALigacao, canCreateEventos, canUploadBase } = useUserAccessType();
  const { isEnabledForEmpresa } = useFeatureFlags();
  const [cadenciaCompletaFlagEnabled, setCadenciaCompletaFlagEnabled] = useState(false);
  
  // Tipo de Evento
  const [tipoEvento, setTipoEvento] = useState<TipoEvento>('Prospecção Mensal');
  const [canalQuarentena, setCanalQuarentena] = useState<'whatsapp' | 'ligacao'>('whatsapp');
  const [isTeste, setIsTeste] = useState(false);
  
  // Dados Gerais
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [canal, setCanal] = useState<'Whatsapp' | 'Ligação'>('Ligação');
  const [templateProspeccaoId, setTemplateProspeccaoId] = useState("");
  const [templateAgendadoId, setTemplateAgendadoId] = useState("");
  const [templateNaoAgendadoId, setTemplateNaoAgendadoId] = useState("");
  const [convite, setConvite] = useState("");
  const [imagemDivulgacao, setImagemDivulgacao] = useState("");
  
  // Templates WhatsApp disponíveis
  const [whatsappTemplates, setWhatsappTemplates] = useState<{ id: string; nome: string; template_id_pri: string | null; id_meta: string | null; agente_id: string | null; pri_telefone: string | null; variable_mapping: Record<string, any> | null }[]>([]);

  // Novos campos para IA Whatsapp
  const [eventoPrincipal, setEventoPrincipal] = useState(true);
  const [qualificarLead, setQualificarLead] = useState(true);
  const [tipoLead, setTipoLead] = useState<'vendas' | 'prospeccao' | 'relacionamento'>('vendas');
  const [dataEnvioInicial, setDataEnvioInicial] = useState("");
  const [dataEnvioCadencia, setDataEnvioCadencia] = useState("");
  
  // Cadência Completa (IA WhatsApp)
  const [cadenciaCompleta, setCadenciaCompleta] = useState(false);
  const [templateAgendado48hId, setTemplateAgendado48hId] = useState("");
  const [templateAgendado24hId, setTemplateAgendado24hId] = useState("");

  // Metas
  const [metaNovos, setMetaNovos] = useState<number | "">("");
  const [metaSeminovos, setMetaSeminovos] = useState<number | "">("");
  const [metaDiretas, setMetaDiretas] = useState<number | "">("");
  const [metaCheckins, setMetaCheckins] = useState<number | "">("");
  const [metaConfirmacoes, setMetaConfirmacoes] = useState<number | "">("");
  const [metaConvites, setMetaConvites] = useState<number | "">("");
  const [tamanhoBase, setTamanhoBase] = useState<number>(0);
  
  // Metas Individuais
  const [metasIndividuais, setMetasIndividuais] = useState<Record<string, { meta_vendas: number; meta_checkins: number; meta_confirmacoes: number; meta_convites: number }>>({});
  const [usersComAcesso, setUsersComAcesso] = useState<{ id: string; nome_completo: string; tipo_acesso: string | null; departamento: string | null; status: string | null }[]>([]);
  const [metasIndividuaisFilter, setMetasIndividuaisFilter] = useState("");
  const [membrosFilterNome, setMembrosFilterNome] = useState("");
  const [membrosFilterTipoAcesso, setMembrosFilterTipoAcesso] = useState<string>("all");
  const [membrosFilterDepartamento, setMembrosFilterDepartamento] = useState<string>("all");
  
  // Equipes
  interface Equipe {
    id?: string;
    nome: string;
    cor: string;
    ativo: boolean;
    membros: string[];
  }
  const coresPadrao = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#F97316', '#EC4899', '#8B5CF6'];
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeEditando, setEquipeEditando] = useState<number | null>(null);
  const [novaEquipeNome, setNovaEquipeNome] = useState("");
  const [novaEquipeCor, setNovaEquipeCor] = useState(coresPadrao[0]);
  const [novaEquipeMembros, setNovaEquipeMembros] = useState<string[]>([]);
  const [criarNovaEquipe, setCriarNovaEquipe] = useState(false);
  
  // Convite
  const [conviteImagem, setConviteImagem] = useState<string | null>(null);
  const [conviteImagemFile, setConviteImagemFile] = useState<File | null>(null);
  const [uploadingConvite, setUploadingConvite] = useState(false);
  
  // Marketing
  interface MarketingAsset {
    id?: string;
    tipo_formato: string;
    plataforma: string;
    largura: number;
    altura: number;
    imagem_url: string | null;
    nome_arquivo?: string;
    tamanho_arquivo?: number;
    file?: File;
  }
  const [marketingAssets, setMarketingAssets] = useState<MarketingAsset[]>([]);
  const [uploadingMarketing, setUploadingMarketing] = useState(false);
  
  // Páginas de Captura
  const [paginaInicioFrase, setPaginaInicioFrase] = useState("");
  const [paginaPalavraDestaque, setPaginaPalavraDestaque] = useState("");
  const [paginaFinalFrase, setPaginaFinalFrase] = useState("");
  const [paginaTextoApoio, setPaginaTextoApoio] = useState("");
  const [paginaPrimeiroDia, setPaginaPrimeiroDia] = useState("");
  const [paginaDiaFinal, setPaginaDiaFinal] = useState("");
  const [paginaHoraInicio, setPaginaHoraInicio] = useState("");
  const [paginaHoraTermino, setPaginaHoraTermino] = useState("");
  const [paginaLinkPolitica, setPaginaLinkPolitica] = useState("");
  const [paginaCorFundo, setPaginaCorFundo] = useState("#0d2b47");
  const [paginaCorTexto, setPaginaCorTexto] = useState("#ffffff");
  const [paginaCorDestaque, setPaginaCorDestaque] = useState("#0ab9d8");
  const [paginaImagemEvento, setPaginaImagemEvento] = useState<string | null>(null);
  const [paginaImagemEventoFile, setPaginaImagemEventoFile] = useState<File | null>(null);
  
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
  
  // Outras Premiações (personalizadas)
  interface OutraPremiacao {
    id?: string;
    nome: string;
    valor: number | "";
    ativo: boolean;
  }
  const [outrasPremiacoes, setOutrasPremiacoes] = useState<OutraPremiacao[]>([]);
  const [novaOutraPremiacao, setNovaOutraPremiacao] = useState({ nome: "", valor: "" as number | "" });
  const [mostrarFormOutraPremiacao, setMostrarFormOutraPremiacao] = useState(false);
  
  // Base de Contatos para IA Ligação
  interface ContatoLigacao {
    nome: string;
    telefone: string;       // Telefone original
    telefoneNormalizado?: string;  // 10 dígitos após normalização
    email?: string;
    cpf?: string;
    segmentacao?: string;
    responsavel?: string;
    origem?: string;
  }
  interface ContatoInvalido {
    nome: string;
    telefone: string;
    motivo: string;
    index: number;
  }
  const [contatosLigacao, setContatosLigacao] = useState<ContatoLigacao[]>([]);
  const [contatosInvalidos, setContatosInvalidos] = useState<ContatoInvalido[]>([]);
  const [contatosDuplicados, setContatosDuplicados] = useState<ContatoInvalido[]>([]);
  
  // Campos de localização do evento (para IA Ligação)
  const [eventoUF, setEventoUF] = useState("");
  const [eventoCidade, setEventoCidade] = useState("");
  const [eventoEndereco, setEventoEndereco] = useState("");
  const [processandoPlanilha, setProcessandoPlanilha] = useState(false);
  const [modoImportBase, setModoImportBase] = useState<'upload' | 'existente'>('upload');
  const [baseExistenteSearch, setBaseExistenteSearch] = useState('');
  const [baseExistenteProspeccao, setBaseExistenteProspeccao] = useState<string>('');
  const [contatosBaseExistente, setContatosBaseExistente] = useState<any[]>([]);
  const [loadingBaseExistente, setLoadingBaseExistente] = useState(false);
  const [prospeccoesList, setProspeccoesList] = useState<{ id: string; titulo: string }[]>([]);
  
  // Estado para expandir descrição
  const [descricaoExpandida, setDescricaoExpandida] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeCompany } = useCompany();

  // Check per-empresa feature flag for cadência completa
  useEffect(() => {
    if (activeCompany?.id && tipoEvento === 'IA Whatsapp') {
      isEnabledForEmpresa('pri_whats_cadencia_completa', activeCompany.id).then(setCadenciaCompletaFlagEnabled);
    } else {
      setCadenciaCompletaFlagEnabled(false);
    }
  }, [activeCompany?.id, tipoEvento, isEnabledForEmpresa]);

  // Get current steps based on tipo
  const steps = getStepsByType(tipoEvento);
  const currentStepName = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Definir datas padrão (primeiro e último dia do mês atual)
  const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    return {
      inicio: formatDate(firstDay),
      fim: formatDate(lastDay)
    };
  };

  // Preencher campos quando estiver editando
  useEffect(() => {
    if (editingProspeccao && isOpen) {
      setTitulo(editingProspeccao.titulo || "");
      setDescricao(editingProspeccao.descricao || "");
      setDataInicio(editingProspeccao.data_inicio || "");
      setDataFim(editingProspeccao.data_fim || "");
      setCanal(editingProspeccao.canal || 'Whatsapp');
      setCanalQuarentena(editingProspeccao.canal_quarentena || 'whatsapp');
      setIsTeste(editingProspeccao.is_teste ?? false);
      setTemplateProspeccaoId(editingProspeccao.template_prospeccao_id || "");
      setTemplateAgendadoId(editingProspeccao.template_agendado_id || "");
      setTemplateNaoAgendadoId(editingProspeccao.template_nao_agendado_id || "");
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
      
      // Novos campos IA Whatsapp - converter ISO para datetime-local
      setEventoPrincipal(editingProspeccao.evento_principal ?? false);
      setQualificarLead(editingProspeccao.qualificar_lead ?? true);
      // Converter timestamp ISO para formato datetime-local (YYYY-MM-DDTHH:MM)
      const formatToDatetimeLocal = (isoString: string | null) => {
        if (!isoString) return "";
        try {
          const date = new Date(isoString);
          // Ajustar para horário local antes de formatar para datetime-local
          const offset = date.getTimezoneOffset();
          const localDate = new Date(date.getTime() - offset * 60000);
          return localDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM em horário local
        } catch {
          return "";
        }
      };
      setDataEnvioInicial(formatToDatetimeLocal(editingProspeccao.data_envio_template_inicial));
      setDataEnvioCadencia(formatToDatetimeLocal(editingProspeccao.data_envio_cadencia));
      
      // Cadência Completa
      setCadenciaCompleta(editingProspeccao.cadencia_completa ?? false);
      setTemplateAgendado48hId(editingProspeccao.template_agendado_48h_id || "");
      setTemplateAgendado24hId(editingProspeccao.template_agendado_24h_id || "");
      
      // Determinar tipo de evento baseado no canal salvo
      const canalSalvo = editingProspeccao.canal;
      if (canalSalvo === 'Grande Evento') {
        setTipoEvento('Grande Evento');
      } else if (canalSalvo === 'Mensal') {
        setTipoEvento('Prospecção Mensal');
      } else if (canalSalvo === 'Ligação') {
        setTipoEvento('IA Ligação');
      } else if (canalSalvo === 'Whatsapp') {
        // Whatsapp pode ser IA Whatsapp (com template_prospeccao_id OU event_id_pri) ou Mensal antigo
        if (editingProspeccao.template_prospeccao_id || editingProspeccao.event_id_pri) {
          setTipoEvento('IA Whatsapp');
        } else {
          // Eventos antigos criados antes da mudança de schema
          setTipoEvento('Prospecção Mensal');
        }
      } else {
        // Fallback para eventos sem canal definido
        setTipoEvento('Prospecção Mensal');
      }
    } else if (!editingProspeccao && isOpen) {
      // Limpar campos quando criar nova prospecção
      clearForm();
      // Definir datas padrão
      const defaultDates = getDefaultDates();
      setDataInicio(defaultDates.inicio);
      setDataFim(defaultDates.fim);
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

  // Buscar endereço do evento de IA Ligação quando editando
  useEffect(() => {
    const fetchEnderecoEvento = async () => {
      if (!editingProspeccao?.id || !isOpen) return;
      
      const canalSalvo = editingProspeccao.canal;
      // Só busca endereço para IA Ligação (e IA Whatsapp que também pode ter)
      if (canalSalvo !== 'Ligação' && canalSalvo !== 'Whatsapp') return;
      
      const eventIdPri = editingProspeccao.event_id_pri;
      if (!eventIdPri) return;
      
      try {
        const idEvento = parseInt(String(eventIdPri), 10);
        if (isNaN(idEvento)) return;
        
        const { data, error } = await supabase
          .from('eventos_pri_voz')
          .select('uf, cidade, endereco')
          .eq('id_evento', idEvento)
          .maybeSingle();
        
        if (error) {
          console.error('Erro ao buscar endereço do evento:', error);
          return;
        }
        
        if (data) {
          if (data.uf) setEventoUF(data.uf);
          if (data.cidade) setEventoCidade(data.cidade);
          if (data.endereco) setEventoEndereco(data.endereco);
        }
      } catch (err) {
        console.error('Erro ao buscar endereço:', err);
      }
    };
    
    fetchEnderecoEvento();
  }, [editingProspeccao, isOpen]);

  // Reset step ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const clearForm = () => {
    setTitulo("");
    setDescricao("");
    setDataInicio("");
    setDataFim("");
    setCanal('Whatsapp');
    setCanalQuarentena('whatsapp');
    setIsTeste(false);
    setTemplateProspeccaoId("");
    setTemplateAgendadoId("");
    setTemplateNaoAgendadoId("");
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
    setMetasIndividuais({});
    setMetasIndividuaisFilter("");
    setEquipes([]);
    setEquipeEditando(null);
    setNovaEquipeNome("");
    setNovaEquipeCor(coresPadrao[0]);
    setNovaEquipeMembros([]);
    setCriarNovaEquipe(false);
    setConviteImagem(null);
    setConviteImagemFile(null);
    // Páginas
    setPaginaInicioFrase("");
    setPaginaPalavraDestaque("");
    setPaginaFinalFrase("");
    setPaginaTextoApoio("");
    setPaginaPrimeiroDia("");
    setPaginaDiaFinal("");
    setPaginaHoraInicio("");
    setPaginaHoraTermino("");
    setPaginaLinkPolitica("");
    setPaginaCorFundo("#0d2b47");
    setPaginaCorTexto("#ffffff");
    setPaginaCorDestaque("#0ab9d8");
    setPaginaImagemEvento(null);
    setPaginaImagemEventoFile(null);
    // Marketing
    setMarketingAssets([]);
    // Outras Premiações
    setOutrasPremiacoes([]);
    setNovaOutraPremiacao({ nome: "", valor: "" });
    setMostrarFormOutraPremiacao(false);
    // Reset novos campos IA Whatsapp
    setEventoPrincipal(true);
    setQualificarLead(true);
    setDataEnvioInicial("");
    setDataEnvioCadencia("");
    // Reset Cadência Completa
    setCadenciaCompleta(false);
    setTemplateAgendado48hId("");
    setTemplateAgendado24hId("");
    // Reset IA Ligação
    setContatosLigacao([]);
    setContatosInvalidos([]);
    setContatosDuplicados([]);
    setProcessandoPlanilha(false);
    setEventoUF("");
    setEventoCidade("");
    setEventoEndereco("");
    // Reset tipo e step
    setTipoEvento('Prospecção Mensal');
    setCurrentStep(0);
  };
  
  // Buscar usuários com acesso à empresa ativa (apenas SDR e Vendedor para equipes)
  useEffect(() => {
    const fetchUsersComAcesso = async () => {
      if (!activeCompany?.id || !isOpen) return;
      
      // Buscar usuários que têm acesso via user_empresas
      const { data: userEmpresasData, error: userEmpresasError } = await supabase
        .from('user_empresas')
        .select('user_id')
        .eq('empresa_id', activeCompany.id);
      
      if (userEmpresasError) {
        console.error('Erro ao buscar user_empresas:', userEmpresasError);
        return;
      }
      
      const userIds = userEmpresasData?.map(ue => ue.user_id) || [];
      
      if (userIds.length === 0) {
        setUsersComAcesso([]);
        return;
      }
      
      // Buscar profiles dos usuários vinculados à loja (SDR, Vendedor e Gestores)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome_completo, tipo_acesso, status, departamento')
        .in('id', userIds)
        .in('tipo_acesso', ['SDR', 'Vendedor', 'Gerente de Loja', 'Gerente de Leads', 'Coordenadora de Leads']);
      
      if (profilesError) {
        console.error('Erro ao buscar profiles:', profilesError);
        return;
      }
      
      setUsersComAcesso(profilesData || []);
    };
    
    fetchUsersComAcesso();
  }, [activeCompany?.id, isOpen]);
  
  // Função para buscar templates WhatsApp (usando pri_telefone para compartilhar entre lojas)
  const fetchWhatsappTemplates = async () => {
    if (!activeCompany?.id) return;
    
    // Buscar agentes vinculados à empresa via agente_empresas (evita problemas de RLS e empresa_id NULL)
    const { data: agentesVinculados, error: agentesErr } = await supabase
      .from('agente_empresas')
      .select(`
        agente_id,
        agentes_ia (
          id,
          nome,
          telefone,
          ativo
        )
      `)
      .eq('empresa_id', activeCompany.id);
    
    if (agentesErr) {
      console.error('Erro ao buscar agentes vinculados:', agentesErr);
    }
    
    // Extrair telefones únicos de agentes ativos (priorizar Pri - Whatsapp)
    const agentes = (agentesVinculados || [])
      .map((ae: any) => ae.agentes_ia)
      .filter((a: any) => a && a.ativo && a.telefone);
    
    // Buscar Pri - Whatsapp primeiro, depois qualquer agente com telefone
    const priWhatsapp = agentes.find((a: any) => {
      const nome = String(a?.nome || '').toLowerCase();
      return nome.includes('pri') && nome.includes('whatsapp');
    });
    
    const agenteComTelefone = priWhatsapp || agentes[0];
    const priTelefone = agenteComTelefone?.telefone?.replace(/\D/g, '') || null;
    
    console.log('📱 Buscando templates WhatsApp com pri_telefone:', priTelefone);
    
    let data;
    let error;
    
    // Se tem pri_telefone, buscar templates que compartilham o mesmo pri_telefone
    if (priTelefone) {
      const result = await supabase
        .from('whatsapp_templates')
        .select('id, nome, template_id_pri, id_meta, agente_id, pri_telefone, variable_mapping')
        .eq('pri_telefone', priTelefone)
        .eq('status_meta', 'APPROVED')
        .order('created_at', { ascending: false });
      
      data = result.data;
      error = result.error;
    } else {
      // Fallback: buscar apenas templates da empresa (sem pri_telefone)
      const result = await supabase
        .from('whatsapp_templates')
        .select('id, nome, template_id_pri, id_meta, agente_id, pri_telefone, variable_mapping')
        .eq('empresa_id', activeCompany.id)
        .eq('status_meta', 'APPROVED')
        .order('created_at', { ascending: false });
      
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.error('Erro ao buscar templates WhatsApp:', error);
      return;
    }
    
    console.log('📋 Templates encontrados:', data?.length || 0);
    setWhatsappTemplates(data || []);
  };

  // Helper para verificar se um template tem variáveis configuradas
  const templateHasVariables = (template: { variable_mapping: Record<string, any> | null }) => {
    if (!template.variable_mapping) return false;
    // Verifica se o objeto tem pelo menos uma chave/valor
    return Object.keys(template.variable_mapping).length > 0;
  };

  // Buscar templates WhatsApp disponíveis (pendente ou aprovado)
  useEffect(() => {
    if (isOpen) {
      fetchWhatsappTemplates();
    }
  }, [activeCompany?.id, isOpen]);

  // Buscar metas individuais quando editando
  useEffect(() => {
    const fetchMetasIndividuais = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id || !isOpen) return;
      
      const { data, error } = await supabase
        .from('prospeccao_metas_individuais')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (error) {
        console.error('Erro ao buscar metas individuais:', error);
        return;
      }
      
      const metasMap: Record<string, { meta_vendas: number; meta_checkins: number; meta_confirmacoes: number; meta_convites: number }> = {};
      data?.forEach(meta => {
        metasMap[meta.user_id] = {
          meta_vendas: meta.meta_vendas || 0,
          meta_checkins: meta.meta_checkins || 0,
          meta_confirmacoes: meta.meta_confirmacoes || 0,
          meta_convites: meta.meta_convites || 0,
        };
      });
      setMetasIndividuais(metasMap);
    };
    
    // Buscar equipes quando editando
    const fetchEquipes = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id || !isOpen) return;
      
      const { data: equipesData, error: equipesError } = await supabase
        .from('prospeccao_equipes')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (equipesError) {
        console.error('Erro ao buscar equipes:', equipesError);
        return;
      }
      
      if (!equipesData) return;
      
      // Buscar membros de cada equipe
      const equipesComMembros = await Promise.all(
        equipesData.map(async (equipe) => {
          const { data: membrosData } = await supabase
            .from('prospeccao_equipe_membros')
            .select('user_id')
            .eq('equipe_id', equipe.id);
          
          return {
            id: equipe.id,
            nome: equipe.nome,
            cor: equipe.cor,
            ativo: equipe.ativo,
            membros: membrosData?.map(m => m.user_id) || []
          };
        })
      );
      
      setEquipes(equipesComMembros);
    };
    
    // Buscar convite quando editando
    const fetchConvite = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      // Primeiro tenta buscar da tabela prospeccao_convites
      const { data, error } = await supabase
        .from('prospeccao_convites')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .single();
      
      if (!error && data?.imagem_url) {
        setConviteImagem(data.imagem_url);
      } else if (editingProspeccao.imagem_divulgacao_url) {
        // Se não encontrou em prospeccao_convites, usa imagem_divulgacao_url da prospecção
        setConviteImagem(editingProspeccao.imagem_divulgacao_url);
      }
    };
    
    // Buscar página de captura quando editando
    const fetchPagina = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('prospeccao_paginas')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .single();
      
      if (!error && data) {
        setPaginaInicioFrase(data.inicio_frase || "");
        setPaginaPalavraDestaque(data.palavra_destaque || "");
        setPaginaFinalFrase(data.final_frase || "");
        setPaginaTextoApoio(data.texto_apoio || "");
        setPaginaPrimeiroDia(data.primeiro_dia_evento || "");
        setPaginaDiaFinal(data.dia_final_evento || "");
        setPaginaHoraInicio(data.hora_inicio || "");
        setPaginaHoraTermino(data.hora_termino || "");
        setPaginaLinkPolitica(data.link_politica_privacidade || "");
        setPaginaCorFundo(data.cor_fundo || "#0d2b47");
        setPaginaCorTexto(data.cor_texto || "#ffffff");
        setPaginaCorDestaque(data.cor_destaque || "#0ab9d8");
        setPaginaImagemEvento(data.imagem_evento_url || null);
      }
    };
    
    // Buscar marketing assets quando editando
    const fetchMarketingAssets = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('prospeccao_marketing')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (!error && data) {
        setMarketingAssets(data.map(item => ({
          id: item.id,
          tipo_formato: item.tipo_formato,
          plataforma: item.plataforma,
          largura: item.largura,
          altura: item.altura,
          imagem_url: item.imagem_url,
          nome_arquivo: item.nome_arquivo || undefined,
          tamanho_arquivo: item.tamanho_arquivo || undefined,
        })));
      }
    };
    
    // Buscar outras premiações quando editando
    const fetchOutrasPremiacoes = async () => {
      if (!editingProspeccao?.id || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('prospeccao_outras_premiacoes')
        .select('*')
        .eq('prospeccao_id', editingProspeccao.id)
        .eq('empresa_id', activeCompany.id);
      
      if (!error && data) {
        setOutrasPremiacoes(data.map(item => ({
          id: item.id,
          nome: item.nome,
          valor: item.valor || 0,
          ativo: item.ativo,
        })));
      }
    };
    
    if (editingProspeccao && isOpen) {
      fetchMetasIndividuais();
      fetchEquipes();
      fetchConvite();
      fetchPagina();
      fetchMarketingAssets();
      fetchOutrasPremiacoes();
    }
  }, [editingProspeccao?.id, activeCompany?.id, isOpen]);

  // Buscar lista de prospecções para Base Existente (IA Ligação)
  useEffect(() => {
    const fetchProspeccoes = async () => {
      if (!activeCompany?.id || !isOpen) return;
      
      const { data } = await supabase
        .from('prospeccoes')
        .select('id, titulo')
        .eq('empresa_id', activeCompany.id)
        .order('created_at', { ascending: false });
      
      if (data) {
        setProspeccoesList(data);
      }
    };
    
    fetchProspeccoes();
  }, [activeCompany?.id, isOpen]);
  
  // Handler para atualizar meta individual
  // Quando o usuário digitar vendas, calcula automaticamente check-ins, confirmações e convites
  const handleMetaIndividualChange = (userId: string, field: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value);
    
    // Calcular meta total de vendas para proporção
    const totalVendas = (Number(metaNovos) || 0) + (Number(metaSeminovos) || 0) + (Number(metaDiretas) || 0);
    
    // Se o campo alterado for vendas e temos metas gerais definidas, calcular os outros automaticamente
    if (field === 'meta_vendas' && totalVendas > 0) {
      // Proporção baseada nas metas gerais
      const proporcao = numValue / totalVendas;
      
      const calculatedCheckins = Math.round(proporcao * (Number(metaCheckins) || 0));
      const calculatedConfirmacoes = Math.round(proporcao * (Number(metaConfirmacoes) || 0));
      const calculatedConvites = Math.round(proporcao * (Number(metaConvites) || 0));
      
      setMetasIndividuais(prev => ({
        ...prev,
        [userId]: {
          meta_vendas: numValue,
          meta_checkins: calculatedCheckins,
          meta_confirmacoes: calculatedConfirmacoes,
          meta_convites: calculatedConvites
        }
      }));
    } else {
      // Para outros campos, apenas atualizar o valor específico
      setMetasIndividuais(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId] || { meta_vendas: 0, meta_checkins: 0, meta_confirmacoes: 0, meta_convites: 0 },
          [field]: numValue
        }
      }));
    }
  };
  
  // Salvar metas individuais
  const saveMetasIndividuais = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    const metasToSave = Object.entries(metasIndividuais)
      .filter(([_, meta]) => meta.meta_vendas > 0 || meta.meta_checkins > 0 || meta.meta_confirmacoes > 0 || meta.meta_convites > 0)
      .map(([userId, meta]) => ({
        prospeccao_id: prospeccaoId,
        user_id: userId,
        empresa_id: activeCompany.id,
        meta_vendas: meta.meta_vendas,
        meta_checkins: meta.meta_checkins,
        meta_confirmacoes: meta.meta_confirmacoes,
        meta_convites: meta.meta_convites,
      }));
    
    if (metasToSave.length === 0) return;
    
    // Upsert metas individuais
    const { error } = await supabase
      .from('prospeccao_metas_individuais')
      .upsert(metasToSave, { onConflict: 'prospeccao_id,user_id' });
    
    if (error) {
      console.error('Erro ao salvar metas individuais:', error);
    }
  };
  
  // Salvar equipes
  const saveEquipes = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    for (const equipe of equipes) {
      if (equipe.id) {
        // Atualizar equipe existente
        await supabase
          .from('prospeccao_equipes')
          .update({
            nome: equipe.nome,
            cor: equipe.cor,
            ativo: equipe.ativo
          })
          .eq('id', equipe.id);
        
        // Remover membros antigos e adicionar novos
        await supabase
          .from('prospeccao_equipe_membros')
          .delete()
          .eq('equipe_id', equipe.id);
        
        if (equipe.membros.length > 0) {
          await supabase
            .from('prospeccao_equipe_membros')
            .insert(equipe.membros.map(userId => ({
              equipe_id: equipe.id,
              user_id: userId
            })));
        }
      } else {
        // Criar nova equipe
        const { data: newEquipe, error: equipeError } = await supabase
          .from('prospeccao_equipes')
          .insert({
            prospeccao_id: prospeccaoId,
            empresa_id: activeCompany.id,
            nome: equipe.nome,
            cor: equipe.cor,
            ativo: equipe.ativo
          })
          .select()
          .single();
        
        if (equipeError || !newEquipe) {
          console.error('Erro ao criar equipe:', equipeError);
          continue;
        }
        
        // Adicionar membros
        if (equipe.membros.length > 0) {
          await supabase
            .from('prospeccao_equipe_membros')
            .insert(equipe.membros.map(userId => ({
              equipe_id: newEquipe.id,
              user_id: userId
            })));
        }
      }
    }
  };
  
  // Salvar convite
  const saveConvite = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    // Se não tem arquivo novo para upload, verifica se já existe imagem
    if (!conviteImagemFile && !conviteImagem) return;
    
    let imagemUrl = conviteImagem;
    
    // Se tem arquivo novo, faz upload
    if (conviteImagemFile) {
      const fileExt = conviteImagemFile.name.split('.').pop();
      const fileName = `${prospeccaoId}-${Date.now()}.${fileExt}`;
      const filePath = `${activeCompany.id}/${fileName}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('convites-prospeccao')
        .upload(filePath, conviteImagemFile, { upsert: true });
      
      if (uploadError) {
        console.error('Erro ao fazer upload do convite:', uploadError);
        return;
      }
      
      // Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from('convites-prospeccao')
        .getPublicUrl(filePath);
      
      imagemUrl = publicUrlData.publicUrl;
    }
    
    // Upsert convite
    const { error } = await supabase
      .from('prospeccao_convites')
      .upsert({
        prospeccao_id: prospeccaoId,
        empresa_id: activeCompany.id,
        imagem_url: imagemUrl
      }, { onConflict: 'prospeccao_id' });
    
    if (error) {
      console.error('Erro ao salvar convite:', error);
    }
    
    // Também atualizar imagem_divulgacao_url na prospecção para aparecer no KV do Evento
    if (imagemUrl) {
      const { error: updateError } = await supabase
        .from('prospeccoes')
        .update({ imagem_divulgacao_url: imagemUrl })
        .eq('id', prospeccaoId);
      
      if (updateError) {
        console.error('Erro ao atualizar imagem_divulgacao_url:', updateError);
      }
    }
  };
  
  // Salvar página de captura
  const savePagina = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    let imagemUrl = paginaImagemEvento;
    
    // Se tem arquivo novo, faz upload
    if (paginaImagemEventoFile) {
      const fileExt = paginaImagemEventoFile.name.split('.').pop();
      const fileName = `pagina-${prospeccaoId}-${Date.now()}.${fileExt}`;
      const filePath = `${activeCompany.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('convites-prospeccao')
        .upload(filePath, paginaImagemEventoFile, { upsert: true });
      
      if (uploadError) {
        console.error('Erro ao fazer upload da imagem da página:', uploadError);
        return;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('convites-prospeccao')
        .getPublicUrl(filePath);
      
      imagemUrl = publicUrlData.publicUrl;
    }
    
    // Upsert página
    const { error } = await supabase
      .from('prospeccao_paginas')
      .upsert({
        prospeccao_id: prospeccaoId,
        empresa_id: activeCompany.id,
        inicio_frase: paginaInicioFrase || null,
        palavra_destaque: paginaPalavraDestaque || null,
        final_frase: paginaFinalFrase || null,
        texto_apoio: paginaTextoApoio || null,
        primeiro_dia_evento: paginaPrimeiroDia || null,
        dia_final_evento: paginaDiaFinal || null,
        hora_inicio: paginaHoraInicio || null,
        hora_termino: paginaHoraTermino || null,
        link_politica_privacidade: paginaLinkPolitica || null,
        cor_fundo: paginaCorFundo,
        cor_texto: paginaCorTexto,
        cor_destaque: paginaCorDestaque,
        imagem_evento_url: imagemUrl
      }, { onConflict: 'prospeccao_id' });
    
    if (error) {
      console.error('Erro ao salvar página:', error);
    }
  };
  
  // Salvar marketing assets
  const saveMarketingAssets = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    // Deletar assets existentes para esta prospecção
    await supabase
      .from('prospeccao_marketing')
      .delete()
      .eq('prospeccao_id', prospeccaoId)
      .eq('empresa_id', activeCompany.id);
    
    // Inserir novos assets
    for (const asset of marketingAssets) {
      let imagemUrl = asset.imagem_url;
      
      // Se tem arquivo novo, faz upload
      if (asset.file) {
        const fileExt = asset.file.name.split('.').pop();
        const fileName = `marketing-${prospeccaoId}-${asset.tipo_formato}-${Date.now()}.${fileExt}`;
        const filePath = `${activeCompany.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('convites-prospeccao')
          .upload(filePath, asset.file, { upsert: true });
        
        if (uploadError) {
          console.error('Erro ao fazer upload do asset:', uploadError);
          continue;
        }
        
        const { data: publicUrlData } = supabase.storage
          .from('convites-prospeccao')
          .getPublicUrl(filePath);
        
        imagemUrl = publicUrlData.publicUrl;
      }
      
      if (imagemUrl) {
        const { error } = await supabase
          .from('prospeccao_marketing')
          .insert({
            prospeccao_id: prospeccaoId,
            empresa_id: activeCompany.id,
            tipo_formato: asset.tipo_formato,
            plataforma: asset.plataforma,
            largura: asset.largura,
            altura: asset.altura,
            imagem_url: imagemUrl,
            nome_arquivo: asset.nome_arquivo,
            tamanho_arquivo: asset.tamanho_arquivo,
          });
        
        if (error) {
          console.error('Erro ao salvar asset de marketing:', error);
        }
      }
    }
  };
  
  // Salvar outras premiações
  const saveOutrasPremiacoes = async (prospeccaoId: string) => {
    if (!activeCompany?.id) return;
    
    // Deletar premiações existentes para esta prospecção
    await supabase
      .from('prospeccao_outras_premiacoes')
      .delete()
      .eq('prospeccao_id', prospeccaoId)
      .eq('empresa_id', activeCompany.id);
    
    // Inserir novas premiações
    for (const premiacao of outrasPremiacoes) {
      const { error } = await supabase
        .from('prospeccao_outras_premiacoes')
        .insert({
          prospeccao_id: prospeccaoId,
          empresa_id: activeCompany.id,
          nome: premiacao.nome,
          valor: Number(premiacao.valor) || 0,
          ativo: premiacao.ativo,
        });
      
      if (error) {
        console.error('Erro ao salvar outra premiação:', error);
      }
    }
  };
  
  // Filtrar usuários - apenas os que estão em equipes do evento
  const usersEmEquipes = equipes.flatMap(e => e.membros);
  const filteredUsers = usersComAcesso
    .filter(user => usersEmEquipes.includes(user.id))
    .filter(user => {
      const searchLower = metasIndividuaisFilter.toLowerCase();
      return user.nome_completo.toLowerCase().includes(searchLower) ||
             (user.tipo_acesso?.toLowerCase().includes(searchLower) ?? false);
    });

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast({
        title: "Erro",
        description: "O título é obrigatório",
        variant: "destructive"
      });
      return;
    }

    // Validação específica para IA Whatsapp: descrição e template obrigatórios
    if (tipoEvento === 'IA Whatsapp' && !descricao.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "A Descrição é obrigatória para eventos do tipo IA Whatsapp.",
        variant: "destructive"
      });
      return;
    }

    if (tipoEvento === 'IA Whatsapp' && !templateProspeccaoId) {
      toast({
        title: "Campo obrigatório",
        description: "Para eventos do tipo IA Whatsapp, o Template de Prospecção é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    // Validação: quando cadência completa está ativa, todos os 4 templates são obrigatórios
    const isCadenciaCompletaAtiva = cadenciaCompleta || editingProspeccao?.cadencia_completa;
    if (tipoEvento === 'IA Whatsapp' && isCadenciaCompletaAtiva) {
      const missingTemplates: string[] = [];
      if (!templateAgendado48hId) missingTemplates.push("Agendado 48h");
      if (!templateAgendado24hId) missingTemplates.push("Agendado 24h");
      if (!templateNaoAgendadoId) missingTemplates.push("Não Responderam");
      if (missingTemplates.length > 0) {
        toast({
          title: "Templates obrigatórios",
          description: `Com cadência completa ativa, os seguintes templates são obrigatórios: ${missingTemplates.join(", ")}.`,
          variant: "destructive"
        });
        return;
      }
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
    setLoadingMessage("");
    
    try {
      // Para IA Ligação na criação, primeiro verificar próximo ID disponível
      let proximoIdEvento: number | null = null;
      if (tipoEvento === 'IA Ligação' && !editingProspeccao) {
        setLoadingMessage("Verificando eventos ativos");
        console.log('🔍 Consultando webhook verifica-eventos + listando IDs já usados no banco (prospeccoes.event_id_pri)...');

        const extractIdsFromWebhook = (payload: any): { ids: number[]; max: number } => {
          const ids: number[] = [];
          let max = 0;

          const pushId = (v: any) => {
            const n = parseInt(String(v ?? ''), 10);
            if (!isNaN(n)) {
              ids.push(n);
              if (n > max) max = n;
            }
          };

          if (typeof payload === 'number') {
            pushId(payload);
            return { ids, max };
          }

          if (Array.isArray(payload)) {
            for (const item of payload) pushId(item?.id_evento ?? item?.id);
            return { ids, max };
          }

          // Alguns formatos possíveis: { eventos: [...] } / { data: [...] } / objeto único { id_evento: 2, ... }
          if (payload && typeof payload === 'object') {
            if (Array.isArray(payload.eventos)) {
              for (const item of payload.eventos) pushId(item?.id_evento ?? item?.id);
              return { ids, max };
            }
            if (Array.isArray(payload.data)) {
              for (const item of payload.data) pushId(item?.id_evento ?? item?.id);
              return { ids, max };
            }

            // Se vier apenas um evento, considerar o ID dele como existente
            pushId(payload.id_evento ?? payload.last_id ?? payload.ultimo_id);
            // Se vier proximo_id, considerar como candidato (mas ainda validaremos contra o banco)
            pushId(payload.proximo_id);
          }

          return { ids, max };
        };

        try {
          // Usar edge function para consultar webhook externo com token SAGA_ONE
          const [verificaResult, existentesRes] = await Promise.all([
            supabase.functions.invoke('external-webhook-proxy', {
              body: { endpoint: 'verifica-eventos' },
            }),
            supabase
              .from('prospeccoes')
              .select('event_id_pri')
              .eq('canal', 'Ligação')
              .not('event_id_pri', 'is', null),
          ]);

          if (verificaResult.error) {
            console.error('❌ Erro ao consultar verifica-eventos:', verificaResult.error);
            throw new Error('Não foi possível verificar eventos ativos');
          }

          if (existentesRes.error) {
            console.error('❌ Erro ao listar event_id_pri no banco:', existentesRes.error);
            throw new Error('Não foi possível validar IDs já usados no banco');
          }

          const verificaData = verificaResult.data;
          console.log('📊 Resposta verifica-eventos:', verificaData);

          const usedIds = new Set<number>();
          let maxDb = 0;

          for (const row of existentesRes.data ?? []) {
            const n = parseInt(String((row as any).event_id_pri ?? ''), 10);
            if (!isNaN(n)) {
              usedIds.add(n);
              if (n > maxDb) maxDb = n;
            }
          }

          const { ids: webhookIds, max: maxWebhook } = extractIdsFromWebhook(verificaData);
          for (const id of webhookIds) usedIds.add(id);

          const maxGlobal = Math.max(maxDb, maxWebhook);
          let candidato = maxGlobal + 1;

          // Garantia extra: nunca usar um ID que já exista (mesmo com dados inconsistentes)
          while (usedIds.has(candidato)) {
            candidato += 1;
          }

          proximoIdEvento = candidato;

          console.log(
            '🔢 ID Evento calculado:',
            { maxDb, maxWebhook, maxGlobal, proximoIdEvento, totalIdsConhecidos: usedIds.size }
          );

        } catch (verificaError) {
          console.error('❌ Erro ao verificar eventos:', verificaError);
          toast({
            title: "Erro ao verificar eventos",
            description: "Não foi possível obter um ID único para o evento. Tente novamente.",
            variant: "destructive"
          });
          setLoading(false);
          setLoadingMessage("");
          return;
        }
      }

      setLoadingMessage("");
      // Determinar canal baseado no tipo de evento
      // Grande Evento = "Grande Evento", Prospecção Mensal = "Mensal", IA Whatsapp = "Whatsapp", IA Ligação = "Ligação"
      let canalFinal: string = 'Whatsapp';
      if (tipoEvento === 'IA Ligação') {
        canalFinal = 'Ligação';
      } else if (tipoEvento === 'Grande Evento') {
        canalFinal = 'Grande Evento';
      } else if (tipoEvento === 'Prospecção Mensal') {
        canalFinal = 'Mensal';
      } else if (tipoEvento === 'IA Whatsapp') {
        canalFinal = 'Whatsapp';
      }
      
      const dadosProspeccao: any = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        canal: canalFinal,
        is_teste: isTeste,
        canal_quarentena: tipoEvento === 'IA Whatsapp' ? 'whatsapp' : tipoEvento === 'IA Ligação' ? 'ligacao' : canalQuarentena,
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

      // Adicionar campos específicos do tipo de evento
      if (tipoEvento === 'IA Whatsapp') {
        dadosProspeccao.template_prospeccao_id = templateProspeccaoId || null;
        dadosProspeccao.template_agendado_id = templateAgendadoId || null;
        dadosProspeccao.template_nao_agendado_id = templateNaoAgendadoId || null;
        dadosProspeccao.convite = null;
        // Se estiver editando e colocando um template válido, liberar disparos pausados
        if (editingProspeccao && (templateProspeccaoId || templateAgendadoId || templateNaoAgendadoId)) {
          dadosProspeccao.disparos_pausados = false;
        }
        // Novos campos IA Whatsapp
        dadosProspeccao.evento_principal = eventoPrincipal;
        dadosProspeccao.qualificar_lead = qualificarLead;
        dadosProspeccao.data_envio_template_inicial = dataEnvioInicial ? new Date(dataEnvioInicial).toISOString() : new Date().toISOString();
        // Cadência completa (apenas na criação, não altera na edição)
        if (!editingProspeccao) {
          dadosProspeccao.cadencia_completa = cadenciaCompleta;
        }
        // Templates 48h/24h (quando cadência completa ativa)
        if (cadenciaCompleta || editingProspeccao?.cadencia_completa) {
          dadosProspeccao.template_agendado_48h_id = templateAgendado48hId || null;
          dadosProspeccao.template_agendado_24h_id = templateAgendado24hId || null;
        }
        // Calcular data_envio_cadencia: se não preenchida, 24h antes da data final do evento
        if (cadenciaCompleta || editingProspeccao?.cadencia_completa) {
          // Cadência completa usa horários fixos, não precisa de data_envio_cadencia manual
          dadosProspeccao.data_envio_cadencia = null;
        } else if (dataEnvioCadencia) {
          dadosProspeccao.data_envio_cadencia = new Date(dataEnvioCadencia).toISOString();
        } else if (dataFim || dataInicio) {
          const dataRef = dataFim || dataInicio;
          const dataEvento = new Date(dataRef + 'T11:00:00');
          dataEvento.setHours(dataEvento.getHours() - 24);
          dadosProspeccao.data_envio_cadencia = dataEvento.toISOString();
        } else {
          dadosProspeccao.data_envio_cadencia = null;
        }
      } else if (tipoEvento === 'IA Ligação') {
        dadosProspeccao.template_prospeccao_id = null;
        dadosProspeccao.template_agendado_id = null;
        dadosProspeccao.template_nao_agendado_id = null;
        dadosProspeccao.convite = convite.trim() || null;
      } else {
        dadosProspeccao.template_prospeccao_id = null;
        dadosProspeccao.template_agendado_id = null;
        dadosProspeccao.template_nao_agendado_id = null;
        dadosProspeccao.convite = null;
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

        // Chamar webhook após atualização (apenas IA Whatsapp)
        let editEventIdPri: string | null = data.event_id_pri || null;
        if (tipoEvento === 'IA Whatsapp') {
          const priConfigResult = await callWebhook(data);
          if (priConfigResult) editEventIdPri = priConfigResult;
        }
        
        // Disparar gatilhos de "novo_evento_criado" (apenas IA Whatsapp)
        if (tipoEvento === 'IA Whatsapp') {
          const gatilhoResult = await triggerNovoEventoCriadoWebhooks(data, true);
          if (gatilhoResult) editEventIdPri = gatilhoResult;
        }
        
        // Para IA WhatsApp na edição: garantir que event_id_pri existe
        if (tipoEvento === 'IA Whatsapp' && !editEventIdPri) {
          console.warn('⚠️ Evento IA WhatsApp editado sem event_id_pri - salvando mas alertando usuário');
          toast({
            title: "⚠️ Atenção: event_id_pri ausente",
            description: "O evento foi atualizado mas o identificador event_id_pri não está configurado. Algumas funcionalidades podem não funcionar corretamente.",
            variant: "destructive",
          });
        } else if (tipoEvento === 'IA Whatsapp' && editEventIdPri && !data.event_id_pri) {
          // Se obteve o event_id_pri agora mas não tinha antes, salvar
          await supabase
            .from('prospeccoes')
            .update({ event_id_pri: editEventIdPri })
            .eq('id', data.id);
          console.log(`✅ event_id_pri "${editEventIdPri}" salvo na edição do evento`);
        }
        
        // Salvar dados relacionados baseado no tipo
        if (tipoEvento === 'Grande Evento') {
          await saveMetasIndividuais(data.id);
          await saveEquipes(data.id);
          await saveConvite(data.id);
          await savePagina(data.id);
          await saveMarketingAssets(data.id);
          await saveOutrasPremiacoes(data.id);
        } else if (tipoEvento === 'Prospecção Mensal') {
          await saveEquipes(data.id);
          await saveConvite(data.id);
        } else if (tipoEvento === 'IA Whatsapp') {
          await saveConvite(data.id);
        } else if (tipoEvento === 'IA Ligação') {
          await saveConvite(data.id);

          setLoadingMessage("Sincronizando evento externo...");
          const ok = await callIALigacaoWebhooks(data, 'atualizar');
          if (!ok) {
            throw new Error('Falha ao atualizar o evento externo (IA Ligação).');
          }
          setLoadingMessage("");

          console.log('✅ Evento IA Ligação atualizado e sincronizado externamente.');
        }

        toast({
          title: "Sucesso",
          description: "Evento atualizado com sucesso!"
        });

        // 🔔 notify-evento-criado DESATIVADO - usando exclusivamente send-crm-event-email
        // supabase.functions.invoke('notify-evento-criado', { ... });

        // 📧 Disparar send-crm-event-email e exibir resultado
        sendCrmEventEmail(data.id).then(result => {
          if (result.success && result.enviados > 0) {
            toast({
              title: "📧 Email CRM enviado",
              description: `Notificação enviada para ${result.enviados} destinatário(s) CRM.`,
            });
          } else if (result.success && result.total_destinatarios === 0) {
            toast({
              title: "⚠️ Nenhum CRM encontrado",
              description: "Nenhum usuário CRM vinculado a esta loja para receber a notificação.",
              variant: "destructive",
            });
          } else if (!result.success) {
            toast({
              title: "❌ Falha no envio de email CRM",
              description: result.error || "Erro ao enviar notificação por email.",
              variant: "destructive",
            });
          } else if (result.erros > 0) {
            toast({
              title: "⚠️ Envio parcial de email CRM",
              description: `${result.enviados} enviado(s), ${result.erros} falha(s) de ${result.total_destinatarios} destinatário(s).`,
              variant: "destructive",
            });
          }
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

        // Se for IA Ligação, incluir o event_id_pri já obtido
        const insertData: any = {
          ...dadosProspeccao,
          responsavel_id: user.id,
          empresa_id: activeCompany.id,
          leads_gerados: 0
        };
        
        // Adicionar event_id_pri se tivermos o próximo ID (para IA Ligação)
        if (tipoEvento === 'IA Ligação' && proximoIdEvento) {
          insertData.event_id_pri = String(proximoIdEvento);
          console.log('🔢 Criando prospecção com event_id_pri:', proximoIdEvento);
        }
        
        const { data, error } = await supabase
          .from('prospeccoes')
          .insert([insertData])
          .select()
          .single();

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }

        // Chamar webhook após criação (apenas IA Whatsapp)
        let eventIdPriFromWebhook: string | null = null;
        if (tipoEvento === 'IA Whatsapp') {
          eventIdPriFromWebhook = await callWebhook(data);
        }
        
        // Disparar gatilhos de "novo_evento_criado" (apenas IA Whatsapp)
        let eventIdPriFromGatilhos: string | null = null;
        if (tipoEvento === 'IA Whatsapp') {
          eventIdPriFromGatilhos = await triggerNovoEventoCriadoWebhooks(data, false);
        }
        
        // Para IA WhatsApp: consolidar event_id_pri obtido de qualquer fonte
        if (tipoEvento === 'IA Whatsapp') {
          const finalEventIdPri = eventIdPriFromWebhook || eventIdPriFromGatilhos;
          
          // Se obteve o event_id_pri do callWebhook mas não foi salvo ainda, salvar agora
          if (eventIdPriFromWebhook && !eventIdPriFromGatilhos) {
            await supabase
              .from('prospeccoes')
              .update({ event_id_pri: eventIdPriFromWebhook })
              .eq('id', data.id);
            console.log(`✅ event_id_pri "${eventIdPriFromWebhook}" salvo via pri-config`);
          }
          
          // VALIDAÇÃO OBRIGATÓRIA: event_id_pri é mandatório para IA WhatsApp
          if (!finalEventIdPri) {
            console.error('❌ event_id_pri não retornado para IA WhatsApp - revertendo evento');
            
            // Reverter criação local
            const { error: rollbackError } = await supabase
              .from('prospeccoes')
              .delete()
              .eq('id', data.id);

            if (rollbackError) {
              console.error('❌ Falha ao reverter prospecção local:', rollbackError);
            }

            throw new Error('Não foi possível criar o evento de IA WhatsApp, pois o identificador event_id_pri não foi retornado. Esse dado é obrigatório para o funcionamento do evento. Tente novamente.');
          }
          
          console.log(`✅ Evento IA WhatsApp criado com event_id_pri: ${finalEventIdPri}`);
        }
        
        // Salvar dados relacionados baseado no tipo
        if (tipoEvento === 'Grande Evento') {
          await saveMetasIndividuais(data.id);
          await saveEquipes(data.id);
          await saveConvite(data.id);
          await savePagina(data.id);
          await saveMarketingAssets(data.id);
          await saveOutrasPremiacoes(data.id);
        } else if (tipoEvento === 'Prospecção Mensal') {
          await saveEquipes(data.id);
          await saveConvite(data.id);
        } else if (tipoEvento === 'IA Whatsapp') {
          await saveConvite(data.id);
        } else if (tipoEvento === 'IA Ligação') {
          await saveConvite(data.id);

          setLoadingMessage("Sincronizando evento externo...");
          const ok = await callIALigacaoWebhooks(data, 'criar');
          if (!ok) {
            // O edge function já persiste localmente em eventos_pri_voz,
            // então só revertemos se callIALigacaoWebhooks retornou false por erro de validação
            // (crm_id ausente, agente não configurado, etc.)
            const { error: rollbackError } = await supabase
              .from('prospeccoes')
              .delete()
              .eq('id', data.id);

            if (rollbackError) {
              console.error('❌ Falha ao reverter prospecção local:', rollbackError);
            }

            throw new Error('Falha ao criar o evento de IA Ligação. Verifique se o agente Pri(Ligação) e o CRM ID estão configurados corretamente.');
          }
          setLoadingMessage("");

          console.log('✅ Evento IA Ligação criado e sincronizado.');
        }

        toast({
          title: "Sucesso",
          description: "Evento criado com sucesso!"
        });

        // 🔔 notify-evento-criado DESATIVADO - usando exclusivamente send-crm-event-email
        // supabase.functions.invoke('notify-evento-criado', { ... });

        // 📧 Disparar send-crm-event-email e exibir resultado
        sendCrmEventEmail(data.id).then(result => {
          if (result.success && result.enviados > 0) {
            toast({
              title: "📧 Email CRM enviado",
              description: `Notificação enviada para ${result.enviados} destinatário(s) CRM.`,
            });
          } else if (result.success && result.total_destinatarios === 0) {
            toast({
              title: "⚠️ Nenhum CRM encontrado",
              description: "Nenhum usuário CRM vinculado a esta loja para receber a notificação.",
              variant: "destructive",
            });
          } else if (!result.success) {
            toast({
              title: "❌ Falha no envio de email CRM",
              description: result.error || "Erro ao enviar notificação por email.",
              variant: "destructive",
            });
          } else if (result.erros > 0) {
            toast({
              title: "⚠️ Envio parcial de email CRM",
              description: `${result.enviados} enviado(s), ${result.erros} falha(s) de ${result.total_destinatarios} destinatário(s).`,
              variant: "destructive",
            });
          }
        });
      }

      // Limpar form e fechar modal
      clearForm();
      onOpenChange(false);
      onProspeccaoCriada();

    } catch (error: any) {
      console.error('Erro ao processar evento:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar evento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const callWebhook = async (prospeccaoData: any): Promise<string | null> => {
    try {
      // Buscar dados da empresa para pegar o crm_id e telefone da Pri
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('crm_id')
        .eq('id', activeCompany?.id)
        .single();

      // Buscar telefone do agente IA WhatsApp da empresa
      const { data: agenteData } = await supabase
        .from('agentes_ia')
        .select('telefone')
        .eq('empresa_id', activeCompany?.id)
        .ilike('nome', '%whatsapp%')
        .eq('ativo', true)
        .limit(1)
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

      // Buscar IDs dos templates selecionados (por UUID)
      const templateDescobertaData = whatsappTemplates.find(t => t.id === prospeccaoData.template_prospeccao_id);
      const templateAgendadoData = whatsappTemplates.find(t => t.id === prospeccaoData.template_agendado_id);
      const templateNaoAgendadoData = whatsappTemplates.find(t => t.id === prospeccaoData.template_nao_agendado_id);
      const templateAgendado48hData = whatsappTemplates.find(t => t.id === prospeccaoData.template_agendado_48h_id);
      const templateAgendado24hData = whatsappTemplates.find(t => t.id === prospeccaoData.template_agendado_24h_id);

      const webhookPayload: any = {
        maia_id: formatarTelefone(agenteData?.telefone || ""),
        nome_evento: prospeccaoData.titulo || "",
        data_inicio: formatarDataISO(prospeccaoData.data_inicio || ""),
        data_fim: formatarDataISO(prospeccaoData.data_fim || ""),
        descricao: prospeccaoData.descricao || "",
        dealerid: empresaData?.crm_id || "",
        template_descoberta: templateDescobertaData?.nome || "",
        template_descoberta_id_pri: templateDescobertaData?.template_id_pri || "",
        template_descoberta_id_meta: templateDescobertaData?.id_meta || "",
        template_conf_agendado: templateAgendadoData?.nome || "",
        template_conf_agendado_id_pri: templateAgendadoData?.template_id_pri || "",
        template_conf_agendado_id_meta: templateAgendadoData?.id_meta || "",
        template_conf_nao_agendado: templateNaoAgendadoData?.nome || "",
        template_conf_nao_agendado_id_pri: templateNaoAgendadoData?.template_id_pri || "",
        template_conf_nao_agendado_id_meta: templateNaoAgendadoData?.id_meta || "",
        cadencia_completa: prospeccaoData.cadencia_completa ?? false,
        is_teste: prospeccaoData.is_teste ?? false,
      };

      // Adicionar templates 48h/24h quando cadência completa
      if (prospeccaoData.cadencia_completa) {
        webhookPayload.template_agendado_48h = templateAgendado48hData?.nome || "";
        webhookPayload.template_agendado_48h_id_pri = templateAgendado48hData?.template_id_pri || "";
        webhookPayload.template_agendado_48h_id_meta = templateAgendado48hData?.id_meta || "";
        webhookPayload.template_agendado_24h = templateAgendado24hData?.nome || "";
        webhookPayload.template_agendado_24h_id_pri = templateAgendado24hData?.template_id_pri || "";
        webhookPayload.template_agendado_24h_id_meta = templateAgendado24hData?.id_meta || "";
      }

      console.log('📤 Enviando webhook:', webhookPayload);

      // Usar edge function para enviar com token SAGA_ONE
      const { data: response, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: {
          endpoint: 'pri-config',
          ...webhookPayload,
        },
      });

      if (error) {
        console.warn('⚠️ Webhook pri-config retornou erro:', error?.message || error);
        return null;
      } else if (response?.code === 404) {
        console.warn('⚠️ Webhook pri-config: workflow não está ativo no n8n (404). Fluxo continua normalmente.');
        return null;
      } else {
        console.log('✅ Webhook pri-config enviado com sucesso', response);
        // Capturar event_id_pri se retornado pelo webhook
        const eventId = response?.event_id || response?.event_id_pri || response?.id_evento;
        if (eventId) {
          console.log(`✅ event_id_pri capturado do pri-config: ${eventId}`);
          return String(eventId);
        }
        return null;
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao disparar gatilho "pri-config": ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  // Função para chamar webhooks de IA Ligação (criar, atualizar, deletar)
  // IMPORTANTE: Esta função SEMPRE envia o payload padronizado para o webhook
  const callIALigacaoWebhooks = async (prospeccaoData: any, acao: 'criar' | 'atualizar' | 'deletar' = 'criar'): Promise<boolean> => {
    if (!activeCompany?.id) return false;
    
    console.log(`📞 Enviando evento para webhook IA Ligação (${acao}):`, prospeccaoData.titulo);
    
    try {
      setLoadingMessage("Verificando configuração do agente...");
      // Mapear contatos da planilha importada ou da base existente (apenas para criar/atualizar)
      // PADRONIZADO: Sempre enviar como array de {nome, telefone, loja}
      const contatosParaEnviarPadronizado = acao !== 'deletar' 
        ? (contatosLigacao || []).map((c) => ({
            nome: c.nome || '',
            telefone: (c.telefone || '').replace(/\D/g, ''),
          }))
        : [];
      
      console.log(`📤 Enviando para webhook (${acao}) com`, contatosParaEnviarPadronizado.length, 'contatos...');

      // BUSCAR DADOS OBRIGATÓRIOS PARA CRIAR/ATUALIZAR EVENTO
      // - pri_telefone: SEMPRE do agente "Pri - Whatsapp" ativo da loja
      // - pri_dealer_id: SEMPRE o crm_id da loja (empresa)
      let priTelefoneLimpo = '';
      let dealerIdFinal = '';
      let nomePri = 'Pri - Whatsapp';

      if (acao !== 'deletar') {
        // 1) crm_id da loja (OBRIGATÓRIO)
        const { data: empresaCrmData, error: empresaCrmError } = await supabase
          .from('empresas')
          .select('crm_id, nome_empresa, uf, cidade, endereco, marca')
          .eq('id', activeCompany.id)
          .single();

        if (empresaCrmError) {
          console.error('❌ Erro ao buscar crm_id da empresa:', empresaCrmError);
        }

        dealerIdFinal = (empresaCrmData?.crm_id ?? '').trim();
        if (!dealerIdFinal) {
          toast({
            title: 'CRM ID da loja não configurado',
            description: 'Preencha o crm_id desta loja antes de criar/atualizar eventos.',
            variant: 'destructive',
          });
          return false;
        }

        // 2) telefone do agente PRI correto baseado no tipo de evento
        // IA Whatsapp → "Pri - Whatsapp" | IA Ligação → "Pri(Ligação)"
        // IMPORTANTE: buscar via agente_empresas (vínculo correto) já que empresa_id em agentes_ia pode ser NULL
        let priAgenteData: { telefone: string | null; nome: string | null } | null = null;

        // Determinar qual agente buscar baseado no tipo de evento
        const isIALigacao = tipoEvento === 'IA Ligação';
        const isIAWhatsapp = tipoEvento === 'IA Whatsapp';
        
        // Padrões de busca para cada tipo
        // IA Ligação: "Pri(Ligação)", "Pri - Ligação", "Pri Ligação"
        // IA Whatsapp: "Pri - Whatsapp", "Pri Whatsapp"
        const agenteSearchPatterns = isIALigacao 
          ? ['ligação', 'ligacao'] 
          : ['whatsapp'];

        // Buscar agentes vinculados à empresa via agente_empresas
        const { data: agentesVinculados, error: agentesVinculadosErr } = await supabase
          .from('agente_empresas')
          .select(`
            agente_id,
            agentes_ia (
              id,
              nome,
              telefone,
              ativo
            )
          `)
          .eq('empresa_id', activeCompany.id);

        if (agentesVinculadosErr) {
          console.error('❌ Erro ao buscar agentes vinculados (agente_empresas):', agentesVinculadosErr);
        }

        const agentes = (agentesVinculados || [])
          .map((ae: any) => ae.agentes_ia)
          .filter((a: any) => a && a.ativo)
          .filter((a: any, idx: number, self: any[]) => idx === self.findIndex(t => t?.id === a?.id));

        const normalizeTel = (value: any) => (value ? String(value).replace(/\D/g, '') : '');

        // Buscar agente específico para o tipo de evento
        const agenteEspecifico = agentes.find((a: any) => {
          const nome = String(a?.nome || '').toLowerCase();
          const temPri = nome.includes('pri');
          const temPatternCorreto = agenteSearchPatterns.some(pattern => nome.includes(pattern));
          return temPri && temPatternCorreto && normalizeTel(a?.telefone);
        });

        if (agenteEspecifico) {
          priAgenteData = { telefone: agenteEspecifico.telefone, nome: agenteEspecifico.nome };
          console.log(`✅ Agente ${isIALigacao ? 'Pri(Ligação)' : 'Pri - Whatsapp'} encontrado:`, agenteEspecifico.nome);
        }

        // Fallback: qualquer agente ativo com telefone (apenas se não for IA específica)
        if (!priAgenteData && !isIALigacao && !isIAWhatsapp) {
          const agenteComTelefone = agentes.find((a: any) => normalizeTel(a?.telefone));
          if (agenteComTelefone) {
            priAgenteData = { telefone: agenteComTelefone.telefone, nome: agenteComTelefone.nome };
          }
        }

        nomePri = priAgenteData?.nome || nomePri;
        priTelefoneLimpo = priAgenteData?.telefone ? priAgenteData.telefone.replace(/\D/g, '') : '';

        // Nome do agente esperado para mensagem de erro
        const nomeAgenteEsperado = isIALigacao ? "Pri(Ligação)" : "Pri - Whatsapp";

        // VALIDAÇÃO CRÍTICA: não criar/atualizar evento sem pri_telefone
        if (!priTelefoneLimpo) {
          console.warn(`⚠️ Agente ${nomeAgenteEsperado} não encontrado para empresa`, activeCompany.id, {
            tipoEvento,
            totalVinculos: (agentesVinculados || []).length,
            totalAgentesAtivos: agentes.length,
            agentesDisponiveis: agentes.map((a: any) => a?.nome),
          });
          toast({
            title: `Agente ${nomeAgenteEsperado} não configurado`,
            description: `Configure um agente '${nomeAgenteEsperado}' ativo com telefone nesta loja antes de criar/atualizar eventos de ${tipoEvento}.`,
            variant: 'destructive',
          });
          return false;
        }

        console.log(`✅ Agente ${nomeAgenteEsperado} OK:`, { priTelefoneLimpo, dealerIdFinal, nomePri });

        // ============================================================
        // CRIAR/ATUALIZAR EVENTO EXTERNO (IA LIGAÇÃO) VIA EDGE FUNCTION
        // (server-to-server, evita CORS e garante execução)
        // ============================================================
        const idEventoNum = prospeccaoData?.event_id_pri
          ? parseInt(String(prospeccaoData.event_id_pri), 10)
          : undefined;
        const idEventoFinal = Number.isFinite(idEventoNum) ? idEventoNum : undefined;

        const eventoParaEdge = {
          id: String(prospeccaoData.id),
          titulo: String(prospeccaoData.titulo || ''),
          descricao: prospeccaoData.descricao ?? null,
          data_inicio: prospeccaoData.data_inicio ?? null,
          data_fim: prospeccaoData.data_fim ?? null,
          canal: String(prospeccaoData.canal || (isIALigacao ? 'Ligação' : 'Whatsapp')),
          evento_principal: Boolean(prospeccaoData.evento_principal ?? false),
          is_teste: Boolean(prospeccaoData.is_teste ?? false),
          qualificar_lead: Boolean(prospeccaoData.qualificar_lead ?? true),
          imagem_divulgacao_url: prospeccaoData.imagem_divulgacao_url ?? null,
          uf: eventoUF.trim() || empresaCrmData?.uf || null,
          cidade: eventoCidade.trim() || empresaCrmData?.cidade || null,
          endereco: eventoEndereco.trim() || empresaCrmData?.endereco || null,
          ...(idEventoFinal ? { id_evento: idEventoFinal } : {}),
        };

        const contatosParaEdge = contatosParaEnviarPadronizado.map((c) => ({
          nome: c.nome || '',
          telefone: c.telefone || '',
          email: null,
          origem: null,
        }));

        setLoadingMessage(`${acao === 'criar' ? 'Criando' : 'Atualizando'} evento no sistema externo...`);

        console.log(`📤 IA Ligação via edge function (${acao})`, {
          prospeccao_id: prospeccaoData.id,
          empresa_id: activeCompany.id,
          id_evento: idEventoFinal,
          total_contatos: contatosParaEdge.length,
        });

        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('ia-ligacao-webhook', {
          body: {
            evento: eventoParaEdge,
            contatos: contatosParaEdge,
            empresa_id: activeCompany.id,
            acao,
            agente_template: {
              telefone: priTelefoneLimpo,
              dealer_id: dealerIdFinal,
              nome: nomePri,
            },
          },
        });

        if (edgeError) {
          console.error('❌ Erro ao chamar ia-ligacao-webhook:', edgeError);
          toast({
            title: `Erro na operação (${acao})`,
            description: `Falha ao sincronizar evento externo: ${edgeError.message}`,
            variant: 'destructive',
          });
          return false;
        }

        // Verificar se houve erro real (sem id_evento = falha total)
        if ((edgeData as any)?.error && !(edgeData as any)?.id_evento) {
          console.error('❌ ia-ligacao-webhook retornou erro sem id_evento:', edgeData);
          const detalhe =
            (edgeData as any)?.data?.message ||
            (edgeData as any)?.data?.hint ||
            (edgeData as any)?.data?.raw ||
            (edgeData as any)?.error ||
            (edgeData as any)?.message ||
            'Falha ao sincronizar evento externo.';
          toast({
            title: `Erro na operação (${acao})`,
            description: detalhe,
            variant: 'destructive',
          });
          return false;
        }

        // Notificar se o webhook externo falhou mas o evento foi salvo localmente
        if ((edgeData as any)?.webhook_ok === false) {
          console.warn('⚠️ Webhook externo falhou mas evento foi persistido localmente');
          toast({
            title: '⚠️ Aviso: Sincronização parcial',
            description: 'O evento foi salvo localmente, mas o sistema externo não confirmou. A sincronização será feita automaticamente.',
          });
        }

        // Obter id_evento - SEMPRE deve existir após ia-ligacao-webhook
        const returnedIdEvento = (edgeData as any)?.id_evento;
        const idEventoFinalStr = returnedIdEvento ? String(returnedIdEvento) : prospeccaoData.event_id_pri;
        
        // Garantir que event_id_pri está salvo na prospecção
        if (idEventoFinalStr) {
          if (!prospeccaoData.event_id_pri || String(prospeccaoData.event_id_pri) !== idEventoFinalStr) {
            const { error: updateError } = await supabase
              .from('prospeccoes')
              .update({ event_id_pri: idEventoFinalStr })
              .eq('id', prospeccaoData.id);

            if (updateError) {
              console.error('❌ Erro ao salvar event_id_pri:', updateError);
            } else {
              console.log(`✅ event_id_pri "${idEventoFinalStr}" salvo na prospecção ${prospeccaoData.id}`);
            }
          }
        } else {
          console.error('❌ Nenhum id_evento disponível após operação');
        }

        // ============================================================
        // SALVAR BASE NO SUPABASE (FONTE PRIMÁRIA) + SYNC EXTERNO
        // Executa independente do resultado do webhook externo
        // ============================================================
        if (contatosParaEdge.length > 0 && (acao === 'criar' || acao === 'atualizar') && idEventoFinalStr) {
          setLoadingMessage("Salvando base de contatos...");
          console.log(`📦 Salvando ${contatosParaEdge.length} contatos no Supabase (fonte primária)...`);
          
          const { data: baseData, error: baseError } = await supabase.functions.invoke('create-base-ligacao', {
            body: {
              contatos: contatosParaEdge.map(c => ({
                nome: c.nome,
                telefone: c.telefone,
                email: c.email || null,
              })),
              id_evento: parseInt(idEventoFinalStr, 10),
              telefone_pri: priTelefoneLimpo,
              empresa_id: activeCompany.id,
              prospeccao_id: prospeccaoData.id,
              loja: empresaCrmData?.nome_empresa || '',
              sync_external: true,
            }
          });

          if (baseError) {
            console.error('❌ Erro ao salvar base no Supabase:', baseError);
          } else {
            console.log('✅ Base salva no Supabase:', baseData?.summary);
          }
        }

        return true;
      }

      // Para ação 'deletar', enviar para webhook de deleção (se houver)
      if (acao === 'deletar') {
        try {
          toast({
            title: "Evento removido!",
            description: "Evento removido com sucesso.",
          });
          return true;

        } catch (deleteError) {
          console.error('❌ Erro ao deletar evento:', deleteError);
          return false;
        }
      }

      return true;
      
    } catch (error) {
      console.error('❌ Erro ao chamar webhook IA Ligação:', error);
      toast({
        title: `Erro na operação`,
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const triggerNovoEventoCriadoWebhooks = async (prospeccaoData: any, isEditing: boolean): Promise<string | null> => {
    if (!activeCompany?.id) return null;
    
    // Disparar webhook para todos os tipos de evento

    console.log('🔔 Verificando gatilhos para evento tipo:', tipoEvento);

    try {
      // Buscar crm_id da loja (dealerid)
      const { data: empresaData, error: empresaErr } = await supabase
        .from('empresas')
        .select('crm_id')
        .eq('id', activeCompany.id)
        .single();

      if (empresaErr) {
        console.error('❌ Erro ao buscar crm_id da empresa:', empresaErr);
      }

      const dealerIdLoja = (empresaData?.crm_id ?? '').toString().trim();

      // Resolver telefone do agente IA Whatsapp que está disponível na loja (preferir "Pri - Whatsapp")
      const normalize = (v?: string | null) => (v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

      const templateNome = prospeccaoData.template_prospeccao;
      const templateLocal = whatsappTemplates.find((t) => normalize(t.nome) === normalize(templateNome));

      let priTelefone = '';
      let priStatus: 'Ativo' | 'Inativo' = 'Inativo';

      // 1) Se o template aponta para um agente, usar o telefone dele (mesmo que foi usado na criação do template)
      if (templateLocal?.agente_id) {
        const { data: agente, error: agenteErr } = await supabase
          .from('agentes_ia')
          .select('telefone, ativo')
          .eq('id', templateLocal.agente_id)
          .single();

        if (agenteErr) console.error('❌ Erro ao buscar agente do template:', agenteErr);

        priTelefone = agente?.telefone ? agente.telefone.replace(/\D/g, '') : '';
        priStatus = agente?.ativo ? 'Ativo' : 'Inativo';
      }

      // 2) Se não tiver agente_id no template, usar pri_telefone salvo no template
      if (!priTelefone && templateLocal?.pri_telefone) {
        priTelefone = templateLocal.pri_telefone.replace(/\D/g, '');
        priStatus = 'Ativo';
      }

      // 3) Fallback: procurar agente "Pri - Whatsapp" vinculado à loja via agente_empresas
      if (!priTelefone) {
        const { data: priLink, error: priLinkErr } = await supabase
          .from('agente_empresas')
          .select(`agente_id, agentes_ia!inner(telefone, nome, ativo)`)
          .eq('empresa_id', activeCompany.id)
          .eq('agentes_ia.ativo', true)
          .ilike('agentes_ia.nome', '%pri%whatsapp%')
          .limit(1)
          .maybeSingle();

        if (priLinkErr) console.error('❌ Erro ao buscar Pri - Whatsapp (agente_empresas):', priLinkErr);

        const a = (priLink as any)?.agentes_ia;
        priTelefone = a?.telefone ? String(a.telefone).replace(/\D/g, '') : '';
        priStatus = a?.ativo ? 'Ativo' : 'Inativo';
      }

      // 4) Último fallback: qualquer agente ativo vinculado à loja
      if (!priTelefone) {
        const { data: anyLink } = await supabase
          .from('agente_empresas')
          .select(`agente_id, agentes_ia!inner(telefone, nome, ativo)`)
          .eq('empresa_id', activeCompany.id)
          .eq('agentes_ia.ativo', true)
          .limit(1)
          .maybeSingle();

        const a = (anyLink as any)?.agentes_ia;
        priTelefone = a?.telefone ? String(a.telefone).replace(/\D/g, '') : '';
        priStatus = a?.ativo ? 'Ativo' : 'Inativo';
      }

      console.log('📌 Evento (novo_evento_criado) - pri resolvido:', { dealerIdLoja, priTelefone, priStatus, templateNome });

      // Buscar gatilhos ativos do tipo "novo_evento_criado"
      const { data: gatilhos, error } = await supabase
        .from('gatilhos')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .eq('status', 'Ativo');

      if (error) {
        console.error('Erro ao buscar gatilhos:', error);
        return null;
      }

      // Filtrar gatilhos do tipo "novo_evento_criado"
      const gatilhosEvento = gatilhos?.filter(g => {
        const acoes = g.acoes as any;
        return acoes?.tipo_evento === 'novo_evento_criado';
      }) || [];

      if (gatilhosEvento.length === 0) {
        console.log('Nenhum gatilho de novo_evento_criado configurado');
        return null;
      }

      // Formatar datas para ISO 8601
      const formatarDataISO = (data: string | null) => {
        if (!data) return null;
        try {
          return new Date(data).toISOString();
        } catch {
          return null;
        }
      };

      // Preparar payload para os webhooks
      const payload: any = {
        evento_id: prospeccaoData.id,
        titulo: prospeccaoData.titulo,
        descricao: prospeccaoData.descricao,
        tipo_evento: tipoEvento,
        data_inicio: formatarDataISO(prospeccaoData.data_inicio ? prospeccaoData.data_inicio + 'T11:00:00' : null),
        data_fim: formatarDataISO(prospeccaoData.data_fim ? prospeccaoData.data_fim + 'T23:59:59' : null),
        canal: prospeccaoData.canal,
        acao: isEditing ? 'alterado' : 'criado',
        empresa_id: activeCompany.id,
        data: new Date().toISOString(),
        // Dados da Pri (agente IA Whatsapp da loja)
        pri_telefone: priTelefone || null,
        pri_dealer_id: dealerIdLoja || null,
        pri_status: priStatus,
        // Novos campos
        evento_principal: prospeccaoData.evento_principal ?? false,
        qualificar_lead: prospeccaoData.qualificar_lead ?? true,
        data_envio_template_inicial: formatarDataISO(prospeccaoData.data_envio_template_inicial),
        data_envio_cadencia: formatarDataISO(prospeccaoData.data_envio_cadencia),
        cadencia_completa: prospeccaoData.cadencia_completa ?? false,
        is_teste: prospeccaoData.is_teste ?? false,
      };

      // Adicionar templates para IA Whatsapp com IDs Pri e Meta
      if (tipoEvento === 'IA Whatsapp') {
        const lookupTemplateById = async (templateId?: string | null) => {
          if (!templateId) return null;

          const localMatch = whatsappTemplates.find((t) => t.id === templateId);
          if (localMatch?.template_id_pri || localMatch?.id_meta) return localMatch;

          const { data, error } = await supabase
            .from('whatsapp_templates')
            .select('id, nome, template_id_pri, id_meta')
            .eq('id', templateId)
            .maybeSingle();
          if (error) throw error;
          return data ?? localMatch ?? null;
        };

        const templateProspeccaoUuid = (prospeccaoData as any).template_prospeccao_id as string | null | undefined;
        const templateAgendadoUuid = (prospeccaoData as any).template_agendado_id as string | null | undefined;
        const templateNaoAgendadoUuid = (prospeccaoData as any).template_nao_agendado_id as string | null | undefined;
        const templateAgendado48hUuid = (prospeccaoData as any).template_agendado_48h_id as string | null | undefined;
        const templateAgendado24hUuid = (prospeccaoData as any).template_agendado_24h_id as string | null | undefined;

        const [templateProspeccaoData, templateAgendadoData, templateNaoAgendadoData, templateAgendado48hData, templateAgendado24hData] = await Promise.all([
          lookupTemplateById(templateProspeccaoUuid),
          lookupTemplateById(templateAgendadoUuid),
          lookupTemplateById(templateNaoAgendadoUuid),
          lookupTemplateById(templateAgendado48hUuid),
          lookupTemplateById(templateAgendado24hUuid),
        ]);

        // Enviar tanto o UUID (novo padrão) quanto os ids externos (PRI/Meta)
        payload.template_prospeccao_id = templateProspeccaoUuid || null;
        payload.template_prospeccao = templateProspeccaoData?.nome || null;
        payload.template_prospeccao_id_pri = templateProspeccaoData?.template_id_pri || null;
        payload.template_prospeccao_id_meta = templateProspeccaoData?.id_meta || null;

        payload.template_agendado_id = templateAgendadoUuid || null;
        payload.template_agendado = templateAgendadoData?.nome || null;
        payload.template_agendado_id_pri = templateAgendadoData?.template_id_pri || null;
        payload.template_agendado_id_meta = templateAgendadoData?.id_meta || null;

        payload.template_nao_agendado_id = templateNaoAgendadoUuid || null;
        payload.template_nao_agendado = templateNaoAgendadoData?.nome || null;
        payload.template_nao_agendado_id_pri = templateNaoAgendadoData?.template_id_pri || null;
        payload.template_nao_agendado_id_meta = templateNaoAgendadoData?.id_meta || null;

        // Templates 48h/24h quando cadência completa
        if (prospeccaoData.cadencia_completa) {
          payload.template_agendado_48h_id = templateAgendado48hUuid || null;
          payload.template_agendado_48h = templateAgendado48hData?.nome || null;
          payload.template_agendado_48h_id_pri = templateAgendado48hData?.template_id_pri || null;
          payload.template_agendado_48h_id_meta = templateAgendado48hData?.id_meta || null;

          payload.template_agendado_24h_id = templateAgendado24hUuid || null;
          payload.template_agendado_24h = templateAgendado24hData?.nome || null;
          payload.template_agendado_24h_id_pri = templateAgendado24hData?.template_id_pri || null;
          payload.template_agendado_24h_id_meta = templateAgendado24hData?.id_meta || null;
        }
      }

      console.log(`📤 Disparando ${gatilhosEvento.length} gatilho(s) de novo_evento_criado para ${tipoEvento}`);
      console.log('📦 Payload:', payload);

      // Disparar cada webhook
      let capturedEventIdPri: string | null = null;
      for (const gatilho of gatilhosEvento) {
        const webhookUrl = (gatilho.acoes as any)?.webhook_url;
        if (!webhookUrl) continue;

        try {
          const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('external-webhook-proxy', {
            body: {
              webhook_url: webhookUrl,
              ...payload
            }
          });

          if (proxyError) {
            console.error(`❌ Erro ao disparar gatilho "${gatilho.nome}": ${proxyError.message}`);
          } else {
            console.log(`✅ Gatilho "${gatilho.nome}" disparado com sucesso`);
            console.log('📥 Resposta do webhook:', proxyResponse);
            
            // Se retornou event_id, salvar na prospecção
            const returnedEventId = proxyResponse?.event_id || proxyResponse?.event_id_pri || proxyResponse?.id_evento;
            if (returnedEventId) {
              capturedEventIdPri = String(returnedEventId);
              const { error: updateError } = await supabase
                .from('prospeccoes')
                .update({ event_id_pri: capturedEventIdPri })
                .eq('id', prospeccaoData.id);
              
              if (updateError) {
                console.error(`❌ Erro ao salvar event_id_pri: ${updateError.message}`);
              } else {
                console.log(`✅ event_id_pri "${capturedEventIdPri}" salvo na prospecção ${prospeccaoData.id}`);
              }
            }
            
            // Atualizar ultima_execucao do gatilho
            await supabase
              .from('gatilhos')
              .update({ ultima_execucao: new Date().toISOString() })
              .eq('id', gatilho.id);
          }
        } catch (webhookError) {
          console.error(`❌ Erro ao disparar gatilho "${gatilho.nome}": ${webhookError instanceof Error ? webhookError.message : 'Erro desconhecido'}`);
        }
      }
      return capturedEventIdPri;
    } catch (error) {
      console.error(`❌ Erro ao processar gatilhos de "novo_evento_criado": ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return null;
    }
  };

  const aplicarModeloDescricao = async () => {
    if (!activeCompany?.id) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa",
        variant: "destructive"
      });
      return;
    }

    // Formatar data do evento
    let dataEvento = 'Data do evento';
    if (dataInicio && dataFim) {
      const formatarData = (d: string) => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };
      if (dataInicio === dataFim) {
        dataEvento = formatarData(dataInicio);
      } else {
        dataEvento = `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
      }
    } else if (dataInicio) {
      const date = new Date(dataInicio + 'T00:00:00');
      dataEvento = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // Formatar localização do evento (para IA Ligação)
    let localEvento = 'Local do evento';
    if (tipoEvento === 'IA Ligação' && (eventoEndereco.trim() || eventoCidade.trim() || eventoUF.trim())) {
      const partes: string[] = [];
      if (eventoEndereco.trim()) partes.push(eventoEndereco.trim());
      if (eventoCidade.trim()) partes.push(eventoCidade.trim());
      if (eventoUF.trim()) partes.push(eventoUF.trim());
      localEvento = partes.join(' - ');
    }

    const modeloPadrao = `🔥 **Evento Especial – Uma Experiência Exclusiva!**

Chegou o momento que você esperava!
Convidamos você para um evento exclusivo de vendas, com atendimento VIP e condições únicas válidas apenas neste evento especial.

✨ O que te espera:
• Ofertas exclusivas disponíveis somente no dia do evento
• Atendimento personalizado
• Condições especiais de financiamento
• Oportunidades únicas

🗓️ ${dataEvento}

Garanta sua presença e não perca essa oportunidade única!

ATENÇÃO: A equipe deve apenas convidar e confirmar interesse. Não deve falar sobre valores, taxas, entrada, financiamento, simulações ou detalhes técnicos.

📍 Localização do Evento:
${localEvento}`;

    // Buscar modelo do banco de dados
    const { data, error } = await supabase
      .from('mensagens_padrao')
      .select('mensagem')
      .eq('empresa_id', activeCompany.id)
      .eq('tipo', 'Modelo Descrição Prospecção')
      .single();

    let descricaoFinal: string;
    if (error || !data?.mensagem) {
      // Se não encontrar, criar o registro com o modelo padrão para esta empresa
      await supabase
        .from('mensagens_padrao')
        .insert([{ 
          tipo: 'Modelo Descrição Prospecção', 
          mensagem: modeloPadrao, 
          periodo_dias: 0, 
          empresa_id: activeCompany.id 
        }]);
      
      descricaoFinal = modeloPadrao;
    } else {
      // Substituir placeholders no modelo salvo no banco
      descricaoFinal = data.mensagem
        .replace(/🗓️\s*Data do evento/gi, `🗓️ ${dataEvento}`)
        .replace(/📍\s*Local do evento/gi, `📍 ${localEvento}`);
    }
    
    setDescricao(descricaoFinal);
    
    toast({
      title: "Modelo aplicado",
      description: "Descrição padrão foi inserida no campo. Edite em Configurações > Mensagens."
    });
  };

  // Função para processar planilha de contatos para IA Ligação
  const handleFileLigacao = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    
    const isExcel = selectedFile.type.includes('excel') || selectedFile.type.includes('spreadsheet') || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv');
    
    if (!isExcel && !isCsv) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)",
        variant: "destructive",
      });
      return;
    }
    
    setProcessandoPlanilha(true);
    // Limpar estados anteriores
    setContatosLigacao([]);
    setContatosInvalidos([]);
    setContatosDuplicados([]);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = safeRead(arrayBuffer);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados suficientes",
          variant: "destructive",
        });
        setProcessandoPlanilha(false);
        return;
      }

      const headers = (jsonData[0] as any[]).map(h => h?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '');
      const dataRows = jsonData.slice(1) as any[][];

      // Encontrar índices das colunas
      const findIndex = (names: string[]) => {
        for (let i = 0; i < headers.length; i++) {
          if (names.some(n => headers[i].includes(n))) return i;
        }
        return -1;
      };

      const nomeIdx = findIndex(['nome']);
      const telefoneIdx = findIndex(['telefone', 'phone', 'celular', 'whatsapp', 'fone']);
      const emailIdx = findIndex(['email', 'e-mail']);
      const cpfIdx = findIndex(['cpf']);

      if (nomeIdx === -1 || telefoneIdx === -1) {
        toast({
          title: "Colunas obrigatórias não encontradas",
          description: "Não foi possível identificar as colunas 'Nome' e 'Telefone' no cabeçalho.",
          variant: "destructive",
        });
        setProcessandoPlanilha(false);
        return;
      }

      // Extrair todos os contatos brutos
      const contatosBrutos = dataRows
        .filter(row => row && row.length > 0)
        .map(row => ({
          nome: nomeIdx >= 0 ? row[nomeIdx]?.toString().trim() || '' : '',
          telefone: telefoneIdx >= 0 ? row[telefoneIdx]?.toString().trim() || '' : '',
          email: emailIdx >= 0 ? row[emailIdx]?.toString().trim() || '' : '',
          cpf: cpfIdx >= 0 ? row[cpfIdx]?.toString().trim() || '' : '',
        }))
        .filter(c => c.nome || c.telefone);

      // Validar e normalizar telefones para 10 dígitos
      const validationResult = validatePhoneBatchForIALigacao(contatosBrutos);
      
      // Contatos válidos com telefone normalizado
      const contatosValidos = validationResult.valid.map(v => {
        const original = contatosBrutos[v.index];
        return {
          nome: original.nome,
          telefone: original.telefone,
          telefoneNormalizado: v.normalized,
          email: original.email,
          cpf: original.cpf,
        };
      });
      
      // Contatos inválidos
      const invalidos = validationResult.invalid.map(inv => ({
        nome: contatosBrutos[inv.index]?.nome || '',
        telefone: inv.original,
        motivo: inv.errorMessage,
        index: inv.index,
      }));
      
      // Contatos duplicados
      const duplicados = validationResult.duplicates.map(dup => ({
        nome: contatosBrutos[dup.index]?.nome || '',
        telefone: dup.original,
        motivo: `Duplicado do contato #${dup.duplicateOf + 1}`,
        index: dup.index,
      }));

      setContatosLigacao(contatosValidos);
      setContatosInvalidos(invalidos);
      setContatosDuplicados(duplicados);
      setProcessandoPlanilha(false);
      
      // Mostrar resumo
      const { summary } = validationResult;
      if (summary.invalid > 0 || summary.duplicates > 0) {
        toast({
          title: "Arquivo processado com alertas",
          description: `${summary.valid} válidos | ${summary.invalid} inválidos | ${summary.duplicates} duplicados`,
          variant: summary.valid === 0 ? "destructive" : "default",
        });
      } else {
        toast({
          title: "Arquivo processado",
          description: `${summary.valid} contatos válidos encontrados`,
        });
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setProcessandoPlanilha(false);
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto",
        variant: "destructive",
      });
    }
    
    // Limpar input para permitir reselecionar o mesmo arquivo
    event.target.value = '';
  };

  const handleCancel = () => {
    clearForm();
    onOpenChange(false);
  };

  // Função para atualizar descrição com dados de localização (IA Ligação)
  const atualizarDescricaoComLocalizacao = (uf: string, cidade: string, endereco: string) => {
    if (tipoEvento !== 'IA Ligação') return;
    
    // Só atualiza se pelo menos um campo de localização estiver preenchido
    if (!uf.trim() && !cidade.trim() && !endereco.trim()) return;
    
    // Formatar endereço completo
    const partes: string[] = [];
    if (endereco.trim()) partes.push(endereco.trim());
    if (cidade.trim()) partes.push(cidade.trim());
    if (uf.trim()) partes.push(uf.trim());
    
    const enderecoCompleto = partes.join(' - ');
    
    // Atualizar descrição - mantém conteúdo existente antes da seção de localização
    const marcador = '📍 Localização do Evento:';
    const descricaoAtual = descricao.trim();
    const indexMarcador = descricaoAtual.indexOf(marcador);
    
    let novaDescricao: string;
    if (indexMarcador >= 0) {
      // Substitui a seção de localização existente
      const antesDoMarcador = descricaoAtual.substring(0, indexMarcador).trim();
      novaDescricao = antesDoMarcador ? `${antesDoMarcador}\n\n${marcador}\n${enderecoCompleto}` : `${marcador}\n${enderecoCompleto}`;
    } else {
      // Adiciona a seção de localização ao final
      novaDescricao = descricaoAtual ? `${descricaoAtual}\n\n${marcador}\n${enderecoCompleto}` : `${marcador}\n${enderecoCompleto}`;
    }
    
    setDescricao(novaDescricao);
  };

  const handleNextStep = () => {
    if (currentStep === 0 && !titulo.trim()) {
      toast({
        title: "Erro",
        description: "O título é obrigatório",
        variant: "destructive"
      });
      return;
    }
    
    // Validação específica para IA Whatsapp: descrição obrigatória
    if (tipoEvento === 'IA Whatsapp' && currentStepName === 'Configuração IA') {
      if (!descricao.trim()) {
        toast({
          title: "Campo obrigatório",
          description: "A Descrição é obrigatória para eventos do tipo IA Whatsapp.",
          variant: "destructive"
        });
        return;
      }
    }

    // Validação específica para IA Ligação na etapa de Configuração IA
    if (tipoEvento === 'IA Ligação' && currentStepName === 'Configuração IA') {
      if (!eventoUF.trim() || !eventoCidade.trim() || !eventoEndereco.trim()) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha o Estado (UF), Cidade e Endereço do evento para continuar.",
          variant: "destructive"
        });
        return;
      }
    }
    
    if (!isLastStep) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Calcular meta total de vendas
  const metaTotalVendas = (Number(metaNovos) || 0) + (Number(metaSeminovos) || 0) + (Number(metaDiretas) || 0);

  // Calcular metas automaticamente com base nas vendas
  const calcularMetasFunil = (totalVendas: number) => {
    if (totalVendas <= 0) return { checkins: 0, confirmacoes: 0, convites: 0 };
    
    const checkins = Math.ceil(totalVendas / 0.30);
    const confirmacoes = Math.ceil(checkins / 0.30);
    const convites = Math.ceil(confirmacoes / 0.33);
    
    return { checkins, confirmacoes, convites };
  };

  // Handler para alteração de metas de vendas
  const handleMetaVendaChange = (
    setter: React.Dispatch<React.SetStateAction<number | "">>,
    value: string,
    otherMetas: { novos?: number | ""; seminovos?: number | ""; diretas?: number | "" }
  ) => {
    const numValue = value === "" ? "" : Number(value);
    setter(numValue);
    
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

  // Tooltip configs
  const tooltipConfigs = {
    novos: { title: "Meta de Novos", description: "Quantidade de veículos novos que você espera vender.", exemplo: "Ex: Para um evento de 2 dias, meta de 4-6 novos." },
    seminovos: { title: "Meta de Seminovos", description: "Quantidade de seminovos/usados esperados.", exemplo: "Ex: Meta de 6-10 seminovos." },
    diretas: { title: "Meta de Vendas Diretas", description: "Vendas diretas (frotistas, PJ, corporativas).", exemplo: "Ex: 2-4 diretas." },
    checkins: { title: "Meta de Check-ins", description: "Clientes que devem comparecer. 30% resultam em vendas.", exemplo: "Ex: Para 10 vendas, ~34 check-ins." },
    confirmacoes: { title: "Meta de Confirmações", description: "Clientes que devem confirmar. 30% comparecem.", exemplo: "Ex: Para 34 check-ins, ~112 confirmações." },
    convites: { title: "Meta de Convites", description: "Clientes que devem ser convidados. 33% confirmam.", exemplo: "Ex: Para 112 confirmações, ~340 convites." }
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

  // Premiações configs
  const premiacaoConfigs = {
    equipe_campea: { nome: "Equipe Campeã", tooltip: "Equipe com mais vendas." },
    equipe_2lugar: { nome: "Equipe 2º Lugar", tooltip: "Segunda maior quantidade de vendas." },
    equipe_3lugar: { nome: "Equipe 3º Lugar", tooltip: "Terceira maior quantidade de vendas." },
    vendedor_ouro: { nome: "Vendedor Ouro", tooltip: "Melhor vendedor do evento." },
    vendedor_prata: { nome: "Vendedor Prata", tooltip: "Segundo melhor vendedor." },
    vendedor_bronze: { nome: "Vendedor Bronze", tooltip: "Terceiro melhor vendedor." },
    prospector_ouro: { nome: "Prospector Ouro", tooltip: "Vendedor que mais prospectar." },
    prospector_prata: { nome: "Prospector Prata", tooltip: "Segundo maior número de prospecções." },
    prospector_bronze: { nome: "Prospector Bronze", tooltip: "Terceiro maior número de prospecções." },
    checkin_ouro: { nome: "Check-ins Ouro", tooltip: "Maior registro de comparecimento." },
    checkin_prata: { nome: "Check-ins Prata", tooltip: "Segundo maior registro." },
    checkin_bronze: { nome: "Check-ins Bronze", tooltip: "Terceiro maior registro." },
    participacao_apoio: { nome: "Participação Apoio", tooltip: "Cada membro da equipe de apoio." },
    indicacao_venda: { nome: "Indicação de Venda", tooltip: "Cada indicação de venda." },
  };

  // Calcular total de premiações
  const totalPremiacoes = Object.values(premiacoes).reduce((acc, p) => {
    if (p.ativo && p.valor !== "") return acc + Number(p.valor);
    return acc;
  }, 0) + outrasPremiacoes.reduce((acc, p) => {
    if (p.ativo && p.valor !== "") return acc + Number(p.valor);
    return acc;
  }, 0);

  const handlePremiacaoToggle = (key: string, checked: boolean) => {
    setPremiacoes(prev => ({
      ...prev,
      [key]: { ...prev[key], ativo: checked, valor: checked ? prev[key].valor : "" }
    }));
  };

  const handlePremiacaoValorChange = (key: string, valor: string) => {
    const numericValue = valor.replace(/\D/g, '');
    const numberValue = numericValue === "" ? "" : Number(numericValue) / 100;
    setPremiacoes(prev => ({
      ...prev,
      [key]: { ...prev[key], valor: numberValue }
    }));
  };

  const formatCurrency = (value: number | "") => {
    if (value === "" || value === 0) return "";
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderPremiacaoField = (premioKey: string, IconComponent: React.ElementType) => {
    const config = premiacaoConfigs[premioKey as keyof typeof premiacaoConfigs];
    const premiacao = premiacoes[premioKey];
    
    return (
      <div key={premioKey} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${premiacao.ativo ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-300'}`}>
        <Switch
          checked={premiacao.ativo}
          onCheckedChange={(checked) => handlePremiacaoToggle(premioKey, checked)}
          className={premiacao.ativo ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-gray-400'}
        />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <IconComponent className={`h-4 w-4 flex-shrink-0 ${premiacao.ativo ? 'text-green-600' : 'text-gray-500'}`} />
          <span className={`text-sm truncate ${premiacao.ativo ? 'font-medium text-green-700' : 'text-gray-600'}`}>{config.nome}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] p-2">
                <p className="text-xs">{config.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="w-28 flex-shrink-0 relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            disabled={!premiacao.ativo}
            value={formatCurrency(premiacao.valor)}
            onChange={(e) => handlePremiacaoValorChange(premioKey, e.target.value)}
            className="text-right text-sm h-8 pl-7"
          />
        </div>
      </div>
    );
  };

  // Renderizar conteúdo da etapa atual
  const renderStepContent = () => {
    switch (currentStepName) {
      case 'Dados Gerais':
        return (
          <div className="space-y-4">
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
              <Label htmlFor="tipoEvento">Tipo do Evento *</Label>
              <Select
                value={tipoEvento}
                onValueChange={(value: TipoEvento) => {
                  setTipoEvento(value);
                  setCurrentStep(0); // Reset step when type changes
                  // Default canal: Ligação para Prospecção Mensal e Grande Evento
                  if (value === 'Prospecção Mensal' || value === 'Grande Evento') {
                    setCanal('Ligação');
                  } else if (value === 'IA Whatsapp') {
                    setCanal('Whatsapp');
                  } else if (value === 'IA Ligação') {
                    setCanal('Ligação');
                  }
                }}
                disabled={!!editingProspeccao}
              >
                <SelectTrigger disabled={!!editingProspeccao}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {canCreateEventos && (
                    <SelectItem value="Prospecção Mensal">Prospecção Mensal</SelectItem>
                  )}
                  {canCreateEventos && (
                    <SelectItem value="Grande Evento">Grande Evento</SelectItem>
                  )}
                  {canCreateEventos && (
                    <SelectItem value="IA Whatsapp">IA Whatsapp</SelectItem>
                  )}
                  {canCreateIALigacao && (
                    <SelectItem value="IA Ligação">IA Ligação</SelectItem>
                  )}
                </SelectContent>
              </Select>
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

            {/* Canal de Prospecção - apenas para Prospecção Mensal e Grande Evento */}
            {(tipoEvento === 'Prospecção Mensal' || tipoEvento === 'Grande Evento') && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="canal_quarentena">Canal de Prospecção</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Os contatos desta prospecção entrarão em quarentena para o canal selecionado. WhatsApp: 20 dias / Ligação: 30 dias após o fim do evento.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={canalQuarentena} onValueChange={(value: 'whatsapp' | 'ligacao') => setCanalQuarentena(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Evento de Teste - para todos os tipos */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <Label htmlFor="is_teste" className="font-medium cursor-pointer">
                  Evento de Teste
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Eventos de teste não geram quarentena para os contatos.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                id="is_teste"
                checked={editingProspeccao ? (editingProspeccao.is_teste ?? false) : isTeste}
                onCheckedChange={setIsTeste}
                disabled={!!editingProspeccao}
              />
            </div>

            {/* Toggle Cadência Completa - visível na criação com flag OU na edição se já estava ativa */}
            {tipoEvento === 'IA Whatsapp' && (cadenciaCompletaFlagEnabled || editingProspeccao?.cadencia_completa) && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <Label htmlFor="cadencia_completa" className="font-medium cursor-pointer">
                    Cadência completa
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {editingProspeccao ? (
                          <p>Definido na criação, não pode ser alterado.</p>
                        ) : (
                          <p>Quando ativado, habilita cadências com horários fixos: 48h e 24h antes do evento para agendados e 4h após o disparo inicial para "não responderam". Os horários não podem ser alterados.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  id="cadencia_completa"
                  checked={editingProspeccao ? (editingProspeccao.cadencia_completa ?? false) : cadenciaCompleta}
                  onCheckedChange={setCadenciaCompleta}
                  disabled={!!editingProspeccao}
                />
              </div>
            )}

          </div>
        );

      case 'Configuração IA':
        if (tipoEvento === 'IA Whatsapp') {
          return (
            <div className="space-y-4">
              {/* Descrição com borda e botão expandir */}
              <div className="rounded-lg border border-border p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="descricao">Descrição <span className="text-destructive">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={aplicarModeloDescricao}>
                      <FileText className="w-4 h-4 mr-1" />
                      Aplicar modelo
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setDescricaoExpandida(!descricaoExpandida)}
                    >
                      {descricaoExpandida ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="descricao"
                  placeholder="Descreva os detalhes da prospecção..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={descricaoExpandida ? 16 : 6}
                  className="resize-none transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template_prospeccao">
                  Template Prospecção <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select value={templateProspeccaoId} onValueChange={(value) => {
                    if (value === templateAgendadoId || value === templateNaoAgendadoId) {
                      toast({
                        title: "Template já utilizado",
                        description: "Este template já está selecionado em outro campo. Escolha um template diferente.",
                        variant: "destructive"
                      });
                      return;
                    }
                    setTemplateProspeccaoId(value);
                  }}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um template aprovado" />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappTemplates
                        .filter(t => (t.template_id_pri || t.id_meta) && t.id !== templateAgendadoId && t.id !== templateNaoAgendadoId)
                        .map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {templateProspeccaoId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setTemplateProspeccaoId("")}
                      className="shrink-0"
                      title="Limpar seleção"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {!templateProspeccaoId && (
                  <p className="text-xs text-destructive">Template de prospecção é obrigatório</p>
                )}
              </div>
              
              {/* Template Agendado - visível apenas quando cadência completa está desativa */}
              {!(cadenciaCompleta || editingProspeccao?.cadencia_completa) && (
              <div className="space-y-2">
                <Label htmlFor="template_agendado">Template Agendado (opcional)</Label>
                <div className="flex gap-2">
                  <Select value={templateAgendadoId} onValueChange={(value) => {
                    if (value === templateProspeccaoId || value === templateNaoAgendadoId) {
                      toast({
                        title: "Template já utilizado",
                        description: "Este template já está selecionado em outro campo. Escolha um template diferente.",
                        variant: "destructive"
                      });
                      return;
                    }
                    setTemplateAgendadoId(value);
                  }}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um template aprovado" />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappTemplates
                        .filter(t => (t.template_id_pri || t.id_meta) && t.id !== templateProspeccaoId && t.id !== templateNaoAgendadoId)
                        .map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {templateAgendadoId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setTemplateAgendadoId("")}
                      className="shrink-0"
                      title="Limpar seleção"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              )}

              {/* Templates Agendado 48h e 24h - visíveis apenas quando cadência completa está ativa */}
              {(cadenciaCompleta || editingProspeccao?.cadencia_completa) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="template_agendado_48h">
                      Template Agendado 48h <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Select value={templateAgendado48hId} onValueChange={setTemplateAgendado48hId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um template aprovado" />
                        </SelectTrigger>
                        <SelectContent>
                          {whatsappTemplates
                            .filter(t => (t.template_id_pri || t.id_meta) && t.id !== templateProspeccaoId && t.id !== templateAgendado24hId && t.id !== templateNaoAgendadoId)
                            .map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {templateAgendado48hId && (
                        <Button type="button" variant="outline" size="icon" onClick={() => setTemplateAgendado48hId("")} className="shrink-0" title="Limpar seleção">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Enviado automaticamente 48h antes do início do evento</p>
                    {!templateAgendado48hId && (
                      <p className="text-xs text-destructive">Template obrigatório</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template_agendado_24h">
                      Template Agendado 24h <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Select value={templateAgendado24hId} onValueChange={setTemplateAgendado24hId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um template aprovado" />
                        </SelectTrigger>
                        <SelectContent>
                          {whatsappTemplates
                            .filter(t => (t.template_id_pri || t.id_meta) && t.id !== templateProspeccaoId && t.id !== templateAgendado48hId && t.id !== templateNaoAgendadoId)
                            .map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {templateAgendado24hId && (
                        <Button type="button" variant="outline" size="icon" onClick={() => setTemplateAgendado24hId("")} className="shrink-0" title="Limpar seleção">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Enviado automaticamente 24h antes do início do evento</p>
                    {!templateAgendado24hId && (
                      <p className="text-xs text-destructive">Template obrigatório</p>
                    )}
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="template_nao_agendado">
                    Template Não Responderam {(cadenciaCompleta || editingProspeccao?.cadencia_completa) ? <span className="text-destructive">*</span> : '(opcional)'}
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-medium mb-1">Motivo:</p>
                        <p>Quem respondeu terá uma cadência automática "como a Maia", sem gastar dinheiro com template. Isso vale para os leads que responderam, mas não agendaram.</p>
                        {(cadenciaCompleta || editingProspeccao?.cadencia_completa) && (
                          <p className="mt-2 text-xs">Será enviado 4 horas após o disparo inicial.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Select value={templateNaoAgendadoId} onValueChange={(value) => {
                    if (value === templateProspeccaoId || value === templateAgendadoId) {
                      toast({
                        title: "Template já utilizado",
                        description: "Este template já está selecionado em outro campo. Escolha um template diferente.",
                        variant: "destructive"
                      });
                      return;
                    }
                    setTemplateNaoAgendadoId(value);
                  }}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um template aprovado" />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappTemplates
                        .filter(t => (t.template_id_pri || t.id_meta) && t.id !== templateProspeccaoId && t.id !== templateAgendadoId)
                        .map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {templateNaoAgendadoId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setTemplateNaoAgendadoId("")}
                      className="shrink-0"
                      title="Limpar seleção"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {(cadenciaCompleta || editingProspeccao?.cadencia_completa) && !templateNaoAgendadoId && (
                  <p className="text-xs text-destructive">Obrigatório com cadência completa ativa</p>
                )}
              </div>

              {/* Configurações de Disparo - ocultas quando cadência completa ativa */}
              {!(cadenciaCompleta || editingProspeccao?.cadencia_completa) && (
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-4">Configurações de Disparo</h4>
                
                {/* Aviso sobre Disparo Inicial */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Label>Disparo Inicial</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>O disparo inicial é realizado manualmente pelo botão "Disparar" na tela do evento.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      O disparo inicial é feito no momento em que você clica no botão de disparo na tela do evento. Apenas a cadência pode ser configurada com data/hora.
                    </p>
                  </div>
                </div>

                {/* Data/Hora Cadência */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="data_envio_cadencia">Data/Hora da Cadência</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Define quando a mensagem de confirmação será enviada. Por padrão é 24 horas antes do início do evento.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="data_envio_cadencia"
                    type="datetime-local"
                    value={dataEnvioCadencia}
                    onChange={(e) => setDataEnvioCadencia(e.target.value)}
                    placeholder="24h antes do evento (padrão)"
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para usar 24h antes do evento</p>
                </div>
              </div>
              )}

              {/* Info sobre cadências fixas quando cadência completa ativa */}
              {(cadenciaCompleta || editingProspeccao?.cadencia_completa) && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3">Cadências Fixas (automáticas)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">Agendados: <strong>48h</strong> e <strong>24h</strong> antes do início do evento</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">Não responderam: <strong>4h</strong> após o disparo inicial</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Separador */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-4">Configurações do Evento</h4>
                
                {/* Evento Principal */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card mb-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="evento_principal" className="font-medium cursor-pointer">Evento Principal</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Se ativado, quando um lead falar com a Pri nessa empresa, ele será automaticamente direcionado para este evento.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="evento_principal"
                    checked={eventoPrincipal}
                    onCheckedChange={setEventoPrincipal}
                  />
                </div>

                {/* Qualificar Lead */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="qualificar_lead" className="font-medium cursor-pointer">Qualificar Lead após Confirmação</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Se ativado, o lead será qualificado para a loja após confirmação. Se desativado, o lead ficará na central de atendimento na coluna 'Agendados' com a tag 'CONFIRMADO'.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="qualificar_lead"
                    checked={qualificarLead}
                    onCheckedChange={setQualificarLead}
                  />
                </div>
              </div>
            </div>
          );
        } else {
          // IA Ligação - Configuração de localização + Upload de Base
          return (
            <div className="space-y-4">
              {/* Localização do Evento */}
              <div className="rounded-lg border border-border p-4 bg-card">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">Localização do Evento *</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventoUF">Estado (UF) *</Label>
                    <Input
                      id="eventoUF"
                      placeholder="Ex: GO"
                      value={eventoUF}
                      onChange={(e) => {
                        const newValue = e.target.value.toUpperCase().slice(0, 2);
                        setEventoUF(newValue);
                        atualizarDescricaoComLocalizacao(newValue, eventoCidade, eventoEndereco);
                      }}
                      maxLength={2}
                      className={!eventoUF.trim() ? 'border-destructive' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventoCidade">Cidade *</Label>
                    <Input
                      id="eventoCidade"
                      placeholder="Ex: Goiânia"
                      value={eventoCidade}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEventoCidade(newValue);
                        atualizarDescricaoComLocalizacao(eventoUF, newValue, eventoEndereco);
                      }}
                      className={!eventoCidade.trim() ? 'border-destructive' : ''}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventoEndereco">Endereço Completo *</Label>
                  <Textarea
                    id="eventoEndereco"
                    placeholder="Ex: Av. República do Líbano, 1234 - Setor Oeste"
                    value={eventoEndereco}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setEventoEndereco(newValue);
                      atualizarDescricaoComLocalizacao(eventoUF, eventoCidade, newValue);
                    }}
                    rows={2}
                    className={!eventoEndereco.trim() ? 'border-destructive' : ''}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  * Campos obrigatórios para o disparo das ligações
                </p>
              </div>

              {/* Aviso sobre importação de base */}
              <div className="rounded-lg border border-border p-4 bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">Base de Contatos</h4>
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-950/30 border border-blue-800/30 rounded-md">
                  <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-300">Importação feita separadamente</p>
                    <p className="text-xs text-blue-400/80 mt-1">
                      Após criar o evento, importe a base de contatos pela aba <strong>"Importar Clientes"</strong> na tela de prospecção.
                    </p>
                  </div>
                </div>
              </div>

              {/* Descrição com borda e botão expandir */}
              <div className="rounded-lg border border-border p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={aplicarModeloDescricao}>
                      <FileText className="w-4 h-4 mr-1" />
                      Aplicar modelo
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setDescricaoExpandida(!descricaoExpandida)}
                    >
                      {descricaoExpandida ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="descricao"
                  placeholder="Descreva os detalhes da prospecção..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={descricaoExpandida ? 16 : 6}
                  className="resize-none transition-all"
                />
              </div>
            </div>
          );
        }

      case 'Base de Contatos':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-r from-phone-600/80 to-phone-700 text-white" style={{ background: 'linear-gradient(to right, #059669, #047857)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Base de Contatos para Ligação</span>
              </div>
              <p className="text-xs opacity-80">
                A base será importada através do menu "Upload de Planilha" após criar o evento
              </p>
            </Card>

            {/* Informação sobre importação */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <Upload className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Como importar a base de contatos:</p>
                  <ol className="text-xs text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                    <li>Primeiro, clique em "Criar Evento" para salvar o evento</li>
                    <li>Depois, use o botão "Upload de Planilha" na tela principal</li>
                    <li>Selecione este evento e faça o upload da planilha</li>
                    <li>Os contatos serão automaticamente vinculados ao evento</li>
                  </ol>
                </div>
              </div>
            </Card>

            {/* Formato esperado */}
            <Card className="p-4 border-dashed border-2 border-muted">
              <div className="text-center">
                <FileText className="mx-auto mb-2 text-muted-foreground" size={24} />
                <p className="text-sm font-medium text-muted-foreground">
                  Formato da planilha
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Colunas obrigatórias: <strong>Nome</strong> e <strong>Telefone</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Colunas opcionais: E-mail, CPF, Segmentação, Responsável
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos aceitos: .csv, .xlsx ou .xls
                </p>
              </div>
            </Card>
          </div>
        );

      case 'Metas':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-r from-primary/80 to-primary text-primary-foreground">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">Meta Total de Vendas</span>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold">{metaTotalVendas}</span>
                <p className="text-xs opacity-80 mt-1">Soma de Novos, Seminovos e Diretas</p>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-muted-foreground">Novos</span>
                  <MetaTooltip config={tooltipConfigs.novos} />
                </div>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={metaNovos}
                  onChange={(e) => handleMetaVendaChange(setMetaNovos, e.target.value, { novos: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="text-center font-semibold h-8"
                />
              </Card>

              <Card className="p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">Seminovos</span>
                  <MetaTooltip config={tooltipConfigs.seminovos} />
                </div>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={metaSeminovos}
                  onChange={(e) => handleMetaVendaChange(setMetaSeminovos, e.target.value, { seminovos: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="text-center font-semibold h-8"
                />
              </Card>

              <Card className="p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-xs font-medium text-muted-foreground">Diretas</span>
                  <MetaTooltip config={tooltipConfigs.diretas} />
                </div>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={metaDiretas}
                  onChange={(e) => handleMetaVendaChange(setMetaDiretas, e.target.value, { diretas: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="text-center font-semibold h-8"
                />
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-2">
                <div className="flex items-center gap-1.5 mb-1">
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
                  className="text-center font-semibold h-8"
                />
              </Card>

              <Card className="p-2">
                <div className="flex items-center gap-1.5 mb-1">
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
                  className="text-center font-semibold h-8"
                />
              </Card>

              <Card className="p-2">
                <div className="flex items-center gap-1.5 mb-1">
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
                  className="text-center font-semibold h-8"
                />
              </Card>
            </div>
          </div>
        );

      case 'Metas Individuais':
        // Calcular totais das metas individuais
        const totalMetasIndividuaisVendas = Object.values(metasIndividuais).reduce((acc, m) => acc + (m.meta_vendas || 0), 0);
        const totalMetasIndividuaisCheckins = Object.values(metasIndividuais).reduce((acc, m) => acc + (m.meta_checkins || 0), 0);
        const totalMetasIndividuaisConfirmacoes = Object.values(metasIndividuais).reduce((acc, m) => acc + (m.meta_confirmacoes || 0), 0);
        const totalMetasIndividuaisConvites = Object.values(metasIndividuais).reduce((acc, m) => acc + (m.meta_convites || 0), 0);
        
        // Percentuais de distribuição
        const percentualVendas = metaTotalVendas > 0 ? Math.min((totalMetasIndividuaisVendas / metaTotalVendas) * 100, 100) : 0;
        const percentualCheckins = Number(metaCheckins) > 0 ? Math.min((totalMetasIndividuaisCheckins / Number(metaCheckins)) * 100, 100) : 0;
        const percentualConfirmacoes = Number(metaConfirmacoes) > 0 ? Math.min((totalMetasIndividuaisConfirmacoes / Number(metaConfirmacoes)) * 100, 100) : 0;
        const percentualConvites = Number(metaConvites) > 0 ? Math.min((totalMetasIndividuaisConvites / Number(metaConvites)) * 100, 100) : 0;
        
        // Verificar se ultrapassou a meta
        const ultrapassouVendas = totalMetasIndividuaisVendas > metaTotalVendas && metaTotalVendas > 0;
        const ultrapassouCheckins = totalMetasIndividuaisCheckins > Number(metaCheckins) && Number(metaCheckins) > 0;
        const ultrapassouConfirmacoes = totalMetasIndividuaisConfirmacoes > Number(metaConfirmacoes) && Number(metaConfirmacoes) > 0;
        const ultrapassouConvites = totalMetasIndividuaisConvites > Number(metaConvites) && Number(metaConvites) > 0;
        
        const algumUltrapassou = ultrapassouVendas || ultrapassouCheckins || ultrapassouConfirmacoes || ultrapassouConvites;
        
        return (
          <div className="space-y-4">
            {/* Indicadores de Distribuição */}
            <Card className={`p-4 ${algumUltrapassou ? 'border-destructive bg-destructive/5' : 'border-primary/20'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Distribuição de Metas</span>
                {algumUltrapassou && (
                  <div className="flex items-center gap-1 ml-auto text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-medium">Meta ultrapassada</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Vendas */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Vendas</span>
                    <span className={`font-medium ${ultrapassouVendas ? 'text-destructive' : ''}`}>
                      {totalMetasIndividuaisVendas} / {metaTotalVendas}
                    </span>
                  </div>
                  <Progress 
                    value={percentualVendas} 
                    className={`h-2 ${ultrapassouVendas ? '[&>div]:bg-destructive' : ''}`}
                  />
                  <p className={`text-[10px] ${ultrapassouVendas ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {ultrapassouVendas 
                      ? `Excedeu em ${totalMetasIndividuaisVendas - metaTotalVendas} veículos` 
                      : `Restam ${metaTotalVendas - totalMetasIndividuaisVendas} para distribuir`}
                  </p>
                </div>
                
                {/* Check-ins */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Check-ins</span>
                    <span className={`font-medium ${ultrapassouCheckins ? 'text-destructive' : ''}`}>
                      {totalMetasIndividuaisCheckins} / {metaCheckins || 0}
                    </span>
                  </div>
                  <Progress 
                    value={percentualCheckins} 
                    className={`h-2 ${ultrapassouCheckins ? '[&>div]:bg-destructive' : ''}`}
                  />
                  <p className={`text-[10px] ${ultrapassouCheckins ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {ultrapassouCheckins 
                      ? `Excedeu em ${totalMetasIndividuaisCheckins - Number(metaCheckins)}` 
                      : `Restam ${Number(metaCheckins || 0) - totalMetasIndividuaisCheckins} para distribuir`}
                  </p>
                </div>
                
                {/* Confirmações */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Confirmações</span>
                    <span className={`font-medium ${ultrapassouConfirmacoes ? 'text-destructive' : ''}`}>
                      {totalMetasIndividuaisConfirmacoes} / {metaConfirmacoes || 0}
                    </span>
                  </div>
                  <Progress 
                    value={percentualConfirmacoes} 
                    className={`h-2 ${ultrapassouConfirmacoes ? '[&>div]:bg-destructive' : ''}`}
                  />
                  <p className={`text-[10px] ${ultrapassouConfirmacoes ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {ultrapassouConfirmacoes 
                      ? `Excedeu em ${totalMetasIndividuaisConfirmacoes - Number(metaConfirmacoes)}` 
                      : `Restam ${Number(metaConfirmacoes || 0) - totalMetasIndividuaisConfirmacoes} para distribuir`}
                  </p>
                </div>
                
                {/* Convites */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Convites</span>
                    <span className={`font-medium ${ultrapassouConvites ? 'text-destructive' : ''}`}>
                      {totalMetasIndividuaisConvites} / {metaConvites || 0}
                    </span>
                  </div>
                  <Progress 
                    value={percentualConvites} 
                    className={`h-2 ${ultrapassouConvites ? '[&>div]:bg-destructive' : ''}`}
                  />
                  <p className={`text-[10px] ${ultrapassouConvites ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {ultrapassouConvites 
                      ? `Excedeu em ${totalMetasIndividuaisConvites - Number(metaConvites)}` 
                      : `Restam ${Number(metaConvites || 0) - totalMetasIndividuaisConvites} para distribuir`}
                  </p>
                </div>
              </div>
            </Card>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filtrar por nome ou perfil..."
                value={metasIndividuaisFilter}
                onChange={(e) => setMetasIndividuaisFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 mb-3 opacity-50" />
                <p>Nenhum usuário encontrado</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {filteredUsers.map((userItem) => {
                  const userMetas = metasIndividuais[userItem.id] || { meta_vendas: 0, meta_checkins: 0, meta_confirmacoes: 0, meta_convites: 0 };
                  
                  return (
                    <Card key={userItem.id} className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                            {userItem.nome_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{userItem.nome_completo}</p>
                            <p className="text-[10px] text-muted-foreground">{userItem.tipo_acesso || 'Sem perfil'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <div className="w-16">
                            <Label className="text-[10px] text-muted-foreground block text-center">Vendas</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={userMetas.meta_vendas || ""}
                              onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_vendas', e.target.value)}
                              className={`h-7 text-center text-xs ${ultrapassouVendas ? 'border-destructive/50' : ''}`}
                            />
                          </div>
                          <div className="w-16">
                            <Label className="text-[10px] text-muted-foreground block text-center">Check-ins</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={userMetas.meta_checkins || ""}
                              onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_checkins', e.target.value)}
                              className={`h-7 text-center text-xs ${ultrapassouCheckins ? 'border-destructive/50' : ''}`}
                            />
                          </div>
                          <div className="w-16">
                            <Label className="text-[10px] text-muted-foreground block text-center">Confirm.</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={userMetas.meta_confirmacoes || ""}
                              onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_confirmacoes', e.target.value)}
                              className={`h-7 text-center text-xs ${ultrapassouConfirmacoes ? 'border-destructive/50' : ''}`}
                            />
                          </div>
                          <div className="w-16">
                            <Label className="text-[10px] text-muted-foreground block text-center">Convites</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={userMetas.meta_convites || ""}
                              onChange={(e) => handleMetaIndividualChange(userItem.id, 'meta_convites', e.target.value)}
                              className={`h-7 text-center text-xs ${ultrapassouConvites ? 'border-destructive/50' : ''}`}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'Equipes':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-r from-violet-500/80 to-violet-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <UsersRound className="h-4 w-4" />
                    <span className="text-sm font-medium">Gestão de Equipes</span>
                  </div>
                  <p className="text-xs opacity-80">{equipes.filter(e => e.ativo).length} equipes ativas</p>
                </div>
                {!criarNovaEquipe && equipeEditando === null && (
                  <Button 
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => {
                      setCriarNovaEquipe(true);
                      setNovaEquipeNome("");
                      setNovaEquipeCor(coresPadrao[equipes.length % coresPadrao.length]);
                      setNovaEquipeMembros([]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Nova Equipe
                  </Button>
                )}
              </div>
            </Card>
            
            {criarNovaEquipe && (
              <Card className="p-4 border-2 border-primary/30">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Nova Equipe</span>
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button"
                        size="sm"
                        disabled={!novaEquipeNome.trim()}
                        onClick={() => {
                          setEquipes([...equipes, {
                            nome: novaEquipeNome.trim(),
                            cor: novaEquipeCor,
                            ativo: true,
                            membros: novaEquipeMembros
                          }]);
                          setCriarNovaEquipe(false);
                          setNovaEquipeNome("");
                          setNovaEquipeMembros([]);
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Criar Equipe
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCriarNovaEquipe(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nome da Equipe</Label>
                      <Input
                        placeholder="Ex: Equipe Alpha"
                        value={novaEquipeNome}
                        onChange={(e) => setNovaEquipeNome(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cor da Equipe</Label>
                      <div className="flex gap-1 mt-1">
                        {coresPadrao.map((cor) => (
                          <button
                            key={cor}
                            type="button"
                            className={`w-7 h-7 rounded-full border-2 transition-all ${novaEquipeCor === cor ? 'border-primary scale-110' : 'border-transparent hover:border-muted-foreground/30'}`}
                            style={{ backgroundColor: cor }}
                            onClick={() => setNovaEquipeCor(cor)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Integrantes</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Buscar por nome..."
                          value={membrosFilterNome}
                          onChange={(e) => setMembrosFilterNome(e.target.value)}
                          className="h-8 text-xs flex-1"
                        />
                        <Select value={membrosFilterTipoAcesso} onValueChange={setMembrosFilterTipoAcesso}>
                          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Acesso" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos Acessos</SelectItem>
                            {[...new Set(usersComAcesso.map(u => u.tipo_acesso).filter(Boolean))].sort().map(t => (
                              <SelectItem key={t!} value={t!}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={membrosFilterDepartamento} onValueChange={setMembrosFilterDepartamento}>
                          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Depto" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos Deptos</SelectItem>
                            {[...new Set(usersComAcesso.map(u => u.departamento).filter(Boolean))].sort().map(d => (
                              <SelectItem key={d!} value={d!}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                        {usersComAcesso
                          .filter(u => {
                            if (membrosFilterNome && !u.nome_completo.toLowerCase().includes(membrosFilterNome.toLowerCase())) return false;
                            if (membrosFilterTipoAcesso !== "all" && u.tipo_acesso !== membrosFilterTipoAcesso) return false;
                            if (membrosFilterDepartamento !== "all" && u.departamento !== membrosFilterDepartamento) return false;
                            return true;
                          })
                          .map((userItem) => {
                          const jaEmOutraEquipe = equipes.some(eq => eq.membros.includes(userItem.id));
                          
                          return (
                            <label key={userItem.id} className={`flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer ${jaEmOutraEquipe ? 'opacity-50' : ''}`}>
                              <Checkbox
                                checked={novaEquipeMembros.includes(userItem.id)}
                                disabled={jaEmOutraEquipe}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNovaEquipeMembros([...novaEquipeMembros, userItem.id]);
                                  } else {
                                    setNovaEquipeMembros(novaEquipeMembros.filter(id => id !== userItem.id));
                                  }
                                }}
                                className="rounded border-primary"
                              />
                              <span className="text-sm">{userItem.nome_completo}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{userItem.tipo_acesso}</span>
                              {jaEmOutraEquipe && <span className="text-xs text-muted-foreground">- já em outra equipe</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            
            {equipes.length === 0 && !criarNovaEquipe ? (
              <div className="text-center py-8 text-muted-foreground">
                <UsersRound className="mx-auto h-12 w-12 mb-3 opacity-50" />
                <p>Nenhuma equipe criada</p>
                <p className="text-sm">Clique em "Nova Equipe" para criar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {equipes.map((equipe, index) => (
                  <Card key={index} className={`p-3 ${!equipe.ativo ? 'opacity-50' : ''}`}>
                    {equipeEditando === index ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input
                              value={equipe.nome}
                              onChange={(e) => {
                                const updated = [...equipes];
                                updated[index].nome = e.target.value;
                                setEquipes(updated);
                              }}
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Cor</Label>
                            <div className="flex gap-1 mt-1">
                              {coresPadrao.map((cor) => (
                                <button
                                  key={cor}
                                  type="button"
                                  className={`w-6 h-6 rounded-full border-2 transition-all ${equipe.cor === cor ? 'border-primary scale-110' : 'border-transparent'}`}
                                  style={{ backgroundColor: cor }}
                                  onClick={() => {
                                    const updated = [...equipes];
                                    updated[index].cor = cor;
                                    setEquipes(updated);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Integrantes</Label>
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Buscar por nome..."
                                value={membrosFilterNome}
                                onChange={(e) => setMembrosFilterNome(e.target.value)}
                                className="h-8 text-xs flex-1"
                              />
                              <Select value={membrosFilterTipoAcesso} onValueChange={setMembrosFilterTipoAcesso}>
                                <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Acesso" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Todos Acessos</SelectItem>
                                  {[...new Set(usersComAcesso.map(u => u.tipo_acesso).filter(Boolean))].sort().map(t => (
                                    <SelectItem key={t!} value={t!}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={membrosFilterDepartamento} onValueChange={setMembrosFilterDepartamento}>
                                <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Depto" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Todos Deptos</SelectItem>
                                  {[...new Set(usersComAcesso.map(u => u.departamento).filter(Boolean))].sort().map(d => (
                                    <SelectItem key={d!} value={d!}>{d}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                              {usersComAcesso
                                .filter(u => {
                                  if (membrosFilterNome && !u.nome_completo.toLowerCase().includes(membrosFilterNome.toLowerCase())) return false;
                                  if (membrosFilterTipoAcesso !== "all" && u.tipo_acesso !== membrosFilterTipoAcesso) return false;
                                  if (membrosFilterDepartamento !== "all" && u.departamento !== membrosFilterDepartamento) return false;
                                  return true;
                                })
                                .map((userItem) => {
                                const jaEmOutraEquipe = equipes.some((eq, i) => i !== index && eq.membros.includes(userItem.id));
                                
                                return (
                                  <label key={userItem.id} className={`flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer ${jaEmOutraEquipe ? 'opacity-50' : ''}`}>
                                    <Checkbox
                                      checked={equipe.membros.includes(userItem.id)}
                                      disabled={jaEmOutraEquipe}
                                      onCheckedChange={(checked) => {
                                        const updated = [...equipes];
                                        if (checked) {
                                          updated[index].membros = [...updated[index].membros, userItem.id];
                                        } else {
                                          updated[index].membros = updated[index].membros.filter(id => id !== userItem.id);
                                        }
                                        setEquipes(updated);
                                      }}
                                      className="rounded border-primary"
                                    />
                                    <span className="text-sm">{userItem.nome_completo}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">{userItem.tipo_acesso}</span>
                                    {jaEmOutraEquipe && <span className="text-xs text-muted-foreground">- já em outra equipe</span>}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button type="button" size="sm" onClick={() => setEquipeEditando(null)}>
                            <Check className="h-4 w-4 mr-1" />
                            Concluir
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: equipe.cor }} />
                          <div>
                            <p className="font-medium text-sm">{equipe.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {equipe.membros.length} integrante{equipe.membros.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={equipe.ativo}
                            onCheckedChange={(checked) => {
                              const updated = [...equipes];
                              updated[index].ativo = checked;
                              setEquipes(updated);
                            }}
                          />
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEquipeEditando(index)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:text-destructive"
                            onClick={() => setEquipes(equipes.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 'Premiações':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-r from-amber-500/80 to-amber-600 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4" />
                <span className="text-sm font-medium">Total em Premiações</span>
              </div>
              <div className="text-center">
                <span className="text-3xl font-bold">
                  {totalPremiacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </Card>

            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              <div className="space-y-2">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Equipes
                </span>
                {renderPremiacaoField("equipe_campea", Trophy)}
                {renderPremiacaoField("equipe_2lugar", Award)}
                {renderPremiacaoField("equipe_3lugar", Award)}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" /> Vendedores
                </span>
                {renderPremiacaoField("vendedor_ouro", Trophy)}
                {renderPremiacaoField("vendedor_prata", Award)}
                {renderPremiacaoField("vendedor_bronze", Award)}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Prospectores
                </span>
                {renderPremiacaoField("prospector_ouro", Trophy)}
                {renderPremiacaoField("prospector_prata", Award)}
                {renderPremiacaoField("prospector_bronze", Award)}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Check-ins
                </span>
                {renderPremiacaoField("checkin_ouro", Trophy)}
                {renderPremiacaoField("checkin_prata", Award)}
                {renderPremiacaoField("checkin_bronze", Award)}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" /> Participação
                </span>
                {renderPremiacaoField("participacao_apoio", Gift)}
                {renderPremiacaoField("indicacao_venda", Gift)}
              </div>
            </div>
          </div>
        );

      case 'Convite':
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nesta tela, o gestor deve cadastrar os KVs das ofertas vigentes. Essas informações serão utilizadas pelos vendedores como referência para entender quais campanhas, condições e comunicações estão ativas no momento.
              <br />
              <span className="italic opacity-80">O KV é apenas para identificação interna do evento e não será enviado ao cliente em nenhum momento.</span>
            </p>
            <Card className="p-4 bg-gradient-to-r from-purple-500/80 to-purple-600 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Image className="h-4 w-4" />
                <span className="text-sm font-medium">Convite do Evento</span>
              </div>
              <p className="text-xs opacity-80">
                Imagem de 400x400 pixels para o convite
              </p>
            </Card>

            <Card className="p-4">
              {conviteImagem ? (
                <div className="relative">
                  <img 
                    src={conviteImagem} 
                    alt="Preview do convite" 
                    className="w-48 h-48 object-cover rounded-lg border mx-auto"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-1/2 translate-x-[100px]"
                    onClick={() => {
                      setConviteImagem(null);
                      setConviteImagemFile(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-48 h-48 mx-auto border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clique para enviar</span>
                  <span className="text-xs text-muted-foreground mt-1">400 × 400px</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setConviteImagemFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setConviteImagem(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </Card>
          </div>
        );


      case 'Marketing':
        return (
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-r from-orange-500/80 to-orange-600 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="h-4 w-4" />
                <span className="text-sm font-medium">Conteúdo para Redes Sociais</span>
              </div>
              <p className="text-xs opacity-80">{marketingAssets.length} imagem(s) criada(s)</p>
            </Card>

            <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto">
              {[
                { tipo: 'stories', nome: 'Stories', dim: '1080×1920px', plat: 'instagram' },
                { tipo: 'feed_quadrado', nome: 'Feed Quadrado', dim: '1080×1080px', plat: 'instagram' },
                { tipo: 'feed_retrato', nome: 'Feed Retrato', dim: '1080×1350px', plat: 'instagram' },
                { tipo: 'reels', nome: 'Reels/TikTok', dim: '1080×1920px', plat: 'instagram_tiktok' },
              ].map((format) => (
                <Card key={format.tipo} className="p-3 border-dashed">
                  <div className="flex items-center gap-2 mb-2">
                    <FileImage className="h-4 w-4 text-primary" />
                    <div>
                      <h4 className="text-xs font-semibold">{format.nome}</h4>
                      <p className="text-[10px] text-muted-foreground">{format.dim}</p>
                    </div>
                  </div>
                  {marketingAssets.find(a => a.tipo_formato === format.tipo) ? (
                    <div className="relative group">
                      <img 
                        src={marketingAssets.find(a => a.tipo_formato === format.tipo)?.imagem_url || ''}
                        alt={format.nome}
                        className="w-full h-20 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => setMarketingAssets(prev => prev.filter(a => a.tipo_formato !== format.tipo))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border border-dashed rounded cursor-pointer hover:bg-muted/50">
                      <Upload className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground">Upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setMarketingAssets(prev => [...prev, {
                                tipo_formato: format.tipo,
                                plataforma: format.plat,
                                largura: 1080,
                                altura: format.tipo === 'feed_quadrado' ? 1080 : format.tipo === 'feed_retrato' ? 1350 : 1920,
                                imagem_url: reader.result as string,
                                nome_arquivo: file.name,
                                tamanho_arquivo: file.size,
                                file
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </Card>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] w-[95vw] h-[600px] max-h-[600px] flex flex-col p-0 overflow-hidden">
        {/* Header fixo */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{editingProspeccao ? 'Editar Evento' : 'Novo Evento'}</span>
              <span className="text-sm font-normal text-muted-foreground">
                Etapa {currentStep + 1} de {steps.length}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    index === currentStep 
                      ? 'bg-primary text-primary-foreground' 
                      : index < currentStep 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-6 h-0.5 mx-1 ${index < currentStep ? 'bg-primary/50' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm font-medium text-primary mt-2">{currentStepName}</p>
        </div>
        
        {/* Conteúdo com scroll */}
        <ScrollIndicator className="flex-1 min-h-0 px-6 py-4">
          {renderStepContent()}
        </ScrollIndicator>

        {/* Footer fixo */}
        <div className="flex-shrink-0 flex justify-between gap-2 px-6 py-4 border-t bg-background">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          
          <div className="flex gap-2">
            {!isFirstStep && (
              <Button type="button" variant="outline" onClick={handlePreviousStep} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
            
            {isLastStep ? (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading 
                  ? (loadingMessage || (editingProspeccao ? "Salvando..." : "Criando..."))
                  : (editingProspeccao ? "Salvar Alterações" : "Criar Evento")
                }
              </Button>
            ) : (
              <Button type="button" onClick={handleNextStep} disabled={loading}>
                Próxima Etapa
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
