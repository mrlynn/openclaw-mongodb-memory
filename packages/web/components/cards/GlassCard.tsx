"use client";

import { Card, CardProps, useTheme } from "@mui/material";

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
        ...(glowColor && isDark
          ? {
              borderColor: `${glowColor}15`,
              "&:hover": {
                borderColor: `${glowColor}25`,
                boxShadow: `0 8px 32px ${glowColor}08`,
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
