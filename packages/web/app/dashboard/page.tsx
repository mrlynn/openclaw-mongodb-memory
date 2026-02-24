"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@leafygreen-ui/button";
import { Select, Option } from "@leafygreen-ui/select";
import Icon from "@leafygreen-ui/icon";
import { useRememberModal } from "@/contexts/RememberModalContext";
import { Database, Clock, Wifi, WifiOff, Cloud, ScatterChart, CalendarDays, Box, Grid2x2 } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useStatus, DaemonStatus } from "@/hooks/useStatus";
import {
  fetchWordCloud,
  WordCloudWord,
  fetchMemoryMap,
  MemoryMapPoint,
  fetchTimeline,
  TimelineDay,
} from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { SetupChecklist } from "@/components/setup/SetupChecklist";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatusIndicator } from "@/components/cards/StatusIndicator";
import { StatCard } from "@/components/cards/StatCard";
import { WordCloud } from "@/components/wordcloud/WordCloud";
import { MemoryMap } from "@/components/memorymap/MemoryMap";
import { MemoryMap3D } from "@/components/memorymap/MemoryMap3D";
import { MemoryTimeline } from "@/components/timeline/MemoryTimeline";
import { MemorySourcesPanel } from "@/components/sources/MemorySourcesPanel";
import { LayersPanel } from "@/components/dashboard/LayersPanel";
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
  if (["running", "connected", "ready", "available"].includes(value)) return "ready";
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

