"use client";

import { useEffect, useState } from "react";
import {
  Box,
  CardContent,
  LinearProgress,
  Typography,
  Chip,
  Stack,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  WarningAmber as WarningIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { GlassCard } from "@/components/cards/GlassCard";
import {
  HealthStatus,
  OpenClawIntegrationStatus,
  fetchHealth,
  fetchOpenClawIntegrationStatus,
} from "@/lib/health-api";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        color: "text.disabled",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 500,
        fontSize: "0.68rem",
        display: "block",
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

export function HealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [integrationStatus, setIntegrationStatus] =
    useState<OpenClawIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const loadData = async () => {
    try {
      const [healthData, integrationData] = await Promise.all([
        fetchHealth(),
        fetchOpenClawIntegrationStatus(),
      ]);

      setHealth(healthData);
      setIntegrationStatus(integrationData);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(`Failed to load health data: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircleIcon sx={{ color: "success.main", fontSize: 20 }} />;
      case "degraded":
        return <WarningIcon sx={{ color: "warning.main", fontSize: 20 }} />;
      case "unhealthy":
        return <ErrorIcon sx={{ color: "error.main", fontSize: 20 }} />;
      default:
        return <InfoIcon sx={{ fontSize: 20 }} />;
    }
  };

  const getStatusColor = (
    status: string
  ): "success" | "warning" | "error" | "default" => {
    switch (status) {
      case "healthy":
        return "success";
      case "degraded":
        return "warning";
      case "unhealthy":
        return "error";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress size={32} sx={{ color: "primary.main" }} />
      </Box>
    );
  }

  if (error && !health) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      {lastUpdate && (
        <Typography variant="caption" sx={{ color: "text.disabled", mb: 3, display: "block", fontSize: "0.7rem" }}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </Typography>
      )}

      <Grid container spacing={3}>
        {/* Overall Status */}
        <Grid size={12}>
          <GlassCard>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                {getStatusIcon(health?.status || "unhealthy")}
                <Typography variant="h6" sx={{ fontWeight: 500 }}>
                  Overall Status
                </Typography>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip
                  label={health?.status.toUpperCase() || "UNKNOWN"}
                  color={getStatusColor(health?.status || "unhealthy")}
                  variant="outlined"
                  size="small"
                />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {health?.checks
                    ? `MongoDB: ${health.checks.mongodb ? "Ok" : "Fail"} | Voyage: ${health.checks.voyage ? "Ok" : "Fail"} | Memory: ${health.checks.memory ? "Ok" : "Fail"}`
                    : "No data"}
                </Typography>
              </Stack>
            </CardContent>
          </GlassCard>
        </Grid>

        {/* Daemon Uptime & Performance */}
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>
                Daemon Status
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <SectionLabel>Uptime</SectionLabel>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {health ? `${Math.floor(health.uptime)}s` : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <SectionLabel>Response Time</SectionLabel>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {health ? `${health.responseTime}ms` : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <SectionLabel>Node Version</SectionLabel>
                  <Typography variant="body2">{health?.system.nodeVersion}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </GlassCard>
        </Grid>

        {/* Memory Usage */}
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>
                Heap Memory Usage
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <SectionLabel>Heap Used</SectionLabel>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {health?.memory.heapUsed}MB / {health?.memory.heapTotal}MB
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={
                      health
                        ? (health.memory.heapUsed / health.memory.heapTotal) * 100
                        : 0
                    }
                    color={
                      health &&
                      health.memory.heapUsed / health.memory.heapTotal > 0.9
                        ? "error"
                        : "primary"
                    }
                    sx={{ borderRadius: 4, height: 6 }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: "text.disabled" }}>
                  External: {health?.memory.external}MB
                </Typography>
              </Stack>
            </CardContent>
          </GlassCard>
        </Grid>

        {/* Database Status */}
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                {getStatusIcon(health?.database.connected ? "healthy" : "unhealthy")}
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  MongoDB Connection
                </Typography>
              </Box>
              <Stack spacing={2}>
                <Box>
                  <SectionLabel>Status</SectionLabel>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {health?.database.connected ? "Connected" : "Disconnected"}
                  </Typography>
                </Box>
                <Box>
                  <SectionLabel>Response Time</SectionLabel>
                  <Typography variant="body2">
                    {health?.database.responseTime}ms
                  </Typography>
                </Box>
                <Box>
                  <SectionLabel>Total Memories</SectionLabel>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    {health?.database.memoriesCount || 0}
                  </Typography>
                </Box>
                {health?.database.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {health.database.error}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </GlassCard>
        </Grid>

        {/* Voyage Configuration */}
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                {getStatusIcon(health?.voyage.configured ? "healthy" : "unhealthy")}
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Voyage Embeddings
                </Typography>
              </Box>
              <Stack spacing={2}>
                <Box>
                  <SectionLabel>Mode</SectionLabel>
                  <Chip
                    label={health?.voyage.mode === "mock" ? "Mock (Testing)" : "Real (Production)"}
                    color={health?.voyage.mode === "mock" ? "warning" : "success"}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Box>
                  <SectionLabel>Endpoint</SectionLabel>
                  <Typography variant="body2" sx={{ wordBreak: "break-all", color: "text.secondary" }}>
                    {health?.voyage.endpoint}
                  </Typography>
                </Box>
                <Box>
                  <SectionLabel>Configured</SectionLabel>
                  <Typography variant="body2">
                    {health?.voyage.configured ? "Yes" : "No"}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </GlassCard>
        </Grid>

        {/* OpenClaw Integration Status */}
        {integrationStatus && (
          <Grid size={12}>
            <GlassCard>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  {getStatusIcon(integrationStatus.status)}
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    OpenClaw Integration Status
                  </Typography>
                </Box>
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Chip
                      label={integrationStatus.status.toUpperCase()}
                      color={getStatusColor(integrationStatus.status)}
                      variant="outlined"
                      size="small"
                    />
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {integrationStatus.status === "integrated"
                        ? "Memory system fully integrated"
                        : integrationStatus.status === "partial"
                          ? "Daemon running but not fully integrated"
                          : "Daemon not accessible"}
                    </Typography>
                  </Box>

                  <TableContainer
                    sx={{
                      borderRadius: 2.5,
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: isDark ? "rgba(139,156,247,0.02)" : "rgba(0,0,0,0.01)",
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 500, fontSize: "0.78rem" }}>Check</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 500, fontSize: "0.78rem" }}>Status</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 500, fontSize: "0.78rem" }}>Details</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>Daemon Accessible</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={integrationStatus.details.daemonAccessible ? "Ok" : "Fail"}
                              color={integrationStatus.details.daemonAccessible ? "success" : "error"}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: "0.68rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {integrationStatus.details.daemonResponseTime}ms
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Memory Storage</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={integrationStatus.details.memoryStorageWorking ? "Ok" : "Fail"}
                              color={integrationStatus.details.memoryStorageWorking ? "success" : "error"}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: "0.68rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {integrationStatus.details.memoryStorageWorking
                              ? "Working"
                              : "Failed"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>In OpenClaw Config</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={integrationStatus.details.daemonInOpenClawConfig ? "Ok" : "Missing"}
                              color={integrationStatus.details.daemonInOpenClawConfig ? "success" : "warning"}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: "0.68rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {integrationStatus.details.daemonInOpenClawConfig
                              ? "Configured"
                              : "Not configured"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Agent Context</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={integrationStatus.details.agentContextInitialized ? "Ok" : "Pending"}
                              color={integrationStatus.details.agentContextInitialized ? "success" : "warning"}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: "0.68rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {integrationStatus.details.agentContextInitialized
                              ? "Ready"
                              : "Not initialized"}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </CardContent>
            </GlassCard>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
