export const STORAGE_KEYS = {
  THEME_MODE: "openclaw-theme-mode",
  DAEMON_URL: "openclaw-daemon-url",
  AGENT_ID: "openclaw-agent-id",
} as const;

export const DEFAULT_DAEMON_URL = "http://localhost:7654";
export const STATUS_POLL_INTERVAL = 5000;
export const SIDEBAR_WIDTH = 260;

export const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: "Dashboard" },
  { label: "Remember", path: "/remember", icon: "Download" },
  { label: "Recall", path: "/recall", icon: "MagnifyingGlass" },
  { label: "Memory Chat", path: "/chat", icon: "Support" },
  { label: "Memory Browser", path: "/browser", icon: "Database" },
  { label: "Documentation", path: "/docs", icon: "University" },
  { label: "Health & Integration", path: "/health", icon: "Gauge" },
  { label: "Settings", path: "/settings", icon: "Settings" },
] as const;
