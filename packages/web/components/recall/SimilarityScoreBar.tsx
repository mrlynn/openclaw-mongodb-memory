"use client";

import { Box, Typography, useTheme } from "@mui/material";

interface SimilarityScoreBarProps {
  score: number;
}

export function SimilarityScoreBar({ score }: SimilarityScoreBarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const percent = Math.min(score * 100, 100);

  const glowIntensity = score > 0.7 ? 0.5 : score > 0.5 ? 0.2 : 0;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
      <Box
        sx={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 3,
            background:
              score > 0.7
                ? "linear-gradient(90deg, #00e5ff, #00ff88)"
                : score > 0.5
                  ? "linear-gradient(90deg, #00e5ff, #ffab00)"
                  : "linear-gradient(90deg, #666, #999)",
            boxShadow:
              isDark && glowIntensity > 0
                ? `0 0 8px rgba(0, 229, 255, ${glowIntensity})`
                : "none",
            transition: "width 0.6s ease-out",
          }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontFamily: "monospace",
          minWidth: 48,
          textAlign: "right",
          color:
            score > 0.7
              ? isDark
                ? "#00ff88"
                : "success.main"
              : "text.secondary",
        }}
      >
        {score.toFixed(3)}
      </Typography>
    </Box>
  );
}
