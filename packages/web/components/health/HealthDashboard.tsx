"use client";

import { useEffect, useState } from "react";
import { Chip } from "@leafygreen-ui/chip";
import Banner from "@leafygreen-ui/banner";
import Icon from "@leafygreen-ui/icon";
import { GlassCard } from "@/components/cards/GlassCard";
import { useThemeMode } from "@/contexts/ThemeContext";
import {
  HealthStatus,
  OpenClawIntegrationStatus,
  fetchHealth,
  fetchOpenClawIntegrationStatus,
} from "@/lib/health-api";
import styles from "./HealthDashboard.module.css";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className={styles.sectionLabel}>{children}</div>;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "healthy":
      return <Icon glyph="CheckmarkWithCircle" fill="#00A35C" />;
    case "degraded":
      return <Icon glyph="Warning" fill="#FFC010" />;
    case "unhealthy":
      return <Icon glyph="ImportantWithCircle" fill="#DB3030" />;
    default:
      return <Icon glyph="InfoWithCircle" />;
  }
}

function getChipVariant(
  status: string
): "green" | "yellow" | "red" | "gray" {
  switch (status) {
    case "healthy":
      return "green";
    case "degraded":
      return "yellow";
    case "unhealthy":
      return "red";
    default:
      return "gray";
  }
}

