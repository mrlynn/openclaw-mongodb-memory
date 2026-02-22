"use client";

import { HealthDashboard } from "@/components/health/HealthDashboard";
import styles from "./page.module.css";

export default function HealthPage() {
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>System Health & Integration</h2>
      <p className={styles.description}>
        Real-time monitoring of memory daemon health and OpenClaw integration
        status
      </p>
      <HealthDashboard />
    </div>
  );
}
