import * as React from "react";
import { cn } from "@/lib/utils";
import { Bold } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./tooltip";

export interface BoldTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onValueChange?: (value: string) => void;
}

/**
 * Textarea com suporte a formatação em negrito para WhatsApp.
 * - Botão "B" para aplicar negrito no texto selecionado
 * - Atalho Ctrl+B / Cmd+B
 * - Formato WhatsApp: *texto em negrito*
 */
const BoldTextarea = React.forwardRef<HTMLTextAreaElement, BoldTextareaProps>(
  ({ className, onValueChange, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLTextAreaElement>) || textareaRef;

    const applyBold = React.useCallback(() => {
      const textarea = combinedRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      if (start === end) {
        // Nenhum texto selecionado - inserir marcadores vazios
        const newText = text.slice(0, start) + "**" + text.slice(end);
        const newCursorPos = start + 1;

        if (onValueChange) {
          onValueChange(newText);
        }

        // Posicionar cursor entre os asteriscos
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      } else {
        // Texto selecionado - envolver com asteriscos
        const selectedText = text.slice(start, end);
        
        // Verificar se já está em negrito (tem * no início e fim)
        const isBold = selectedText.startsWith("*") && selectedText.endsWith("*");
        
        let newText: string;
        let newStart: number;
        let newEnd: number;

        if (isBold && selectedText.length >= 2) {
          // Remover negrito
          const unboldedText = selectedText.slice(1, -1);
          newText = text.slice(0, start) + unboldedText + text.slice(end);
          newStart = start;
          newEnd = start + unboldedText.length;
        } else {
          // Aplicar negrito
          newText = text.slice(0, start) + "*" + selectedText + "*" + text.slice(end);
          newStart = start;
          newEnd = end + 2;
        }

        if (onValueChange) {
          onValueChange(newText);
        }

        // Manter seleção após formatação
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newStart, newEnd);
        }, 0);
      }
    }, [combinedRef, onValueChange]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl+B ou Cmd+B para negrito
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          applyBold();
        }
      },
      [applyBold]
    );

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (onChange) {
          onChange(e);
        }
        if (onValueChange) {
          onValueChange(e.target.value);
        }
      },
      [onChange, onValueChange]
    );

    return (
      <div className="relative">
        {/* Toolbar */}
        <div className="absolute top-2 right-2 z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-muted"
                  onClick={applyBold}
                  tabIndex={-1}
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Negrito (Ctrl+B)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <textarea
          ref={combinedRef}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);

BoldTextarea.displayName = "BoldTextarea";

export { BoldTextarea };
