"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import { STORAGE_KEYS } from "@/lib/constants";

type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  mode: ThemeMode;
  darkMode: boolean;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  darkMode: true,
  toggleMode: () => {},
});

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
      if (stored === "light" || stored === "dark") return stored;
    }
    return "dark";
  });

  const darkMode = mode === "dark";

  useEffect(() => {
    document.body.setAttribute("data-theme", mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, darkMode, toggleMode }}>
      <LeafyGreenProvider darkMode={darkMode}>
        {children}
      </LeafyGreenProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
