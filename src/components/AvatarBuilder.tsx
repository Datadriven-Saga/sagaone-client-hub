import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, Sparkles, User, Palette, Scissors, Eye, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AvatarBuilderProps {
  currentAvatar?: string | null;
  userName?: string;
  onAvatarChange: (avatarUrl: string) => void;
  disabled?: boolean;
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
}

const skinTones = [
  { id: "light", color: "#FFDFC4", label: "Clara" },
  { id: "medium-light", color: "#E5B887", label: "Morena Clara" },
  { id: "medium", color: "#C68642", label: "Morena" },
  { id: "medium-dark", color: "#8D5524", label: "Morena Escura" },
  { id: "dark", color: "#5C3317", label: "Negra" },
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

export const AvatarBuilder = ({ currentAvatar, userName, onAvatarChange, disabled }: AvatarBuilderProps) => {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
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
  });

  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

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

  const handleConfirm = () => {
    if (generatedAvatar) {
      onAvatarChange(generatedAvatar);
      setOpen(false);
      setGeneratedAvatar(null);
    }
  };

  const updateOption = <K extends keyof AvatarOptions>(key: K, value: AvatarOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setGeneratedAvatar(null); // Reset generated avatar when options change
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="relative group cursor-pointer" onClick={() => !disabled && setOpen(true)}>
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Avatar Personalizado
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
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
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Barba</Label>
                  <Switch
                    checked={options.hasBeard}
                    onCheckedChange={(v) => updateOption("hasBeard", v)}
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
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Óculos
                </Label>
                <Switch
                  checked={options.hasGlasses}
                  onCheckedChange={(v) => updateOption("hasGlasses", v)}
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

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!generatedAvatar}>
            Usar este Avatar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
