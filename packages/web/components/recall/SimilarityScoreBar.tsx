"use client";

import { Box, Typography, useTheme } from "@mui/material";

interface SimilarityScoreBarProps {
  score: number;
}

export function SimilarityScoreBar({ score }: SimilarityScoreBarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const percent = Math.min(score * 100, 100);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
      <Box
        sx={{
          flex: 1,
          height: 5,
          borderRadius: 3,
          bgcolor: isDark ? "rgba(180,188,208,0.06)" : "rgba(0,0,0,0.06)",
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
                ? "linear-gradient(90deg, #8b9cf7, #7ec8a4)"
                : score > 0.5
                  ? "linear-gradient(90deg, #8b9cf7, #d4a76a)"
                  : isDark
                    ? "linear-gradient(90deg, #4a4f65, #5a5f75)"
                    : "linear-gradient(90deg, #b0b5c5, #c0c5d5)",
            transition: "width 0.6s ease-out",
          }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontFamily: "monospace",
          minWidth: 48,
          textAlign: "right",
          color:
            score > 0.7
              ? isDark
                ? "#7ec8a4"
                : "success.main"
              : "text.secondary",
          fontSize: "0.72rem",
        }}
      >
        {score.toFixed(3)}
      </Typography>
    </Box>
  );
}
