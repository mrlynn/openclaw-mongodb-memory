"use client";

import IconButton from "@leafygreen-ui/icon-button";
import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode();

  return (
    <IconButton
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleMode}
      darkMode={mode === "dark"}
    >
      {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}
