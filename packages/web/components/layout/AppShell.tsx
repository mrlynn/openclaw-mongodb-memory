"use client";

import { useState } from "react";
import Image from "next/image";
import IconButton from "@leafygreen-ui/icon-button";
import Icon from "@leafygreen-ui/icon";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useThemeMode } from "@/contexts/ThemeContext";
import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const { darkMode } = useThemeMode();

  return (
    <div className={styles.shell}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <main className={styles.main}>
        {/* Mobile top bar */}
        {!isDesktop && (
          <header className={styles.mobileHeader}>
            <IconButton
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              darkMode={darkMode}
            >
              <Icon glyph="Menu" />
            </IconButton>
            <Image
              src="/ocmem-trans-1024x1024.png"
              alt="OpenClaw logo"
              width={28}
              height={28}
              style={{ borderRadius: 6 }}
            />
            <span className={styles.mobileTitle}>OpenClaw</span>
          </header>
        )}

        {/* Page content */}
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
