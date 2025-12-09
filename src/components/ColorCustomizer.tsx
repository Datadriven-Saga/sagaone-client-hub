import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, RotateCcw, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ColorConfig {
  primary: string;
  button: string;
  background: string;
  card: string;
}

const DEFAULT_COLORS: ColorConfig = {
  primary: "#0f2a45",
  button: "#04bbda",
  background: "#F4F4F4",
  card: "#FFFFFF",
};

const COLOR_INFO = {
  primary: {
    label: "Cor Principal",
    description: "Aplicada em: Menu lateral (sidebar), textos principais, títulos, ícones de navegação e elementos de destaque do sistema."
  },
  button: {
    label: "Cor dos Botões",
    description: "Aplicada em: Todos os botões de ação, fundo dos ícones nos cards da página inicial, links interativos e elementos clicáveis."
  },
  background: {
    label: "Cor de Fundo",
    description: "Aplicada em: Fundo de todas as páginas do sistema, áreas de conteúdo e espaços entre os cards."
  },
  card: {
    label: "Cor dos Cards",
    description: "Aplicada em: Fundo dos cards, modais, popovers, menus dropdown e áreas de formulário."
  },
};

// Convert HEX to HSL
const hexToHsl = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

// Apply colors to CSS variables
const applyColors = (colors: ColorConfig) => {
  const root = document.documentElement;
  
  // Primary color (sidebar, text, etc.)
  const primaryHsl = hexToHsl(colors.primary);
  root.style.setProperty('--foreground', primaryHsl);
  root.style.setProperty('--card-foreground', primaryHsl);
  root.style.setProperty('--popover-foreground', primaryHsl);
  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--secondary-foreground', primaryHsl);
  root.style.setProperty('--accent', primaryHsl);
  root.style.setProperty('--ring', primaryHsl);
  root.style.setProperty('--sidebar-background', primaryHsl);
  root.style.setProperty('--sidebar-primary', primaryHsl);
  root.style.setProperty('--sidebar-ring', primaryHsl);
  root.style.setProperty('--sagaone-primary', primaryHsl);
  root.style.setProperty('--sagaone-dark', primaryHsl);
  root.style.setProperty('--sagaone-login-button', primaryHsl);
  
  // Button color
  const buttonHsl = hexToHsl(colors.button);
  root.style.setProperty('--sagaone-login-card', buttonHsl);
  
  // Background color
  const bgHsl = hexToHsl(colors.background);
  root.style.setProperty('--background', bgHsl);
  root.style.setProperty('--secondary', bgHsl);
  root.style.setProperty('--muted', bgHsl);
  root.style.setProperty('--sagaone-bg', bgHsl);
  root.style.setProperty('--sagaone-login-bg', bgHsl);
  
  // Card color
  const cardHsl = hexToHsl(colors.card);
  root.style.setProperty('--card', cardHsl);
  root.style.setProperty('--popover', cardHsl);
  root.style.setProperty('--sagaone-light', cardHsl);
};

export function ColorCustomizer() {
  const { toast } = useToast();
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load saved colors from localStorage
    const savedColors = localStorage.getItem('userColorConfig');
    if (savedColors) {
      const parsed = JSON.parse(savedColors);
      setColors(parsed);
      applyColors(parsed);
    }
  }, []);

  const handleColorChange = (key: keyof ColorConfig, value: string) => {
    const newColors = { ...colors, [key]: value };
    setColors(newColors);
    setHasChanges(true);
    // Apply in real-time for preview
    applyColors(newColors);
  };

  const handleSave = () => {
    localStorage.setItem('userColorConfig', JSON.stringify(colors));
    setHasChanges(false);
    toast({
      title: "Cores salvas",
      description: "Suas preferências de cores foram salvas com sucesso!",
    });
  };

  const handleReset = () => {
    setColors(DEFAULT_COLORS);
    applyColors(DEFAULT_COLORS);
    localStorage.removeItem('userColorConfig');
    setHasChanges(false);
    toast({
      title: "Cores restauradas",
      description: "As cores foram restauradas para o padrão do sistema.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Palette className="h-5 w-5 mr-2" />
          Personalização de Cores
        </CardTitle>
        <CardDescription>
          Personalize as cores do sistema de acordo com sua preferência. As alterações são aplicadas em tempo real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(COLOR_INFO) as Array<keyof ColorConfig>).map((key) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={key} className="font-medium">
                  {COLOR_INFO[key].label}
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-sm">{COLOR_INFO[key].description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-md border border-border shadow-sm cursor-pointer"
                  style={{ backgroundColor: colors[key] }}
                  onClick={() => document.getElementById(`color-${key}`)?.click()}
                />
                <Input
                  id={`color-${key}`}
                  type="color"
                  value={colors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-20 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors[key].toUpperCase()}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                      handleColorChange(key, value);
                    }
                  }}
                  className="flex-1 font-mono text-sm"
                  placeholder="#000000"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {COLOR_INFO[key].description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={!hasChanges}>
            Salvar Preferências
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}