export function HealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [integrationStatus, setIntegrationStatus] =
    useState<OpenClawIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { darkMode } = useThemeMode();

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

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%" }} />
      </div>
    );
  }

  if (error && !health) {
    return (
      <Banner variant="danger" darkMode={darkMode}>
        {error}
      </Banner>
    );
  }

  const heapPercent = health
    ? (health.memory.heapUsed / health.memory.heapTotal) * 100
    : 0;

  return (
    <div>
      {lastUpdate && (
        <span className={styles.lastUpdate}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </span>
      )}

      <div className={styles.grid}>
        {/* Overall Status */}
        <div className={styles.fullWidth}>
          <GlassCard>
            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <StatusIcon status={health?.status || "unhealthy"} />
                <span className={styles.cardTitle}>Overall Status</span>
              </div>
              <div className={styles.statusRow}>
                <Chip
                  label={health?.status.toUpperCase() || "UNKNOWN"}
                  variant={getChipVariant(health?.status || "unhealthy")}
                />
                <span className={styles.statusDescription}>
                  {health?.checks
                    ? `MongoDB: ${health.checks.mongodb ? "Ok" : "Fail"} | Voyage: ${health.checks.voyage ? "Ok" : "Fail"} | Memory: ${health.checks.memory ? "Ok" : "Fail"}`
                    : "No data"}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Daemon Uptime & Performance */}
        <GlassCard>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>Daemon Status</span>
            <div className={styles.statGroup} style={{ marginTop: 16 }}>
              <div>
                <SectionLabel>Uptime</SectionLabel>
                <div className={styles.statValue}>
                  {health ? `${Math.floor(health.uptime)}s` : "N/A"}
                </div>
              </div>
              <div>
                <SectionLabel>Response Time</SectionLabel>
                <div className={styles.statValue}>
                  {health ? `${health.responseTime}ms` : "N/A"}
                </div>
              </div>
              <div>
                <SectionLabel>Node Version</SectionLabel>
                <span style={{ fontSize: "0.875rem" }}>
                  {health?.system.nodeVersion}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Memory Usage */}
        <GlassCard>
          <div className={styles.cardContent}>
            <span className={styles.cardTitle}>Heap Memory Usage</span>
            <div className={styles.statGroup} style={{ marginTop: 16 }}>
              <div>
                <div className={styles.heapHeader}>
                  <SectionLabel>Heap Used</SectionLabel>
                  <span className={styles.heapLabel}>
                    {health?.memory.heapUsed}MB / {health?.memory.heapTotal}MB
                  </span>
                </div>
                <div className={styles.heapBarTrack}>
                  <div
                    className={`${styles.heapBarFill} ${heapPercent > 90 ? styles.danger : ""}`}
                    style={{ width: `${heapPercent}%` }}
                  />
                </div>
              </div>
              <span className={styles.externalLabel}>
                External: {health?.memory.external}MB
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Database Status */}
        <GlassCard>
          <div className={styles.cardContent}>
            <div className={styles.cardHeader}>
              <StatusIcon
                status={
                  health?.database.connected ? "healthy" : "unhealthy"
                }
              />
              <span className={styles.cardTitle}>MongoDB Connection</span>
            </div>
            <div className={styles.statGroup}>
              <div>
                <SectionLabel>Status</SectionLabel>
                <div style={{ fontWeight: 500 }}>
                  {health?.database.connected ? "Connected" : "Disconnected"}
                </div>
              </div>
              <div>
                <SectionLabel>Response Time</SectionLabel>
                <span style={{ fontSize: "0.875rem" }}>
                  {health?.database.responseTime}ms
                </span>
              </div>
              <div>
                <SectionLabel>Total Memories</SectionLabel>
                <div className={styles.statValue}>
                  {health?.database.memoriesCount || 0}
                </div>
              </div>
              {health?.database.error && (
                <Banner variant="danger" darkMode={darkMode}>
                  {health.database.error}
                </Banner>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Voyage Configuration */}
        <GlassCard>
          <div className={styles.cardContent}>
            <div className={styles.cardHeader}>
              <StatusIcon
                status={
                  health?.voyage.configured ? "healthy" : "unhealthy"
                }
              />
              <span className={styles.cardTitle}>Voyage Embeddings</span>
            </div>
            <div className={styles.statGroup}>
              <div>
                <SectionLabel>Mode</SectionLabel>
                <Chip
                  label={
                    health?.voyage.mode === "mock"
                      ? "Mock (Testing)"
                      : "Real (Production)"
                  }
                  variant={
                    health?.voyage.mode === "mock" ? "yellow" : "green"
                  }
                />
              </div>
              <div>
                <SectionLabel>Endpoint</SectionLabel>
                <span className={styles.wordBreak}>
                  {health?.voyage.endpoint}
                </span>
              </div>
              <div>
                <SectionLabel>Configured</SectionLabel>
                <span style={{ fontSize: "0.875rem" }}>
                  {health?.voyage.configured ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* OpenClaw Integration Status */}
        {integrationStatus && (
          <div className={styles.fullWidth}>
            <GlassCard>
              <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                  <StatusIcon status={integrationStatus.status} />
                  <span className={styles.cardTitle}>
                    OpenClaw Integration Status
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className={styles.statusRow}>
                    <Chip
                      label={integrationStatus.status.toUpperCase()}
                      variant={getChipVariant(integrationStatus.status)}
                    />
                    <span className={styles.statusDescription}>
                      {integrationStatus.status === "integrated"
                        ? "Memory system fully integrated"
                        : integrationStatus.status === "partial"
                          ? "Daemon running but not fully integrated"
                          : "Daemon not accessible"}
                    </span>
                  </div>

                  <table className={styles.integrationTable}>
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Daemon Accessible</td>
                        <td>
                          <Chip
                            label={
                              integrationStatus.details.daemonAccessible
                                ? "Ok"
                                : "Fail"
                            }
                            variant={
                              integrationStatus.details.daemonAccessible
                                ? "green"
                                : "red"
                            }
                          />
                        </td>
                        <td className={styles.detailText}>
                          {integrationStatus.details.daemonResponseTime}ms
                        </td>
                      </tr>
                      <tr>
                        <td>Memory Storage</td>
                        <td>
                          <Chip
                            label={
                              integrationStatus.details.memoryStorageWorking
                                ? "Ok"
                                : "Fail"
                            }
                            variant={
                              integrationStatus.details.memoryStorageWorking
                                ? "green"
                                : "red"
                            }
                          />
                        </td>
                        <td className={styles.detailText}>
                          {integrationStatus.details.memoryStorageWorking
                            ? "Working"
                            : "Failed"}
                        </td>
                      </tr>
                      <tr>
                        <td>In OpenClaw Config</td>
                        <td>
                          <Chip
                            label={
                              integrationStatus.details
                                .daemonInOpenClawConfig
                                ? "Ok"
                                : "Missing"
                            }
                            variant={
                              integrationStatus.details
                                .daemonInOpenClawConfig
                                ? "green"
                                : "yellow"
                            }
                          />
                        </td>
                        <td className={styles.detailText}>
                          {integrationStatus.details.daemonInOpenClawConfig
                            ? "Configured"
                            : "Not configured"}
                        </td>
                      </tr>
                      <tr>
                        <td>Agent Context</td>
                        <td>
                          <Chip
                            label={
                              integrationStatus.details
                                .agentContextInitialized
                                ? "Ok"
                                : "Pending"
                            }
                            variant={
                              integrationStatus.details
                                .agentContextInitialized
                                ? "green"
                                : "yellow"
                            }
                          />
                        </td>
                        <td className={styles.detailText}>
                          {integrationStatus.details.agentContextInitialized
                            ? "Ready"
                            : "Not initialized"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
