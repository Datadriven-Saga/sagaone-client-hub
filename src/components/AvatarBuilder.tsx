import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Loader2, Sparkles, User, Palette, Scissors, Eye, CircleUser, Upload, Shirt, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/storageUtils";

interface AvatarBuilderProps {
  currentAvatar?: string | null;
  userName?: string;
  onAvatarChange: (avatarUrl: string) => void;
  disabled?: boolean;
  triggerOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface AvatarOptions {
  gender: "male" | "female";
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  hasBeard: boolean;
  beardStyle: string;
  hasGlasses: boolean;
  glassesStyle: string;
  faceShape: string;
  clothingColor: string;
  backgroundColor: string;
}

const skinTones = [
  { id: "light", color: "#FFDFC4", label: "Clara" },
  { id: "medium-light", color: "#E5B887", label: "Morena Clara" },
  { id: "medium", color: "#C68642", label: "Morena" },
  { id: "medium-dark", color: "#8D5524", label: "Morena Escura" },
  { id: "dark", color: "#5C3317", label: "Negra" },
];

const clothingColors = [
  { id: "navy", color: "#1e3a5f", label: "Azul Marinho" },
  { id: "black", color: "#1a1a1a", label: "Preto" },
  { id: "white", color: "#f5f5f5", label: "Branco" },
  { id: "gray", color: "#6b7280", label: "Cinza" },
  { id: "blue", color: "#3b82f6", label: "Azul" },
  { id: "green", color: "#22c55e", label: "Verde" },
  { id: "red", color: "#ef4444", label: "Vermelho" },
  { id: "purple", color: "#8b5cf6", label: "Roxo" },
];

const backgroundColors = [
  { id: "light-gray", color: "#e5e7eb", label: "Cinza Claro" },
  { id: "light-blue", color: "#dbeafe", label: "Azul Claro" },
  { id: "white", color: "#ffffff", label: "Branco" },
  { id: "light-green", color: "#dcfce7", label: "Verde Claro" },
  { id: "light-yellow", color: "#fef9c3", label: "Amarelo Claro" },
  { id: "light-purple", color: "#f3e8ff", label: "Roxo Claro" },
  { id: "navy", color: "#1e3a5f", label: "Azul Marinho" },
  { id: "dark", color: "#374151", label: "Escuro" },
];

const hairStyles = [
  { id: "short", label: "Curto" },
  { id: "medium", label: "Médio" },
  { id: "long", label: "Longo" },
  { id: "curly", label: "Cacheado" },
  { id: "wavy", label: "Ondulado" },
  { id: "bald", label: "Careca" },
  { id: "buzz", label: "Raspado" },
];

const hairColors = [
  { id: "black", color: "#1a1a1a", label: "Preto" },
  { id: "brown", color: "#4a3728", label: "Castanho" },
  { id: "blonde", color: "#d4a574", label: "Loiro" },
  { id: "red", color: "#8b3a3a", label: "Ruivo" },
  { id: "gray", color: "#808080", label: "Grisalho" },
  { id: "white", color: "#e8e8e8", label: "Branco" },
];

const beardStyles = [
  { id: "stubble", label: "Por Fazer" },
  { id: "short", label: "Curta" },
  { id: "full", label: "Cheia" },
  { id: "goatee", label: "Cavanhaque" },
  { id: "mustache", label: "Bigode" },
];

const glassesStyles = [
  { id: "round", label: "Redondos" },
  { id: "square", label: "Quadrados" },
  { id: "aviator", label: "Aviador" },
  { id: "cat-eye", label: "Gatinho" },
  { id: "rimless", label: "Sem Aro" },
];

const faceShapes = [
  { id: "oval", label: "Oval" },
  { id: "round", label: "Redondo" },
  { id: "square", label: "Quadrado" },
  { id: "heart", label: "Coração" },
  { id: "oblong", label: "Alongado" },
];

export const AvatarBuilder = ({ currentAvatar, userName, onAvatarChange, disabled, triggerOpen, onOpenChange }: AvatarBuilderProps) => {
  const [open, setOpen] = useState(triggerOpen ?? false);
  
  // Sync with external trigger
  useEffect(() => {
    if (triggerOpen !== undefined) {
      setOpen(triggerOpen);
    }
  }, [triggerOpen]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };
  const [activeTab, setActiveTab] = useState<"ai" | "upload">("ai");
  const [generating, setGenerating] = useState(false);
  const [generatingFromPhoto, setGeneratingFromPhoto] = useState(false);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [generatedFromPhotoAvatar, setGeneratedFromPhotoAvatar] = useState<string | null>(null);
  const [uploadPhotoChoice, setUploadPhotoChoice] = useState<"original" | "pixar" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<AvatarOptions>({
    gender: "male",
    skinTone: "medium",
    hairStyle: "short",
    hairColor: "brown",
    hasBeard: false,
    beardStyle: "short",
    hasGlasses: false,
    glassesStyle: "square",
    faceShape: "oval",
    clothingColor: "navy",
    backgroundColor: "light-gray",
  });

  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(validation.error);
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setUploadedAvatar(result);
        setGeneratedFromPhotoAvatar(null);
        setUploadPhotoChoice(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAvatar = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-avatar", {
        body: options,
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        } else if (data.error.includes("Payment")) {
          toast.error("Créditos insuficientes. Adicione créditos ao seu workspace.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data.imageUrl) {
        setGeneratedAvatar(data.imageUrl);
        toast.success("Avatar gerado com sucesso!");
      }
    } catch (error) {
      console.error("Error generating avatar:", error);
      toast.error("Erro ao gerar avatar. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFromPhoto = async () => {
    if (!uploadedAvatar) return;
    
    setGeneratingFromPhoto(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-avatar", {
        body: { 
          sourceImage: uploadedAvatar,
          generateFromPhoto: true 
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        } else if (data.error.includes("Payment")) {
          toast.error("Créditos insuficientes. Adicione créditos ao seu workspace.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data.imageUrl) {
        setGeneratedFromPhotoAvatar(data.imageUrl);
        setUploadPhotoChoice("pixar");
        toast.success("Avatar Pixar gerado com sucesso!");
      }
    } catch (error) {
      console.error("Error generating avatar from photo:", error);
      toast.error("Erro ao gerar avatar. Tente novamente.");
    } finally {
      setGeneratingFromPhoto(false);
    }
  };

  const handleConfirm = () => {
    let avatarToUse: string | null = null;
    
    if (activeTab === "ai") {
      avatarToUse = generatedAvatar;
    } else {
      avatarToUse = uploadPhotoChoice === "pixar" ? generatedFromPhotoAvatar : uploadedAvatar;
    }
    
    if (avatarToUse) {
      onAvatarChange(avatarToUse);
      handleOpenChange(false);
      setGeneratedAvatar(null);
      setUploadedAvatar(null);
      setGeneratedFromPhotoAvatar(null);
      setUploadPhotoChoice(null);
    }
  };

  const updateOption = <K extends keyof AvatarOptions>(key: K, value: AvatarOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setGeneratedAvatar(null);
  };

  const currentSelectedAvatar = activeTab === "ai" 
    ? generatedAvatar 
    : (uploadPhotoChoice === "pixar" ? generatedFromPhotoAvatar : (uploadPhotoChoice === "original" ? uploadedAvatar : null));

  // If triggered externally, render without the visual trigger
  const showTrigger = triggerOpen === undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <div className="relative group cursor-pointer" onClick={() => !disabled && handleOpenChange(true)}>
            <Avatar className="h-20 w-20">
              <AvatarImage src={currentAvatar || undefined} alt={userName} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            {!disabled && (
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Alterar Foto de Perfil
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ai" | "upload")} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar com IA
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Enviar Foto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Options Column */}
              <div className="space-y-5">
                {/* Gender */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4" />
                    Gênero
                  </Label>
                  <RadioGroup
                    value={options.gender}
                    onValueChange={(v) => updateOption("gender", v as "male" | "female")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <Label htmlFor="male" className="cursor-pointer">Masculino</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <Label htmlFor="female" className="cursor-pointer">Feminino</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Skin Tone */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Palette className="h-4 w-4" />
                    Tom de Pele
                  </Label>
                  <div className="flex gap-2">
                    {skinTones.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          options.skinTone === tone.id
                            ? "border-primary ring-2 ring-primary/30 scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: tone.color }}
                        onClick={() => updateOption("skinTone", tone.id)}
                        title={tone.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Face Shape */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <CircleUser className="h-4 w-4" />
                    Formato do Rosto
                  </Label>
                  <Select value={options.faceShape} onValueChange={(v) => updateOption("faceShape", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {faceShapes.map((shape) => (
                        <SelectItem key={shape.id} value={shape.id}>
                          {shape.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hair Style */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Scissors className="h-4 w-4" />
                    Estilo do Cabelo
                  </Label>
                  <Select value={options.hairStyle} onValueChange={(v) => updateOption("hairStyle", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hairStyles.map((style) => (
                        <SelectItem key={style.id} value={style.id}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hair Color */}
                {options.hairStyle !== "bald" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Cor do Cabelo</Label>
                    <div className="flex gap-2">
                      {hairColors.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all",
                            options.hairColor === color.id
                              ? "border-primary ring-2 ring-primary/30 scale-110"
                              : "border-muted-foreground/30 hover:scale-105"
                          )}
                          style={{ backgroundColor: color.color }}
                          onClick={() => updateOption("hairColor", color.id)}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Beard (only for male) */}
                {options.gender === "male" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <Label className="text-sm font-medium">Barba</Label>
                      <Switch
                        checked={options.hasBeard}
                        onCheckedChange={(v) => updateOption("hasBeard", v)}
                        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/40"
                      />
                    </div>
                    {options.hasBeard && (
                      <Select value={options.beardStyle} onValueChange={(v) => updateOption("beardStyle", v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {beardStyles.map((style) => (
                            <SelectItem key={style.id} value={style.id}>
                              {style.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Glasses */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Eye className="h-4 w-4" />
                      Óculos
                    </Label>
                    <Switch
                      checked={options.hasGlasses}
                      onCheckedChange={(v) => updateOption("hasGlasses", v)}
                      className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/40"
                    />
                  </div>
                  {options.hasGlasses && (
                    <Select value={options.glassesStyle} onValueChange={(v) => updateOption("glassesStyle", v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {glassesStyles.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            {style.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Clothing Color */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Shirt className="h-4 w-4" />
                    Cor da Roupa
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {clothingColors.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          options.clothingColor === color.id
                            ? "border-primary ring-2 ring-primary/30 scale-110"
                            : "border-muted-foreground/30 hover:scale-105"
                        )}
                        style={{ backgroundColor: color.color }}
                        onClick={() => updateOption("clothingColor", color.id)}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Background Color */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Palette className="h-4 w-4" />
                    Cor do Fundo
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {backgroundColors.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          options.backgroundColor === color.id
                            ? "border-primary ring-2 ring-primary/30 scale-110"
                            : "border-muted-foreground/30 hover:scale-105"
                        )}
                        style={{ backgroundColor: color.color }}
                        onClick={() => updateOption("backgroundColor", color.id)}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview Column */}
              <div className="flex flex-col items-center justify-center space-y-4 bg-muted/30 rounded-lg p-6">
                <div className="relative">
                  {generatedAvatar ? (
                    <img
                      src={generatedAvatar}
                      alt="Avatar gerado"
                      className="w-48 h-48 rounded-full object-cover border-4 border-primary shadow-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                      <div className="text-center text-muted-foreground">
                        <Sparkles className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">Clique em "Gerar Avatar"</p>
                        <p className="text-xs">para criar seu avatar</p>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleGenerateAvatar}
                  disabled={generating}
                  className="w-full"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando Avatar...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Avatar
                    </>
                  )}
                </Button>

                {generatedAvatar && (
                  <p className="text-xs text-muted-foreground text-center">
                    Não gostou? Ajuste as opções e gere novamente!
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="flex flex-col items-center justify-center gap-6 py-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
              />
              
              {uploadedAvatar ? (
                <div className="w-full space-y-6">
                  {/* Photo preview and action buttons */}
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={uploadedAvatar}
                      alt="Foto enviada"
                      className="w-32 h-32 rounded-full object-cover border-4 border-muted shadow-md"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Trocar foto
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUploadedAvatar(null);
                          setGeneratedFromPhotoAvatar(null);
                          setUploadPhotoChoice(null);
                        }}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    </div>
                  </div>

                  {/* Choice buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1: Use original photo */}
                    <div
                      className={cn(
                        "border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
                        uploadPhotoChoice === "original"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      )}
                      onClick={() => setUploadPhotoChoice("original")}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={uploadedAvatar}
                          alt="Foto original"
                          className={cn(
                            "w-28 h-28 rounded-full object-cover border-4 transition-all",
                            uploadPhotoChoice === "original" ? "border-primary" : "border-muted"
                          )}
                        />
                        <div className="text-center">
                          <p className="font-medium text-sm">Usar Foto Original</p>
                          <p className="text-xs text-muted-foreground">Usar sua foto como está</p>
                        </div>
                      </div>
                    </div>

                    {/* Option 2: Generate Pixar avatar */}
                    <div
                      className={cn(
                        "border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
                        uploadPhotoChoice === "pixar"
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      )}
                      onClick={() => {
                        setUploadPhotoChoice("pixar");
                        if (!generatedFromPhotoAvatar && !generatingFromPhoto) {
                          handleGenerateFromPhoto();
                        }
                      }}
                    >
                      <div className="flex flex-col items-center gap-3">
                        {generatingFromPhoto ? (
                          <div className="w-28 h-28 rounded-full border-4 border-dashed border-primary/50 flex items-center justify-center bg-muted/30">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          </div>
                        ) : generatedFromPhotoAvatar ? (
                          <img
                            src={generatedFromPhotoAvatar}
                            alt="Avatar Pixar"
                            className={cn(
                              "w-28 h-28 rounded-full object-cover border-4 transition-all",
                              uploadPhotoChoice === "pixar" ? "border-primary" : "border-muted"
                            )}
                          />
                        ) : (
                          <div className="w-28 h-28 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                            <Sparkles className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        <div className="text-center">
                          <p className="font-medium text-sm flex items-center gap-1 justify-center">
                            <Sparkles className="h-3.5 w-3.5" />
                            Avatar Estilo Pixar
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {generatingFromPhoto 
                              ? "Gerando avatar..." 
                              : generatedFromPhotoAvatar 
                                ? "Avatar baseado na sua foto" 
                                : "Clique para gerar"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Regenerate button for Pixar option */}
                  {uploadPhotoChoice === "pixar" && generatedFromPhotoAvatar && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateFromPhoto}
                        disabled={generatingFromPhoto}
                      >
                        {generatingFromPhoto ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Gerar novamente
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="w-48 h-48 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/30"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground block">Clique para enviar</span>
                    <span className="text-xs text-muted-foreground block">sua foto</span>
                  </div>
                </div>
              )}
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Formatos suportados: JPG, PNG, GIF
                </p>
                <p className="text-xs text-muted-foreground">
                  Tamanho máximo: 5MB
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!currentSelectedAvatar}>
            Usar este Avatar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};