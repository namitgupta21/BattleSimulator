import { useEffect, useState } from "react";

/**
 * Hook that detects whether the user / OS prefers reduced motion,
 * and reacts live to any changes to the operating system setting.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQueryList = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQueryList.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", listener);
      return () => mediaQueryList.removeEventListener("change", listener);
    } else if ((mediaQueryList as any).addListener) {
      // Legacy browser fallback
      (mediaQueryList as any).addListener(listener);
      return () => (mediaQueryList as any).removeListener(listener);
    }
  }, []);

  return prefersReducedMotion;
}
