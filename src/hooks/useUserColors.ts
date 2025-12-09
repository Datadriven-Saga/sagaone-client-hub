import { useEffect } from "react";

interface ColorConfig {
  primary: string;
  button: string;
  background: string;
  card: string;
}

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
  root.style.setProperty('--ring', primaryHsl);
  root.style.setProperty('--sidebar-background', primaryHsl);
  root.style.setProperty('--sidebar-primary', primaryHsl);
  root.style.setProperty('--sidebar-ring', primaryHsl);
  root.style.setProperty('--sagaone-primary', primaryHsl);
  root.style.setProperty('--sagaone-dark', primaryHsl);
  root.style.setProperty('--sagaone-login-button', primaryHsl);
  
  // Button color (icons, interactive elements)
  const buttonHsl = hexToHsl(colors.button);
  root.style.setProperty('--accent', buttonHsl);
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

export function useUserColors() {
  useEffect(() => {
    const savedColors = localStorage.getItem('userColorConfig');
    if (savedColors) {
      try {
        const parsed = JSON.parse(savedColors);
        applyColors(parsed);
      } catch (error) {
        console.error("Error loading user colors:", error);
      }
    }
  }, []);
}