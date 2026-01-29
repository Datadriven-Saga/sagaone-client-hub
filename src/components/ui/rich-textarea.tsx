import * as React from "react";
import { cn } from "@/lib/utils";
import { Bold } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./tooltip";

export interface RichTextareaProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Renderiza texto com asteriscos visíveis e texto em negrito entre eles
 */
function renderFormattedContent(text: string): React.ReactNode[] {
  if (!text) return [];
  
  const result: React.ReactNode[] = [];
  const regex = /(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = regex.exec(text)) !== null) {
    // Texto antes do match
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      result.push(
        <span key={key++}>
          {beforeText.split('\n').map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </span>
      );
    }
    
    // Texto em negrito com asteriscos visíveis
    const fullMatch = match[0]; // ex: "*texto bold*"
    const innerText = fullMatch.slice(1, -1); // ex: "texto bold"
    
    result.push(
      <span key={key++}>
        <span className="text-muted-foreground/50">*</span>
        <strong className="font-bold">{innerText}</strong>
        <span className="text-muted-foreground/50">*</span>
      </span>
    );
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Texto restante
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    result.push(
      <span key={key++}>
        {remaining.split('\n').map((line, i, arr) => (
          <React.Fragment key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  }
  
  return result;
}

/**
 * Textarea com suporte a formatação em negrito visual para WhatsApp.
 * - Mostra asteriscos visíveis (esmaecidos) com texto em negrito
 * - Armazena internamente com asteriscos (*texto*)
 * - Botão "B" para aplicar negrito no texto selecionado
 * - Atalho Ctrl+B / Cmd+B
 */
const RichTextarea = React.forwardRef<HTMLDivElement, RichTextareaProps>(
  ({ 
    value, 
    onValueChange, 
    placeholder, 
    maxLength, 
    className,
    minHeight = "120px",
    disabled,
    id 
  }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (maxLength && newValue.length > maxLength) {
        return;
      }
      onValueChange(newValue);
    }, [onValueChange, maxLength]);

    const applyBold = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      let newValue: string;
      let newCursorPos: number;

      if (selectedText) {
        // Verifica se já está envolvido em asteriscos
        const beforeChar = start > 0 ? value[start - 1] : '';
        const afterChar = end < value.length ? value[end] : '';
        
        if (beforeChar === '*' && afterChar === '*') {
          // Remove negrito
          newValue = value.substring(0, start - 1) + selectedText + value.substring(end + 1);
          newCursorPos = start - 1 + selectedText.length;
        } else {
          // Aplica negrito
          newValue = value.substring(0, start) + '*' + selectedText + '*' + value.substring(end);
          newCursorPos = end + 2;
        }
      } else {
        // Sem seleção - insere placeholder
        newValue = value.substring(0, start) + '*texto*' + value.substring(end);
        newCursorPos = start + 1;
        
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 6);
          textarea.focus();
        }, 0);
      }

      if (maxLength && newValue.length > maxLength) {
        return;
      }

      onValueChange(newValue);
      
      setTimeout(() => {
        if (!selectedText) return;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }, [value, onValueChange, maxLength]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          applyBold();
        }
      },
      [applyBold]
    );

    return (
      <div className="relative" ref={ref}>
        {/* Botão Bold */}
        <div className="absolute top-2 right-2 z-20">
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
                  disabled={disabled}
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

        {/* Container com camadas sobrepostas */}
        <div className="relative" style={{ minHeight }}>
          {/* Camada de preview (mostra texto formatado) */}
          <div
            className={cn(
              "absolute inset-0 w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-sm overflow-y-auto whitespace-pre-wrap break-words pointer-events-none",
              disabled && "opacity-50"
            )}
            style={{ minHeight }}
            aria-hidden="true"
          >
            {!value && placeholder ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              renderFormattedContent(value)
            )}
          </div>

          {/* Textarea invisível (funcional) por cima */}
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              "relative z-10 w-full rounded-md border border-transparent bg-transparent px-3 py-2 pr-12 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
              "text-transparent caret-foreground selection:bg-primary/30 selection:text-transparent"
            )}
            style={{ minHeight }}
            placeholder=""
          />
        </div>
      </div>
    );
  }
);

RichTextarea.displayName = "RichTextarea";

export { RichTextarea };
