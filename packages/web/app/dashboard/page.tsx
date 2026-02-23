"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@leafygreen-ui/button";
import { Select, Option } from "@leafygreen-ui/select";
import Icon from "@leafygreen-ui/icon";
import { Database, Clock, Wifi, WifiOff, Cloud } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useStatus, DaemonStatus } from "@/hooks/useStatus";
import { fetchWordCloud, WordCloudWord } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatusIndicator } from "@/components/cards/StatusIndicator";
import { StatCard } from "@/components/cards/StatCard";
import { WordCloud } from "@/components/wordcloud/WordCloud";
import styles from "./page.module.css";

interface AgentInfo {
  agentId: string;
  count: number;
  lastUpdated: string | null;
}

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

// ---------------------------------------------------------------------------
// Word Cloud section — auto-loads on mount, refreshes when agent changes
// ---------------------------------------------------------------------------

function WordCloudSection({ daemonUrl }: { daemonUrl: string }) {
  const { darkMode } = useThemeMode();
  const router = useRouter();

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentId, setAgentId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AGENT_ID) || "";
    }
    return "";
  });

  const [words, setWords] = useState<WordCloudWord[]>([]);
  const [totalMemories, setTotalMemories] = useState(0);
  const [totalUniqueWords, setTotalUniqueWords] = useState(0);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Fetch word cloud for a given agent
  const loadWordCloud = useCallback(
    async (agent: string) => {
      if (!agent) return;
      setLoadingCloud(true);
      setCloudError(null);
      try {
        const data = await fetchWordCloud(daemonUrl, agent, {
          limit: 150,
          minCount: 2,
        });
        setWords(data.words);
        setTotalMemories(data.totalMemories);
        setTotalUniqueWords(data.totalUniqueWords);
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingCloud(false);
      }
    },
    [daemonUrl],
  );

  // Fetch agents on mount, then auto-load word cloud
  useEffect(() => {
    const init = async () => {
      try {
        const response = await fetch(`${daemonUrl}/agents`);
        if (!response.ok) return;
        const data = await response.json();
        const agentsList: AgentInfo[] = data.agents || [];
        setAgents(agentsList);

        // Resolve which agent to use
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.AGENT_ID)
            : null;
        const resolvedAgent =
          stored && agentsList.some((a) => a.agentId === stored)
            ? stored
            : agentsList[0]?.agentId || "";

        if (resolvedAgent) {
          setAgentId(resolvedAgent);
          localStorage.setItem(STORAGE_KEYS.AGENT_ID, resolvedAgent);
          loadWordCloud(resolvedAgent);
        }
      } catch {
        // Silently fail — dashboard system stats are still useful
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daemonUrl]);

  const handleAgentChange = (val: string) => {
    setAgentId(val);
    localStorage.setItem(STORAGE_KEYS.AGENT_ID, val);
    loadWordCloud(val);
  };

  const handleWordClick = (word: string) => {
    localStorage.setItem(STORAGE_KEYS.AGENT_ID, agentId);
    router.push(`/recall?query=${encodeURIComponent(word)}`);
  };

  // Don't render section at all if no agents available
  if (agents.length === 0 && !loadingCloud) return null;

  return (
    <GlassCard>
      <div className={styles.wordCloudHeader}>
        <div className={styles.wordCloudTitleRow}>
          <Cloud size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Memory Word Cloud</div>
        </div>

        <div className={styles.wordCloudControls}>
          {words.length > 0 && !loadingCloud && (
            <div className={styles.wordCloudStats}>
              <span>
                <strong>{totalMemories.toLocaleString()}</strong> memories
              </span>
              <span className={styles.statSep}>·</span>
              <span>
                <strong>{totalUniqueWords.toLocaleString()}</strong> words
              </span>
            </div>
          )}

          {agents.length > 1 && (
            <div className={styles.wordCloudSelect}>
              <Select
                aria-label="Agent"
                value={agentId}
                onChange={handleAgentChange}
                size="xsmall"
                darkMode={darkMode}
              >
                {agents.map((agent) => (
                  <Option key={agent.agentId} value={agent.agentId}>
                    {agent.agentId}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loadingCloud && (
        <div className={styles.wordCloudLoading}>
          <div
            className="skeleton"
            style={{ width: "100%", height: 360, borderRadius: 8 }}
          />
        </div>
      )}

      {/* Error */}
      {cloudError && !loadingCloud && (
        <div className={styles.wordCloudEmpty}>
          <div style={{ opacity: 0.5 }}>
            Could not load word cloud.
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingCloud && !cloudError && words.length === 0 && (
        <div className={styles.wordCloudEmpty}>
          <Cloud size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No words to display yet.</div>
          <div style={{ fontSize: "0.8rem", marginTop: 4, opacity: 0.6 }}>
            Store some memories to see your word cloud.
          </div>
        </div>
      )}

      {/* Word cloud */}
      {!loadingCloud && !cloudError && words.length > 0 && (
        <WordCloud words={words} onWordClick={handleWordClick} />
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

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
                <WordCloudSection daemonUrl={daemonUrl} />
              </div>

              <div className={`${styles.fullRow} ${styles.stagger2}`}>
                <ServiceStatusPanel status={status} />
              </div>

              <div className={styles.stagger3}>
                <StatCard
                  icon={<Database size={22} />}
                  label="Total Memories"
                  value={status.stats.totalMemories.toLocaleString()}
                  color="#016BF8"
                />
              </div>
              <div className={styles.stagger4}>
                <StatCard
                  icon={<Clock size={22} />}
                  label="Uptime"
                  value={formatUptime(status.uptime)}
                  color="#00ED64"
                />
              </div>
              <div className={styles.stagger5}>
                <StatCard
                  icon={<Icon glyph="Charts" size={22} />}
                  label="Heap Used"
                  value={formatMB(status.memory.heapUsed)}
                  subtitle={`of ${formatMB(status.memory.heapTotal)}`}
                  color="#FFC010"
                />
              </div>
              <div className={styles.stagger6}>
                <StatCard
                  icon={error ? <WifiOff size={22} /> : <Wifi size={22} />}
                  label="Connection"
                  value={error ? "Offline" : "Connected"}
                  subtitle={daemonUrl}
                  color={error ? "#DB3030" : "#00A35C"}
                />
              </div>

              <div className={`${styles.fullRow} ${styles.stagger7}`}>
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
