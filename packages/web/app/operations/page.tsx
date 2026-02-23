"use client";

import Icon from "@leafygreen-ui/icon";
import { BackupSection } from "@/components/operations/BackupSection";
import { RestoreSection } from "@/components/operations/RestoreSection";
import { DatabaseStatsSection } from "@/components/operations/DatabaseStatsSection";
import styles from "./page.module.css";

export default function OperationsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Icon glyph="Apps" size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Operations</h2>
      </div>
      <p className={styles.description}>Backup, restore, and manage your memory database.</p>

      <div className={styles.sections}>
        <div className={styles.section}>
          <DatabaseStatsSection />
        </div>
        <div className={styles.section}>
          <BackupSection />
        </div>
        <div className={styles.section}>
          <RestoreSection />
        </div>
      </div>
    </div>
  );
}
