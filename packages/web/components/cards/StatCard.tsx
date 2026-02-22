"use client";

import { useThemeMode } from "@/contexts/ThemeContext";
import { GlassCard } from "./GlassCard";
import styles from "./StatCard.module.css";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export function StatCard({ icon, label, value, subtitle, color }: StatCardProps) {
  const { darkMode } = useThemeMode();
  const accentColor = color || "#00ED64";

  return (
    <GlassCard>
      <div className={styles.content}>
        <div
          className={styles.iconBox}
          style={{
            backgroundColor: `${accentColor}${darkMode ? "12" : "0c"}`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
        <div className={styles.info}>
          <div className={styles.label}>{label}</div>
          <div className={styles.value}>{value}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </div>
    </GlassCard>
  );
}
