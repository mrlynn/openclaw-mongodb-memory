"use client";

import { Card, CardProps, useTheme } from "@mui/material";
import { keyframes } from "@emotion/react";

const subtleGlow = keyframes`
  0%, 100% { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); }
  50% { box-shadow: 0 8px 32px rgba(0, 229, 255, 0.06); }
`;

interface GlassCardProps extends CardProps {
  glowColor?: string;
  animated?: boolean;
}

export function GlassCard({
  children,
  glowColor,
  animated = false,
  sx,
  ...props
}: GlassCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Card
      {...props}
      sx={{
        ...(isDark && animated
          ? { animation: `${subtleGlow} 4s ease-in-out infinite` }
          : {}),
        ...(glowColor && isDark
          ? {
              borderColor: `${glowColor}20`,
              "&:hover": {
                borderColor: `${glowColor}40`,
                boxShadow: `0 8px 32px ${glowColor}15`,
              },
            }
          : {}),
        ...sx,
      }}
    >
      {children}
    </Card>
  );
}
