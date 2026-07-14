import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { DialogPortal, DialogOverlay } from "@/components/ui/dialog";

/**
 * ResponsiveDialogContent (Fase 1 — responsividade)
 *
 * Wrapper de DialogContent com:
 *  - largura fluida em mobile (`calc(100vw - 1rem)`), teto em `sm:max-w-[size]`;
 *  - altura máxima em `dvh` (não `vh`) — evita corte pela URL bar no iOS/Android;
 *  - scroll interno único (container `overflow-hidden`, body `overflow-y-auto`)
 *    para não gerar duplo scrollbar do Radix;
 *  - slots opcionais `header` / `footer` fixos (não rolam com o body);
 *  - `overscroll-contain` para não vazar scroll para o body da página.
 *
 * Uso:
 *   <Dialog>
 *     <ResponsiveDialogContent size="lg" header={<Header />} footer={<Footer />}>
 *       ...conteúdo rolável...
 *     </ResponsiveDialogContent>
 *   </Dialog>
 */
const SIZE: Record<"sm" | "md" | "lg" | "xl" | "full", string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[calc(100vw-4rem)]",
};

interface ResponsiveDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: keyof typeof SIZE;
  hideCloseButton?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}

export const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ResponsiveDialogContentProps
>(
  (
    {
      className,
      children,
      size = "md",
      hideCloseButton = false,
      header,
      footer,
      bodyClassName,
      ...props
    },
    ref
  ) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          "flex flex-col w-[calc(100vw-1rem)] max-h-[90dvh] overflow-hidden",
          "border bg-background shadow-lg sm:rounded-lg box-border",
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          SIZE[size],
          className
        )}
        {...props}
      >
        {header ? (
          <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-2">{header}</div>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6",
            header ? "pt-0" : "pt-4 sm:pt-6",
            footer ? "pb-2" : "pb-4 sm:pb-6",
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t">{footer}</div>
        ) : null}

        {!hideCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none h-10 w-10 sm:h-8 sm:w-8 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
);
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";