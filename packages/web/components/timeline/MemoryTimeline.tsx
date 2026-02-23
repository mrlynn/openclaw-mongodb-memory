"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useThemeMode } from "@/contexts/ThemeContext";
import type { TimelineDay } from "@/lib/api";
import styles from "./MemoryTimeline.module.css";

interface MemoryTimelineProps {
  days: TimelineDay[];
  /** Number of days to display (default 90) */
  numDays?: number;
}

const CELL_SIZE = 12;
const CELL_GAP = 3;
const DAY_LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 16;

// 5-level color scales (empty, L1, L2, L3, L4)
const DARK_COLORS = [
  "rgba(255, 255, 255, 0.04)", // empty
  "#023430", // L1 — green.dark3
  "#00684A", // L2 — green.dark2
  "#00A35C", // L3 — green.dark1
  "#00ED64", // L4 — green.base
];

const LIGHT_COLORS = [
  "rgba(0, 0, 0, 0.03)", // empty
  "#C0FAE6", // L1 — green.light2
  "#71F6BA", // L2 — green.light1
  "#00A35C", // L3 — green.dark1
  "#00684A", // L4 — green.dark2
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function getColorLevel(count: number, maxCount: number): number {
  if (count === 0) return 0;
  if (maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function MemoryTimeline({ days, numDays = 90 }: MemoryTimelineProps) {
  const { darkMode } = useThemeMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    count: number;
  } | null>(null);

  // Build a lookup map: "YYYY-MM-DD" → count
  const dayMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of days) {
      map.set(d.date, d.count);
    }
    return map;
  }, [days]);

  // Generate the full grid of days
  const { cells, weeks, monthLabels, maxCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Walk backwards numDays from today
    const allDays: { date: string; count: number; dayOfWeek: number }[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      allDays.push({
        date: dateStr,
        count: dayMap.get(dateStr) || 0,
        dayOfWeek: d.getDay(), // 0 = Sun, 6 = Sat
      });
    }

    // Organize into weeks (columns)
    // First, pad the start so the first column begins on Sunday
    const firstDayOfWeek = allDays[0]?.dayOfWeek || 0;
    const paddedDays: (typeof allDays[0] | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      paddedDays.push(null);
    }
    paddedDays.push(...allDays);

    const weeksList: (typeof paddedDays)[] = [];
    for (let i = 0; i < paddedDays.length; i += 7) {
      weeksList.push(paddedDays.slice(i, i + 7));
    }

    // Month labels — detect month transitions
    const labels: { text: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeksList.length; w++) {
      const firstDay = weeksList[w].find((d) => d != null);
      if (firstDay) {
        const month = parseInt(firstDay.date.slice(5, 7), 10) - 1;
        if (month !== lastMonth) {
          labels.push({ text: MONTH_NAMES[month], weekIndex: w });
          lastMonth = month;
        }
      }
    }

    const max = Math.max(0, ...allDays.map((d) => d.count));

    return { cells: allDays, weeks: weeksList, monthLabels: labels, maxCount: max };
  }, [dayMap, numDays]);

  const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
  const totalWidth =
    DAY_LABEL_WIDTH + weeks.length * (CELL_SIZE + CELL_GAP) + CELL_GAP;
  const totalHeight =
    MONTH_LABEL_HEIGHT + 7 * (CELL_SIZE + CELL_GAP) + CELL_GAP;

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className={styles.svg}
      >
        {/* Month labels */}
        {monthLabels.map((ml) => (
          <text
            key={`month-${ml.weekIndex}`}
            x={DAY_LABEL_WIDTH + ml.weekIndex * (CELL_SIZE + CELL_GAP)}
            y={MONTH_LABEL_HEIGHT - 4}
            className={styles.monthLabel}
          >
            {ml.text}
          </text>
        ))}

        {/* Day labels (Mon, Wed, Fri) */}
        {DAY_LABELS.map(
          (label, i) =>
            label && (
              <text
                key={`day-${i}`}
                x={DAY_LABEL_WIDTH - 6}
                y={
                  MONTH_LABEL_HEIGHT +
                  i * (CELL_SIZE + CELL_GAP) +
                  CELL_SIZE / 2 +
                  4
                }
                className={styles.dayLabel}
              >
                {label}
              </text>
            ),
        )}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null;
            const level = getColorLevel(day.count, maxCount);
            const x =
              DAY_LABEL_WIDTH + wi * (CELL_SIZE + CELL_GAP) + CELL_GAP;
            const y =
              MONTH_LABEL_HEIGHT + di * (CELL_SIZE + CELL_GAP) + CELL_GAP;

            return (
              <rect
                key={day.date}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                ry={2}
                fill={colors[level]}
                className={styles.cell}
                style={{ animationDelay: `${wi * 15}ms` }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const containerRect =
                    containerRef.current?.getBoundingClientRect();
                  if (containerRect) {
                    setTooltip({
                      x: rect.left - containerRect.left + CELL_SIZE / 2,
                      y: rect.top - containerRect.top - 4,
                      date: day.date,
                      count: day.count,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          }),
        )}
      </svg>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Less</span>
        {colors.map((color, i) => (
          <div
            key={i}
            className={styles.legendCell}
            style={{ background: color }}
          />
        ))}
        <span className={styles.legendLabel}>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <strong>
            {tooltip.count} memor{tooltip.count === 1 ? "y" : "ies"}
          </strong>{" "}
          on {new Date(tooltip.date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}
