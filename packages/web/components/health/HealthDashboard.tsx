"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
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
  Paper,
  CircularProgress,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import {
  HealthStatus,
  OpenClawIntegrationStatus,
  fetchHealth,
  fetchOpenClawIntegrationStatus,
} from "@/lib/health-api";

export function HealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [integrationStatus, setIntegrationStatus] =
    useState<OpenClawIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircleIcon sx={{ color: "success.main" }} />;
      case "degraded":
        return <WarningIcon sx={{ color: "warning.main" }} />;
      case "unhealthy":
        return <ErrorIcon sx={{ color: "error.main" }} />;
      default:
        return <InfoIcon />;
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
        <CircularProgress />
      </Box>
    );
  }

  if (error && !health) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        🧠 Memory System Health
      </Typography>

      {lastUpdate && (
        <Typography variant="caption" color="textSecondary" sx={{ mb: 2 }}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </Typography>
      )}

      <Grid container spacing={3}>
        {/* Overall Status */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Overall Status"
              avatar={getStatusIcon(health?.status || "unhealthy")}
            />
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip
                  label={health?.status.toUpperCase() || "UNKNOWN"}
                  color={getStatusColor(health?.status || "unhealthy")}
                  variant="outlined"
                />
                <Typography variant="body2" color="textSecondary">
                  {health?.checks
                    ? `MongoDB: ${health.checks.mongodb ? "✓" : "✗"} | Voyage: ${health.checks.voyage ? "✓" : "✗"} | Memory: ${health.checks.memory ? "✓" : "✗"}`
                    : "No data"}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Daemon Uptime & Performance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Daemon Status" />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Uptime
                  </Typography>
                  <Typography variant="h6">
                    {health ? `${Math.floor(health.uptime)}s` : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Response Time
                  </Typography>
                  <Typography variant="h6">
                    {health ? `${health.responseTime}ms` : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Node Version
                  </Typography>
                  <Typography variant="body2">{health?.system.nodeVersion}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Usage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Heap Memory Usage" />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption">Heap Used</Typography>
                    <Typography variant="caption">
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
                  />
                </Box>
                <Typography variant="caption" color="textSecondary">
                  External: {health?.memory.external}MB
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Database Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="MongoDB Connection"
              avatar={getStatusIcon(health?.database.connected ? "healthy" : "unhealthy")}
            />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Status
                  </Typography>
                  <Typography variant="h6">
                    {health?.database.connected ? "Connected ✓" : "Disconnected ✗"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Response Time
                  </Typography>
                  <Typography variant="body2">
                    {health?.database.responseTime}ms
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Total Memories
                  </Typography>
                  <Typography variant="h6">
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
          </Card>
        </Grid>

        {/* Voyage Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Voyage Embeddings"
              avatar={getStatusIcon(health?.voyage.configured ? "healthy" : "unhealthy")}
            />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Mode
                  </Typography>
                  <Chip
                    label={health?.voyage.mode === "mock" ? "Mock (Testing)" : "Real (Production)"}
                    color={health?.voyage.mode === "mock" ? "warning" : "success"}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Endpoint
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    {health?.voyage.endpoint}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    Configured
                  </Typography>
                  <Typography variant="body2">
                    {health?.voyage.configured ? "Yes ✓" : "No ✗"}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* OpenClaw Integration Status */}
        {integrationStatus && (
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="OpenClaw Integration Status"
                avatar={getStatusIcon(integrationStatus.status)}
              />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Chip
                      label={integrationStatus.status.toUpperCase()}
                      color={getStatusColor(integrationStatus.status)}
                      variant="outlined"
                    />
                    <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                      {integrationStatus.status === "integrated"
                        ? "Memory system fully integrated"
                        : integrationStatus.status === "partial"
                          ? "Daemon running but not fully integrated"
                          : "Daemon not accessible"}
                    </Typography>
                  </Box>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                          <TableCell>Check</TableCell>
                          <TableCell align="right">Status</TableCell>
                          <TableCell align="right">Details</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>Daemon Accessible</TableCell>
                          <TableCell align="right">
                            {integrationStatus.details.daemonAccessible ? "✓" : "✗"}
                          </TableCell>
                          <TableCell align="right">
                            {integrationStatus.details.daemonResponseTime}ms
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Memory Storage</TableCell>
                          <TableCell align="right">
                            {integrationStatus.details.memoryStorageWorking ? "✓" : "✗"}
                          </TableCell>
                          <TableCell align="right">
                            {integrationStatus.details.memoryStorageWorking
                              ? "Working"
                              : "Failed"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>In OpenClaw Config</TableCell>
                          <TableCell align="right">
                            {integrationStatus.details.daemonInOpenClawConfig ? "✓" : "✗"}
                          </TableCell>
                          <TableCell align="right">
                            {integrationStatus.details.daemonInOpenClawConfig
                              ? "Configured"
                              : "Not configured"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Agent Context</TableCell>
                          <TableCell align="right">
                            {integrationStatus.details.agentContextInitialized ? "✓" : "✗"}
                          </TableCell>
                          <TableCell align="right">
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
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
