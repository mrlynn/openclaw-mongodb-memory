"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import Icon from "@leafygreen-ui/icon";
import { useThemeMode } from "@/contexts/ThemeContext";
import { DaemonUrlConfig } from "@/components/settings/DaemonUrlConfig";
import { DangerZone } from "@/components/settings/DangerZone";
import { HealthDashboard } from "@/components/health/HealthDashboard";
import { DocsContent } from "@/components/settings/DocsContent";
import { SemanticConfig } from "@/components/settings/SemanticConfig";
import styles from "./page.module.css";

const TAB_MAP: Record<string, number> = {
  semantic: 1,
  health: 2,
  docs: 3,
};

function SettingsContent() {
  const { darkMode } = useThemeMode();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam && TAB_MAP[tabParam]) || 0;
  const [selectedTab, setSelectedTab] = useState(initialTab);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Icon glyph="Settings" size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Settings</h2>
      </div>
      <p className={styles.description}>
        Configure the daemon connection and manage system settings.
      </p>

      <Tabs
        aria-label="Settings"
        darkMode={darkMode}
        selected={selectedTab}
        onChange={setSelectedTab}
      >
        <Tab name="Configuration">
          <div className={styles.sections}>
            <div className={styles.section}>
              <DaemonUrlConfig />
            </div>
            <div className={styles.section}>
              <DangerZone />
            </div>
          </div>
        </Tab>
        <Tab name="Semantic / LLM">
          <div className={styles.sections}>
            <div className={styles.section}>
              <SemanticConfig />
            </div>
          </div>
        </Tab>
        <Tab name="Health">
          <HealthDashboard />
        </Tab>
        <Tab name="Documentation">
          <DocsContent />
        </Tab>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
