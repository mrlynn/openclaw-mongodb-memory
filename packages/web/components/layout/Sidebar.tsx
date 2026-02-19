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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Dashboard,
  SaveAlt,
  Search,
  Storage,
  Settings,
  HealthAndSafety,
} from "@mui/icons-material";
import { SIDEBAR_WIDTH, NAV_ITEMS } from "@/lib/constants";
import { ThemeToggle } from "./ThemeToggle";

const ICON_MAP: Record<string, React.ReactNode> = {
  Dashboard: <Dashboard />,
  SaveAlt: <SaveAlt />,
  Search: <Search />,
  Storage: <Storage />,
  HealthCheck: <HealthAndSafety />,
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
        py: 3,
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 3, mb: 4 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            fontSize: "1.05rem",
            letterSpacing: "-0.02em",
            color: "text.primary",
          }}
        >
          OpenClaw
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            display: "block",
            mt: 0.25,
            fontSize: "0.68rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Memory System
        </Typography>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 1.5, flex: 1 }}>
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
                borderRadius: 2.5,
                mb: 0.25,
                mx: 0.5,
                py: 1,
                px: 1.5,
                transition: "all 0.25s ease",
                "&.Mui-selected": {
                  background: isDark
                    ? "rgba(139, 156, 247, 0.08)"
                    : "rgba(91, 106, 191, 0.06)",
                  "& .MuiListItemIcon-root": {
                    color: "primary.main",
                  },
                  "& .MuiListItemText-primary": {
                    fontWeight: 500,
                    color: "primary.main",
                  },
                },
                "&:hover": {
                  background: isDark
                    ? "rgba(139, 156, 247, 0.05)"
                    : "rgba(0, 0, 0, 0.03)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: isActive ? "primary.main" : "text.disabled",
                  "& svg": { fontSize: 20 },
                }}
              >
                {ICON_MAP[item.icon]}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: "0.85rem",
                  letterSpacing: "-0.01em",
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* Footer */}
      <Box
        sx={{
          px: 3,
          pb: 1,
          pt: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${theme.palette.divider}`,
          mt: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: "text.disabled", fontSize: "0.65rem" }}
        >
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
