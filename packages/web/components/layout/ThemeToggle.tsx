"use client";

import { IconButton, Tooltip } from "@mui/material";
import { DarkMode, LightMode } from "@mui/icons-material";
import { useThemeMode } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode();

  return (
    <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton
        onClick={toggleMode}
        sx={{
          color: mode === "dark" ? "primary.main" : "text.secondary",
          transition: "transform 0.3s ease",
          "&:hover": {
            transform: "rotate(30deg)",
          },
        }}
      >
        {mode === "dark" ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
}
