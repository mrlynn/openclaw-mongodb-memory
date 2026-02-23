"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import type { MemoryTimelineItem } from "@/lib/api";
import { TimelineDateGroup } from "./TimelineDateGroup";
import styles from "./TimelineContainer.module.css";

interface DateGroup {
  date: string;
  memories: MemoryTimelineItem[];
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Group memories by date (local timezone)
  const groups: DateGroup[] = useMemo(() => {
    const map = new Map<string, MemoryTimelineItem[]>();
    for (const mem of memories) {
      const dateKey = new Date(mem.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(mem);
    }
    return Array.from(map.entries()).map(([date, mems]) => ({
      date,
      memories: mems,
    }));
  }, [memories]);

  // Convert vertical scroll to horizontal
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Only convert when there's more vertical delta than horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Keyboard navigation (left/right arrow keys)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const scrollAmount = 300;
    if (e.key === "ArrowRight") {
      el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    } else if (e.key === "ArrowLeft") {
      el.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  }, []);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: containerRef.current,
        rootMargin: "0px 200px 0px 0px", // trigger 200px before visible
        threshold: 0.1,
      },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (groups.length === 0 && !loadingMore) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Memory timeline"
    >
      {/* Horizontal axis line */}
      <div className={styles.axisLine} />

      {/* Date groups */}
      <div className={styles.track}>
        {groups.map((group, idx) => (
          <TimelineDateGroup
            key={group.date}
            date={group.date}
            memories={group.memories}
            onCardClick={onCardClick}
            groupIndex={idx}
          />
        ))}

        {/* Loading more indicator */}
        {loadingMore && (
          <div className={styles.loadingMore}>
            <div className={styles.shimmerCard} />
            <div className={styles.shimmerCard} />
          </div>
        )}

        {/* Sentinel for infinite scroll */}
        {hasMore && <div ref={sentinelRef} className={styles.sentinel} />}
      </div>
    </div>
  );
}
