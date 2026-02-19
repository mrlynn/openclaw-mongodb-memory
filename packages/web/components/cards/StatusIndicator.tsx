"use client";

import { Box, Typography, useTheme } from "@mui/material";
import { keyframes } from "@emotion/react";

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 var(--pulse-color); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

type StatusType = "ready" | "connected" | "error" | "unknown" | "loading";

const STATUS_COLORS: Record<StatusType, string> = {
  ready: "#00ff88",
  connected: "#00ff88",
  error: "#ff4466",
  unknown: "#ffab00",
  loading: "#888888",
};

interface StatusIndicatorProps {
  status: StatusType;
  size?: "small" | "medium" | "large";
  label?: string;
  showPulse?: boolean;
}

const SIZE_MAP = { small: 8, medium: 12, large: 16 };

export function StatusIndicator({
  status,
  size = "medium",
  label,
  showPulse = status === "ready" || status === "connected",
}: StatusIndicatorProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const color = STATUS_COLORS[status];
  const dotSize = SIZE_MAP[size];

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          backgroundColor: color,
          "--pulse-color": `${color}66`,
          ...(showPulse
            ? { animation: `${pulse} 2s ease-in-out infinite` }
            : {}),
          ...(isDark
            ? { boxShadow: `0 0 ${dotSize}px ${color}66` }
            : {}),
        } as any}
      />
      {label && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      )}
    </Box>
  );
}
