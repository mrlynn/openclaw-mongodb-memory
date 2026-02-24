"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import Icon from "@leafygreen-ui/icon";
import { useThemeMode } from "@/contexts/ThemeContext";
import { BackupSection } from "@/components/operations/BackupSection";
import { RestoreSection } from "@/components/operations/RestoreSection";
import { DatabaseStatsSection } from "@/components/operations/DatabaseStatsSection";
import { DecaySchedulerControls } from "@/components/operations/DecaySchedulerControls";
import { ReflectionPipelineControls } from "@/components/operations/ReflectionPipelineControls";
import { ConflictsContent } from "@/components/operations/ConflictsContent";
import { ExpirationContent } from "@/components/operations/ExpirationContent";
import { ReflectionJobsContent } from "@/components/operations/ReflectionJobsContent";
import styles from "./page.module.css";

const TAB_MAP: Record<string, number> = {
  conflicts: 1,
  expiration: 2,
  reflection: 3,
};

function OperationsContent() {
  const { darkMode } = useThemeMode();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam && TAB_MAP[tabParam]) || 0;
  const [selectedTab, setSelectedTab] = useState(initialTab);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Icon glyph="Apps" size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Operations</h2>
      </div>
      <p className={styles.description}>Backup, restore, and manage your memory database.</p>

      <Tabs
        aria-label="Operations"
        darkMode={darkMode}
        selected={selectedTab}
        onChange={setSelectedTab}
      >
        <Tab name="General">
          <div className={styles.sections}>
            <div className={styles.section}>
              <DatabaseStatsSection />
            </div>
            <div className={styles.section}>
              <ReflectionPipelineControls />
            </div>
            <div className={styles.section}>
              <DecaySchedulerControls />
            </div>
            <div className={styles.section}>
              <BackupSection />
            </div>
            <div className={styles.section}>
              <RestoreSection />
            </div>
          </div>
        </Tab>
        <Tab name="Conflicts">
          <ConflictsContent />
        </Tab>
        <Tab name="Expiration">
          <ExpirationContent />
        </Tab>
        <Tab name="Reflection Jobs">
          <ReflectionJobsContent />
        </Tab>
      </Tabs>
    </div>
  );
}

export default function OperationsPage() {
  return (
    <Suspense>
      <OperationsContent />
    </Suspense>
  );
}
