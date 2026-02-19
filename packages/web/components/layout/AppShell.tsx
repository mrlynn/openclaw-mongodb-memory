"use client";

import { useState } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import { SIDEBAR_WIDTH } from "@/lib/constants";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isDark = theme.palette.mode === "dark";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          minHeight: "100vh",
          position: "relative",
          // Neural glow background in dark mode
          "&::before": isDark
            ? {
                content: '""',
                position: "fixed",
                top: 0,
                left: { md: `${SIDEBAR_WIDTH}px` },
                right: 0,
                height: "40vh",
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(0,229,255,0.04) 0%, transparent 70%)",
                pointerEvents: "none",
                zIndex: 0,
              }
            : {},
        }}
      >
        {/* Mobile top bar */}
        {!isDesktop && (
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              background: isDark
                ? "rgba(8, 12, 24, 0.9)"
                : "rgba(255,255,255,0.9)",
              backdropFilter: "blur(12px)",
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Toolbar>
              <IconButton
                edge="start"
                onClick={() => setMobileOpen(true)}
                sx={{ mr: 2, color: "text.primary" }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                OpenClaw
              </Typography>
            </Toolbar>
          </AppBar>
        )}

        {/* Page content */}
        <Box
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            position: "relative",
            zIndex: 1,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
