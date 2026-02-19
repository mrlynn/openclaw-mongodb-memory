"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Dashboard,
  SaveAlt,
  Search,
  Storage,
  Settings,
  Hub,
} from "@mui/icons-material";
import { SIDEBAR_WIDTH, NAV_ITEMS } from "@/lib/constants";
import { ThemeToggle } from "./ThemeToggle";

const ICON_MAP: Record<string, React.ReactNode> = {
  Dashboard: <Dashboard />,
  SaveAlt: <SaveAlt />,
  Search: <Search />,
  Storage: <Storage />,
  Settings: <Settings />,
};

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarContent() {
  const pathname = usePathname();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        py: 2,
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Hub
            sx={{
              fontSize: 32,
              color: "primary.main",
              filter: isDark ? "drop-shadow(0 0 8px rgba(0,229,255,0.5))" : "none",
            }}
          />
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: "1.1rem",
                background: isDark
                  ? "linear-gradient(135deg, #00e5ff, #d500f9)"
                  : "none",
                backgroundClip: isDark ? "text" : "unset",
                WebkitBackgroundClip: isDark ? "text" : "unset",
                WebkitTextFillColor: isDark ? "transparent" : "unset",
              }}
            >
              OpenClaw
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block", mt: -0.5 }}
            >
              Memory System
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mx: 2, mb: 1 }} />

      {/* Navigation */}
      <List sx={{ px: 1, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.path ||
            (item.path === "/dashboard" && pathname === "/");
          return (
            <ListItemButton
              key={item.path}
              component={Link}
              href={item.path}
              selected={isActive}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                mx: 1,
                transition: "all 0.2s ease",
                "&.Mui-selected": {
                  background: isDark
                    ? "rgba(0, 229, 255, 0.1)"
                    : "rgba(0, 151, 167, 0.1)",
                  borderLeft: `3px solid ${theme.palette.primary.main}`,
                  "& .MuiListItemIcon-root": {
                    color: "primary.main",
                  },
                  "& .MuiListItemText-primary": {
                    fontWeight: 600,
                    color: "primary.main",
                  },
                },
                "&:hover": {
                  background: isDark
                    ? "rgba(0, 229, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActive ? "primary.main" : "text.secondary",
                }}
              >
                {ICON_MAP[item.icon]}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: "0.9rem",
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ mx: 2, mb: 1 }} />

      {/* Footer */}
      <Box sx={{ px: 3, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          v0.1.0
        </Typography>
        <ThemeToggle />
      </Box>
    </Box>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  if (isDesktop) {
    return (
      <Drawer
        variant="permanent"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        <SidebarContent />
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={onMobileClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        "& .MuiDrawer-paper": {
          width: SIDEBAR_WIDTH,
          boxSizing: "border-box",
        },
      }}
    >
      <SidebarContent />
    </Drawer>
  );
}
