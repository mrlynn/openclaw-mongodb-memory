"use client";

import { useThemeMode } from "@/contexts/ThemeContext";
import styles from "./StatusIndicator.module.css";

type StatusType = "ready" | "connected" | "error" | "unknown" | "loading";

const STATUS_COLORS: Record<StatusType, string> = {
  ready: "#00A35C",
  connected: "#00A35C",
  error: "#DB3030",
  unknown: "#FFC010",
  loading: "#889397",
};

interface StatusIndicatorProps {
  status: StatusType;
  size?: "small" | "medium" | "large";
  label?: string;
  showPulse?: boolean;
}

const SIZE_MAP = { small: 7, medium: 10, large: 14 };

export function StatusIndicator({
  status,
  size = "medium",
  label,
  showPulse = status === "ready" || status === "connected",
}: StatusIndicatorProps) {
  const { darkMode } = useThemeMode();
  const color = STATUS_COLORS[status];
  const dotSize = SIZE_MAP[size];

  return (
    <span className={styles.wrapper}>
      <span
        className={`${styles.dot} ${showPulse ? styles.pulse : ""}`}
        style={
          {
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
            "--pulse-color": `${color}40`,
            ...(darkMode ? { boxShadow: `0 0 ${dotSize}px ${color}30` } : {}),
          } as React.CSSProperties
        }
      />
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}
