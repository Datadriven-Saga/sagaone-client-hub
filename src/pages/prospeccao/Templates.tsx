import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextarea } from "@/components/ui/rich-textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Type, 
  MousePointer2, 
  Image, 
  Video, 
  CreditCard, 
  List,
  Check,
  X,
  Upload,
  Trash2,
  Copy,
  Music,
  RefreshCw,
  Eye,
  Loader2
} from "lucide-react";
import { TemplatePreview } from "@/components/TemplatePreview";
import { 
  TemplateVariablesEditor, 
  buildBodyExamplePayload, 
  buildVariableMappingPayload,
  VariableMapping 
} from "@/components/TemplateVariablesEditor";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { normalizePhone } from "@/lib/utils";
import { useVideoCompression, MAX_VIDEO_SIZE_BYTES } from "@/hooks/useVideoCompression";


type TemplateFormat = "texto" | "botao" | "imagem" | "video" | "card" | "lista";
type TemplateCategory = "marketing" | "utilidade" | "autenticacao";

interface CardButton {
  id: string;
  nome: string;
  buttonId: string;
}

interface CardData {
  imagemCampanha: File | null;
  imagemPreviewUrl: string;
  audioCampanha: File | null;
  audioPreviewUrl: string;
  videoCampanha: File | null;
  videoPreviewUrl: string;
  videoMimeType?: string;
  videoSizeBytes?: number;
  cardMediaType?: "imagem" | "video";
  textoCabecalho: string;
  corpoTexto: string;
  rodape: string;
  botoes: CardButton[];
}

interface TemplateFormData {
  nome: string;
  categoria: TemplateCategory | "";
  departamento_id: string;
  agente_id: string;
  formato: TemplateFormat | "";
  conteudo: string;
  variaveis: string[];
  cardData: CardData;
}

const formatOptions = [
  { 
    value: "texto" as TemplateFormat, 
    label: "Texto", 
    description: "Template de texto simples.",
    icon: Type 
  },
  { 
    value: "botao" as TemplateFormat, 
    label: "Botões", 
    description: "Pequeno texto e botões de resposta.",
    icon: MousePointer2 
  },
  { 
    value: "imagem" as TemplateFormat, 
    label: "Imagem", 
    description: "Card composta de uma imagem e um título de assunto.",
    icon: Image 
  },
  { 
    value: "video" as TemplateFormat, 
    label: "Vídeo", 
    description: "Envie um vídeo para o cliente.",
    icon: Video 
  },
  { 
    value: "card" as TemplateFormat, 
    label: "Card", 
    description: "Envie um card com um título, texto, imagem e botões de resposta.",
    icon: CreditCard 
  },
];

// Campos de variáveis agora gerenciados em TemplateVariablesEditor

