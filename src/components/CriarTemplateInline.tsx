import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { 
  X, 
  Type, 
  MousePointer2, 
  Image, 
  Video, 
  CreditCard, 
  Music,
  Upload,
  Plus,
  Trash2,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useVideoCompression, MAX_VIDEO_SIZE_BYTES } from "@/hooks/useVideoCompression";

type TemplateFormat = "texto" | "botao" | "imagem" | "audio" | "video" | "card";
type TemplateCategory = "marketing" | "utilidade" | "autenticacao";

interface CardButton {
  id: string;
  nome: string;
  buttonId: string;
}

interface CriarTemplateInlineProps {
  empresaId: string;
  onClose: () => void;
  onTemplateCreated: (templateName: string) => void;
}

const formatOptions = [
  { value: "texto" as TemplateFormat, label: "Texto", description: "Template de texto simples.", icon: Type },
  { value: "botao" as TemplateFormat, label: "Botões", description: "Texto e botões de resposta.", icon: MousePointer2 },
  { value: "imagem" as TemplateFormat, label: "Imagem", description: "Imagem com legenda.", icon: Image },
  { value: "audio" as TemplateFormat, label: "Áudio", description: "Áudio com legenda.", icon: Music },
  { value: "video" as TemplateFormat, label: "Vídeo", description: "Vídeo com legenda.", icon: Video },
  { value: "card" as TemplateFormat, label: "Card", description: "Card completo.", icon: CreditCard },
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

export const CriarTemplateInline = ({ empresaId, onClose, onTemplateCreated }: CriarTemplateInlineProps) => {
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<TemplateCategory | "">("");
  const [formato, setFormato] = useState<TemplateFormat | "">("");
  const [conteudo, setConteudo] = useState("");
  
  // Card data
  const [corpoTexto, setCorpoTexto] = useState("");
  const [textoCabecalho, setTextoCabecalho] = useState("");
  const [rodape, setRodape] = useState("");
  const [botoes, setBotoes] = useState<CardButton[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cardMediaType, setCardMediaType] = useState<'image' | 'video'>('image');
  const [nomeDuplicado, setNomeDuplicado] = useState(false);
  const [verificandoNome, setVerificandoNome] = useState(false);
  const [priTelefone, setPriTelefone] = useState<string | null>(null);
  const [agentesIAWhatsapp, setAgentesIAWhatsapp] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [selectedAgenteId, setSelectedAgenteId] = useState<string | null>(null);
  
  // Video compression hook
  const { compressVideo, isCompressing, compressionProgress, cancelCompression } = useVideoCompression();

  // Buscar todos os agentes ativos vinculados à empresa (via agente_empresas)
  useEffect(() => {
    const fetchAgentesIA = async () => {
      if (!empresaId) return;

      // Buscar agentes vinculados à empresa via tabela de relacionamento
      const { data, error } = await supabase
        .from("agente_empresas")
        .select(`
          agente_id,
          agentes_ia (
            id,
            nome,
            telefone,
            ativo
          )
        `)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Erro ao buscar agentes IA:", error);
        setAgentesIAWhatsapp([]);
        return;
      }

      // Extrair agentes únicos e ativos
      const agentes = (data || [])
        .map((ae: any) => ae.agentes_ia)
        .filter((a: any) => a && a.ativo)
        .filter((a: any, index: number, self: any[]) => 
          index === self.findIndex((t) => t.id === a.id)
        );

      setAgentesIAWhatsapp(agentes);
      
      // Selecionar primeiro agente por padrão
      if (agentes.length > 0 && !selectedAgenteId) {
        setSelectedAgenteId(agentes[0].id);
        const telefone = agentes[0].telefone?.replace(/\D/g, "") || null;
        setPriTelefone(telefone);
      }
    };

    fetchAgentesIA();
  }, [empresaId]);

  // Atualizar priTelefone quando agente selecionado mudar
  useEffect(() => {
    if (selectedAgenteId && agentesIAWhatsapp.length > 0) {
      const agenteSelecionado = agentesIAWhatsapp.find(a => a.id === selectedAgenteId);
      if (agenteSelecionado?.telefone) {
        setPriTelefone(agenteSelecionado.telefone.replace(/\D/g, ""));
      }
    }
  }, [selectedAgenteId, agentesIAWhatsapp]);

  // Verificar nome duplicado (usando pri_telefone)
  useEffect(() => {
    const verificarNomeDuplicado = async () => {
      if (!nome.trim() || nome.trim().length < 2 || !priTelefone) {
        setNomeDuplicado(false);
        return;
      }

      setVerificandoNome(true);
      try {
        const { data: existingTemplate } = await supabase
          .from("whatsapp_templates")
          .select("id")
          .eq("pri_telefone", priTelefone)
          .ilike("nome", nome.trim())
          .maybeSingle();

        setNomeDuplicado(!!existingTemplate);
      } catch (error) {
        console.error("Erro ao verificar nome duplicado:", error);
      } finally {
        setVerificandoNome(false);
      }
    };

    const debounceTimer = setTimeout(verificarNomeDuplicado, 300);
    return () => clearTimeout(debounceTimer);
  }, [nome, priTelefone]);

  const uploadMediaToStorage = async (file: File, mediaType: 'image' | 'audio' | 'video'): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${empresaId}/${mediaType}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('whatsapp-templates')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      
      if (error) {
        console.error('Upload error:', error);
        toast.error('Erro ao fazer upload do arquivo');
        return null;
      }
      
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

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'audio' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validação de 5MB para imagens
    if (mediaType === 'image' && file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      e.target.value = "";
      return;
    }
    
    let fileToUpload = file;
    
    // Compressão automática para vídeos maiores que 12MB
    if (mediaType === 'video' && file.size > MAX_VIDEO_SIZE_BYTES) {
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
    
    setMediaFile(fileToUpload);
    const url = await uploadMediaToStorage(fileToUpload, mediaType);
    if (url) {
      setMediaUrl(url);
    }
  };

  const addButton = () => {
    if (botoes.length >= 3) return;
    setBotoes([...botoes, { id: crypto.randomUUID(), nome: "", buttonId: `btn_${botoes.length + 1}` }]);
  };

  const removeButton = (id: string) => {
    setBotoes(botoes.filter(b => b.id !== id));
  };

  const updateButton = (id: string, nome: string) => {
    setBotoes(botoes.map(b => b.id === id ? { ...b, nome } : b));
  };

  const insertVariable = (variable: string, target: 'conteudo' | 'corpo') => {
    if (target === 'conteudo') {
      setConteudo(prev => prev + variable);
    } else {
      setCorpoTexto(prev => prev + variable);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Preencha o nome do template");
      return;
    }
    if (!categoria) {
      toast.error("Selecione a categoria");
      return;
    }
    if (!formato) {
      toast.error("Selecione o formato");
      return;
    }
    if (!selectedAgenteId) {
      toast.error("Selecione um agente IA WhatsApp");
      return;
    }

    // Verificar se já existe template com o mesmo nome (usando pri_telefone)
    if (priTelefone) {
      const { data: existingTemplate } = await supabase
        .from("whatsapp_templates")
        .select("id")
        .eq("pri_telefone", priTelefone)
        .ilike("nome", nome.trim())
        .maybeSingle();

      if (existingTemplate) {
        toast.error("Já existe um template com este nome");
        return;
      }
    }

    // Validações por formato
    if (formato === "texto" && !conteudo.trim()) {
      toast.error("Preencha o conteúdo do template");
      return;
    }
    if (formato === "botao") {
      if (!corpoTexto.trim()) {
        toast.error("Preencha o corpo do texto");
        return;
      }
      if (botoes.length === 0 || !botoes.some(b => b.nome.trim())) {
        toast.error("Adicione pelo menos um botão com texto");
        return;
      }
    }
    if (formato === "imagem" || formato === "audio" || formato === "video") {
      if (!corpoTexto.trim()) {
        toast.error("Preencha o corpo do texto");
        return;
      }
      if (!mediaUrl) {
        toast.error(`Faça upload de ${formato === "imagem" ? "uma imagem" : formato === "audio" ? "um áudio" : "um vídeo"}`);
        return;
      }
    }
    if (formato === "card") {
      if (!corpoTexto.trim()) {
        toast.error("Preencha o corpo do texto");
        return;
      }
    }

    setLoading(true);

    try {
      let cardData: Record<string, any> = {};
      let conteudoFinal = "";

      switch (formato) {
        case "texto":
          conteudoFinal = conteudo;
          break;
        case "botao":
          conteudoFinal = corpoTexto;
          cardData = { botoes: botoes.map(b => ({ id: b.id, nome: b.nome, buttonId: b.buttonId })) };
          break;
        case "imagem":
          conteudoFinal = corpoTexto;
          cardData = { imagemUrl: mediaUrl };
          break;
        case "audio":
          conteudoFinal = corpoTexto;
          cardData = { audioUrl: mediaUrl };
          break;
        case "video":
          conteudoFinal = corpoTexto;
          cardData = { videoUrl: mediaUrl };
          break;
        case "card":
          conteudoFinal = corpoTexto;
          cardData = {
            ...(cardMediaType === 'video' ? { videoUrl: mediaUrl } : { imagemUrl: mediaUrl }),
            textoCabecalho,
            rodape,
            botoes: botoes.map(b => ({ id: b.id, nome: b.nome, buttonId: b.buttonId })),
          };
          break;
      }

      const { error } = await supabase
        .from("whatsapp_templates")
        .insert([{
          empresa_id: empresaId,
          nome: nome.trim(),
          categoria,
          formato,
          conteudo: conteudoFinal,
          card_data: cardData,
          agente_id: selectedAgenteId, // Vincula ao agente selecionado
          pri_telefone: priTelefone, // Chave principal de compartilhamento (telefone do agente)
        }]);

      if (error) throw error;

      // Disparar webhooks para gatilhos de novo template
      await triggerWebhooks({
        nome: nome.trim(),
        categoria,
        formato,
        conteudo: conteudoFinal,
        cardData,
        agenteId: selectedAgenteId,
        agenteTelefone: priTelefone,
      });

      toast.success("Template criado com sucesso!");
      onTemplateCreated(nome.trim());
    } catch (error: any) {
      console.error("Erro ao criar template:", error);
      toast.error("Erro ao criar template: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para disparar webhooks dos gatilhos
  const triggerWebhooks = async (templateData: {
    nome: string;
    categoria: string;
    formato: string;
    conteudo: string;
    cardData: Record<string, any>;
    agenteId: string;
    agenteTelefone: string | null;
  }) => {
    if (!empresaId || !templateData.agenteId) {
      console.warn("⚠️ Dados insuficientes para disparar webhooks:", { empresaId, agenteId: templateData.agenteId });
      return;
    }

    try {
      // Buscar dados completos do agente selecionado diretamente do banco
      const { data: agenteData, error: agenteError } = await supabase
        .from("agentes_ia")
        .select("id, nome, telefone, dealer_id, ativo")
        .eq("id", templateData.agenteId)
        .single();

      if (agenteError) {
        console.error("❌ Erro ao buscar dados do agente:", agenteError);
      }

      // Log para debug - dados do agente
      console.log("📱 Dados do agente para webhook:", {
        agenteId: templateData.agenteId,
        agenteNome: agenteData?.nome,
        agenteTelefone: agenteData?.telefone,
        agenteDealerId: agenteData?.dealer_id,
        agenteAtivo: agenteData?.ativo,
        telefoneFromState: templateData.agenteTelefone
      });

      // Buscar gatilhos ativos
      const { data: gatilhos, error } = await supabase
        .from("gatilhos")
        .select("*")
        .eq("empresa_id", empresaId)
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

      // Garantir que o telefone seja formatado corretamente (apenas números)
      const telefoneLimpo = agenteData?.telefone?.replace(/\D/g, "") || templateData.agenteTelefone?.replace(/\D/g, "") || "";

      // Construir payload com dados do agente selecionado
      const payload = {
        template: {
          name: templateData.nome.toLowerCase().replace(/\s+/g, "_"),
          category: templateData.categoria.toUpperCase(),
          language: "pt_BR",
          components: buildTemplateComponents(templateData),
        },
        agente_id: templateData.agenteId,
        agente_nome: agenteData?.nome || "",
        pri_telefone: telefoneLimpo,
        pri_dealer_id: agenteData?.dealer_id || "",
        pri_status: agenteData?.ativo ? "Ativo" : "Inativo",
      };

      console.log("📤 Payload do webhook:", payload);

      // Disparar webhooks para cada gatilho
      for (const gatilho of gatilhosFiltrados) {
        const acoes = gatilho.acoes as { webhook_url?: string } | null;
        const webhookUrl = acoes?.webhook_url;

        if (!webhookUrl) {
          console.log(`Gatilho ${gatilho.nome} sem webhook_url configurado`);
          continue;
        }

        try {
          console.log(`📤 Disparando webhook para gatilho: ${gatilho.nome}`);

          const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('external-webhook-proxy', {
            body: {
              webhook_url: webhookUrl,
              ...payload
            }
          });

          if (proxyError) {
            console.error(`❌ Erro ao disparar gatilho "${gatilho.nome}": ${proxyError.message}`);
          } else {
            console.log(`✅ Gatilho "${gatilho.nome}" disparado com sucesso:`, proxyResponse);
            await supabase
              .from("gatilhos")
              .update({ ultima_execucao: new Date().toISOString() })
              .eq("id", gatilho.id);
          }
        } catch (webhookError) {
          console.error(`❌ Erro ao disparar gatilho "${gatilho.nome}": ${webhookError instanceof Error ? webhookError.message : 'Erro desconhecido'}`);
        }
      }
    } catch (err) {
      console.error(`❌ Erro ao processar gatilhos de "novo_template_whatsapp": ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  // Construir componentes do template para o payload
  const buildTemplateComponents = (templateData: {
    formato: string;
    conteudo: string;
    cardData: Record<string, any>;
  }) => {
    const components: any[] = [];

    // Adicionar BODY
    if (templateData.conteudo) {
      components.push({
        type: "BODY",
        text: templateData.conteudo,
      });
    }

    // Adicionar HEADER se houver mídia
    if (templateData.cardData.imagemUrl) {
      components.push({
        type: "HEADER",
        format: "IMAGE",
        example: { header_handle: [templateData.cardData.imagemUrl] },
      });
    } else if (templateData.cardData.videoUrl) {
      components.push({
        type: "HEADER",
        format: "VIDEO",
        example: { header_handle: [templateData.cardData.videoUrl] },
      });
    } else if (templateData.cardData.audioUrl) {
      components.push({
        type: "HEADER",
        format: "AUDIO",
        example: { header_handle: [templateData.cardData.audioUrl] },
      });
    } else if (templateData.cardData.textoCabecalho) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: templateData.cardData.textoCabecalho,
      });
    }

    // Adicionar FOOTER se houver rodapé
    if (templateData.cardData.rodape) {
      components.push({
        type: "FOOTER",
        text: templateData.cardData.rodape,
      });
    }

    // Adicionar BUTTONS se houver botões
    if (templateData.cardData.botoes && templateData.cardData.botoes.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: templateData.cardData.botoes.map((btn: any) => ({
          type: "QUICK_REPLY",
          text: btn.nome,
        })),
      });
    }

    return components;
  };

  const renderFormatFields = () => {
    switch (formato) {
      case "texto":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conteúdo</Label>
              <Select value="" onValueChange={(v) => insertVariable(v, 'conteudo')}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="Variável..." />
                </SelectTrigger>
                <SelectContent>
                  {systemVariables.map(v => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Digite o conteúdo do template..."
              rows={4}
            />
          </div>
        );

      case "botao":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Corpo do Texto</Label>
                <Select value="" onValueChange={(v) => insertVariable(v, 'corpo')}>
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue placeholder="Variável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {systemVariables.map(v => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={corpoTexto}
                onChange={(e) => setCorpoTexto(e.target.value)}
                placeholder="Digite o texto..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Botões ({botoes.length}/3)</Label>
                {botoes.length < 3 && (
                  <Button type="button" variant="outline" size="sm" onClick={addButton}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
              {botoes.map((btn) => (
                <div key={btn.id} className="flex items-center gap-2">
                  <Input
                    value={btn.nome}
                    onChange={(e) => updateButton(btn.id, e.target.value)}
                    placeholder="Nome do botão"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeButton(btn.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );

      case "imagem":
      case "audio":
      case "video":
        const mediaType = formato === "imagem" ? "image" : formato as "audio" | "video";
        const accept = formato === "imagem" ? "image/*" : formato === "audio" ? "audio/*" : "video/*";
        const isVideoFormat = formato === "video";
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{formato === "imagem" ? "Imagem" : formato === "audio" ? "Áudio" : "Vídeo"}</Label>
              {isVideoFormat && (
                <p className="text-xs text-muted-foreground">
                  Vídeos maiores que 12MB serão comprimidos automaticamente
                </p>
              )}
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {isCompressing && isVideoFormat ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      {compressionProgress?.message || 'Comprimindo vídeo...'}
                    </p>
                    {compressionProgress && compressionProgress.stage === 'compressing' && (
                      <div className="w-full max-w-xs mx-auto">
                        <Progress value={compressionProgress.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground">{compressionProgress.progress}%</span>
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={cancelCompression}>
                      Cancelar
                    </Button>
                  </div>
                ) : mediaUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Arquivo carregado</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setMediaUrl("")}>
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {isUploading ? "Enviando..." : "Clique para fazer upload"}
                    </span>
                    <input
                      type="file"
                      accept={accept}
                      className="hidden"
                      onChange={(e) => handleMediaUpload(e, mediaType)}
                      disabled={isUploading || isCompressing}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Legenda (opcional)</Label>
              <Textarea
                value={corpoTexto}
                onChange={(e) => setCorpoTexto(e.target.value)}
                placeholder="Digite a legenda..."
                rows={2}
              />
            </div>
          </div>
        );

      case "card":
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Mídia do Card (opcional)</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={cardMediaType === 'image' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setCardMediaType('image'); setMediaUrl(''); setMediaFile(null); }}
                >
                  <Image className="w-4 h-4 mr-1" /> Imagem
                </Button>
                <Button
                  type="button"
                  variant={cardMediaType === 'video' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setCardMediaType('video'); setMediaUrl(''); setMediaFile(null); }}
                >
                  <Video className="w-4 h-4 mr-1" /> Vídeo
                </Button>
              </div>
              {cardMediaType === 'video' && (
                <p className="text-xs text-muted-foreground">
                  Vídeos maiores que 12MB serão comprimidos automaticamente
                </p>
              )}
              <div className="border-2 border-dashed rounded-lg p-3 text-center">
                {isCompressing && cardMediaType === 'video' ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      {compressionProgress?.message || 'Comprimindo vídeo...'}
                    </p>
                    {compressionProgress && compressionProgress.stage === 'compressing' && (
                      <div className="w-full max-w-xs mx-auto">
                        <Progress value={compressionProgress.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground">{compressionProgress.progress}%</span>
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={cancelCompression}>
                      Cancelar
                    </Button>
                  </div>
                ) : mediaUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {cardMediaType === 'image' ? 'Imagem' : 'Vídeo'} carregado
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setMediaUrl("")}>
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {isUploading ? "Enviando..." : `Upload ${cardMediaType === 'image' ? 'imagem' : 'vídeo'}`}
                    </span>
                    <input
                      type="file"
                      accept={cardMediaType === 'image' ? 'image/*' : 'video/*'}
                      className="hidden"
                      onChange={(e) => handleMediaUpload(e, cardMediaType)}
                      disabled={isUploading || isCompressing}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cabeçalho</Label>
              <Input
                value={textoCabecalho}
                onChange={(e) => setTextoCabecalho(e.target.value)}
                placeholder="Título do card"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Corpo do Texto</Label>
                <Select value="" onValueChange={(v) => insertVariable(v, 'corpo')}>
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue placeholder="Variável..." />
                  </SelectTrigger>
                  <SelectContent>
                    {systemVariables.map(v => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={corpoTexto}
                onChange={(e) => setCorpoTexto(e.target.value)}
                placeholder="Digite o texto..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Rodapé (opcional)</Label>
              <Input
                value={rodape}
                onChange={(e) => setRodape(e.target.value)}
                placeholder="Texto do rodapé"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Botões ({botoes.length}/3)</Label>
                {botoes.length < 3 && (
                  <Button type="button" variant="outline" size="sm" onClick={addButton}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
              {botoes.map((btn) => (
                <div key={btn.id} className="flex items-center gap-2">
                  <Input
                    value={btn.nome}
                    onChange={(e) => updateButton(btn.id, e.target.value)}
                    placeholder="Nome do botão"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeButton(btn.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-sm">Criar Novo Template</h4>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do template"
              className={`h-9 ${nomeDuplicado ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {nomeDuplicado && (
              <p className="text-xs text-destructive">Já existe um template com este nome</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as TemplateCategory)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="utilidade">Utilidade</SelectItem>
                <SelectItem value="autenticacao">Autenticação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Agente IA WhatsApp *</Label>
          <Select value={selectedAgenteId || ""} onValueChange={(v) => setSelectedAgenteId(v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione o agente..." />
            </SelectTrigger>
            <SelectContent>
              {agentesIAWhatsapp.map((agente) => (
                <SelectItem key={agente.id} value={agente.id}>
                  {agente.nome} {agente.telefone ? `(${agente.telefone})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agentesIAWhatsapp.length === 0 && (
            <p className="text-xs text-amber-600">
              Nenhum agente encontrado. Vincule um agente à empresa primeiro.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Formato</Label>
          <div className="grid grid-cols-3 gap-2">
            {formatOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormato(opt.value)}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    formato === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-xs">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {formato && renderFormatFields()}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={loading || isUploading || nomeDuplicado || verificandoNome || !selectedAgenteId}>
            {loading ? "Salvando..." : "Criar Template"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
