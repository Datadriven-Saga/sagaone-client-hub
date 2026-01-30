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
 * Renders text with bold formatting (hides asterisks, shows bold text)
 * Used in the visual preview layer
 */
function renderFormattedPreview(text: string): React.ReactNode[] {
  if (!text) return [];
  
  const result: React.ReactNode[] = [];
  const regex = /(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
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
    
    // Add the formatted bold section - hide asterisks visually but keep spacing
    const fullMatch = match[0]; // e.g., "*bold text*"
    const innerText = fullMatch.slice(1, -1); // e.g., "bold text"
    
    result.push(
      <span key={key++}>
        <span className="invisible">*</span>
        <strong className="font-bold">{innerText}</strong>
        <span className="invisible">*</span>
      </span>
    );
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add remaining text
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
 * Textarea rico com suporte a formatação em negrito visual para WhatsApp.
 * - Mostra texto em negrito visualmente (asteriscos ficam invisíveis)
 * - Armazena internamente com asteriscos (*texto*) para o payload
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
    const previewRef = React.useRef<HTMLDivElement>(null);

    // Sync scroll between textarea and preview
    const handleScroll = React.useCallback(() => {
      if (textareaRef.current && previewRef.current) {
        previewRef.current.scrollTop = textareaRef.current.scrollTop;
        previewRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }, []);

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
        // Check if already wrapped in asterisks
        const beforeChar = start > 0 ? value[start - 1] : '';
        const afterChar = end < value.length ? value[end] : '';
        
        if (beforeChar === '*' && afterChar === '*') {
          // Remove bold - remove the asterisks around selection
          newValue = value.substring(0, start - 1) + selectedText + value.substring(end + 1);
          newCursorPos = start - 1 + selectedText.length;
        } else {
          // Apply bold - wrap selection in asterisks
          newValue = value.substring(0, start) + '*' + selectedText + '*' + value.substring(end);
          newCursorPos = end + 2;
        }
      } else {
        // No selection - insert placeholder bold markers
        newValue = value.substring(0, start) + '*texto*' + value.substring(end);
        newCursorPos = start + 1; // Position cursor after first asterisk
        
        // Select the "texto" placeholder for easy replacement
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 6);
          textarea.focus();
        }, 0);
      }

      if (maxLength && newValue.length > maxLength) {
        return;
      }

      onValueChange(newValue);
      
      // Restore cursor position
      setTimeout(() => {
        if (!selectedText) return; // Skip if we're selecting placeholder
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }, [value, onValueChange, maxLength]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        // Ctrl+B ou Cmd+B para negrito
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          applyBold();
        }
      },
      [applyBold]
    );

    const hasContent = value && value.length > 0;

    return (
      <div className="relative" ref={ref}>
        {/* Toolbar */}
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

        {/* Container for layered approach */}
        <div className="relative">
          {/* Preview layer - shows formatted text with visible bold */}
          <div
            ref={previewRef}
            aria-hidden="true"
            className={cn(
              "w-full rounded-md border border-transparent bg-transparent px-3 py-2 pr-12 text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-words",
              className
            )}
            style={{ 
              minHeight,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {hasContent ? renderFormattedPreview(value) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>

          {/* Textarea layer - transparent text, handles editing */}
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            disabled={disabled}
            className={cn(
              "w-full rounded-md border border-input bg-transparent px-3 py-2 pr-12 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
              "text-transparent caret-foreground selection:bg-primary/20",
              className
            )}
            style={{ 
              minHeight,
              position: 'relative',
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
