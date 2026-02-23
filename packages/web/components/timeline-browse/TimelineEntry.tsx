"use client";

import type { MemoryTimelineItem } from "@/lib/api";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { TimelineMiniCard } from "./TimelineMiniCard";
import styles from "./TimelineEntry.module.css";

interface TimelineEntryProps {
  memory: MemoryTimelineItem;
  index: number;
  side: "left" | "right";
  onCardClick: (memory: MemoryTimelineItem) => void;
}

export function TimelineEntry({ memory, index, side, onCardClick }: TimelineEntryProps) {
  const { ref, isVisible } = useScrollReveal();

  const className = [
    styles.entry,
    side === "right" ? styles.entryRight : "",
    isVisible ? styles.entryVisible : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={className}>
      {/* Left card */}
      {side === "left" && (
        <div className={styles.cardWrapper}>
          <TimelineMiniCard memory={memory} index={index} onClick={() => onCardClick(memory)} />
        </div>
      )}

      {/* Center spine dot */}
      <div className={styles.node}>
        <div className={styles.dot} />
      </div>

      {/* Right card */}
      {side === "right" && (
        <div className={styles.cardWrapper}>
          <TimelineMiniCard memory={memory} index={index} onClick={() => onCardClick(memory)} />
        </div>
      )}
    </div>
  );
}
