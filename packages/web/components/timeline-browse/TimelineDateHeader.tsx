"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";
import styles from "./TimelineDateHeader.module.css";

interface TimelineDateHeaderProps {
  date: string; // "YYYY-MM-DD"
  count: number;
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

export function TimelineDateHeader({ date, count }: TimelineDateHeaderProps) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.5 });

  return (
    <div ref={ref} className={`${styles.header} ${isVisible ? styles.headerVisible : ""}`}>
      <span className={styles.label}>{formatDateLabel(date)}</span>
      <span className={styles.badge}>{count}</span>
    </div>
  );
}
