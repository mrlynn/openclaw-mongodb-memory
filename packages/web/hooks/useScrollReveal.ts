"use client";

import { useRef, useState, useEffect } from "react";

/**
 * Fires once when the element enters the viewport.
 * Returns `{ ref, isVisible }` — attach `ref` to the DOM element,
 * use `isVisible` to toggle a CSS class for entrance animations.
 */
export function useScrollReveal(options?: IntersectionObserverInit): {
  ref: React.RefObject<HTMLDivElement | null>;
  isVisible: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -40px 0px",
        ...options,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, isVisible };
}
