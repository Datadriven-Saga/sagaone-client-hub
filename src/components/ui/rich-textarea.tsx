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
 * Textarea simples com suporte a formatação em negrito para WhatsApp.
 * - Armazena texto com asteriscos (*texto*) para o payload
 * - Botão "B" para aplicar negrito no texto selecionado
 * - Atalho Ctrl+B / Cmd+B
 */
const RichTextarea = React.forwardRef<HTMLTextAreaElement, RichTextareaProps>(
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

    // Use forwarded ref or local ref
    React.useImperativeHandle(ref, () => textareaRef.current!);

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

    return (
      <div className="relative">
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

        {/* Simple textarea */}
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
            className
          )}
          style={{ minHeight }}
        />
      </div>
    );
  }
);

RichTextarea.displayName = "RichTextarea";

export { RichTextarea };