export default function Templates() {
  const { activeCompany } = useCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nomeDuplicado, setNomeDuplicado] = useState(false);
  const [verificandoNome, setVerificandoNome] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedAgenteId, setSelectedAgenteId] = useState<string | null>(null);
  
  // Video compression hook
  const { compressVideo, isCompressing, compressionProgress, cancelCompression } = useVideoCompression();

  // Helper function to upload media to Supabase Storage
  const uploadMediaToStorage = async (file: File, mediaType: 'image' | 'audio' | 'video'): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${activeCompany?.id}/${mediaType}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('whatsapp-templates')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });
      
      if (error) {
        console.error('Upload error:', error);
        toast.error('Erro ao fazer upload do arquivo');
        return null;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-templates')
        .getPublicUrl(data.path);
      
      return publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload do arquivo');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const initialCardData: CardData = {
    imagemCampanha: null,
    imagemPreviewUrl: "",
    audioCampanha: null,
    audioPreviewUrl: "",
    videoCampanha: null,
    videoPreviewUrl: "",
    videoMimeType: undefined,
    videoSizeBytes: undefined,
    textoCabecalho: "",
    corpoTexto: "",
    rodape: "",
    botoes: [],
  };

  const [formData, setFormData] = useState<TemplateFormData>({
    nome: "",
    categoria: "",
    departamento_id: "",
    agente_id: "",
    formato: "",
    conteudo: "",
    variaveis: [],
    cardData: initialCardData,
  });

  // Estado para mapeamento de variáveis dinâmicas {{1}}, {{2}}, etc.
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case "aprovado":
        return "bg-green-100 text-green-700 border-green-200";
      case "rejeitado":
        return "bg-red-100 text-red-700 border-red-200";
      case "pausado":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "pendente":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "aprovado":
        return "Aprovado";
      case "rejeitado":
        return "Rejeitado";
      case "pausado":
        return "Pausado";
      case "pendente":
      default:
        return "Pendente";
    }
  };

  // Fetch departamentos
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos", activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return [];
      const { data, error } = await supabase
        .from("departamentos")
        .select("*")
        .eq("empresa_id", activeCompany.id)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!activeCompany?.id,
  });

  // Buscar apenas agentes "Pri - Whatsapp" (tipo IA Whatsapp) vinculados à empresa
  const { data: agentesIAWhatsapp = [] } = useQuery({
    queryKey: ["agentes_ia_whatsapp", activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return [];

      // Buscar agentes vinculados à empresa via tabela de relacionamento
      const { data, error } = await supabase
        .from("agente_empresas")
        .select(`
          agente_id,
          agentes_ia (
            id,
            nome,
            telefone,
            dealer_id,
            ativo
          )
        `)
        .eq("empresa_id", activeCompany.id);

      if (error) {
        console.error("Erro ao buscar agentes IA:", error);
        return [];
      }

      // Extrair apenas agentes do tipo "Pri - Whatsapp" (IA Whatsapp) ativos
      const agentes = (data || [])
        .map((ae: any) => ae.agentes_ia)
        .filter((a: any) => a && a.ativo)
        // Filtrar apenas agentes do tipo WhatsApp (nome contém "whatsapp" case insensitive)
        .filter((a: any) => a.nome?.toLowerCase().includes('whatsapp'))
        .filter(
          (a: any, index: number, self: any[]) =>
            index === self.findIndex((t) => t.id === a.id)
        );

      return agentes;
    },
    enabled: !!activeCompany?.id,
  });

  // Selecionar "Pri - Whatsapp" como padrão, senão primeiro agente disponível
  useEffect(() => {
    if (agentesIAWhatsapp.length > 0 && !agentesIAWhatsapp.some((a: any) => a.id === selectedAgenteId)) {
      // Tentar encontrar o agente "Pri - Whatsapp" (case insensitive)
      const priWhatsapp = agentesIAWhatsapp.find((a: any) => 
        a.nome?.toLowerCase().includes('whatsapp') || 
        a.nome?.toLowerCase() === 'pri - whatsapp'
      );
      setSelectedAgenteId(priWhatsapp?.id || agentesIAWhatsapp[0].id);
    }
  }, [agentesIAWhatsapp, selectedAgenteId]);

  // Buscar o telefone do agente selecionado ou primeiro disponível
  const { data: priTelefone } = useQuery({
    queryKey: ["pri_telefone", activeCompany?.id, selectedAgenteId, agentesIAWhatsapp],
    queryFn: async () => {
      if (!activeCompany?.id) return null;

      // Se há um agente selecionado, usar o telefone dele
      if (selectedAgenteId) {
        const agenteSelecionado = agentesIAWhatsapp.find(a => a.id === selectedAgenteId);
        if (agenteSelecionado?.telefone) {
          return normalizePhone(agenteSelecionado.telefone);
        }
      }

      // Se há agentes disponíveis, usar o primeiro
      if (agentesIAWhatsapp.length > 0) {
        const primeiroAgente = agentesIAWhatsapp[0];
        if (primeiroAgente?.telefone) {
          return normalizePhone(primeiroAgente.telefone);
        }
      }

      return null;
    },
    enabled: !!activeCompany?.id,
  });

  // Fetch templates - busca diretamente pelo campo pri_telefone
  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ["whatsapp_templates", priTelefone],
    queryFn: async () => {
      if (!priTelefone) return [];

      // Buscar templates diretamente pelo pri_telefone
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*, departamentos(nome)")
        .eq("pri_telefone", priTelefone)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!priTelefone,
  });

  // Verificar nome duplicado em tempo real (usando pri_telefone)
  useEffect(() => {
    const verificarNomeDuplicado = async () => {
      if (!formData.nome || formData.nome.trim().length < 2 || !priTelefone) {
        setNomeDuplicado(false);
        return;
      }

      setVerificandoNome(true);
      try {
        let query = supabase
          .from("whatsapp_templates")
          .select("id")
          .eq("pri_telefone", priTelefone)
          .ilike("nome", formData.nome.trim());


        const { data: existingTemplate } = await query.maybeSingle();
        setNomeDuplicado(!!existingTemplate);
      } catch (error) {
        console.error("Erro ao verificar nome duplicado:", error);
      } finally {
        setVerificandoNome(false);
      }
    };

    const debounceTimer = setTimeout(verificarNomeDuplicado, 300);
    return () => clearTimeout(debounceTimer);
  }, [formData.nome, priTelefone]);

  const handleOpenModal = (duplicateFrom?: any) => {
    const isTemplateObject =
      !!duplicateFrom &&
      typeof duplicateFrom === "object" &&
      "formato" in duplicateFrom &&
      "categoria" in duplicateFrom;

    const templateToDuplicate = isTemplateObject ? duplicateFrom : null;

    setDuplicatingTemplate(templateToDuplicate);
    setVariableMappings([]); // Resetar mapeamento de variáveis

    if (templateToDuplicate) {
      // Preencher com dados do template duplicado
      const cardData = templateToDuplicate.card_data || {};
      setFormData({
        nome: "", // Nome deve ser novo
        categoria: (templateToDuplicate.categoria as TemplateCategory) || "marketing",
        departamento_id: templateToDuplicate.departamento_id || "",
        agente_id: selectedAgenteId || "",
        formato: (templateToDuplicate.formato as TemplateFormat) || "",
        conteudo: templateToDuplicate.formato === "texto" ? templateToDuplicate.conteudo : "",
        variaveis: [],
        cardData: {
          imagemCampanha: null,
          imagemPreviewUrl: cardData.imagemUrl || "",
          audioCampanha: null,
          audioPreviewUrl: cardData.audioUrl || "",
          videoCampanha: null,
          videoPreviewUrl: cardData.videoUrl || "",
          textoCabecalho: cardData.textoCabecalho || "",
          corpoTexto: templateToDuplicate.formato !== "texto" ? templateToDuplicate.conteudo : "",
          rodape: cardData.rodape || "",
          botoes: (cardData.botoes || []).map((b: any) => ({
            id: crypto.randomUUID(),
            nome: b.nome || "",
            buttonId: b.buttonId || "",
          })),
        },
      });
    } else {
      setFormData({
        nome: "",
        categoria: "marketing",
        departamento_id: "",
        agente_id: selectedAgenteId || "",
        formato: "",
        conteudo: "",
        variaveis: [],
        cardData: initialCardData,
      });
    }
    // Selecionar "Pri - Whatsapp" como padrão ao abrir modal
    const priWhatsapp = agentesIAWhatsapp.find((a: any) => 
      a.nome?.toLowerCase().includes('whatsapp') || 
      a.nome?.toLowerCase() === 'pri - whatsapp'
    );
    setSelectedAgenteId(priWhatsapp?.id || (agentesIAWhatsapp.length > 0 ? agentesIAWhatsapp[0].id : null));
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleDuplicateTemplate = (template: any) => {
    // Definir agente do template se existir
    setSelectedAgenteId(template.agente_id || (agentesIAWhatsapp.length > 0 ? agentesIAWhatsapp[0].id : null));
    handleOpenModal(template);
  };

  const handleDeleteTemplate = async (template: any) => {
    if (!confirm(`Tem certeza que deseja excluir o template "${template.nome}"?`)) {
      return;
    }

    try {
      // 1) Excluir do banco local PRIMEIRO (rápido e confiável)
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;

      toast.success("Template excluído com sucesso!");
      refetchTemplates();

      // 2) Chamar webhook para apagar na Meta em background (não bloqueia UI)
      if (template.template_id_pri || template.nome) {
        (async () => {
          try {
            let agenteData: { telefone: string | null; dealer_id: string | null; ativo: boolean; nome: string } | null = null;
            if (selectedAgenteId) {
              const { data } = await supabase
                .from("agentes_ia")
                .select("telefone, dealer_id, ativo, nome")
                .eq("id", selectedAgenteId)
                .single();
              agenteData = data;
            }

            const deletePayload = {
              template_id_pri: template.template_id_pri || null,
              template_name: template.nome,
              id_meta: template.id_meta || null,
              empresa_id: activeCompany?.id,
              agente_id: selectedAgenteId,
              agente_nome: agenteData?.nome || null,
              pri_telefone: agenteData?.telefone ? normalizePhone(agenteData.telefone) : null,
              pri_dealer_id: agenteData?.dealer_id || null,
              pri_status: agenteData?.ativo ? "Ativo" : "Inativo",
              data: new Date().toISOString(),
            };

            console.log("Chamando webhook para apagar template na Meta:", deletePayload);

            const { error: webhookError } = await supabase.functions.invoke('external-webhook-proxy', {
              body: {
                endpoint: 'apaga-template-meta',
                ...deletePayload,
              },
            });

            if (webhookError) {
              console.warn("Aviso: Falha ao apagar template na Meta (já removido localmente):", webhookError);
            } else {
              console.log("Template apagado na Meta com sucesso");
            }
          } catch (webhookError) {
            console.warn("Aviso: Erro ao chamar webhook da Meta (já removido localmente):", webhookError);
          }
        })();
      }
    } catch (error: any) {
      console.error("Erro ao excluir template:", error);
      toast.error("Erro ao excluir template: " + error.message);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentStep(1);
    setDuplicatingTemplate(null);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.nome || !formData.categoria) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
      if (!selectedAgenteId) {
        toast.error("Selecione um agente IA WhatsApp");
        return;
      }
      if (nomeDuplicado) {
        toast.error("Já existe um template com este nome");
        return;
      }
    }
    if (currentStep === 2) {
      if (!formData.formato) {
        toast.error("Selecione um formato");
        return;
      }
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Função para mapear categoria para o formato Meta
  const mapCategoriaToMeta = (categoria: string): string => {
    const mapping: Record<string, string> = {
      "marketing": "MARKETING",
      "utilidade": "UTILITY",
      "autenticacao": "AUTHENTICATION",
    };
    return mapping[categoria] || "MARKETING";
  };

  // Função para converter nome para formato Meta (minúsculo, sem espaços/acentos)
  const formatNameForMeta = (nome: string): string => {
    return nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]/g, "_") // Substitui caracteres especiais por _
      .replace(/_+/g, "_") // Remove underscores duplicados
      .replace(/^_|_$/g, ""); // Remove underscores no início/fim
  };

  // Função para converter URL de mídia em base64 e obter tamanho
  const fetchMediaAsBase64 = async (url: string): Promise<{ base64: string; mimeType: string; size: number } | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Erro ao buscar mídia:", response.status);
        return null;
      }
      const blob = await response.blob();
      const mimeType = blob.type || "application/octet-stream";
      const size = blob.size;
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove o prefixo "data:...;base64," se existir
          const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
          resolve({ base64: base64Data, mimeType, size });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Erro ao converter mídia para base64:", error);
      return null;
    }
  };

  // Função para construir o payload Meta-compatível (async para buscar binários)
  const buildMetaPayload = async (savedData: {
    nome: string;
    categoria: string;
    formato: string;
    conteudo: string;
    cardData: Record<string, any>;
  }) => {
    const components: any[] = [];

    // BODY é obrigatório - incluir exemplos se houver variáveis
    const bodyComponent: any = {
      type: "BODY",
      text: savedData.conteudo || "",
    };

    // Adicionar exemplos de variáveis se existirem
    const examplePayload = buildBodyExamplePayload(variableMappings);
    if (examplePayload) {
      bodyComponent.example = examplePayload;
    }

    components.push(bodyComponent);

    // HEADER (opcional) - para formatos com cabeçalho
    if (savedData.formato === "card") {
      // Card pode ter vídeo ou imagem como mídia de cabeçalho
      if (savedData.cardData?.videoUrl) {
        const mediaData = await fetchMediaAsBase64(savedData.cardData.videoUrl);
        components.push({
          type: "HEADER",
          format: "VIDEO",
          media_url: savedData.cardData.videoUrl,
          media_base64: mediaData?.base64 || null,
          media_mime_type: (savedData.cardData as any).videoMimeType || mediaData?.mimeType || "video/mp4",
          media_type: "video",
          media_length: (savedData.cardData as any).videoSizeBytes || mediaData?.size || null,
        });
      } else if (savedData.cardData?.imagemUrl) {
        const mediaData = await fetchMediaAsBase64(savedData.cardData.imagemUrl);
        components.push({
          type: "HEADER",
          format: "IMAGE",
          media_url: savedData.cardData.imagemUrl,
          media_base64: mediaData?.base64 || null,
          media_mime_type: mediaData?.mimeType || null,
          media_type: "image",
          media_length: mediaData?.size || null,
        });
      }
      // Texto do cabeçalho só como header de texto se não houver mídia
      if (savedData.cardData?.textoCabecalho && !savedData.cardData?.imagemUrl && !savedData.cardData?.videoUrl) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: savedData.cardData.textoCabecalho,
        });
      }
    } else if (savedData.formato === "imagem" && savedData.cardData?.imagemUrl) {
      const mediaData = await fetchMediaAsBase64(savedData.cardData.imagemUrl);
      components.push({
        type: "HEADER",
        format: "IMAGE",
        media_url: savedData.cardData.imagemUrl,
        media_base64: mediaData?.base64 || null,
        media_mime_type: mediaData?.mimeType || null,
        media_type: "image",
        media_length: mediaData?.size || null,
      });
    } else if (savedData.formato === "audio" && savedData.cardData?.audioUrl) {
      const mediaData = await fetchMediaAsBase64(savedData.cardData.audioUrl);
      components.push({
        type: "HEADER",
        format: "AUDIO",
        media_url: savedData.cardData.audioUrl,
        media_base64: mediaData?.base64 || null,
        media_mime_type: mediaData?.mimeType || null,
        media_type: "audio",
        media_length: mediaData?.size || null,
      });
    } else if (savedData.formato === "video" && savedData.cardData?.videoUrl) {
      const mediaData = await fetchMediaAsBase64(savedData.cardData.videoUrl);
      components.push({
        type: "HEADER",
        format: "VIDEO",
        media_url: savedData.cardData.videoUrl,
        media_base64: mediaData?.base64 || null,
        media_mime_type: mediaData?.mimeType || savedData.cardData.videoMimeType || "video/mp4",
        media_type: "video",
        media_length: mediaData?.size || savedData.cardData.videoSizeBytes || null,
      });
    }

    // FOOTER removed - not used

    // BUTTONS (opcional)
    if (savedData.cardData?.botoes && savedData.cardData.botoes.length > 0) {
      const buttons = savedData.cardData.botoes.map((btn: any) => {
        // Se tem buttonId que parece URL, é URL button, senão QUICK_REPLY
        const isUrl = btn.buttonId && (btn.buttonId.startsWith("http") || btn.buttonId.includes("://"));
        if (isUrl) {
          return {
            type: "URL",
            text: btn.nome,
            url: btn.buttonId,
          };
        }
        return {
          type: "QUICK_REPLY",
          text: btn.nome,
        };
      });
      components.push({
        type: "BUTTONS",
        buttons,
      });
    }

    // Verificar se há variáveis no conteúdo (formato {{1}}, {{2}}, etc.)
    const hasVariables = /\{\{\d+\}\}/.test(savedData.conteudo || "");

    return {
      provider: "meta_whatsapp",
      action: "create_message_template",
      waba_id: "",
      tem_variavel: hasVariables ? "Sim" : "Não",
      payload: {
        name: formatNameForMeta(savedData.nome),
        language: "pt_BR",
        category: mapCategoriaToMeta(savedData.categoria),
        components,
      },
    };
  };

  // Função para disparar webhooks dos gatilhos via Edge Function
  const triggerWebhooks = async (templateData: {
    nome: string;
    categoria: string;
    formato: string;
    conteudo: string;
    cardData: Record<string, any>;
    agenteId: string | null;
    variableMappings?: VariableMapping[];
  }): Promise<{ template_id_pri?: string; id_meta?: string; status_meta?: string; category_meta?: string } | null> => {
    if (!activeCompany?.id) return null;

    try {
      // Buscar dados completos do agente selecionado
      let agenteData: { telefone: string | null; dealer_id: string | null; ativo: boolean; nome: string } | null = null;
      
      if (templateData.agenteId) {
        const { data } = await supabase
          .from("agentes_ia")
          .select("telefone, dealer_id, ativo, nome")
          .eq("id", templateData.agenteId)
          .single();
        agenteData = data;
      }

      if (!agenteData) {
        console.error("❌ Agente não encontrado para o template - webhook não será disparado");
        toast.error("Agente não encontrado. Webhook não disparado.");
        return null;
      }

      // Construir payload Meta-compatível (async para buscar binários de mídia)
      const metaPayload = await buildMetaPayload(templateData);

      // Construir mapeamento de variáveis para resolução no disparo
      const varMapping = templateData.variableMappings 
        ? buildVariableMappingPayload(templateData.variableMappings)
        : {};

      // Adicionar dados do agente selecionado ao payload
      const payloadWithAgente = {
        ...metaPayload,
        empresa_id: activeCompany.id,
        agente_id: templateData.agenteId,
        agente_nome: agenteData.nome,
        pri_telefone: normalizePhone(agenteData.telefone),
        pri_dealer_id: agenteData.dealer_id || null,
        pri_status: agenteData.ativo ? "Ativo" : "Inativo",
        variable_mapping: varMapping, // Mapeamento para resolução de variáveis no disparo
      };

      console.log("Chamando Edge Function trigger-webhook com payload completo");

      // Chamar Edge Function que serve como proxy para os webhooks
      const { data: webhookResult, error: webhookError } = await supabase.functions.invoke('trigger-webhook', {
        body: {
          gatilho: 'novo_template_whatsapp',
          dados: payloadWithAgente
        }
      });

      if (webhookError) {
        console.error("Erro ao chamar Edge Function:", webhookError);
        return null;
      }

      console.log("Resposta da Edge Function:", webhookResult);

      // Extrair dados do Meta da resposta do webhook
      if (webhookResult?.webhook_response) {
        const response = webhookResult.webhook_response;
        return {
          template_id_pri: response.template_id_pri || response.id || null,
          id_meta: response.id_meta || response.id || null,
          status_meta: response.status_meta || response.status || null,
          category_meta: response.category_meta || response.category || null,
        };
      }

      return null;
    } catch (error) {
      console.error("❌ Erro ao disparar webhooks:", error);
      toast.error("Erro ao disparar webhook externo. Verifique os logs.");
      return null;
    }
  };

  const handleSave = async () => {
    if (isSaving) return; // Evitar duplo clique
    
    // Validação de nome duplicado
    const duplicateExists = templates.some(
      t => t.nome.toLowerCase() === formData.nome.trim().toLowerCase()
    );
    
    if (duplicateExists) {
      toast.error("Já existe um template com este nome");
      return;
    }

    // Validações específicas por formato
    if (formData.formato === "texto" && !formData.conteudo) {
      toast.error("Preencha o conteúdo do template");
      return;
    }
    if (formData.formato === "botao") {
      if (!formData.cardData.corpoTexto || formData.cardData.botoes.length === 0) {
        toast.error("Preencha o corpo do texto e adicione pelo menos um botão");
        return;
      }
      const emptyButtonName = formData.cardData.botoes.some(b => !b.nome.trim());
      if (emptyButtonName) {
        toast.error("Preencha o nome de todos os botões");
        return;
      }
    }
    if (formData.formato === "imagem" && !formData.cardData.imagemPreviewUrl) {
      toast.error("Faça upload de uma imagem");
      return;
    }
    if (formData.formato === "video" && !formData.cardData.videoPreviewUrl) {
      toast.error("Faça upload de um vídeo");
      return;
    }
    if (formData.formato === "card" && !formData.cardData.corpoTexto) {
      toast.error("Preencha o corpo do texto do card");
      return;
    }
    
    if (!activeCompany?.id) {
      toast.error("Empresa não selecionada");
      return;
    }

    setIsSaving(true);
    try {
      // Prepare card_data based on format type
      let cardData: Record<string, any> = {};
      let conteudo = "";

      switch (formData.formato) {
        case "texto":
          // Texto simples: apenas conteudo
          conteudo = formData.conteudo;
          cardData = {};
          break;

        case "botao":
          // Botão: corpo do texto + botões
          conteudo = formData.cardData.corpoTexto;
          cardData = {
            botoes: formData.cardData.botoes.map(b => ({ 
              id: b.id, 
              nome: b.nome, 
              buttonId: b.buttonId 
            })),
          };
          break;

        case "imagem":
          // Imagem: URL da imagem + corpo do texto (legenda)
          conteudo = formData.cardData.corpoTexto;
          cardData = {
            imagemUrl: formData.cardData.imagemPreviewUrl,
          };
          break;


        case "video":
          // Vídeo: URL do vídeo + corpo do texto (legenda)
          conteudo = formData.cardData.corpoTexto;
          cardData = {
            videoUrl: formData.cardData.videoPreviewUrl,
            videoMimeType: formData.cardData.videoMimeType || formData.cardData.videoCampanha?.type || null,
            videoSizeBytes: formData.cardData.videoSizeBytes || formData.cardData.videoCampanha?.size || null,
          };
          break;

        case "card":
          // Card: imagem ou vídeo + cabeçalho + corpo + rodapé + botões
          conteudo = formData.cardData.corpoTexto;
          cardData = {
            imagemUrl: formData.cardData.imagemPreviewUrl || undefined,
            videoUrl: formData.cardData.videoPreviewUrl || undefined,
            videoMimeType: formData.cardData.videoMimeType || undefined,
            videoSizeBytes: formData.cardData.videoSizeBytes || undefined,
            textoCabecalho: formData.cardData.textoCabecalho,
            botoes: formData.cardData.botoes.map(b => ({ 
              id: b.id, 
              nome: b.nome, 
              buttonId: b.buttonId 
            })),
          };
          break;
      }

      // Obter telefone do agente selecionado
      const agenteSelecionado = agentesIAWhatsapp.find(a => a.id === selectedAgenteId);
      const telefoneAgente = agenteSelecionado?.telefone 
        ? normalizePhone(agenteSelecionado.telefone) 
        : priTelefone;

      // Construir mapeamento de variáveis para salvar no banco
      const varMappingForDB = variableMappings.length > 0 
        ? buildVariableMappingPayload(variableMappings) 
        : null;

      const templateData = {
        empresa_id: activeCompany.id,
        departamento_id: formData.departamento_id || null,
        nome: formData.nome,
        categoria: formData.categoria,
        formato: formData.formato,
        conteudo: conteudo,
        card_data: cardData,
        agente_id: selectedAgenteId,
        pri_telefone: telefoneAgente,
        variable_mapping: varMappingForDB,
      };

      // 1. Inserir o template no banco
      const { data: insertedData, error: insertError } = await supabase
        .from("whatsapp_templates")
        .insert(templateData)
        .select("id")
        .single();

      if (insertError) throw insertError;
      
      const insertedTemplateId = insertedData?.id;
      if (!insertedTemplateId) throw new Error("Erro ao criar template: ID não retornado.");

      // 2. Chamar webhook para criar na Meta
      const webhookResponse = await triggerWebhooks({
        nome: formData.nome,
        categoria: formData.categoria,
        formato: formData.formato,
        conteudo: conteudo,
        cardData: cardData,
        agenteId: selectedAgenteId,
        variableMappings: variableMappings,
      });

      // 3. Validar que o webhook retornou template_id_pri (OBRIGATÓRIO)
      const returnedTemplateIdPri = webhookResponse?.template_id_pri;
      
      if (!returnedTemplateIdPri) {
        // Rollback: excluir o template parcial do banco
        await supabase.from("whatsapp_templates").delete().eq("id", insertedTemplateId);
        throw new Error(
          "Não foi possível criar o template, pois o identificador template_id_pri não foi retornado pelo webhook. " +
          "Esse dado é obrigatório para o funcionamento do template na PRI WhatsApp. Tente novamente."
        );
      }

      // 4. Atualizar o template com os IDs retornados
      const { error: updateError } = await supabase
        .from("whatsapp_templates")
        .update({
          template_id_pri: returnedTemplateIdPri,
          id_meta: webhookResponse?.id_meta || null,
          status_meta: webhookResponse?.status_meta || null,
          category_meta: webhookResponse?.category_meta || null,
        })
        .eq("id", insertedTemplateId);

      if (updateError) {
        console.error("Erro ao salvar dados do Meta:", updateError);
      }

      toast.success("Template criado com sucesso!");
      refetchTemplates();
      handleCloseModal();
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      
      // Verificar se é erro de vídeo muito grande
      if (error.message?.startsWith("VIDEO_TOO_LARGE:")) {
        const sizeInMB = error.message.split(":")[1];
        toast.error(`O vídeo selecionado tem ${sizeInMB}MB e excede o limite de 100MB permitido pela Meta. Por favor, faça o upload de um vídeo menor.`, {
          duration: 8000,
        });
      } else {
        toast.error("Erro ao salvar template: " + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Função para atualizar status dos templates via webhook
  const handleUpdateStatusMeta = async (options?: { showToasts?: boolean }) => {
    const showToasts = options?.showToasts ?? true;

    if (!activeCompany?.id || isUpdatingStatus) return;

    // Usa o agente selecionado ou o primeiro disponível (WhatsApp ou qualquer outro)
    const agenteId = selectedAgenteId || agentesIAWhatsapp[0]?.id;
    let agente = agenteId ? agentesIAWhatsapp.find((a: any) => a.id === agenteId) : null;

    // Fallback: se não há agente WhatsApp, buscar qualquer agente ativo vinculado à empresa
    if (!agente) {
      try {
        const { data: fallbackData } = await supabase
          .from("agente_empresas")
          .select(`agentes_ia (id, nome, telefone, dealer_id, ativo)`)
          .eq("empresa_id", activeCompany.id);

        const fallbackAgente = (fallbackData || [])
          .map((ae: any) => ae.agentes_ia)
          .filter((a: any) => a && a.ativo)?.[0];

        if (fallbackAgente) {
          agente = fallbackAgente;
        }
      } catch (err) {
        console.error("Erro ao buscar agente fallback:", err);
      }
    }

    if (!agente) {
      if (showToasts) toast.error("Nenhum agente IA ativo encontrado para esta empresa.");
      return;
    }

    setIsUpdatingStatus(true);
    try {

      // Buscar gatilhos ativos do tipo atualiza_status_meta
      const { data: gatilhos, error } = await supabase
        .from("gatilhos")
        .select("*")
        .eq("empresa_id", activeCompany.id)
        .eq("status", "Ativo");

      if (error) {
        console.error("Erro ao buscar gatilhos:", error);
        if (showToasts) toast.error("Erro ao buscar gatilhos");
        return;
      }

      const gatilhosFiltrados = (gatilhos || []).filter((g) => {
        const acoes = g.acoes as { tipo_evento?: string } | null;
        return acoes?.tipo_evento === "atualiza_status_meta";
      });

      if (gatilhosFiltrados.length === 0) {
        if (showToasts) toast.error("Nenhum gatilho 'Atualiza Status Meta' ativo encontrado");
        return;
      }

      const payload = {
        agente_id: agente.id,
        agente_nome: agente.nome,
        pri_telefone: normalizePhone(agente.telefone),
        pri_dealer_id: agente.dealer_id,
        pri_status: agente.ativo ? "Ativo" : "Inativo",
        data: new Date().toISOString(),
      };

      for (const gatilho of gatilhosFiltrados) {
        const acoes = gatilho.acoes as { webhook_url?: string } | null;
        const webhookUrl = acoes?.webhook_url;

        if (!webhookUrl) continue;

        try {
          // Route through edge function proxy to avoid CSP violations
          const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('external-webhook-proxy', {
            body: {
              endpoint: webhookUrl.split('/webhook/').pop() || '',
              ...payload,
            },
          });

          if (proxyError) {
            console.error("Erro ao chamar webhook via proxy:", proxyError);
            continue;
          }

          const responseData = proxyResponse;
          console.log("Resposta do webhook de status:", responseData);

          // O retorno pode estar em responseData.data ou ser diretamente um array
          const templatesArray = responseData?.data || responseData;

          if (Array.isArray(templatesArray)) {
            let updatedCount = 0;
            for (const item of templatesArray) {
              const metaId = item.id || item.id_meta;
              const metaStatus = item.status || item.status_meta;
              const metaName = item.name;
              const metaCategory = item.category;

              if (!metaId || !metaStatus) continue;

              // Buscar o template local para verificar se tem template_id_pri
              const { data: localMatch } = await supabase
                .from("whatsapp_templates")
                .select("id, template_id_pri")
                .eq("id_meta", metaId)
                .eq("empresa_id", activeCompany.id)
                .maybeSingle();

              // REGRA CRÍTICA: template sem template_id_pri NUNCA pode ser APPROVED
              const finalStatus = (localMatch && !localMatch.template_id_pri) ? "REJECTED" : metaStatus;

              if (localMatch) {
                const { error: updateByIdErr } = await supabase
                  .from("whatsapp_templates")
                  .update({
                    status_meta: finalStatus,
                    category_meta: metaCategory || null,
                  })
                  .eq("id", localMatch.id)
                  .eq("empresa_id", activeCompany.id);

                if (!updateByIdErr) updatedCount++;
                continue;
              }

              if (metaName) {
                const { data: localTemplates } = await supabase
                  .from("whatsapp_templates")
                  .select("id, nome, template_id_pri")
                  .eq("empresa_id", activeCompany.id)
                  .is("id_meta", null);

                if (localTemplates) {
                  const matchingTemplate = localTemplates.find((t) => {
                    const normalizedLocalName = formatNameForMeta(t.nome);
                    return normalizedLocalName === metaName;
                  });

                  if (matchingTemplate) {
                    // REGRA CRÍTICA: template sem template_id_pri NUNCA pode ser APPROVED
                    const finalStatusByName = !matchingTemplate.template_id_pri ? "REJECTED" : metaStatus;

                    const { error: updateByNameErr } = await supabase
                      .from("whatsapp_templates")
                      .update({
                        id_meta: metaId,
                        status_meta: finalStatusByName,
                        category_meta: metaCategory || null,
                      })
                      .eq("id", matchingTemplate.id)
                      .eq("empresa_id", activeCompany.id);

                    if (!updateByNameErr) updatedCount++;
                  }
                }
              }
            }
            if (showToasts) toast.success(`Status atualizado para ${updatedCount} templates`);
          } else if (templatesArray?.id_meta && templatesArray?.status_meta) {
            await supabase
              .from("whatsapp_templates")
              .update({
                status_meta: templatesArray.status_meta,
                category_meta: templatesArray.category || null,
              })
              .eq("id_meta", templatesArray.id_meta)
              .eq("empresa_id", activeCompany.id);
            if (showToasts) toast.success("Status atualizado com sucesso");
          }

          await supabase
            .from("gatilhos")
            .update({ ultima_execucao: new Date().toISOString() })
            .eq("id", gatilho.id);

          refetchTemplates();
        } catch (err: any) {
          console.error("Erro ao chamar webhook:", err);
          if (showToasts) toast.error("Erro ao conectar com o webhook");
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      if (showToasts) toast.error("Erro ao atualizar status dos templates");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Chamar atualização de status ao entrar no módulo
  useEffect(() => {
    if (activeCompany?.id && templates.length > 0) {
      // Delay pequeno para garantir que os dados estejam carregados
      const timer = setTimeout(() => {
        handleUpdateStatusMeta({ showToasts: false });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeCompany?.id]);

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      conteudo: prev.conteudo + variable,
    }));
  };

  const insertVariableToCorpoTexto = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      cardData: { ...prev.cardData, corpoTexto: prev.cardData.corpoTexto + variable },
    }));
  };

  // Função removida - variáveis agora gerenciadas apenas via TemplateVariablesEditor

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
              step < currentStep 
                ? "bg-primary border-primary text-primary-foreground"
                : step === currentStep 
                  ? "border-primary text-primary bg-background"
                  : "border-muted-foreground/30 text-muted-foreground"
            }`}
          >
            {step < currentStep ? (
              <Check className="h-4 w-4" />
            ) : (
              <span className="text-sm font-medium">{step}</span>
            )}
          </div>
          <span className={`ml-2 text-sm font-medium ${
            step === currentStep ? "text-foreground" : "text-muted-foreground"
          }`}>
            {step === 1 ? "Definição" : step === 2 ? "Formato" : "Conteúdo"}
          </span>
          {step < 3 && (
            <div className={`w-16 h-0.5 mx-2 ${
              step < currentStep ? "bg-primary" : "bg-muted-foreground/30"
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <Label htmlFor="nome" className="sm:w-40 shrink-0 sm:text-right pt-2">Nome do Template *</Label>
        <div className="flex-1 space-y-1">
          <Input
            id="nome"
            value={formData.nome}
            onChange={(e) => {
              // Normaliza para snake_case: minúsculas, sem acentos, espaços viram _
              const normalized = e.target.value
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .toLowerCase()
                .replace(/\s+/g, '_') // Espaços viram _
                .replace(/[^a-z0-9_]/g, ''); // Remove caracteres especiais
              
              if (normalized.length <= 100) {
                setFormData(prev => ({ ...prev, nome: normalized }));
              }
            }}
            placeholder="ex_convite_evento_vip"
            maxLength={100}
            className={`bg-white ${nomeDuplicado ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          <p className="text-xs text-muted-foreground text-right">{formData.nome.length}/100</p>
          {nomeDuplicado && (
            <p className="text-xs text-destructive">Já existe um template com este nome</p>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Label htmlFor="categoria" className="sm:w-40 shrink-0 sm:text-right">Categoria *</Label>
        <Select
          value={formData.categoria}
          onValueChange={(value: TemplateCategory) => setFormData(prev => ({ ...prev, categoria: value }))}
        >
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="utilidade">Utilidade</SelectItem>
            <SelectItem value="autenticacao">Autenticação</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Label htmlFor="agente" className="sm:w-40 shrink-0 sm:text-right">Agente IA WhatsApp *</Label>
        <Select
          value={formData.agente_id}
          onValueChange={(value) => setFormData(prev => ({ ...prev, agente_id: value }))}
          disabled={agentesIAWhatsapp.length === 0}
        >
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue placeholder={agentesIAWhatsapp.length === 0 ? "Nenhum agente Pri-WhatsApp encontrado" : "Selecione o agente"} />
          </SelectTrigger>
          <SelectContent>
            {agentesIAWhatsapp.map((agente) => (
              <SelectItem key={agente.id} value={agente.id}>
                {agente.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {agentesIAWhatsapp.length === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="hidden sm:block sm:w-40 shrink-0" />
          <p className="text-sm text-amber-600">
            Nenhum agente Pri - WhatsApp encontrado. Vincule um agente do tipo IA WhatsApp à empresa primeiro.
          </p>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-1">
      <h3 className="text-lg font-medium mb-2">Selecione o tipo</h3>
      {formatOptions.map((format) => (
        <Card 
          key={format.value}
          className={`cursor-pointer transition-all hover:border-primary ${
            formData.formato === format.value ? "border-primary border-2" : ""
          }`}
          onClick={() => {
            setFormData(prev => ({ ...prev, formato: format.value }));
            setCurrentStep(3);
          }}
        >
          <CardContent className="flex items-center justify-between py-1.5 px-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-muted">
                <format.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">{format.label}</p>
                <p className="text-xs text-muted-foreground">{format.description}</p>
              </div>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              formData.formato === format.value 
                ? "border-primary bg-primary" 
                : "border-muted-foreground/30"
            }`}>
              {formData.formato === format.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderStep3 = () => {
    const limitsAlert = (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4">
        <p className="text-sm font-medium text-amber-800">⚠️ Limites da Meta para aprovação:</p>
        <ul className="text-xs text-amber-700 mt-1 list-disc list-inside space-y-0.5">
          <li>Corpo do template: máximo de <strong>1024 caracteres</strong></li>
          <li>Texto de cada botão: máximo de <strong>25 caracteres</strong></li>
        </ul>
      </div>
    );

    if (formData.formato === "texto") {
      return (
        <div className="space-y-4">
          {limitsAlert}
          <div>
            <Label htmlFor="conteudo">Conteúdo do Template</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Máximo de 1024 caracteres
            </p>
            <RichTextarea
              id="conteudo"
              value={formData.conteudo}
              onValueChange={(value) => {
                if (value.length <= 1024) {
                  setFormData(prev => ({ ...prev, conteudo: value }));
                }
              }}
              placeholder="Digite o conteúdo do template..."
              className="bg-white"
              minHeight="150px"
            />
            <p className="text-sm text-muted-foreground mt-1 text-right">
              {formData.conteudo.length}/1024
            </p>
          </div>

          {/* Editor de variáveis dinâmicas {{1}}, {{2}}, etc. */}
          <TemplateVariablesEditor
            text={formData.conteudo}
            variables={variableMappings}
            onVariablesChange={setVariableMappings}
            onInsertVariable={() => {
              const nextNum = variableMappings.length > 0 
                ? Math.max(...variableMappings.map(v => v.position)) + 1 
                : 1;
              setFormData(prev => ({
                ...prev,
                conteudo: prev.conteudo + `{{${nextNum}}}`
              }));
            }}
          />
        </div>
      );
    }

    if (formData.formato === "card") {
      const cardMediaType = formData.cardData.cardMediaType || (formData.cardData.videoPreviewUrl ? "video" : "imagem");
      const setCardMediaType = (type: "imagem" | "video") => {
        setFormData(prev => ({ ...prev, cardData: { ...prev.cardData, cardMediaType: type } }));
      };

      const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            toast.error("Imagem deve ter no máximo 5MB");
            e.target.value = "";
            return;
          }
          const publicUrl = await uploadMediaToStorage(file, 'image');
          if (publicUrl) {
            setFormData(prev => ({
              ...prev,
              cardData: {
                ...prev.cardData,
                imagemCampanha: file,
                imagemPreviewUrl: publicUrl,
                videoCampanha: null,
                videoPreviewUrl: "",
              }
            }));
          }
        }
      };

      const handleRemoveImage = () => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            imagemCampanha: null,
            imagemPreviewUrl: "",
          }
        }));
      };

      const handleCardVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let fileToUpload = file;
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
          toast.info(`O vídeo tem ${sizeInMB}MB. Iniciando compressão automática...`);
          const compressedFile = await compressVideo(file);
          if (!compressedFile) {
            toast.error('Não foi possível comprimir o vídeo para menos de 12MB. Tente um vídeo mais curto.');
            e.target.value = "";
            return;
          }
          toast.success(`Vídeo comprimido com sucesso! Novo tamanho: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
          fileToUpload = compressedFile;
        }

        const publicUrl = await uploadMediaToStorage(fileToUpload, 'video');
        if (publicUrl) {
          setFormData(prev => ({
            ...prev,
            cardData: {
              ...prev.cardData,
              videoCampanha: fileToUpload,
              videoPreviewUrl: publicUrl,
              videoMimeType: fileToUpload.type || "video/mp4",
              videoSizeBytes: fileToUpload.size,
              imagemCampanha: null,
              imagemPreviewUrl: "",
            }
          }));
        }
      };

      const handleRemoveCardVideo = () => {
        cancelCompression();
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            videoCampanha: null,
            videoPreviewUrl: "",
            videoMimeType: undefined,
            videoSizeBytes: undefined,
          }
        }));
      };

      const handleAddButton = () => {
        const newButton: CardButton = {
          id: crypto.randomUUID(),
          nome: "",
          buttonId: "",
        };
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            botoes: [...prev.cardData.botoes, newButton],
          }
        }));
      };

      const handleUpdateButton = (id: string, field: "nome" | "buttonId", value: string) => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            botoes: prev.cardData.botoes.map(btn => 
              btn.id === id ? { ...btn, [field]: value } : btn
            ),
          }
        }));
      };

      const handleDeleteButton = (id: string) => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            botoes: prev.cardData.botoes.filter(btn => btn.id !== id),
          }
        }));
      };

      return (
        <div className="space-y-4">
          {limitsAlert}
          {/* Mídia da Campanha */}
          <div>
            <Label>Mídia da Campanha</Label>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              A URL da mídia é pública e permanente
            </p>
            {/* Seletor de tipo de mídia */}
            <div className="flex gap-2 mt-2 mb-2">
              <Button
                type="button"
                size="sm"
                variant={cardMediaType === "imagem" ? "default" : "outline"}
                onClick={() => {
                  setCardMediaType("imagem");
                  if (cardMediaType !== "imagem") handleRemoveCardVideo();
                }}
              >
                Imagem
              </Button>
              <Button
                type="button"
                size="sm"
                variant={cardMediaType === "video" ? "default" : "outline"}
                onClick={() => {
                  setCardMediaType("video");
                  if (cardMediaType !== "video") handleRemoveImage();
                }}
              >
                Vídeo
              </Button>
            </div>

            <div className="mt-2">
              {cardMediaType === "imagem" ? (
                isUploading ? (
                  <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-primary rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-1"></div>
                    <span className="text-sm text-muted-foreground">Enviando...</span>
                  </div>
                ) : formData.cardData.imagemPreviewUrl ? (
                  <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                    <img 
                      src={formData.cardData.imagemPreviewUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={handleRemoveImage}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-sm text-muted-foreground">Clique para enviar imagem</span>
                    <span className="text-xs text-muted-foreground">(máximo 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )
              ) : (
                isUploading || isCompressing ? (
                  <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-primary rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-1"></div>
                    <span className="text-sm text-muted-foreground">
                      {isCompressing ? (compressionProgress?.message || "Comprimindo...") : "Enviando..."}
                    </span>
                  </div>
                ) : formData.cardData.videoPreviewUrl ? (
                  <div className="relative w-full bg-muted rounded-lg overflow-hidden">
                    <video
                      src={formData.cardData.videoPreviewUrl}
                      controls
                      className="w-full h-32 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={handleRemoveCardVideo}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-sm text-muted-foreground">Clique para enviar vídeo</span>
                    <span className="text-xs text-muted-foreground">(máx. 12MB, compressão automática)</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleCardVideoUpload}
                    />
                  </label>
                )
              )}
            </div>
          </div>

          {/* Corpo do Texto */}
          <div>
            <Label htmlFor="corpoTexto">Corpo do Texto</Label>
            <RichTextarea
              id="corpoTexto"
              value={formData.cardData.corpoTexto}
              onValueChange={(value) => {
                if (value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: value }
                  }));
                }
              }}
              placeholder="Conteúdo principal do card..."
              className="bg-white"
              minHeight="80px"
              maxLength={1024}
            />
            <div className="flex items-center justify-end mt-1">
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>

            {/* Editor de variáveis dinâmicas */}
            <TemplateVariablesEditor
              text={formData.cardData.corpoTexto}
              variables={variableMappings}
              onVariablesChange={setVariableMappings}
              onInsertVariable={() => {
                const nextNum = variableMappings.length > 0 
                  ? Math.max(...variableMappings.map(v => v.position)) + 1 
                  : 1;
                setFormData(prev => ({
                  ...prev,
                  cardData: { ...prev.cardData, corpoTexto: prev.cardData.corpoTexto + `{{${nextNum}}}` }
                }));
              }}
            />
          </div>

          {/* Botões */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Botões (máx. 3)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddButton}
                disabled={formData.cardData.botoes.length >= 3}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar Botão
              </Button>
            </div>
            {formData.cardData.botoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">
                Nenhum botão adicionado
              </p>
            ) : (
              <div className="space-y-2">
                {formData.cardData.botoes.map((btn, index) => (
                  <div key={btn.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                    <div className="flex-1 space-y-0.5">
                      <Input
                        value={btn.nome}
                        onChange={(e) => {
                          if (e.target.value.length <= 25) {
                            handleUpdateButton(btn.id, "nome", e.target.value);
                          }
                        }}
                        placeholder="Texto do botão"
                        className={`h-8 text-sm bg-white ${btn.nome.length >= 25 ? "border-amber-400" : ""}`}
                        maxLength={25}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{btn.nome.length}/25</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteButton(btn.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (formData.formato === "botao") {
      const handleAddButton = () => {
        const newButton: CardButton = {
          id: crypto.randomUUID(),
          nome: "",
          buttonId: "",
        };
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            botoes: [...prev.cardData.botoes, newButton],
          }
        }));
      };

      const handleUpdateButton = (id: string, field: "nome" | "buttonId", value: string) => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            botoes: prev.cardData.botoes.map(btn => 
              btn.id === id ? { ...btn, [field]: value } : btn
            ),
          }
        }));
      };

      const handleDeleteButton = (id: string) => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            botoes: prev.cardData.botoes.filter(btn => btn.id !== id),
          }
        }));
      };

      return (
        <div className="space-y-4">
          {limitsAlert}
          {/* Corpo do Texto */}
          <div>
            <Label htmlFor="corpoTextoBotao">Corpo do Texto</Label>
            <RichTextarea
              id="corpoTextoBotao"
              value={formData.cardData.corpoTexto}
              onValueChange={(value) => {
                if (value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: value }
                  }));
                }
              }}
              placeholder="Digite o conteúdo da mensagem..."
              className="bg-white"
              minHeight="120px"
              maxLength={1024}
            />
            <div className="flex items-center justify-end mt-1">
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>

            {/* Editor de variáveis dinâmicas */}
            <TemplateVariablesEditor
              text={formData.cardData.corpoTexto}
              variables={variableMappings}
              onVariablesChange={setVariableMappings}
              onInsertVariable={() => {
                const nextNum = variableMappings.length > 0 
                  ? Math.max(...variableMappings.map(v => v.position)) + 1 
                  : 1;
                setFormData(prev => ({
                  ...prev,
                  cardData: { ...prev.cardData, corpoTexto: prev.cardData.corpoTexto + `{{${nextNum}}}` }
                }));
              }}
            />
          </div>

          {/* Botões */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Botões (máx. 3)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddButton}
                disabled={formData.cardData.botoes.length >= 3}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adicionar Botão
              </Button>
            </div>
            {formData.cardData.botoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">
                Nenhum botão adicionado
              </p>
            ) : (
              <div className="space-y-2">
                {formData.cardData.botoes.map((btn, index) => (
                  <div key={btn.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                    <div className="flex-1 space-y-0.5">
                      <Input
                        value={btn.nome}
                        onChange={(e) => {
                          if (e.target.value.length <= 25) {
                            handleUpdateButton(btn.id, "nome", e.target.value);
                          }
                        }}
                        placeholder="Texto do botão"
                        className={`h-8 text-sm bg-white ${btn.nome.length >= 25 ? "border-amber-400" : ""}`}
                        maxLength={25}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{btn.nome.length}/25</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteButton(btn.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (formData.formato === "imagem") {
      const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            toast.error("Imagem deve ter no máximo 5MB");
            e.target.value = "";
            return;
          }
          const publicUrl = await uploadMediaToStorage(file, 'image');
          if (publicUrl) {
            setFormData(prev => ({
              ...prev,
              cardData: {
                ...prev.cardData,
                imagemCampanha: file,
                imagemPreviewUrl: publicUrl,
              }
            }));
          }
        }
      };

      const handleRemoveImage = () => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            imagemCampanha: null,
            imagemPreviewUrl: "",
          }
        }));
      };

      return (
        <div className="space-y-4">
          {limitsAlert}
          {/* Imagem da Campanha */}
          <div>
            <Label>Imagem da Campanha</Label>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              A URL da mídia é pública e permanente
            </p>
            <div className="mt-2">
              {isUploading ? (
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                  <span className="text-sm text-muted-foreground">Enviando...</span>
                </div>
              ) : formData.cardData.imagemPreviewUrl ? (
                <div className="relative w-full h-40 bg-muted rounded-lg overflow-hidden">
                  <img 
                    src={formData.cardData.imagemPreviewUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={handleRemoveImage}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clique para enviar imagem</span>
                  <span className="text-xs text-muted-foreground">(máximo 5MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Corpo do Texto */}
          <div>
            <Label htmlFor="corpoTextoImagem">Corpo do Texto</Label>
            <RichTextarea
              id="corpoTextoImagem"
              value={formData.cardData.corpoTexto}
              onValueChange={(value) => {
                if (value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: value }
                  }));
                }
              }}
              placeholder="Digite o conteúdo da mensagem..."
              className="bg-white"
              minHeight="120px"
              maxLength={1024}
            />
            <div className="flex items-center justify-end mt-1">
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>

            {/* Editor de variáveis dinâmicas */}
            <TemplateVariablesEditor
              text={formData.cardData.corpoTexto}
              variables={variableMappings}
              onVariablesChange={setVariableMappings}
              onInsertVariable={() => {
                const nextNum = variableMappings.length > 0 
                  ? Math.max(...variableMappings.map(v => v.position)) + 1 
                  : 1;
                setFormData(prev => ({
                  ...prev,
                  cardData: { ...prev.cardData, corpoTexto: prev.cardData.corpoTexto + `{{${nextNum}}}` }
                }));
              }}
            />
          </div>
        </div>
      );
    }


    if (formData.formato === "video") {
      const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let fileToUpload = file;
        
        // Check if compression is needed
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
          toast.info(
            `O vídeo tem ${sizeInMB}MB. Iniciando compressão automática...`
          );
          
          const compressedFile = await compressVideo(file);
          
          if (!compressedFile) {
            toast.error(
              'Não foi possível comprimir o vídeo para menos de 12MB. Tente um vídeo mais curto.'
            );
            e.target.value = "";
            return;
          }
          
          const compressedSizeMB = (compressedFile.size / 1024 / 1024).toFixed(2);
          toast.success(
            `Vídeo comprimido com sucesso! Novo tamanho: ${compressedSizeMB}MB`
          );
          
          fileToUpload = compressedFile;
        }

        const publicUrl = await uploadMediaToStorage(fileToUpload, 'video');
        if (publicUrl) {
          setFormData(prev => ({
            ...prev,
            cardData: {
              ...prev.cardData,
              videoCampanha: fileToUpload,
              videoPreviewUrl: publicUrl,
              videoMimeType: fileToUpload.type || "video/mp4",
              videoSizeBytes: fileToUpload.size,
            }
          }));
        }
      };

      const handleRemoveVideo = () => {
        cancelCompression();
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            videoCampanha: null,
            videoPreviewUrl: "",
            videoMimeType: undefined,
            videoSizeBytes: undefined,
          }
        }));
      };

      return (
        <div className="space-y-4">
          {limitsAlert}
          {/* Vídeo da Campanha */}
          <div>
            <Label>Vídeo da Campanha</Label>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              A URL da mídia é pública e permanente
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vídeos maiores que 12MB serão comprimidos automaticamente
            </p>
            <div className="mt-2">
              {isCompressing ? (
                <div className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-primary rounded-lg p-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                  <span className="text-sm text-muted-foreground mb-2">
                    {compressionProgress?.message || 'Comprimindo vídeo...'}
                  </span>
                  {compressionProgress && compressionProgress.stage === 'compressing' && (
                    <div className="w-full max-w-xs">
                      <Progress value={compressionProgress.progress} className="h-2" />
                      <span className="text-xs text-muted-foreground mt-1 block text-center">
                        {compressionProgress.progress}%
                      </span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      cancelCompression();
                      toast.info('Compressão cancelada');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : isUploading ? (
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                  <span className="text-sm text-muted-foreground">Enviando...</span>
                </div>
              ) : formData.cardData.videoPreviewUrl ? (
                <div className="relative w-full bg-muted rounded-lg overflow-hidden">
                  <video 
                    src={formData.cardData.videoPreviewUrl} 
                    controls
                    className="w-full h-40 object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={handleRemoveVideo}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Video className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clique para enviar vídeo</span>
                  <span className="text-xs text-muted-foreground">(compressão automática para &gt;12MB)</span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Corpo do Texto */}
          <div>
            <Label htmlFor="corpoTextoVideo">Corpo do Texto</Label>
            <RichTextarea
              id="corpoTextoVideo"
              value={formData.cardData.corpoTexto}
              onValueChange={(value) => {
                if (value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: value }
                  }));
                }
              }}
              placeholder="Digite o conteúdo da mensagem..."
              className="bg-white"
              minHeight="120px"
              maxLength={1024}
            />
            <div className="flex items-center justify-end mt-1">
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>

            {/* Editor de variáveis dinâmicas */}
            <TemplateVariablesEditor
              text={formData.cardData.corpoTexto}
              variables={variableMappings}
              onVariablesChange={setVariableMappings}
              onInsertVariable={() => {
                const nextNum = variableMappings.length > 0 
                  ? Math.max(...variableMappings.map(v => v.position)) + 1 
                  : 1;
                setFormData(prev => ({
                  ...prev,
                  cardData: { ...prev.cardData, corpoTexto: prev.cardData.corpoTexto + `{{${nextNum}}}` }
                }));
              }}
            />
          </div>
        </div>
      );
    }

    // For other formats, show placeholder
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Configuração para o formato "{formatOptions.find(f => f.value === formData.formato)?.label}" em desenvolvimento.
        </p>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Templates WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os templates de mensagens para integração com a Meta
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Linha com seletor de agente e botão atualizar */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedAgenteId}
                onValueChange={setSelectedAgenteId}
                disabled={agentesIAWhatsapp.length === 0}
              >
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder="Selecione o agente" />
                </SelectTrigger>
                <SelectContent>
                  {agentesIAWhatsapp.map((agente) => (
                    <SelectItem key={agente.id} value={agente.id}>
                      {agente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => handleUpdateStatusMeta({ showToasts: true })} 
                disabled={isUpdatingStatus || agentesIAWhatsapp.length === 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
                Atualizar Status
              </Button>
            </div>
            {/* Botão novo template em destaque */}
            <Button onClick={() => handleOpenModal()} disabled={agentesIAWhatsapp.length === 0} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-[calc(100vh-220px)] overflow-auto">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Type className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum template cadastrado
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie seu primeiro template de mensagem para WhatsApp
                </p>
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>ID Pri</TableHead>
                    <TableHead>ID Meta</TableHead>
                    <TableHead>Status Meta</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.categoria.charAt(0).toUpperCase() + template.categoria.slice(1)}</Badge>
                      </TableCell>
                      <TableCell>{template.formato.charAt(0).toUpperCase() + template.formato.slice(1)}</TableCell>
                      <TableCell className="font-mono text-xs">{template.template_id_pri || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{template.id_meta || "-"}</TableCell>
                      <TableCell>
                        {template.status_meta ? (
                          <Badge 
                            className={
                              template.status_meta === "APPROVED" 
                                ? "bg-green-500 text-white hover:bg-green-600" 
                                : template.status_meta === "PENDING" 
                                  ? "bg-orange-500 text-white hover:bg-orange-600" 
                                  : "bg-red-500 text-white hover:bg-red-600"
                            }
                          >
                            {template.status_meta === "APPROVED" ? "Aprovado" 
                              : template.status_meta === "PENDING" ? "Pendente"
                              : template.status_meta === "REJECTED" ? "Reprovado"
                              : template.status_meta === "INTEGRATION_ERROR" ? "Reprovado"
                              : template.status_meta}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="cursor-pointer"
                            onClick={() => {
                              setPreviewTemplate(template);
                              setIsPreviewOpen(true);
                            }}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="cursor-pointer"
                            onClick={() => handleDuplicateTemplate(template)}
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteTemplate(template)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col overflow-hidden pb-3">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{duplicatingTemplate ? "Novo Template (Duplicado)" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-shrink-0">
            {renderStepIndicator()}
          </div>
          
          <ScrollIndicator className="flex-1 min-h-0">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </ScrollIndicator>

          <div className="flex-shrink-0 flex justify-between gap-2 pt-2 border-t mt-2">
            <div>
              {currentStep > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {currentStep === 3 && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const cardData = formData.formato === "texto" ? {} : {
                      imagemUrl: formData.cardData.imagemPreviewUrl,
                      audioUrl: formData.cardData.audioPreviewUrl,
                      videoUrl: formData.cardData.videoPreviewUrl,
                      textoCabecalho: formData.cardData.textoCabecalho,
                      rodape: formData.cardData.rodape,
                      botoes: formData.cardData.botoes,
                    };
                    setPreviewTemplate({
                      nome: formData.nome,
                      formato: formData.formato,
                      conteudo: formData.formato === "texto" ? formData.conteudo : formData.cardData.corpoTexto,
                      card_data: cardData,
                    });
                    setIsPreviewOpen(true);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              )}
              {currentStep < 3 ? (
                <Button onClick={handleNext}>
                  Avançar
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Criando..." : "Criar Template"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Preview Modal */}
      <TemplatePreview
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewTemplate(null);
        }}
        nome={previewTemplate?.nome || ""}
        formato={previewTemplate?.formato || ""}
        conteudo={previewTemplate?.conteudo || ""}
        cardData={previewTemplate?.card_data}
      />
    </DashboardLayout>
  );
}
