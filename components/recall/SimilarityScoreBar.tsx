"use client";

import { useThemeMode } from "@/contexts/ThemeContext";

interface SimilarityScoreBarProps {
  score: number;
}

export function SimilarityScoreBar({ score }: SimilarityScoreBarProps) {
  const { darkMode } = useThemeMode();
  const percent = Math.min(score * 100, 100);

  const gradient =
    score > 0.7
      ? "linear-gradient(90deg, #016BF8, #00A35C)"
      : score > 0.5
        ? "linear-gradient(90deg, #016BF8, #FFC010)"
        : darkMode
          ? "linear-gradient(90deg, #3D4F58, #5C6C75)"
          : "linear-gradient(90deg, #B8C4C2, #C1C7C6)";

  const scoreColor =
    score > 0.7
      ? darkMode
        ? "#00ED64"
        : "#00A35C"
      : undefined;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 3,
          background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 3,
            background: gradient,
            transition: "width 0.6s ease-out",
          }}
        />
      </div>
      <span
        style={{
          fontWeight: 600,
          fontFamily: "monospace",
          minWidth: 48,
          textAlign: "right",
          color: scoreColor,
          fontSize: "0.72rem",
          opacity: scoreColor ? 1 : 0.6,
        }}
      >
        {score.toFixed(3)}
      </span>
    </div>
  );
}
