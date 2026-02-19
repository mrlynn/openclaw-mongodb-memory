"use client";

import {
  Box,
  Typography,
  Alert,
  Fade,
  Skeleton,
  Button,
  CardContent,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import Link from "next/link";
import {
  Storage,
  Timer,
  DataUsage,
  Wifi,
  WifiOff,
  LinkOff,
  Settings,
  Refresh,
} from "@mui/icons-material";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useStatus, DaemonStatus } from "@/hooks/useStatus";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatusIndicator } from "@/components/cards/StatusIndicator";
import { StatCard } from "@/components/cards/StatCard";
import { useTheme } from "@mui/material";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatMB(mb: number): string {
  return `${mb} MB`;
}

function mapStatus(value: string): "ready" | "error" | "unknown" {
  if (
    value === "running" ||
    value === "connected" ||
    value === "ready" ||
    value === "available"
  )
    return "ready";
  if (value === "error" || value === "disconnected") return "error";
  return "unknown";
}

function ServiceStatusPanel({ status }: { status: DaemonStatus }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const services = [
    { name: "Daemon", status: status.daemon },
    { name: "MongoDB", status: status.mongodb },
    { name: "Voyage AI", status: status.voyage },
  ];

  return (
    <GlassCard>
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: "text.disabled",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 500,
            fontSize: "0.68rem",
            mb: 2.5,
          }}
        >
          Service Health
        </Typography>
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {services.map((svc) => (
            <Box
              key={svc.name}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1,
                borderRadius: 2.5,
                background: isDark
                  ? "rgba(139,156,247,0.03)"
                  : "rgba(91,106,191,0.03)",
              }}
            >
              <StatusIndicator status={mapStatus(svc.status)} size="medium" />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {svc.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.disabled", textTransform: "capitalize", fontSize: "0.7rem" }}
                >
                  {svc.status}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </GlassCard>
  );
}

function HeapUsageBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? (used / total) * 100 : 0;
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <GlassCard>
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1.5,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.disabled",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 500,
              fontSize: "0.68rem",
            }}
          >
            Heap Memory Usage
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
            {formatMB(used)} / {formatMB(total)}
          </Typography>
        </Box>
        <Box
          sx={{
            width: "100%",
            height: 8,
            borderRadius: 4,
            bgcolor: isDark ? "rgba(180,188,208,0.06)" : "rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 4,
              background: "linear-gradient(90deg, #8b9cf7, #c4a7e7)",
              transition: "width 0.8s ease-out",
            }}
          />
        </Box>
        <Typography
          variant="caption"
          sx={{ color: "text.disabled", mt: 0.75, display: "block", fontSize: "0.7rem" }}
        >
          {percent.toFixed(1)}% utilized
        </Typography>
      </CardContent>
    </GlassCard>
  );
}

function DisconnectedState({ daemonUrl, onRetry }: { daemonUrl: string; onRetry: () => void }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <GlassCard
      glowColor="#e87878"
      sx={{
        border: isDark
          ? "1px solid rgba(232, 120, 120, 0.12)"
          : "1px solid rgba(196, 88, 88, 0.15)",
        animation: `${fadeInUp} 0.5s ease-out`,
      }}
    >
      <CardContent sx={{ p: 4, textAlign: "center" }}>
        <LinkOff
          sx={{
            fontSize: 48,
            color: "error.main",
            mb: 2,
            opacity: 0.7,
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Daemon Unreachable
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", mb: 0.5, maxWidth: 480, mx: "auto" }}
        >
          Could not connect to the memory daemon at:
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: "monospace",
            color: "primary.main",
            mb: 2.5,
            px: 2,
            py: 0.5,
            display: "inline-block",
            borderRadius: 1.5,
            bgcolor: isDark ? "rgba(139,156,247,0.06)" : "rgba(91,106,191,0.06)",
            fontSize: "0.82rem",
          }}
        >
          {daemonUrl}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", mb: 3, maxWidth: 480, mx: "auto" }}
        >
          Make sure the daemon is running, or update the URL in Settings if it is
          on a different host or port.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={onRetry}
          >
            Retry
          </Button>
          <Button
            variant="outlined"
            startIcon={<Settings />}
            component={Link}
            href="/settings"
          >
            Configure Connection
          </Button>
        </Box>
      </CardContent>
    </GlassCard>
  );
}

export default function DashboardPage() {
  const { daemonUrl } = useDaemonConfig();
  const { status, loading, error, refetch } = useStatus(daemonUrl);

  return (
    <Fade in timeout={400}>
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            mb: 3,
            letterSpacing: "-0.02em",
            animation: `${fadeInUp} 0.4s ease-out`,
          }}
        >
          Dashboard
        </Typography>

        {!loading && error && (
          <Box sx={{ mb: 3 }}>
            <DisconnectedState daemonUrl={daemonUrl} onRetry={refetch} />
          </Box>
        )}

        {loading ? (
          <Grid container spacing={3}>
            <Grid size={12}>
              <Skeleton
                variant="rounded"
                height={100}
                sx={{ borderRadius: 4.5 }}
              />
            </Grid>
            {[1, 2, 3, 4].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                <Skeleton
                  variant="rounded"
                  height={110}
                  sx={{ borderRadius: 4.5 }}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={3}>
            {/* Service Status */}
            {status && (
              <Grid
                size={12}
                sx={{ animation: `${fadeInUp} 0.4s ease-out 0.05s both` }}
              >
                <ServiceStatusPanel status={status} />
              </Grid>
            )}

            {/* Stats Row */}
            {status && (
              <>
                <Grid
                  size={{ xs: 12, sm: 6, md: 3 }}
                  sx={{ animation: `${fadeInUp} 0.4s ease-out 0.1s both` }}
                >
                  <StatCard
                    icon={<Storage />}
                    label="Total Memories"
                    value={status.stats.totalMemories.toLocaleString()}
                    color="#8b9cf7"
                  />
                </Grid>
                <Grid
                  size={{ xs: 12, sm: 6, md: 3 }}
                  sx={{ animation: `${fadeInUp} 0.4s ease-out 0.15s both` }}
                >
                  <StatCard
                    icon={<Timer />}
                    label="Uptime"
                    value={formatUptime(status.uptime)}
                    color="#c4a7e7"
                  />
                </Grid>
                <Grid
                  size={{ xs: 12, sm: 6, md: 3 }}
                  sx={{ animation: `${fadeInUp} 0.4s ease-out 0.2s both` }}
                >
                  <StatCard
                    icon={<DataUsage />}
                    label="Heap Used"
                    value={formatMB(status.memory.heapUsed)}
                    subtitle={`of ${formatMB(status.memory.heapTotal)}`}
                    color="#d4a76a"
                  />
                </Grid>
                <Grid
                  size={{ xs: 12, sm: 6, md: 3 }}
                  sx={{ animation: `${fadeInUp} 0.4s ease-out 0.25s both` }}
                >
                  <StatCard
                    icon={error ? <WifiOff /> : <Wifi />}
                    label="Connection"
                    value={error ? "Offline" : "Connected"}
                    subtitle={daemonUrl}
                    color={error ? "#e87878" : "#7ec8a4"}
                  />
                </Grid>

                {/* Heap Usage Bar */}
                <Grid
                  size={12}
                  sx={{ animation: `${fadeInUp} 0.4s ease-out 0.3s both` }}
                >
                  <HeapUsageBar
                    used={status.memory.heapUsed}
                    total={status.memory.heapTotal}
                  />
                </Grid>
              </>
            )}
          </Grid>
        )}
      </Box>
    </Fade>
  );
}
