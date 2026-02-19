"use client";

import { Box, CardContent, Typography, useTheme } from "@mui/material";
import { GlassCard } from "./GlassCard";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export function StatCard({ icon, label, value, subtitle, color }: StatCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const accentColor = color || theme.palette.primary.main;

  return (
    <GlassCard>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDark
                ? `${accentColor}12`
                : `${accentColor}0c`,
              color: accentColor,
              flexShrink: 0,
              "& svg": { fontSize: 22 },
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.disabled",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 500,
                fontSize: "0.68rem",
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
                mt: 0.25,
                letterSpacing: "-0.02em",
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: "text.disabled", mt: 0.25, display: "block" }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </GlassCard>
  );
}
