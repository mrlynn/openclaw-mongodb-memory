"use client";

import { useThemeMode } from "@/contexts/ThemeContext";
import type { MemoryTimelineItem } from "@/lib/api";
import styles from "./TimelineMiniCard.module.css";

// MongoDB brand color palette for card accents
const ACCENT_COLORS_DARK = [
  "#00ED64",
  "#71F6BA",
  "#016BF8",
  "#C3E7FE",
  "#00A35C",
  "#FFC010",
  "#B1FF05",
];
const ACCENT_COLORS_LIGHT = [
  "#00684A",
  "#00A35C",
  "#016BF8",
  "#1A567E",
  "#023430",
  "#944F01",
  "#3D4F58",
];

interface TimelineMiniCardProps {
  memory: MemoryTimelineItem;
  index: number;
  onClick: () => void;
}

export function TimelineMiniCard({ memory, index, onClick }: TimelineMiniCardProps) {
  const { darkMode } = useThemeMode();
  const colors = darkMode ? ACCENT_COLORS_DARK : ACCENT_COLORS_LIGHT;
  const accentColor = colors[index % colors.length];

  const time = new Date(memory.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const maxTags = 3;
  const visibleTags = memory.tags.slice(0, maxTags);
  const extraTags = memory.tags.length - maxTags;

  return (
    <button
      className={styles.card}
      onClick={onClick}
      style={{ borderLeftColor: accentColor }}
      type="button"
    >
      <div className={styles.textPreview}>{memory.text}</div>

      {visibleTags.length > 0 && (
        <div className={styles.tagsRow}>
          {visibleTags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
          {extraTags > 0 && <span className={styles.tagOverflow}>+{extraTags}</span>}
        </div>
      )}

      <div className={styles.time}>{time}</div>
    </button>
  );
}
