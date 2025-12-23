import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Edit2,
  Music,
  RefreshCw
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";


type TemplateFormat = "texto" | "botao" | "imagem" | "audio" | "video" | "card" | "lista";
type TemplateCategory = "marketing" | "utilidade" | "transacional";

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
  textoCabecalho: string;
  corpoTexto: string;
  rodape: string;
  botoes: CardButton[];
}

interface TemplateFormData {
  nome: string;
  categoria: TemplateCategory | "";
  departamento_id: string;
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
    value: "audio" as TemplateFormat, 
    label: "Áudio", 
    description: "Envie um áudio para o cliente.",
    icon: Music 
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

const systemVariables = [
  { value: "{{nome_cliente}}", label: "Nome do Cliente" },
  { value: "{{empresa}}", label: "Empresa" },
  { value: "{{marca}}", label: "Marca" },
  { value: "{{data_atual}}", label: "Data Atual" },
  { value: "{{nome_prospeccao}}", label: "Nome Prospecção" },
  { value: "{{data_inicio}}", label: "Data Início" },
  { value: "{{data_fim}}", label: "Data Fim" },
];

export default function Templates() {
  const { activeCompany } = useCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nomeDuplicado, setNomeDuplicado] = useState(false);
  const [verificandoNome, setVerificandoNome] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
          upsert: false
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
    textoCabecalho: "",
    corpoTexto: "",
    rodape: "",
    botoes: [],
  };

  const [formData, setFormData] = useState<TemplateFormData>({
    nome: "",
    categoria: "",
    departamento_id: "",
    formato: "",
    conteudo: "",
    variaveis: [],
    cardData: initialCardData,
  });

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case "aprovado":
        return "bg-green-100 text-green-700 border-green-200";
      case "rejeitado":
        return "bg-red-100 text-red-700 border-red-200";
      case "pausado":
        return "bg-gray-100 text-gray-700 border-gray-200";
      case "pendente":
      default:
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
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

  // Fetch templates
  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ["whatsapp_templates", activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return [];
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*, departamentos(nome)")
        .eq("empresa_id", activeCompany.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeCompany?.id,
  });

  // Verificar nome duplicado em tempo real
  useEffect(() => {
    const verificarNomeDuplicado = async () => {
      if (!formData.nome.trim() || formData.nome.trim().length < 2 || !activeCompany?.id) {
        setNomeDuplicado(false);
        return;
      }

      setVerificandoNome(true);
      try {
        let query = supabase
          .from("whatsapp_templates")
          .select("id")
          .eq("empresa_id", activeCompany.id)
          .ilike("nome", formData.nome.trim());

        // Se estiver editando, excluir o template atual da verificação
        if (editingTemplateId) {
          query = query.neq("id", editingTemplateId);
        }

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
  }, [formData.nome, activeCompany?.id, editingTemplateId]);

  const handleOpenModal = () => {
    setEditingTemplateId(null);
    setFormData({
      nome: "",
      categoria: "",
      departamento_id: "",
      formato: "",
      conteudo: "",
      variaveis: [],
      cardData: initialCardData,
    });
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplateId(template.id);
    
    // Parse card_data from database
    const cardData = template.card_data || {};
    
    setFormData({
      nome: template.nome,
      categoria: template.categoria as TemplateCategory,
      departamento_id: template.departamento_id || "",
      formato: template.formato as TemplateFormat,
      conteudo: template.formato === "texto" ? template.conteudo : "",
      variaveis: [],
      cardData: {
        imagemCampanha: null,
        imagemPreviewUrl: cardData.imagemUrl || "",
        audioCampanha: null,
        audioPreviewUrl: cardData.audioUrl || "",
        videoCampanha: null,
        videoPreviewUrl: cardData.videoUrl || "",
        textoCabecalho: cardData.textoCabecalho || "",
        corpoTexto: template.formato !== "texto" ? template.conteudo : "",
        rodape: cardData.rodape || "",
        botoes: (cardData.botoes || []).map((b: any) => ({
          id: b.id || crypto.randomUUID(),
          nome: b.nome || "",
          buttonId: b.buttonId || "",
        })),
      },
    });
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentStep(1);
    setEditingTemplateId(null);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.nome || !formData.categoria || !formData.departamento_id) {
        toast.error("Preencha todos os campos obrigatórios");
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
      "transacional": "TRANSACTIONAL",
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

    // BODY é obrigatório
    components.push({
      type: "BODY",
      text: savedData.conteudo || "",
    });

    // HEADER (opcional) - para formatos com cabeçalho
    if (savedData.formato === "card") {
      // Card pode ter imagem + texto de cabeçalho
      if (savedData.cardData?.imagemUrl) {
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
      // Texto do cabeçalho vai separado se houver
      if (savedData.cardData?.textoCabecalho) {
        // Se já tem imagem, o texto vai no próprio header como exemplo
        // Se não tem imagem, é header de texto
        if (!savedData.cardData?.imagemUrl) {
          components.push({
            type: "HEADER",
            format: "TEXT",
            text: savedData.cardData.textoCabecalho,
          });
        }
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
        media_mime_type: mediaData?.mimeType || null,
        media_type: "video",
        media_length: mediaData?.size || null,
      });
    }

    // FOOTER (opcional)
    if (savedData.cardData?.rodape) {
      components.push({
        type: "FOOTER",
        text: savedData.cardData.rodape,
      });
    }

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

    return {
      provider: "meta_whatsapp",
      action: "create_message_template",
      waba_id: "",
      payload: {
        name: formatNameForMeta(savedData.nome),
        language: "pt_BR",
        category: mapCategoriaToMeta(savedData.categoria),
        components,
      },
    };
  };

  // Função para disparar webhooks dos gatilhos
  const triggerWebhooks = async (templateData: {
    nome: string;
    categoria: string;
    formato: string;
    conteudo: string;
    cardData: Record<string, any>;
  }) => {
    if (!activeCompany?.id) return;

    try {
      // Buscar dados da Pri (agente de IA)
      const { data: priAgent } = await supabase
        .from("agentes_ia")
        .select("telefone, dealer_id, ativo")
        .eq("empresa_id", activeCompany.id)
        .eq("nome", "Pri")
        .single();

      // Buscar gatilhos ativos - filtramos por acoes->tipo_evento = "novo_template_whatsapp_criado"
      const { data: gatilhos, error } = await supabase
        .from("gatilhos")
        .select("*")
        .eq("empresa_id", activeCompany.id)
        .eq("status", "Ativo");

      if (error) {
        console.error("Erro ao buscar gatilhos:", error);
        return;
      }

      // Filtrar gatilhos pelo tipo_evento nas acoes
      const gatilhosFiltrados = (gatilhos || []).filter((g) => {
        const acoes = g.acoes as { tipo_evento?: string } | null;
        return acoes?.tipo_evento === "novo_template_whatsapp";
      });

      if (gatilhosFiltrados.length === 0) {
        console.log("Nenhum gatilho ativo encontrado para novo_template_whatsapp");
        return;
      }

      // Construir payload Meta-compatível (async para buscar binários de mídia)
      const metaPayload = await buildMetaPayload(templateData);

      // Adicionar dados da Pri ao payload
      const payloadWithPri = {
        ...metaPayload,
        pri_telefone: priAgent?.telefone || null,
        pri_dealer_id: priAgent?.dealer_id || null,
        pri_status: priAgent?.ativo ? "Ativo" : "Inativo",
      };

      // Disparar webhooks para cada gatilho
      for (const gatilho of gatilhosFiltrados) {
        const acoes = gatilho.acoes as { webhook_url?: string } | null;
        const webhookUrl = acoes?.webhook_url;

        if (!webhookUrl) {
          console.log(`Gatilho ${gatilho.nome} sem webhook_url configurado`);
          continue;
        }

        try {
          console.log(`Disparando webhook para gatilho: ${gatilho.nome}`);
          console.log("Payload:", JSON.stringify(payloadWithPri, null, 2));

          // Adicionar timeout de 10 segundos para evitar travamento
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payloadWithPri),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const responseData = await response.text();
            console.log(`Webhook disparado com sucesso para: ${gatilho.nome}`);
            console.log("Resposta do webhook:", responseData);
            
            // Tentar parsear a resposta JSON para extrair dados do Meta
            try {
              const jsonResponse = JSON.parse(responseData);
              if (jsonResponse.template_id_pri || jsonResponse.id_meta || jsonResponse.status_meta || jsonResponse.category) {
                return {
                  template_id_pri: jsonResponse.template_id_pri || null,
                  id_meta: jsonResponse.id_meta || null,
                  status_meta: jsonResponse.status_meta || null,
                  category_meta: jsonResponse.category || null,
                };
              }
            } catch (parseErr) {
              console.log("Resposta do webhook não é JSON válido");
            }
            
            // Atualizar ultima_execucao do gatilho
            await supabase
              .from("gatilhos")
              .update({ ultima_execucao: new Date().toISOString() })
              .eq("id", gatilho.id);
          } else {
            const errorBody = await response.text();
            console.error(`Erro ao disparar webhook para ${gatilho.nome}:`, response.status);
            console.error("Corpo do erro:", errorBody);
            toast.error(`Erro no webhook (${response.status}): ${errorBody.substring(0, 200)}`);
          }
        } catch (webhookError: any) {
          if (webhookError.name === 'AbortError') {
            console.error(`Timeout ao chamar webhook ${gatilho.nome}`);
          } else {
            console.error(`Erro ao chamar webhook ${gatilho.nome}:`, webhookError);
          }
        }
      }
      
      return null;
    } catch (err) {
      console.error("Erro ao processar gatilhos:", err);
      return null;
    }
  };

  const handleSave = async () => {
    if (isSaving) return; // Evitar duplo clique
    
    // Validação de nome duplicado
    const duplicateExists = templates.some(
      t => t.nome.toLowerCase() === formData.nome.trim().toLowerCase() && t.id !== editingTemplateId
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
    if (formData.formato === "botao" && (!formData.cardData.corpoTexto || formData.cardData.botoes.length === 0)) {
      toast.error("Preencha o corpo do texto e adicione pelo menos um botão");
      return;
    }
    if (formData.formato === "imagem" && !formData.cardData.imagemPreviewUrl) {
      toast.error("Faça upload de uma imagem");
      return;
    }
    if (formData.formato === "audio" && !formData.cardData.audioPreviewUrl) {
      toast.error("Faça upload de um áudio");
      return;
    }
    if (formData.formato === "video" && !formData.cardData.videoPreviewUrl) {
      toast.error("Faça upload de um vídeo");
      return;
    }
    if (formData.formato === "card" && (!formData.cardData.textoCabecalho || !formData.cardData.corpoTexto)) {
      toast.error("Preencha o cabeçalho e o corpo do texto do card");
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

        case "audio":
          // Áudio: URL do áudio + corpo do texto (legenda)
          conteudo = formData.cardData.corpoTexto;
          cardData = {
            audioUrl: formData.cardData.audioPreviewUrl,
          };
          break;

        case "video":
          // Vídeo: URL do vídeo + corpo do texto (legenda)
          conteudo = formData.cardData.corpoTexto;
          cardData = {
            videoUrl: formData.cardData.videoPreviewUrl,
          };
          break;

        case "card":
          // Card: imagem + cabeçalho + corpo + rodapé + botões
          conteudo = formData.cardData.corpoTexto;
          cardData = {
            imagemUrl: formData.cardData.imagemPreviewUrl,
            textoCabecalho: formData.cardData.textoCabecalho,
            rodape: formData.cardData.rodape,
            botoes: formData.cardData.botoes.map(b => ({ 
              id: b.id, 
              nome: b.nome, 
              buttonId: b.buttonId 
            })),
          };
          break;
      }

      const templateData = {
        empresa_id: activeCompany.id,
        departamento_id: formData.departamento_id || null,
        nome: formData.nome,
        categoria: formData.categoria,
        formato: formData.formato,
        conteudo: conteudo,
        card_data: cardData,
      };

      let error;
      let insertedTemplateId: string | null = null;
      
      if (editingTemplateId) {
        // Update existing template
        const result = await supabase
          .from("whatsapp_templates")
          .update(templateData)
          .eq("id", editingTemplateId);
        error = result.error;
        insertedTemplateId = editingTemplateId;
      } else {
        // Insert new template
        const result = await supabase
          .from("whatsapp_templates")
          .insert([templateData])
          .select("id")
          .single();
        error = result.error;
        insertedTemplateId = result.data?.id || null;
      }

      if (error) throw error;

      // Disparar webhooks dos gatilhos "novo_template_whatsapp_criado"
      const webhookResponse = await triggerWebhooks({
        nome: formData.nome,
        categoria: formData.categoria,
        formato: formData.formato,
        conteudo: conteudo,
        cardData: cardData,
      });

      // Se o webhook retornou dados do Meta, atualizar o template
      if (webhookResponse && insertedTemplateId) {
        const { error: updateError } = await supabase
          .from("whatsapp_templates")
          .update({
            template_id_pri: webhookResponse.template_id_pri,
            id_meta: webhookResponse.id_meta,
            status_meta: webhookResponse.status_meta,
            category_meta: webhookResponse.category_meta,
          })
          .eq("id", insertedTemplateId);

        if (updateError) {
          console.error("Erro ao salvar dados do Meta:", updateError);
        } else {
          console.log("Dados do Meta salvos com sucesso:", webhookResponse);
        }
      }

      toast.success(editingTemplateId ? "Template atualizado com sucesso!" : "Template criado com sucesso!");
      refetchTemplates();
      handleCloseModal();
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Função para atualizar status dos templates via webhook
  const handleUpdateStatusMeta = async () => {
    if (!activeCompany?.id || isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    try {
      // Buscar dados da Pri (agente de IA)
      const { data: priAgent } = await supabase
        .from("agentes_ia")
        .select("telefone, dealer_id, ativo")
        .eq("empresa_id", activeCompany.id)
        .eq("nome", "Pri")
        .single();

      if (!priAgent?.dealer_id) {
        toast.error("Agente Pri não encontrado ou sem dealer_id configurado");
        return;
      }

      // Buscar gatilhos ativos do tipo atualiza_status_meta
      const { data: gatilhos, error } = await supabase
        .from("gatilhos")
        .select("*")
        .eq("empresa_id", activeCompany.id)
        .eq("status", "Ativo");

      if (error) {
        console.error("Erro ao buscar gatilhos:", error);
        toast.error("Erro ao buscar gatilhos");
        return;
      }

      const gatilhosFiltrados = (gatilhos || []).filter((g) => {
        const acoes = g.acoes as { tipo_evento?: string } | null;
        return acoes?.tipo_evento === "atualiza_status_meta";
      });

      if (gatilhosFiltrados.length === 0) {
        toast.error("Nenhum gatilho 'Atualiza Status Meta' ativo encontrado");
        return;
      }

      const payload = {
        pri_telefone: priAgent.telefone || null,
        pri_dealer_id: priAgent.dealer_id,
        pri_status: priAgent.ativo ? "Ativo" : "Inativo",
        data: new Date().toISOString(),
      };

      for (const gatilho of gatilhosFiltrados) {
        const acoes = gatilho.acoes as { webhook_url?: string } | null;
        const webhookUrl = acoes?.webhook_url;

        if (!webhookUrl) continue;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const responseData = await response.json();
            console.log("Resposta do webhook de status:", responseData);

            // responseData deve ser um array de templates com id_meta e status_meta
            if (Array.isArray(responseData)) {
              for (const item of responseData) {
                if (item.id_meta && item.status_meta) {
                  await supabase
                    .from("whatsapp_templates")
                    .update({ status_meta: item.status_meta })
                    .eq("id_meta", item.id_meta)
                    .eq("empresa_id", activeCompany.id);
                }
              }
              toast.success(`Status atualizado para ${responseData.length} templates`);
            } else if (responseData.id_meta && responseData.status_meta) {
              await supabase
                .from("whatsapp_templates")
                .update({ status_meta: responseData.status_meta })
                .eq("id_meta", responseData.id_meta)
                .eq("empresa_id", activeCompany.id);
              toast.success("Status atualizado com sucesso");
            }

            await supabase
              .from("gatilhos")
              .update({ ultima_execucao: new Date().toISOString() })
              .eq("id", gatilho.id);

            refetchTemplates();
          } else {
            const errorBody = await response.text();
            console.error("Erro no webhook:", response.status, errorBody);
            toast.error(`Erro ao atualizar status: ${response.status}`);
          }
        } catch (err: any) {
          console.error("Erro ao chamar webhook:", err);
          toast.error("Erro ao conectar com o webhook");
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      toast.error("Erro ao atualizar status dos templates");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Chamar atualização de status ao entrar no módulo
  useEffect(() => {
    if (activeCompany?.id && templates.length > 0) {
      // Delay pequeno para garantir que os dados estejam carregados
      const timer = setTimeout(() => {
        handleUpdateStatusMeta();
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

  const renderVariableDropdown = (onInsert: (variable: string) => void) => (
    <div className="flex items-center gap-2">
      <Label className="shrink-0">Inserir variável:</Label>
      <Select
        value=""
        onValueChange={(value) => onInsert(value)}
      >
        <SelectTrigger className="w-48 h-8 bg-white text-sm">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {systemVariables.map((variable) => (
            <SelectItem key={variable.value} value={variable.value}>
              {variable.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

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
      <div className="flex items-start gap-4">
        <Label htmlFor="nome" className="w-40 shrink-0 text-right pt-2">Nome do Template *</Label>
        <div className="flex-1 space-y-1">
          <Input
            id="nome"
            value={formData.nome}
            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            placeholder="Ex: Convite Evento VIP"
            className={`bg-white ${nomeDuplicado ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          {nomeDuplicado && (
            <p className="text-xs text-destructive">Já existe um template com este nome</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Label htmlFor="categoria" className="w-40 shrink-0 text-right">Categoria *</Label>
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
            <SelectItem value="transacional">Transacional</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-4">
        <Label htmlFor="departamento" className="w-40 shrink-0 text-right">Departamento *</Label>
        <Select
          value={formData.departamento_id}
          onValueChange={(value) => setFormData(prev => ({ ...prev, departamento_id: value }))}
        >
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue placeholder="Selecione o departamento" />
          </SelectTrigger>
          <SelectContent>
            {departamentos.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>{dept.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
          onClick={() => setFormData(prev => ({ ...prev, formato: format.value }))}
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
    if (formData.formato === "texto") {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="conteudo">Conteúdo do Template</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Máximo de 1024 caracteres
            </p>
            <Textarea
              id="conteudo"
              value={formData.conteudo}
              onChange={(e) => {
                if (e.target.value.length <= 1024) {
                  setFormData(prev => ({ ...prev, conteudo: e.target.value }));
                }
              }}
              placeholder="Digite o conteúdo do template..."
              className="min-h-[150px] bg-white"
            />
            <p className="text-sm text-muted-foreground mt-1 text-right">
              {formData.conteudo.length}/1024
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="shrink-0">Inserir variável:</Label>
            <Select
              value=""
              onValueChange={(value) => insertVariable(value)}
            >
              <SelectTrigger className="w-48 h-8 bg-white text-sm">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {systemVariables.map((variable) => (
                  <SelectItem key={variable.value} value={variable.value}>
                    {variable.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (formData.formato === "card") {
      const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
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
          {/* Imagem da Campanha */}
          <div>
            <Label>Imagem da Campanha</Label>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              A URL da mídia é pública e permanente
            </p>
            <div className="mt-2">
              {isUploading ? (
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

          {/* Texto do Cabeçalho */}
          <div>
            <Label htmlFor="textoCabecalho">Texto do Cabeçalho</Label>
            <Input
              id="textoCabecalho"
              value={formData.cardData.textoCabecalho}
              onChange={(e) => {
                if (e.target.value.length <= 40) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, textoCabecalho: e.target.value }
                  }));
                }
              }}
              placeholder="Título do card"
              className="bg-white"
              maxLength={40}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {formData.cardData.textoCabecalho.length}/40
            </p>
          </div>

          {/* Corpo do Texto */}
          <div>
            <Label htmlFor="corpoTexto">Corpo do Texto</Label>
            <Textarea
              id="corpoTexto"
              value={formData.cardData.corpoTexto}
              onChange={(e) => {
                if (e.target.value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: e.target.value }
                  }));
                }
              }}
              placeholder="Conteúdo principal do card..."
              className="min-h-[80px] bg-white"
              maxLength={1024}
            />
            <div className="flex items-center justify-between mt-1">
              {renderVariableDropdown(insertVariableToCorpoTexto)}
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>
          </div>

          {/* Rodapé */}
          <div>
            <Label htmlFor="rodape">Rodapé</Label>
            <Input
              id="rodape"
              value={formData.cardData.rodape}
              onChange={(e) => {
                if (e.target.value.length <= 60) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, rodape: e.target.value }
                  }));
                }
              }}
              placeholder="Texto do rodapé"
              className="bg-white"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {formData.cardData.rodape.length}/60
            </p>
          </div>

          {/* Botões */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Botões</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddButton}
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
                    <Input
                      value={btn.nome}
                      onChange={(e) => handleUpdateButton(btn.id, "nome", e.target.value)}
                      placeholder="Nome do botão"
                      className="flex-1 h-8 text-sm bg-white"
                    />
                    <Input
                      value={btn.buttonId}
                      onChange={(e) => handleUpdateButton(btn.id, "buttonId", e.target.value)}
                      placeholder="ID do botão"
                      className="flex-1 h-8 text-sm bg-white"
                    />
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
          {/* Corpo do Texto */}
          <div>
            <Label htmlFor="corpoTextoBotao">Corpo do Texto</Label>
            <Textarea
              id="corpoTextoBotao"
              value={formData.cardData.corpoTexto}
              onChange={(e) => {
                if (e.target.value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: e.target.value }
                  }));
                }
              }}
              placeholder="Digite o conteúdo da mensagem..."
              className="min-h-[120px] bg-white"
              maxLength={1024}
            />
            <div className="flex items-center justify-between mt-1">
              {renderVariableDropdown(insertVariableToCorpoTexto)}
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>
          </div>

          {/* Botões */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Botões</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddButton}
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
                    <Input
                      value={btn.nome}
                      onChange={(e) => handleUpdateButton(btn.id, "nome", e.target.value)}
                      placeholder="Nome do botão"
                      className="flex-1 h-8 text-sm bg-white"
                    />
                    <Input
                      value={btn.buttonId}
                      onChange={(e) => handleUpdateButton(btn.id, "buttonId", e.target.value)}
                      placeholder="ID do botão"
                      className="flex-1 h-8 text-sm bg-white"
                    />
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
            <Textarea
              id="corpoTextoImagem"
              value={formData.cardData.corpoTexto}
              onChange={(e) => {
                if (e.target.value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: e.target.value }
                  }));
                }
              }}
              placeholder="Digite o conteúdo da mensagem..."
              className="min-h-[120px] bg-white"
              maxLength={1024}
            />
            <div className="flex items-center justify-between mt-1">
              {renderVariableDropdown(insertVariableToCorpoTexto)}
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (formData.formato === "audio") {
      const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const publicUrl = await uploadMediaToStorage(file, 'audio');
          if (publicUrl) {
            setFormData(prev => ({
              ...prev,
              cardData: {
                ...prev.cardData,
                audioCampanha: file,
                audioPreviewUrl: publicUrl,
              }
            }));
          }
        }
      };

      const handleRemoveAudio = () => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            audioCampanha: null,
            audioPreviewUrl: "",
          }
        }));
      };

      return (
        <div className="space-y-4">
          {/* Áudio da Campanha */}
          <div>
            <Label>Áudio da Campanha</Label>
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
              ) : formData.cardData.audioPreviewUrl ? (
                <div className="relative w-full bg-muted rounded-lg overflow-hidden p-4">
                  <audio 
                    src={formData.cardData.audioPreviewUrl} 
                    controls
                    className="w-full"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={handleRemoveAudio}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Music className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clique para enviar áudio</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleAudioUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Corpo do Texto */}
          <div>
            <Label htmlFor="corpoTextoAudio">Corpo do Texto</Label>
            <Textarea
              id="corpoTextoAudio"
              value={formData.cardData.corpoTexto}
              onChange={(e) => {
                if (e.target.value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: e.target.value }
                  }));
                }
              }}
              placeholder="Digite o conteúdo da mensagem..."
              className="min-h-[120px] bg-white"
              maxLength={1024}
            />
            <div className="flex items-center justify-between mt-1">
              {renderVariableDropdown(insertVariableToCorpoTexto)}
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (formData.formato === "video") {
      const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const publicUrl = await uploadMediaToStorage(file, 'video');
          if (publicUrl) {
            setFormData(prev => ({
              ...prev,
              cardData: {
                ...prev.cardData,
                videoCampanha: file,
                videoPreviewUrl: publicUrl,
              }
            }));
          }
        }
      };

      const handleRemoveVideo = () => {
        setFormData(prev => ({
          ...prev,
          cardData: {
            ...prev.cardData,
            videoCampanha: null,
            videoPreviewUrl: "",
          }
        }));
      };

      return (
        <div className="space-y-4">
          {/* Vídeo da Campanha */}
          <div>
            <Label>Vídeo da Campanha</Label>
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
            <Textarea
              id="corpoTextoVideo"
              value={formData.cardData.corpoTexto}
              onChange={(e) => {
                if (e.target.value.length <= 1024) {
                  setFormData(prev => ({
                    ...prev,
                    cardData: { ...prev.cardData, corpoTexto: e.target.value }
                  }));
                }
              }}
              placeholder="Digite o conteúdo da mensagem..."
              className="min-h-[120px] bg-white"
              maxLength={1024}
            />
            <div className="flex items-center justify-between mt-1">
              {renderVariableDropdown(insertVariableToCorpoTexto)}
              <p className="text-xs text-muted-foreground">
                {formData.cardData.corpoTexto.length}/1024
              </p>
            </div>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Templates WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os templates de mensagens para integração com a Meta
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleUpdateStatusMeta} disabled={isUpdatingStatus}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
              {isUpdatingStatus ? "Atualizando..." : "Atualizar Status"}
            </Button>
            <Button onClick={handleOpenModal}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-[calc(100vh-200px)] overflow-auto">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Type className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum template cadastrado
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie seu primeiro template de mensagem para WhatsApp
                </p>
                <Button onClick={handleOpenModal}>
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
                    <TableHead>Departamento</TableHead>
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
                      <TableCell>{template.departamentos?.nome || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{template.id_meta || "-"}</TableCell>
                      <TableCell>
                        {template.status_meta ? (
                          <Badge variant={template.status_meta === "APPROVED" ? "default" : template.status_meta === "PENDING" ? "secondary" : "destructive"}>
                            {template.status_meta}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
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
            <DialogTitle>{editingTemplateId ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-shrink-0">
            {renderStepIndicator()}
          </div>
          
          <ScrollIndicator className="flex-1 min-h-0">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </ScrollIndicator>

          <div className="flex-shrink-0 flex justify-end gap-2 pt-2 border-t mt-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
            )}
            {currentStep < 3 ? (
              <Button onClick={handleNext}>
                Avançar
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar Template"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
