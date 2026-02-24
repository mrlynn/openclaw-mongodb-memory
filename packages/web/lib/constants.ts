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
  { label: "Search", path: "/search", icon: "MagnifyingGlass" },
  { label: "Chat", path: "/chat", icon: "Support" },
  { label: "Memories", path: "/memories", icon: "Database" },
  { label: "Graph", path: "/graph", icon: "Diagram3" },
  { label: "Usage & Cost", path: "/usage", icon: "ActivityFeed" },
  { label: "Operations", path: "/operations", icon: "Apps" },
  { label: "Settings", path: "/settings", icon: "Settings" },
] as const;