function DisconnectedState({ daemonUrl, onRetry }: { daemonUrl: string; onRetry: () => void }) {
  const { darkMode } = useThemeMode();

  return (
    <GlassCard glowColor="#DB3030">
      <div className={styles.disconnected}>
        <div className={styles.disconnectedIcon}>
          <WifiOff size={48} />
        </div>
        <div className={styles.disconnectedTitle}>Daemon Unreachable</div>
        <div className={styles.disconnectedDesc}>Could not connect to the memory daemon at:</div>
        <div className={styles.daemonUrlBadge}>{daemonUrl}</div>
        <div className={styles.disconnectedDesc} style={{ marginBottom: 24 }}>
          Make sure the daemon is running, or update the URL in Settings if it is on a different
          host or port.
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
// Word Cloud section — receives agentId from parent
// ---------------------------------------------------------------------------

function WordCloudSection({ daemonUrl, agentId }: { daemonUrl: string; agentId: string }) {
  const router = useRouter();

  const [words, setWords] = useState<WordCloudWord[]>([]);
  const [totalMemories, setTotalMemories] = useState(0);
  const [totalUniqueWords, setTotalUniqueWords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWordCloud = useCallback(
    async (agent: string) => {
      if (!agent) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWordCloud(daemonUrl, agent, {
          limit: 150,
          minCount: 2,
        });
        setWords(data.words);
        setTotalMemories(data.totalMemories);
        setTotalUniqueWords(data.totalUniqueWords);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [daemonUrl],
  );

  useEffect(() => {
    if (agentId) loadWordCloud(agentId);
  }, [agentId, loadWordCloud]);

  const handleWordClick = (word: string) => {
    router.push(`/search?query=${encodeURIComponent(word)}`);
  };

  return (
    <GlassCard>
      <div className={styles.vizHeader}>
        <div className={styles.vizTitleRow}>
          <Cloud size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Memory Word Cloud</div>
        </div>

        {words.length > 0 && !loading && (
          <div className={styles.vizStats}>
            <span>
              <strong>{totalMemories.toLocaleString()}</strong> memories
            </span>
            <span className={styles.statSep}>·</span>
            <span>
              <strong>{totalUniqueWords.toLocaleString()}</strong> words
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className={styles.vizLoading}>
          <div className="skeleton" style={{ width: "100%", height: 360, borderRadius: 8 }} />
        </div>
      )}

      {error && !loading && (
        <div className={styles.vizEmpty}>
          <div style={{ opacity: 0.5 }}>Could not load word cloud.</div>
        </div>
      )}

      {!loading && !error && words.length === 0 && (
        <div className={styles.vizEmpty}>
          <Cloud size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No words to display yet.</div>
          <div style={{ fontSize: "0.8rem", marginTop: 4, opacity: 0.6 }}>
            Store some memories to see your word cloud.
          </div>
        </div>
      )}

      {!loading && !error && words.length > 0 && (
        <WordCloud words={words} onWordClick={handleWordClick} />
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Memory Map section — 2D/3D semantic scatter plot via PCA
// ---------------------------------------------------------------------------

function MemoryMapSection({ daemonUrl, agentId }: { daemonUrl: string; agentId: string }) {
  const router = useRouter();

  const [points, setPoints] = useState<MemoryMapPoint[]>([]);
  const [varianceExplained, setVarianceExplained] = useState<[number, number, number] | undefined>();
  const [is3D, setIs3D] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMap = useCallback(
    async (agent: string, dimensions: number) => {
      if (!agent) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMemoryMap(daemonUrl, agent, {
          limit: 300,
          dimensions,
        });
        setPoints(data.points);
        setVarianceExplained(data.varianceExplained);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [daemonUrl],
  );

  useEffect(() => {
    if (agentId) loadMap(agentId, is3D ? 3 : 2);
  }, [agentId, is3D, loadMap]);

  const handlePointClick = (text: string) => {
    router.push(`/search?query=${encodeURIComponent(text)}`);
  };

  const toggleDimension = () => setIs3D((prev) => !prev);

  return (
    <GlassCard>
      <div className={styles.vizHeader}>
        <div className={styles.vizTitleRow}>
          <ScatterChart size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Semantic Memory Map</div>

          <button
            className={styles.dimensionToggle}
            onClick={toggleDimension}
            title={is3D ? "Switch to 2D view" : "Switch to 3D view"}
          >
            {is3D ? (
              <>
                <Grid2x2 size={12} />
                <span>2D</span>
              </>
            ) : (
              <>
                <Box size={12} />
                <span>3D</span>
              </>
            )}
          </button>
        </div>

        {points.length > 0 && !loading && (
          <div className={styles.vizStats}>
            <span>
              <strong>{points.length}</strong> memories projected to {is3D ? "3D" : "2D"} via PCA
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className={styles.vizLoading}>
          <div className="skeleton" style={{ width: "100%", height: 400, borderRadius: 8 }} />
        </div>
      )}

      {error && !loading && (
        <div className={styles.vizEmpty}>
          <div style={{ opacity: 0.5 }}>Could not load memory map.</div>
        </div>
      )}

      {!loading && !error && points.length === 0 && (
        <div className={styles.vizEmpty}>
          <ScatterChart size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No memories to map yet.</div>
          <div style={{ fontSize: "0.8rem", marginTop: 4, opacity: 0.6 }}>
            Store some memories to see your semantic map.
          </div>
        </div>
      )}

      {!loading && !error && points.length > 0 && (
        is3D ? (
          <MemoryMap3D
            points={points}
            varianceExplained={varianceExplained}
            onPointClick={handlePointClick}
          />
        ) : (
          <MemoryMap points={points} onPointClick={handlePointClick} />
        )
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Memory Timeline section — GitHub-style activity heatmap
// ---------------------------------------------------------------------------

function TimelineSection({ daemonUrl, agentId }: { daemonUrl: string; agentId: string }) {
  const [days, setDays] = useState<TimelineDay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(
    async (agent: string) => {
      if (!agent) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTimeline(daemonUrl, agent, { days: 90 });
        setDays(data.days);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [daemonUrl],
  );

  useEffect(() => {
    if (agentId) loadTimeline(agentId);
  }, [agentId, loadTimeline]);

  return (
    <GlassCard>
      <div className={styles.vizHeader}>
        <div className={styles.vizTitleRow}>
          <CalendarDays size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Memory Activity</div>
        </div>

        {total > 0 && !loading && (
          <div className={styles.vizStats}>
            <span>
              <strong>{total.toLocaleString()}</strong> memories in the last 90 days
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className={styles.vizLoading}>
          <div className="skeleton" style={{ width: "100%", height: 140, borderRadius: 8 }} />
        </div>
      )}

      {error && !loading && (
        <div className={styles.vizEmpty}>
          <div style={{ opacity: 0.5 }}>Could not load timeline.</div>
        </div>
      )}

      {!loading && !error && days.length === 0 && (
        <div className={styles.vizEmpty}>
          <CalendarDays size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No activity yet.</div>
          <div style={{ fontSize: "0.8rem", marginTop: 4, opacity: 0.6 }}>
            Store some memories to see your activity timeline.
          </div>
        </div>
      )}

      {!loading && !error && (days.length > 0 || total === 0) && total >= 0 && days.length > 0 && (
        <MemoryTimeline days={days} numDays={90} />
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard — agent state lifted here, shared across all viz sections
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();
  const { status, loading, error, refetch } = useStatus(daemonUrl);
  const { openRememberModal } = useRememberModal();
  const searchParams = useSearchParams();
  const didOpenRemember = useRef(false);

  // --- Shared agent state ---
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  // Always start with "" to match server render; restored from localStorage in the useEffect below.
  const [agentId, setAgentId] = useState("");

  // Open remember modal if ?remember=1 is in the URL
  useEffect(() => {
    if (searchParams.get("remember") === "1" && !didOpenRemember.current) {
      didOpenRemember.current = true;
      openRememberModal();
      // Clean the URL
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [searchParams, openRememberModal]);

  // Fetch agents on mount, resolve which one to use
  useEffect(() => {
    const init = async () => {
      try {
        const response = await fetch(`${daemonUrl}/agents`);
        if (!response.ok) return;
        const data = await response.json();
        const agentsList: AgentInfo[] = data.agents || [];
        setAgents(agentsList);

        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AGENT_ID) : null;
        const resolvedAgent =
          stored && agentsList.some((a) => a.agentId === stored)
            ? stored
            : agentsList[0]?.agentId || "";

        if (resolvedAgent) {
          setAgentId(resolvedAgent);
          localStorage.setItem(STORAGE_KEYS.AGENT_ID, resolvedAgent);
        }
      } catch {
        // Silently fail — dashboard system stats still useful
      }
    };
    init();
  }, [daemonUrl]);

  const handleAgentChange = (val: string) => {
    setAgentId(val);
    localStorage.setItem(STORAGE_KEYS.AGENT_ID, val);
  };

  return (
    <div className={styles.page}>
      <div className={styles.dashboardHeader}>
        <h2 className={styles.title}>Dashboard</h2>

        {agents.length > 1 && (
          <div className={styles.agentSelector}>
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

      <SetupChecklist daemonUrl={daemonUrl} />

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
              {/* Visualization sections — only show if we have an agent */}
              {agentId && (
                <>
                  <div className={`${styles.fullRow} ${styles.stagger1}`}>
                    <WordCloudSection daemonUrl={daemonUrl} agentId={agentId} />
                  </div>

                  <div className={`${styles.fullRow} ${styles.stagger2}`}>
                    <LayersPanel agentId={agentId} />
                  </div>

                  <div className={`${styles.fullRow} ${styles.stagger3}`}>
                    <MemoryMapSection daemonUrl={daemonUrl} agentId={agentId} />
                  </div>

                  <div className={`${styles.fullRow} ${styles.stagger4}`}>
                    <TimelineSection daemonUrl={daemonUrl} agentId={agentId} />
                  </div>

                  <div className={`${styles.fullRow} ${styles.stagger5}`}>
                    <MemorySourcesPanel daemonUrl={daemonUrl} agentId={agentId} />
                  </div>
                </>
              )}

              <div className={`${styles.fullRow} ${styles.stagger6}`}>
                <ServiceStatusPanel status={status} />
              </div>

              <div className={styles.stagger7}>
                <StatCard
                  icon={<Database size={22} />}
                  label="Total Memories"
                  value={status.stats.totalMemories.toLocaleString()}
                  color="#016BF8"
                />
              </div>
              <div className={styles.stagger8}>
                <StatCard
                  icon={<Clock size={22} />}
                  label="Uptime"
                  value={formatUptime(status.uptime)}
                  color="#00ED64"
                />
              </div>
              <div className={styles.stagger9}>
                <StatCard
                  icon={<Icon glyph="Charts" size={22} />}
                  label="Heap Used"
                  value={formatMB(status.memory.heapUsed)}
                  subtitle={`of ${formatMB(status.memory.heapTotal)}`}
                  color="#FFC010"
                />
              </div>
              <div className={styles.stagger10}>
                <StatCard
                  icon={error ? <WifiOff size={22} /> : <Wifi size={22} />}
                  label="Connection"
                  value={error ? "Offline" : "Connected"}
                  subtitle={daemonUrl}
                  color={error ? "#DB3030" : "#00A35C"}
                />
              </div>

              <div className={`${styles.fullRow} ${styles.stagger11}`}>
                <HeapUsageBar used={status.memory.heapUsed} total={status.memory.heapTotal} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
