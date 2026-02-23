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
  // Always start with "dark" to match the server render and the inline FOUC script default.
  const [mode, setMode] = useState<ThemeMode>("dark");

  const darkMode = mode === "dark";

  // On mount, read the user's stored preference and sync body attribute.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
    if (stored === "light" || stored === "dark") {
      setMode(stored);
      document.body.setAttribute("data-theme", stored);
    } else {
      document.body.setAttribute("data-theme", "dark");
    }
  }, []);

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
