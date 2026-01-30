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

  const result: React.ReactNode[] = [];
  const regex = /(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const pushPlain = (plain: string) => {
    if (!plain) return;
    result.push(
      <span key={key++}>
        {plain.split("\n").map((line, i, arr) => (
          <React.Fragment key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const innerText = fullMatch.slice(1, -1);

    result.push(
      <span key={key++}>
        <span className="invisible">*</span>
        <strong className="font-bold">{innerText}</strong>
        <span className="invisible">*</span>
      </span>
    );

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    pushPlain(text.slice(lastIndex));
  }

  return result;
}

function computeBoldActive(value: string, start: number, end: number): boolean {
  if (!value) return false;

  // Seleção: ativa se estiver exatamente entre * e *
  if (start !== end) {
    const before = start > 0 ? value[start - 1] : "";
    const after = end < value.length ? value[end] : "";
    return before === "*" && after === "*";
  }

  // Cursor: ativa se estiver dentro de um par *...*
  const left = value.lastIndexOf("*", Math.max(0, start - 1));
  const right = value.indexOf("*", start);
  return left !== -1 && right !== -1 && left < start && right >= start;
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
    const [boldActive, setBoldActive] = React.useState(false);

    const updateBoldActive = React.useCallback(() => {
      const t = textareaRef.current;
      if (!t) return;
      setBoldActive(computeBoldActive(value, t.selectionStart ?? 0, t.selectionEnd ?? 0));
    }, [value]);

    React.useEffect(() => {
      updateBoldActive();
    }, [updateBoldActive]);

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

    const applyBold = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      let newValue: string;
      let newCursorPos: number;

      if (selectedText) {
        const beforeChar = start > 0 ? value[start - 1] : "";
        const afterChar = end < value.length ? value[end] : "";

        if (beforeChar === "*" && afterChar === "*") {
          // Remove bold
          newValue =
            value.substring(0, start - 1) +
            selectedText +
            value.substring(end + 1);
          newCursorPos = start - 1 + selectedText.length;
        } else {
          // Apply bold
          newValue =
            value.substring(0, start) +
            "*" +
            selectedText +
            "*" +
            value.substring(end);
          newCursorPos = end + 2;
        }
      } else {
        // No selection - placeholder
        newValue = value.substring(0, start) + "*texto*" + value.substring(end);
        newCursorPos = start + 1;
      }

      if (maxLength && newValue.length > maxLength) return;

      onValueChange(newValue);

      // Restore focus + selection after state update
      setTimeout(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();

        if (!selectedText) {
          // Select "texto" placeholder
          t.setSelectionRange(start + 1, start + 6);
        } else {
          t.setSelectionRange(newCursorPos, newCursorPos);
        }
        updateBoldActive();
      }, 0);
    }, [maxLength, onValueChange, updateBoldActive, value]);

    const handleKeyDownCapture = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          // Impede o shortcut global (menu/sidebar) e usa só aqui
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent?.stopImmediatePropagation?.();
          applyBold();
        }
      },
      [applyBold]
    );

    return (
      <div className="relative" ref={ref}>
        {/* Toolbar */}
        <div className="absolute top-2 right-2 z-20">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant={boldActive ? "secondary" : "outline"}
                  aria-pressed={boldActive}
                  className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
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

        {/* Container com preview + textarea */}
        <div className="relative">
          {/* Preview */}
          <div
            ref={previewRef}
            aria-hidden="true"
            className={cn(
              "w-full rounded-md border border-transparent bg-transparent px-3 py-2 pr-12 text-sm text-foreground pointer-events-none overflow-hidden whitespace-pre-wrap break-words",
              className
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
            onMouseUp={updateBoldActive}
            onKeyUp={updateBoldActive}
            onSelect={updateBoldActive}
            disabled={disabled}
            className={cn(
              "w-full rounded-md border border-input bg-transparent px-3 py-2 pr-12 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
              "text-transparent caret-foreground selection:bg-primary/20",
              className
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
