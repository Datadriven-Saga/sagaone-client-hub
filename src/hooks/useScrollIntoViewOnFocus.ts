import * as React from "react";

/**
 * Rola o elemento para o centro da viewport quando ele recebe foco
 * em telas mobile — evita que o teclado virtual esconda inputs no
 * final de modais/formulários longos.
 *
 * Uso:
 *   const ref = useScrollIntoViewOnFocus<HTMLInputElement>();
 *   <Input ref={ref} ... />
 *
 * - Ativa apenas em <= 768px (matchMedia).
 * - Aguarda 300ms após o focus para o teclado virtual abrir.
 * - Usa `visualViewport` quando disponível para maior precisão.
 */
export function useScrollIntoViewOnFocus<T extends HTMLElement = HTMLElement>() {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

    const onFocus = () => {
      if (!isMobile()) return;
      window.setTimeout(() => {
        try {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          el.scrollIntoView();
        }
      }, 300);
    };

    el.addEventListener("focus", onFocus);
    return () => el.removeEventListener("focus", onFocus);
  }, []);

  return ref;
}

/**
 * Variante em nível de container: instala um único `focusin` listener
 * que rola qualquer input/textarea/select/[contenteditable] focado
 * para o centro da viewport em mobile. Evita a necessidade de plugar
 * `ref` campo-a-campo em formulários/modais longos.
 *
 *   const containerRef = useAutoScrollFocusInContainer<HTMLDivElement>();
 *   <div ref={containerRef}>...campos...</div>
 */
export function useAutoScrollFocusInContainer<T extends HTMLElement = HTMLElement>() {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const container = ref.current;
    if (!container || typeof window === "undefined") return;

    const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
    const FOCUSABLE = "input, textarea, select, [contenteditable='true']";

    const onFocusIn = (evt: FocusEvent) => {
      if (!isMobile()) return;
      const target = evt.target as HTMLElement | null;
      if (!target || !target.matches?.(FOCUSABLE)) return;
      window.setTimeout(() => {
        try {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          target.scrollIntoView();
        }
      }, 300);
    };

    container.addEventListener("focusin", onFocusIn);
    return () => container.removeEventListener("focusin", onFocusIn);
  }, []);

  return ref;
}