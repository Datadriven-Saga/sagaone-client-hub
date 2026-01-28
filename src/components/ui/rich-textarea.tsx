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
 * Converte texto com asteriscos (*negrito*) para exibição visual
 * Retorna HTML com spans em negrito
 */
function textToDisplayHtml(text: string): string {
  // Escape HTML first
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  
  // Convert *text* to <strong>text</strong>
  return escaped.replace(/\*([^*]+)\*/g, '<strong class="font-bold">$1</strong>');
}

/**
 * Converte HTML de volta para texto com asteriscos
 */
function htmlToText(html: string): string {
  // Create a temporary div to parse HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;
  
  // Replace <strong> and <b> with asterisks
  temp.querySelectorAll("strong, b").forEach(el => {
    el.replaceWith(`*${el.textContent}*`);
  });
  
  // Replace <br> with newlines
  temp.querySelectorAll("br").forEach(el => {
    el.replaceWith("\n");
  });
  
  return temp.textContent || "";
}

/**
 * Textarea rico com suporte a formatação em negrito visual para WhatsApp.
 * - Mostra negrito visualmente durante a edição
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
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = React.useState(false);
    
    // Sync value to editor when it changes externally
    React.useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      
      // Only update if editor doesn't have focus (to avoid cursor jumping)
      if (document.activeElement !== editor) {
        const html = textToDisplayHtml(value);
        if (editor.innerHTML !== html) {
          editor.innerHTML = html || "";
        }
      }
    }, [value]);

    const handleInput = React.useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      
      // Get text content with formatting preserved
      let newValue = "";
      
      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          newValue += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          
          if (el.tagName === "BR") {
            newValue += "\n";
          } else if (el.tagName === "STRONG" || el.tagName === "B") {
            newValue += "*";
            el.childNodes.forEach(processNode);
            newValue += "*";
          } else if (el.tagName === "DIV" || el.tagName === "P") {
            if (newValue.length > 0 && !newValue.endsWith("\n")) {
              newValue += "\n";
            }
            el.childNodes.forEach(processNode);
          } else {
            el.childNodes.forEach(processNode);
          }
        }
      };
      
      editor.childNodes.forEach(processNode);
      
      // Remove trailing newline if it's just from empty divs
      newValue = newValue.replace(/\n+$/, "");
      
      // Check maxLength
      if (maxLength && newValue.length > maxLength) {
        return;
      }
      
      onValueChange(newValue);
    }, [onValueChange, maxLength]);

    const applyBold = React.useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const editor = editorRef.current;
      if (!editor || !editor.contains(range.commonAncestorContainer)) return;
      
      const selectedText = range.toString();
      
      if (!selectedText) {
        // No selection - insert bold markers at cursor
        document.execCommand("insertHTML", false, "<strong>\u200B</strong>");
      } else {
        // Check if already bold
        const parentBold = range.commonAncestorContainer.parentElement?.closest("strong, b");
        
        if (parentBold) {
          // Remove bold
          document.execCommand("removeFormat", false);
        } else {
          // Apply bold
          document.execCommand("bold", false);
        }
      }
      
      handleInput();
    }, [handleInput]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        // Ctrl+B ou Cmd+B para negrito
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          applyBold();
        }
        
        // Handle Enter to insert <br> instead of <div>
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak", false);
          handleInput();
        }
      },
      [applyBold, handleInput]
    );

    const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      handleInput();
    }, [handleInput]);

    const showPlaceholder = !value && !isFocused;

    return (
      <div className="relative" ref={ref}>
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

        {/* Placeholder */}
        {showPlaceholder && placeholder && (
          <div className="absolute top-2 left-3 text-muted-foreground pointer-events-none text-sm">
            {placeholder}
          </div>
        )}

        {/* Editable content */}
        <div
          ref={editorRef}
          id={id}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 pr-12 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          style={{ minHeight }}
          suppressContentEditableWarning
        />
      </div>
    );
  }
);

RichTextarea.displayName = "RichTextarea";

export { RichTextarea };
