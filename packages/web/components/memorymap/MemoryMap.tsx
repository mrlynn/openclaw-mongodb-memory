"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useThemeMode } from "@/contexts/ThemeContext";
import type { MemoryMapPoint } from "@/lib/api";
import styles from "./MemoryMap.module.css";

interface MemoryMapProps {
  points: MemoryMapPoint[];
  onPointClick?: (text: string) => void;
}

// MongoDB brand palette for scatter dots — maps index to color
const DARK_COLORS = [
  "#00ED64", // green.base
  "#71F6BA", // green.light1
  "#016BF8", // blue.base
  "#C3E7FE", // blue.light2
  "#00A35C", // green.dark1
  "#FFC010", // yellow.base
  "#C0FAE6", // green.light2
  "#B8C4C2", // gray.light1
];

const LIGHT_COLORS = [
  "#00684A", // green.dark2
  "#00A35C", // green.dark1
  "#016BF8", // blue.base
  "#1A567E", // blue.dark2
  "#023430", // green.dark3
  "#944F01", // yellow.dark2
  "#3D4F58", // gray.dark2
  "#00684A", // green.dark2
];

const MAP_HEIGHT = 400;
const DOT_RADIUS = 5;
const PADDING = 40;

export function MemoryMap({ points, onPointClick }: MemoryMapProps) {
  const { darkMode } = useThemeMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    point: MemoryMapPoint;
  } | null>(null);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width > 0) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Map normalized [-1, 1] coordinates to SVG pixel space
  const toPixel = useCallback(
    (x: number, y: number): [number, number] => {
      const plotW = containerWidth - PADDING * 2;
      const plotH = MAP_HEIGHT - PADDING * 2;
      return [
        PADDING + ((x + 1) / 2) * plotW,
        PADDING + ((1 - y) / 2) * plotH, // invert Y for screen coords
      ];
    },
    [containerWidth],
  );

  const palette = darkMode ? DARK_COLORS : LIGHT_COLORS;

  // Grid lines
  const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let t = 0; t <= 4; t++) {
    const frac = t / 4;
    const px = PADDING + frac * (containerWidth - PADDING * 2);
    const py = PADDING + frac * (MAP_HEIGHT - PADDING * 2);
    gridLines.push({ x1: px, y1: PADDING, x2: px, y2: MAP_HEIGHT - PADDING });
    gridLines.push({
      x1: PADDING,
      y1: py,
      x2: containerWidth - PADDING,
      y2: py,
    });
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        width={containerWidth}
        height={MAP_HEIGHT}
        viewBox={`0 0 ${containerWidth} ${MAP_HEIGHT}`}
        className={styles.svg}
      >
        {/* Grid */}
        {gridLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className={styles.gridLine}
          />
        ))}

        {/* Dots */}
        {points.map((point, i) => {
          const [px, py] = toPixel(point.x, point.y);
          const color = palette[i % palette.length];
          const r = DOT_RADIUS + Math.min(point.tags.length, 3);

          return (
            <circle
              key={point.id}
              cx={px}
              cy={py}
              r={r}
              fill={color}
              className={styles.dot}
              style={{ animationDelay: `${i * 8}ms` }}
              onClick={() => {
                // Use first 60 chars as query
                const q =
                  point.text.length > 60
                    ? point.text.slice(0, 60)
                    : point.text;
                onPointClick?.(q);
              }}
              onMouseEnter={(e) => {
                const svgRect = e.currentTarget
                  .closest("svg")
                  ?.getBoundingClientRect();
                if (svgRect) {
                  setTooltip({
                    x: px,
                    y: py,
                    point,
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <title>
                {point.text.slice(0, 100)}
                {point.text.length > 100 ? "..." : ""}
              </title>
            </circle>
          );
        })}
      </svg>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(
              tooltip.x,
              containerWidth - 260,
            ),
            top: tooltip.y > MAP_HEIGHT / 2 ? tooltip.y - 80 : tooltip.y + 20,
          }}
        >
          <div className={styles.tooltipText}>
            {tooltip.point.text.slice(0, 120)}
            {tooltip.point.text.length > 120 ? "..." : ""}
          </div>
          {tooltip.point.tags.length > 0 && (
            <div className={styles.tooltipTags}>
              {tooltip.point.tags.slice(0, 5).map((tag) => (
                <span key={tag} className={styles.tooltipTag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className={styles.tooltipDate}>
            {new Date(tooltip.point.createdAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
