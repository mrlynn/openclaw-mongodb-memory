"use client";

import { ReactNode } from "react";
import { useThemeMode } from "@/contexts/ThemeContext";
import styles from "./GlassCard.module.css";

interface GlassCardProps {
  children: ReactNode;
  glowColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function GlassCard({
  children,
  glowColor,
  className,
  style,
  onClick,
}: GlassCardProps) {
  const { darkMode } = useThemeMode();

  return (
    <div
      className={`${styles.card} ${className || ""}`}
      onClick={onClick}
      style={{
        ...(glowColor && darkMode
          ? { borderColor: `${glowColor}15` }
          : {}),
        ...style,
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {children}
    </div>
  );
}
