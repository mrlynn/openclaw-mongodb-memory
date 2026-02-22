"use client";

import Link from "next/link";
import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import { Database, Clock, Wifi, WifiOff } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useStatus, DaemonStatus } from "@/hooks/useStatus";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatusIndicator } from "@/components/cards/StatusIndicator";
import { StatCard } from "@/components/cards/StatCard";
import styles from "./page.module.css";

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
  if (["running", "connected", "ready", "available"].includes(value))
    return "ready";
  if (["error", "disconnected"].includes(value)) return "error";
  return "unknown";
}

function ServiceStatusPanel({ status }: { status: DaemonStatus }) {
  const services = [
    { name: "Daemon", status: status.daemon },
    { name: "MongoDB", status: status.mongodb },
    { name: "Voyage AI", status: status.voyage },
  ];

  return (
    <GlassCard>
      <div className={styles.sectionLabel} style={{ marginBottom: 20 }}>
        Service Health
      </div>
      <div className={styles.serviceList}>
        {services.map((svc) => (
          <div key={svc.name} className={styles.serviceItem}>
            <StatusIndicator status={mapStatus(svc.status)} size="medium" />
            <div>
              <div className={styles.serviceName}>{svc.name}</div>
              <div className={styles.serviceStatus}>{svc.status}</div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function HeapUsageBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? (used / total) * 100 : 0;

  return (
    <GlassCard>
      <div className={styles.heapHeader}>
        <div className={styles.sectionLabel}>Heap Memory Usage</div>
        <div className={styles.heapValues}>
          {formatMB(used)} / {formatMB(total)}
        </div>
      </div>
      <div className={styles.heapTrack}>
        <div className={styles.heapFill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.heapPercent}>{percent.toFixed(1)}% utilized</div>
    </GlassCard>
  );
}

function DisconnectedState({
  daemonUrl,
  onRetry,
}: {
  daemonUrl: string;
  onRetry: () => void;
}) {
  const { darkMode } = useThemeMode();

  return (
    <GlassCard glowColor="#DB3030">
      <div className={styles.disconnected}>
        <div className={styles.disconnectedIcon}>
          <WifiOff size={48} />
        </div>
        <div className={styles.disconnectedTitle}>Daemon Unreachable</div>
        <div className={styles.disconnectedDesc}>
          Could not connect to the memory daemon at:
        </div>
        <div className={styles.daemonUrlBadge}>{daemonUrl}</div>
        <div className={styles.disconnectedDesc} style={{ marginBottom: 24 }}>
          Make sure the daemon is running, or update the URL in Settings if it
          is on a different host or port.
        </div>
        <div className={styles.disconnectedActions}>
          <Button
            variant="primary"
            darkMode={darkMode}
            leftGlyph={<Icon glyph="Refresh" />}
            onClick={onRetry}
          >
            Retry
          </Button>
          <Button
            variant="default"
            darkMode={darkMode}
            leftGlyph={<Icon glyph="Settings" />}
            as={Link}
            href="/settings"
          >
            Configure Connection
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

export default function DashboardPage() {
  const { daemonUrl } = useDaemonConfig();
  const { status, loading, error, refetch } = useStatus(daemonUrl);

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Dashboard</h2>

      {!loading && error && (
        <div className={styles.errorWrap}>
          <DisconnectedState daemonUrl={daemonUrl} onRetry={refetch} />
        </div>
      )}

      {loading ? (
        <div className={styles.statsGrid}>
          <div className={`${styles.fullRow} skeleton ${styles.skeletonCard}`} />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`skeleton ${styles.skeletonStat}`} />
          ))}
        </div>
      ) : (
        <div className={styles.statsGrid}>
          {status && (
            <>
              <div className={`${styles.fullRow} ${styles.stagger1}`}>
                <ServiceStatusPanel status={status} />
              </div>

              <div className={styles.stagger2}>
                <StatCard
                  icon={<Database size={22} />}
                  label="Total Memories"
                  value={status.stats.totalMemories.toLocaleString()}
                  color="#016BF8"
                />
              </div>
              <div className={styles.stagger3}>
                <StatCard
                  icon={<Clock size={22} />}
                  label="Uptime"
                  value={formatUptime(status.uptime)}
                  color="#00ED64"
                />
              </div>
              <div className={styles.stagger4}>
                <StatCard
                  icon={<Icon glyph="Charts" size={22} />}
                  label="Heap Used"
                  value={formatMB(status.memory.heapUsed)}
                  subtitle={`of ${formatMB(status.memory.heapTotal)}`}
                  color="#FFC010"
                />
              </div>
              <div className={styles.stagger5}>
                <StatCard
                  icon={error ? <WifiOff size={22} /> : <Wifi size={22} />}
                  label="Connection"
                  value={error ? "Offline" : "Connected"}
                  subtitle={daemonUrl}
                  color={error ? "#DB3030" : "#00A35C"}
                />
              </div>

              <div className={`${styles.fullRow} ${styles.stagger6}`}>
                <HeapUsageBar
                  used={status.memory.heapUsed}
                  total={status.memory.heapTotal}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
