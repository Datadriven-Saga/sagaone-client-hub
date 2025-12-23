import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TemplateFormat = "texto" | "botao" | "imagem" | "audio" | "video" | "card";
type TemplateCategory = "marketing" | "utilidade" | "transacional";

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
    
    setMediaFile(file);
    const url = await uploadMediaToStorage(file, mediaType);
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

    // Validações por formato
    if (formato === "texto" && !conteudo) {
      toast.error("Preencha o conteúdo do template");
      return;
    }
    if (formato === "botao" && (!corpoTexto || botoes.length === 0)) {
      toast.error("Preencha o corpo do texto e adicione pelo menos um botão");
      return;
    }
    if ((formato === "imagem" || formato === "audio" || formato === "video") && !mediaUrl) {
      toast.error(`Faça upload de ${formato === "imagem" ? "uma imagem" : formato === "audio" ? "um áudio" : "um vídeo"}`);
      return;
    }
    if (formato === "card" && (!textoCabecalho || !corpoTexto)) {
      toast.error("Preencha o cabeçalho e o corpo do texto");
      return;
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
            imagemUrl: mediaUrl,
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
        }]);

      if (error) throw error;

      toast.success("Template criado com sucesso!");
      onTemplateCreated(nome.trim());
    } catch (error: any) {
      console.error("Erro ao criar template:", error);
      toast.error("Erro ao criar template: " + error.message);
    } finally {
      setLoading(false);
    }
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
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{formato === "imagem" ? "Imagem" : formato === "audio" ? "Áudio" : "Vídeo"}</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {mediaUrl ? (
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
                      disabled={isUploading}
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
              <Label>Imagem do Card (opcional)</Label>
              <div className="border-2 border-dashed rounded-lg p-3 text-center">
                {mediaUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Imagem carregada</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setMediaUrl("")}>
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {isUploading ? "Enviando..." : "Upload imagem"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleMediaUpload(e, 'image')}
                      disabled={isUploading}
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
              className="h-9"
            />
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
                <SelectItem value="transacional">Transacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <Button type="button" size="sm" onClick={handleSave} disabled={loading || isUploading}>
            {loading ? "Salvando..." : "Criar Template"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
