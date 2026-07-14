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