export const STORAGE_KEYS = {
  THEME_MODE: "openclaw-theme-mode",
  DAEMON_URL: "openclaw-daemon-url",
  AGENT_ID: "openclaw-agent-id",
} as const;

export const DEFAULT_DAEMON_URL = "http://localhost:7654";
export const STATUS_POLL_INTERVAL = 5000;
export const SIDEBAR_WIDTH = 260;

export const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: "Dashboard" as const },
  { label: "Remember", path: "/remember", icon: "SaveAlt" as const },
  { label: "Recall", path: "/recall", icon: "Search" as const },
  { label: "Memory Browser", path: "/browser", icon: "Storage" as const },
  { label: "Health & Integration", path: "/health", icon: "HealthCheck" as const },
  { label: "Settings", path: "/settings", icon: "Settings" as const },
] as const;
