"use client";

import { useEffect, useRef, useState } from "react";
import cloud from "d3-cloud";
import { useThemeMode } from "@/contexts/ThemeContext";
import styles from "./WordCloud.module.css";

export interface WordItem {
  text: string;
  count: number;
  frequency: number;
}

interface LayoutWord {
  text: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  count: number;
}

interface WordCloudProps {
  words: WordItem[];
  onWordClick?: (word: string) => void;
}

// MongoDB brand palette — dark mode uses brighter tones, light mode uses deeper
const DARK_PALETTE = [
  "#00ED64", // green.base
  "#71F6BA", // green.light1
  "#016BF8", // blue.base
  "#C3E7FE", // blue.light2
  "#00A35C", // green.dark1
  "#B8C4C2", // gray.light1
  "#FFC010", // yellow.base
  "#C0FAE6", // green.light2
];

const LIGHT_PALETTE = [
  "#00684A", // green.dark2
  "#00A35C", // green.dark1
  "#1A567E", // blue.dark2
  "#016BF8", // blue.base
  "#023430", // green.dark3
  "#3D4F58", // gray.dark2
  "#944F01", // yellow.dark2
  "#00684A", // green.dark2
];

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 72;
const CLOUD_HEIGHT = 480;

export function WordCloud({ words, onWordClick }: WordCloudProps) {
  const { darkMode } = useThemeMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutWords, setLayoutWords] = useState<LayoutWord[]>([]);
  const [containerWidth, setContainerWidth] = useState(700);

  // Track container width for responsive layout
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

  // Run d3-cloud layout whenever words, dimensions, or theme change
  useEffect(() => {
    if (words.length === 0) {
      setLayoutWords([]);
      return;
    }

    const palette = darkMode ? DARK_PALETTE : LIGHT_PALETTE;

    const layout = cloud<cloud.Word & { count: number; color: string }>()
      .size([containerWidth, CLOUD_HEIGHT])
      .words(
        words.map((w, i) => ({
          text: w.text,
          size: MIN_FONT_SIZE + w.frequency * (MAX_FONT_SIZE - MIN_FONT_SIZE),
          count: w.count,
          color: palette[i % palette.length],
        })),
      )
      .padding(5)
      .rotate(() => {
        const r = Math.random();
        if (r < 0.65) return 0;
        return r < 0.825 ? 90 : -90;
      })
      .font("'Euclid Circular A', 'Helvetica Neue', Helvetica, Arial, sans-serif")
      .fontSize((d) => d.size!)
      .spiral("archimedean")
      .on("end", (output) => {
        setLayoutWords(
          output.map((d) => ({
            text: d.text!,
            size: d.size!,
            x: d.x!,
            y: d.y!,
            rotate: d.rotate!,
            color: (d as cloud.Word & { color: string }).color,
            count: (d as cloud.Word & { count: number }).count,
          })),
        );
      });

    layout.start();
  }, [words, containerWidth, darkMode]);

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        width={containerWidth}
        height={CLOUD_HEIGHT}
        viewBox={`0 0 ${containerWidth} ${CLOUD_HEIGHT}`}
        className={styles.svg}
      >
        <g transform={`translate(${containerWidth / 2}, ${CLOUD_HEIGHT / 2})`}>
          {layoutWords.map((word, i) => (
            <text
              key={`${word.text}-${i}`}
              className={styles.word}
              textAnchor="middle"
              transform={`translate(${word.x}, ${word.y}) rotate(${word.rotate})`}
              style={{
                fontSize: word.size,
                fill: word.color,
                animationDelay: `${i * 15}ms`,
                cursor: onWordClick ? "pointer" : "default",
              }}
              onClick={() => onWordClick?.(word.text)}
            >
              <title>{`"${word.text}" — ${word.count} occurrence${word.count !== 1 ? "s" : ""}`}</title>
              {word.text}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
