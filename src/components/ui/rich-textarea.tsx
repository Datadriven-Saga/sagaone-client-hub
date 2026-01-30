import * as React from "react";
import { cn } from "@/lib/utils";
import { Bold } from "lucide-react";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "./tooltip";

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
 * Preview: renderiza *negrito* sem mostrar asteriscos.
 * Mantém os asteriscos “invisíveis” para o layout bater com o textarea
 * (cursor e quebras de linha alinhados).
 */
function renderFormattedPreview(text: string): React.ReactNode[] {
  if (!text) return [];

  const nodes: React.ReactNode[] = [];
  let bold = false;
  let buffer = "";
  let key = 0;

  const flush = () => {
    if (!buffer) return;
    if (bold) {
      nodes.push(
        <strong key={key++} className="font-bold">
          {buffer}
        </strong>
      );
    } else {
      nodes.push(<span key={key++}>{buffer}</span>);
    }
    buffer = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "*") {
      flush();
      nodes.push(
        <span key={key++} className="invisible">
          *
        </span>
      );
      bold = !bold;
    } else {
      buffer += ch;
    }
  }

  flush();
  return nodes;
}

/**
 * Textarea rico para templates WhatsApp:
 * - UI mostra negrito de verdade (asteriscos escondidos)
 * - payload continua com *texto*
 * - botão B indica estado ativo
 * - Ctrl/Cmd+B NÃO deve afetar o menu (stopPropagation)
 */
const RichTextarea = React.forwardRef<HTMLDivElement, RichTextareaProps>(
  (
    {
      value,
      onValueChange,
      placeholder,
      maxLength,
      className,
      minHeight = "120px",
      disabled,
      id,
    },
    ref
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const previewRef = React.useRef<HTMLDivElement>(null);
    const [boldMode, setBoldMode] = React.useState(false);

    const handleScroll = React.useCallback(() => {
      if (textareaRef.current && previewRef.current) {
        previewRef.current.scrollTop = textareaRef.current.scrollTop;
        previewRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }, []);

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (maxLength && newValue.length > maxLength) return;
        onValueChange(newValue);
      },
      [onValueChange, maxLength]
    );

    const toggleBold = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const hasSelection = start !== end;

      // 1) Com seleção: aplica/remove negrito na seleção (não muda o modo persistente)
      if (hasSelection) {
        const selectedText = value.substring(start, end);
        const beforeChar = start > 0 ? value[start - 1] : "";
        const afterChar = end < value.length ? value[end] : "";

        let newValue: string;
        let newCursorPos: number;

        if (beforeChar === "*" && afterChar === "*") {
          newValue =
            value.substring(0, start - 1) +
            selectedText +
            value.substring(end + 1);
          newCursorPos = start - 1 + selectedText.length;
        } else {
          newValue =
            value.substring(0, start) +
            "*" +
            selectedText +
            "*" +
            value.substring(end);
          newCursorPos = end + 2;
        }

        if (maxLength && newValue.length > maxLength) return;
        onValueChange(newValue);

        setTimeout(() => {
          const t = textareaRef.current;
          if (!t) return;
          t.focus();
          t.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
        return;
      }

      // 2) Sem seleção: alterna modo persistente e insere apenas "*" (sem placeholder)
      const nextMode = !boldMode;
      const insertPos = start;
      const nextValue = value.substring(0, insertPos) + "*" + value.substring(insertPos);
      if (maxLength && nextValue.length > maxLength) return;

      onValueChange(nextValue);
      setBoldMode(nextMode);

      setTimeout(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(insertPos + 1, insertPos + 1);
      }, 0);
    }, [boldMode, maxLength, onValueChange, value]);

    const handleKeyDownCapture = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          // Impede o shortcut global (menu/sidebar) e usa só aqui
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent?.stopImmediatePropagation?.();
          toggleBold();
        }
      },
      [toggleBold]
    );

    return (
      <div
        className={cn(
          "relative w-full rounded-md border border-input bg-background ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          className
        )}
        ref={ref}
      >
        {/* Toolbar */}
        <div className="absolute top-2 right-2 z-20">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-pressed={boldMode}
                  className={cn(
                    "h-7 w-7",
                    boldMode
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
                      : "bg-background/80 backdrop-blur-sm"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleBold}
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

        {/* Container com preview + textarea */}
        <div className="relative">
          {/* Preview */}
          <div
            ref={previewRef}
            aria-hidden="true"
            className={cn(
              "w-full px-3 py-2 pr-12 text-sm text-foreground pointer-events-none overflow-hidden whitespace-pre-wrap break-words"
            )}
            style={{
              minHeight,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {value?.length ? (
              renderFormattedPreview(value)
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>

          {/* Textarea (edição) */}
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDownCapture={handleKeyDownCapture}
            disabled={disabled}
            className={cn(
              "w-full bg-transparent px-3 py-2 pr-12 text-sm resize-none disabled:cursor-not-allowed disabled:opacity-50",
              "text-transparent caret-foreground selection:bg-primary/20",
              "focus-visible:outline-none"
            )}
            style={{
              minHeight,
              position: "relative",
              zIndex: 10,
            }}
            placeholder=""
          />
        </div>
      </div>
    );
  }
);

RichTextarea.displayName = "RichTextarea";

export { RichTextarea };
