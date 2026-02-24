"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Icon from "@leafygreen-ui/icon";
import { Body } from "@leafygreen-ui/typography";
import { SIDEBAR_WIDTH, NAV_ITEMS } from "@/lib/constants";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useRememberModal } from "@/contexts/RememberModalContext";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { darkMode } = useThemeMode();
  const { openRememberModal } = useRememberModal();

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
          <Image
            src="/mongodb-icon.svg"
            alt=""
            width={12}
            height={12}
            aria-hidden="true"
          />
          <span>Powered by MongoDB</span>
        </a>
      </div>

      {/* Remember action button */}
      <div className={styles.rememberWrapper}>
        <button
          className={styles.rememberButton}
          onClick={() => {
            openRememberModal();
            onNavigate?.();
          }}
        >
          <Icon glyph="Plus" size={16} />
          Remember
        </button>
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
