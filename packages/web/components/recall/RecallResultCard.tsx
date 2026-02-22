"use client";

import { useState } from "react";
import { Chip } from "@leafygreen-ui/chip";
import IconButton from "@leafygreen-ui/icon-button";
import Icon from "@leafygreen-ui/icon";
import Tooltip from "@leafygreen-ui/tooltip";
import { GlassCard } from "@/components/cards/GlassCard";
import { useThemeMode } from "@/contexts/ThemeContext";
import { SimilarityScoreBar } from "./SimilarityScoreBar";

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
  const { darkMode } = useThemeMode();

  const isLong = text.length > 200;
  const displayText = isLong && !expanded ? text.slice(0, 200) + "..." : text;

  const borderColor =
    score > 0.7
      ? "#00A35C"
      : score > 0.5
        ? "#FFC010"
        : darkMode
          ? "rgba(255,255,255,0.1)"
          : "rgba(0,0,0,0.08)";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <GlassCard style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div style={{ marginBottom: 12 }}>
        <SimilarityScoreBar score={score} />
      </div>

      <p
        style={{
          marginBottom: 12,
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          fontSize: "0.875rem",
        }}
      >
        {displayText}
      </p>

      {isLong && (
        <span
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            cursor: "pointer",
            color: darkMode ? "#00ED64" : "#00684A",
            marginBottom: 8,
            fontWeight: 500,
            fontSize: "0.75rem",
            gap: 2,
          }}
        >
          {expanded ? "Show less" : "Show more"}
          <Icon glyph={expanded ? "ChevronUp" : "ChevronDown"} size={14} />
        </span>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {tags.map((tag, i) => (
            <Chip key={i} label={tag} variant="blue" darkMode={darkMode} />
          ))}
          <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>
            {formatRelativeTime(createdAt)}
          </span>
        </div>

        <Tooltip
          trigger={
            <IconButton
              aria-label="Delete this memory"
              onClick={handleDelete}
              disabled={deleting}
              darkMode={darkMode}
            >
              <Icon glyph="Trash" size={16} />
            </IconButton>
          }
          darkMode={darkMode}
        >
          Delete this memory
        </Tooltip>
      </div>
    </GlassCard>
  );
}
