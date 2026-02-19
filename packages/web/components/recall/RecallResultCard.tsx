"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Tooltip,
  useTheme,
} from "@mui/material";
import { Delete, ExpandMore, ExpandLess } from "@mui/icons-material";
import { GlassCard } from "@/components/cards/GlassCard";
import { SimilarityScoreBar } from "./SimilarityScoreBar";
import { CardContent } from "@mui/material";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return date.toLocaleDateString();
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

interface RecallResultCardProps {
  id: string;
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
  onDelete: (id: string) => void;
}

export function RecallResultCard({
  id,
  text,
  score,
  tags,
  createdAt,
  onDelete,
}: RecallResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const isLong = text.length > 200;
  const displayText = isLong && !expanded ? text.slice(0, 200) + "..." : text;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <GlassCard
      sx={{
        borderLeft: `3px solid ${
          score > 0.7
            ? "#00ff88"
            : score > 0.5
              ? "#ffab00"
              : isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.1)"
        }`,
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ mb: 1.5 }}>
          <SimilarityScoreBar score={score} />
        </Box>

        <Typography
          variant="body2"
          sx={{
            mb: 1.5,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {displayText}
        </Typography>

        {isLong && (
          <Box
            onClick={() => setExpanded(!expanded)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              cursor: "pointer",
              color: "primary.main",
              mb: 1,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {expanded ? "Show less" : "Show more"}
            </Typography>
            {expanded ? (
              <ExpandLess sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 16 }} />
            )}
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {tags.map((tag, i) => (
              <Chip
                key={i}
                label={tag}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ height: 24, fontSize: "0.7rem" }}
              />
            ))}
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              {formatRelativeTime(createdAt)}
            </Typography>
          </Box>

          <Tooltip title="Delete this memory">
            <IconButton
              size="small"
              onClick={handleDelete}
              disabled={deleting}
              sx={{
                color: "text.disabled",
                "&:hover": { color: "error.main" },
              }}
            >
              <Delete sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </GlassCard>
  );
}
