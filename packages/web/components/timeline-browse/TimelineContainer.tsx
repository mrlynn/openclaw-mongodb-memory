"use client";

import { useMemo } from "react";
import type { MemoryTimelineItem } from "@/lib/api";
import { TimelineDateHeader } from "./TimelineDateHeader";
import { TimelineEntry } from "./TimelineEntry";
import styles from "./TimelineContainer.module.css";

type RenderItem =
  | { type: "header"; date: string; count: number }
  | {
      type: "entry";
      memory: MemoryTimelineItem;
      side: "left" | "right";
      globalIndex: number;
    };

interface TimelineContainerProps {
  memories: MemoryTimelineItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onCardClick: (memory: MemoryTimelineItem) => void;
}

export function TimelineContainer({
  memories,
  hasMore,
  loadingMore,
  onLoadMore,
  onCardClick,
}: TimelineContainerProps) {
  // Pre-compute a flat render list with date headers and alternating sides.
  // This avoids mutable counters during render.
  const renderItems: RenderItem[] = useMemo(() => {
    const items: RenderItem[] = [];
    const groups = new Map<string, MemoryTimelineItem[]>();

    for (const mem of memories) {
      const dateKey = new Date(mem.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(mem);
    }

    let globalIndex = 0;
    for (const [date, mems] of groups) {
      items.push({ type: "header", date, count: mems.length });
      for (const mem of mems) {
        items.push({
          type: "entry",
          memory: mem,
          side: globalIndex % 2 === 0 ? "left" : "right",
          globalIndex,
        });
        globalIndex++;
      }
    }

    return items;
  }, [memories]);

  if (memories.length === 0) return null;

  return (
    <div className={styles.timeline}>
      {renderItems.map((item) => {
        if (item.type === "header") {
          return (
            <TimelineDateHeader key={`header-${item.date}`} date={item.date} count={item.count} />
          );
        }

        return (
          <TimelineEntry
            key={item.memory.id}
            memory={item.memory}
            index={item.globalIndex}
            side={item.side}
            onCardClick={onCardClick}
          />
        );
      })}

      {/* Load more */}
      {hasMore && (
        <div className={styles.loadMoreWrap}>
          <button className={styles.loadMoreBtn} onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load More Memories"}
          </button>
        </div>
      )}
    </div>
  );
}
