"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Icon from "@leafygreen-ui/icon";
import { Body } from "@leafygreen-ui/typography";
import { SIDEBAR_WIDTH, NAV_ITEMS } from "@/lib/constants";
import { useThemeMode } from "@/contexts/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { darkMode } = useThemeMode();

  return (
    <div className={styles.container}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoRow}>
          <Image
            src="/ocmem-trans-1024x1024.png"
            alt="OpenClaw logo"
            width={36}
            height={36}
            className={styles.logoImage}
          />
          <div>
            <div className={styles.logoTitle}>OpenClaw</div>
            <span className={styles.logoSubtitle}>Memory System</span>
          </div>
        </div>
        <a
          href="https://mongodb.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.poweredBy}
          title="Built with MongoDB"
        >
          <svg width="12" height="12" viewBox="0 0 15 32" fill="currentColor" aria-hidden="true">
            <path d="M8.1 28.5c-.3-1.7-.5-3.4-.5-3.4s-3.2-2.1-3.7-5.7c-.5-3.5.6-5.3 1.6-7.3C6.9 9.6 7.8 7.2 7.7 4c0 0 1.2 1.6 1.5 2.8.8 2.7-.2 4.8-.2 4.8s1.3-.8 2-2.8c.3-.9.2-2.1.2-2.1s1.1 1.7 1.1 3.7c0 2.5-1.4 4-2.1 5.8-.7 1.7-.5 3.7-.5 3.7s.1 2.4.1 4.7c0 1.3-.1 2.6-.2 3.9h-1.5z" />
          </svg>
          <span>Powered by MongoDB</span>
        </a>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.path || (item.path === "/dashboard" && pathname === "/");
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={onNavigate}
              className={`${styles.navLink} ${isActive ? styles.active : ""}`}
            >
              <span className={styles.navIcon}>
                <Icon glyph={item.icon as any} size={18} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.version}>v0.1.0</span>
        <ThemeToggle />
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: persistent sidebar */}
      <div className={styles.desktopDrawer} style={{ width: SIDEBAR_WIDTH }}>
        <SidebarContent />
      </div>

      {/* Mobile: overlay + slide-in drawer */}
      <div
        className={`${styles.mobileOverlay} ${mobileOpen ? styles.open : ""}`}
        onClick={onMobileClose}
      />
      <div
        className={`${styles.mobileDrawer} ${mobileOpen ? styles.open : ""}`}
        style={{ width: SIDEBAR_WIDTH }}
      >
        <SidebarContent onNavigate={onMobileClose} />
      </div>
    </>
  );
}
