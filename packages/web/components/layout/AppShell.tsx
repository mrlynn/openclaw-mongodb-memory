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
          "&::before": isDark
            ? {
                content: '""',
                position: "fixed",
                top: 0,
                left: { md: `${SIDEBAR_WIDTH}px` },
                right: 0,
                height: "50vh",
                background:
                  "radial-gradient(ellipse at 30% 0%, rgba(139,156,247,0.025) 0%, transparent 60%), radial-gradient(ellipse at 70% 10%, rgba(196,167,231,0.015) 0%, transparent 50%)",
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
                ? "rgba(15, 17, 23, 0.85)"
                : "rgba(248,249,252,0.85)",
              backdropFilter: "blur(16px) saturate(1.2)",
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
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, letterSpacing: "-0.02em" }}
              >
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
            maxWidth: 1400,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
