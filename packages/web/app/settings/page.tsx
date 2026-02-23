"use client";

import Icon from "@leafygreen-ui/icon";
import { DaemonUrlConfig } from "@/components/settings/DaemonUrlConfig";
import { DangerZone } from "@/components/settings/DangerZone";
import styles from "./page.module.css";

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Icon glyph="Settings" size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Settings</h2>
      </div>
      <p className={styles.description}>
        Configure the daemon connection and manage system settings.
      </p>

      <div className={styles.sections}>
        <div className={styles.section}>
          <DaemonUrlConfig />
        </div>
        <div className={styles.section}>
          <DangerZone />
        </div>
      </div>
    </div>
  );
}
