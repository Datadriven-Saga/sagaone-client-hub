import * as React from "react";

/**
 * Fonte única de verdade para breakpoints responsivos.
 * Espelha os tokens do Tailwind (sm 640, md 768, lg 1024, xl 1280).
 *
 * Retorna `true` quando a viewport é >= ao breakpoint informado
 * (semântica mobile-first, igual aos utilitários do Tailwind).
 *
 *   const isDesktop = useBreakpoint("md"); // true em >= 768px
 */
const BP: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export function useBreakpoint(bp: "sm" | "md" | "lg" | "xl"): boolean {
  const query = `(min-width: ${BP[bp]}px)`;
  const getMatch = React.useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const [matches, setMatches] = React.useState<boolean>(getMatch);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}