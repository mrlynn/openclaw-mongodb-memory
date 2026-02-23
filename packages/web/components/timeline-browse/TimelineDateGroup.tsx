"use client";

import type { MemoryTimelineItem } from "@/lib/api";
import { TimelineMiniCard } from "./TimelineMiniCard";
import styles from "./TimelineDateGroup.module.css";

interface TimelineDateGroupProps {
  date: string; // "YYYY-MM-DD"
  memories: MemoryTimelineItem[];
  onCardClick: (memory: MemoryTimelineItem) => void;
  groupIndex: number;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // noon to avoid TZ issues
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TimelineDateGroup({
  date,
  memories,
  onCardClick,
  groupIndex,
}: TimelineDateGroupProps) {
  const label = formatDateLabel(date);

  return (
    <div className={styles.group} style={{ animationDelay: `${groupIndex * 80}ms` }}>
      {/* Date marker */}
      <div className={styles.marker}>
        <div className={styles.dot} />
        <div className={styles.markerLabel}>
          <span className={styles.dateText}>{label}</span>
          <span className={styles.countBadge}>{memories.length}</span>
        </div>
      </div>

      {/* Cards */}
      <div className={styles.cards}>
        {memories.map((memory, idx) => (
          <TimelineMiniCard
            key={memory.id}
            memory={memory}
            index={groupIndex * 7 + idx}
            onClick={() => onCardClick(memory)}
            animationDelay={groupIndex * 80 + idx * 50}
          />
        ))}
      </div>
    </div>
  );
}
