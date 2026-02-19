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
              width: 48,
              height: 48,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDark
                ? `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`
                : `${accentColor}14`,
              color: accentColor,
              flexShrink: 0,
              "& svg": { fontSize: 24 },
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                fontSize: "0.7rem",
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                mt: 0.25,
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
