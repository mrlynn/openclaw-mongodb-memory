"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import Icon from "@leafygreen-ui/icon";
import { useThemeMode } from "@/contexts/ThemeContext";
import { BrowserContent } from "@/components/memories/BrowserContent";
import { TimelineContent } from "@/components/memories/TimelineContent";
import styles from "./page.module.css";

function MemoriesContent() {
  const { darkMode } = useThemeMode();
  const searchParams = useSearchParams();

  const viewParam = searchParams.get("view");
  const initialTab = viewParam === "timeline" ? 1 : 0;
  const [selectedTab, setSelectedTab] = useState(initialTab);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Icon glyph="Database" size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Memories</h2>
      </div>
      <p className={styles.description}>Browse, search, and manage all stored memories.</p>

      <Tabs
        aria-label="Memory views"
        darkMode={darkMode}
        selected={selectedTab}
        onChange={setSelectedTab}
      >
        <Tab name="Browser">
          <BrowserContent />
        </Tab>
        <Tab name="Timeline">
          <TimelineContent />
        </Tab>
      </Tabs>
    </div>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense>
      <MemoriesContent />
    </Suspense>
  );
}
