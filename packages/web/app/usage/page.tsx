"use client";

import { useState, useEffect } from "react";
import { Select, Option } from "@leafygreen-ui/select";
import { Zap, DollarSign, TrendingUp, Activity, Database, AlertTriangle } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useUsage } from "@/hooks/useUsage";
import { fetchAgents, AgentInfo } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatCard } from "@/components/cards/StatCard";
import styles from "./page.module.css";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  if (usd >= 0.0001) return `$${usd.toFixed(6)}`;
  if (usd === 0) return "$0.00";
  return `$${usd.toExponential(2)}`;
}

function formatCostShort(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.001) return `$${usd.toFixed(4)}`;
  if (usd === 0) return "$0.00";
  return `$${usd.toFixed(6)}`;
}

// ---------------------------------------------------------------------------
// Timeline Chart (CSS-only bar chart)
// ---------------------------------------------------------------------------

function TimelineChart({
  buckets,
  days,
  onDaysChange,
}: {
  buckets: { date: string; tokens: number; cost: number; calls: number }[];
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const maxTokens = Math.max(...buckets.map((b) => b.tokens), 1);

  return (
    <GlassCard>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <Activity size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Usage Timeline</div>
        </div>
        <div className={styles.timelinePeriodToggle}>
          {[
            { label: "24h", value: 1 },
            { label: "7d", value: 7 },
            { label: "30d", value: 30 },
          ].map((p) => (
            <button
              key={p.value}
              className={`${styles.periodBtn} ${days === p.value ? styles.periodBtnActive : ""}`}
              onClick={() => onDaysChange(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {buckets.length === 0 ? (
        <div className={styles.emptyState}>
          <Activity size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No usage data yet.</div>
          <div className={styles.emptySubtext}>
            Store or search memories to generate usage events.
          </div>
        </div>
      ) : (
        <div className={styles.timelineChart}>
          {buckets.map((b, i) => {
            const height = maxTokens > 0 ? Math.max((b.tokens / maxTokens) * 100, 2) : 2;
            const date = new Date(b.date);
            const label = days <= 1
              ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : date.toLocaleDateString([], { month: "short", day: "numeric" });
            return (
              <div key={i} className={styles.timelineBarWrap}>
                <div className={styles.barTooltip}>
                  <strong>{label}</strong>
                  <br />
                  {formatTokens(b.tokens)} tokens
                  <br />
                  {formatCostShort(b.cost)}
                  <br />
                  {b.calls} calls
                </div>
                <div
                  className={styles.timelineBar}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Operation Breakdown Table
// ---------------------------------------------------------------------------

function OperationBreakdown({
  byOperation,
}: {
  byOperation: Record<string, { tokens: number; cost: number; calls: number }>;
}) {
  const entries = Object.entries(byOperation).map(([operation, data]) => ({
    operation,
    ...data,
  }));
  const maxTokens = Math.max(...entries.map((o) => o.tokens), 1);
  const totalTokens = entries.reduce((s, o) => s + o.tokens, 0);

  return (
    <GlassCard>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <Zap size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Operation Breakdown</div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className={styles.emptyState}>No operations recorded yet.</div>
      ) : (
        <table className={styles.breakdownTable}>
          <thead>
            <tr>
              <th>Operation</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Calls</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {entries
              .sort((a, b) => b.tokens - a.tokens)
              .map((op) => {
                const pct = totalTokens > 0 ? (op.tokens / totalTokens) * 100 : 0;
                const barWidth = maxTokens > 0 ? (op.tokens / maxTokens) * 100 : 0;
                const isReflect = op.operation.startsWith("reflect:");
                return (
                  <tr key={op.operation} className={isReflect ? styles.reflectOp : undefined}>
                    <td>
                      <div className={styles.opName}>{op.operation}</div>
                      <div className={styles.opBar} style={{ width: `${barWidth}%` }} />
                    </td>
                    <td>{formatTokens(op.tokens)}</td>
                    <td>{formatCostShort(op.cost)}</td>
                    <td>{op.calls}</td>
                    <td className={styles.percentCell}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Pipeline Cost Attribution
// ---------------------------------------------------------------------------

const STAGE_COLORS = [
  styles.stageColor0,
  styles.stageColor1,
  styles.stageColor2,
  styles.stageColor3,
  styles.stageColor4,
];

function PipelineBreakdown({
  stages,
  totalPipelineTokens,
}: {
  stages: { stage: string; tokens: number; cost: number; calls: number; percentOfTotal: number }[];
  totalPipelineTokens: number;
}) {
  const maxTokens = Math.max(...stages.map((s) => s.tokens), 1);
  const totalCost = stages.reduce((sum, s) => sum + s.cost, 0);

  return (
    <GlassCard>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <TrendingUp size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Reflection Pipeline Costs</div>
        </div>
        {totalCost > 0 && (
          <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>
            Total: {formatCost(totalCost)} ({formatTokens(totalPipelineTokens)} tokens)
          </div>
        )}
      </div>

      {stages.length === 0 ? (
        <div className={styles.emptyState}>
          <TrendingUp size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No reflection pipeline data yet.</div>
          <div className={styles.emptySubtext}>
            Run a reflection pipeline to see per-stage costs.
          </div>
        </div>
      ) : (
        <div className={styles.pipelineStages}>
          {stages
            .sort((a, b) => b.tokens - a.tokens)
            .map((stage, i) => {
              const barWidth = maxTokens > 0 ? Math.max((stage.tokens / maxTokens) * 100, 8) : 8;
              return (
                <div key={stage.stage} className={styles.pipelineRow}>
                  <div className={styles.pipelineName}>{stage.stage}</div>
                  <div className={styles.pipelineBarTrack}>
                    <div
                      className={`${styles.pipelineBarFill} ${STAGE_COLORS[i % STAGE_COLORS.length]}`}
                      style={{ width: `${barWidth}%` }}
                    >
                      <span>{stage.percentOfTotal.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className={styles.pipelineStats}>
                    {formatTokens(stage.tokens)} &middot; {formatCostShort(stage.cost)}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Cost Efficiency Card
// ---------------------------------------------------------------------------

function CostEfficiency({
  projections,
}: {
  projections: {
    projectedMonthlyCostUsd: number;
    costPerMemory: number;
    costEfficiency: number;
    reflectionCostRatio: number;
    windowDays: number;
    totalMemories: number;
    recallsInWindow: number;
  };
}) {
  const reflectionPct = projections.reflectionCostRatio * 100;

  return (
    <GlassCard>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <TrendingUp size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Cost Efficiency</div>
        </div>
      </div>

      <div className={styles.efficiencyGrid}>
        <div className={styles.efficiencyMetric}>
          <div className={styles.efficiencyLabel}>Retrievals / Dollar</div>
          <div className={styles.efficiencyValue}>
            {projections.costEfficiency === Infinity || isNaN(projections.costEfficiency) || projections.costEfficiency === 0
              ? "--"
              : projections.costEfficiency.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className={styles.efficiencySubtext}>
            {projections.recallsInWindow.toLocaleString()} recalls over {projections.windowDays}d
          </div>
        </div>

        <div className={styles.efficiencyMetric}>
          <div className={styles.efficiencyLabel}>Reflection Overhead</div>
          <div className={styles.efficiencyValue}>
            {reflectionPct.toFixed(1)}%
          </div>
          <div className={styles.ratioBar}>
            <div
              className={styles.ratioFill}
              style={{
                width: `${Math.min(reflectionPct, 100)}%`,
                background: reflectionPct > 50
                  ? "linear-gradient(90deg, #FFC010, #DB3030)"
                  : "linear-gradient(90deg, #00ED64, #016BF8)",
              }}
            />
          </div>
          <div className={styles.efficiencySubtext}>
            of total tokens used by reflection pipeline
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Agent Breakdown Table
// ---------------------------------------------------------------------------

function AgentBreakdown({
  agents,
}: {
  agents: {
    agentId: string;
    tokens: number;
    cost: number;
    calls: number;
    memoryCount: number;
    costPerMemory: number;
  }[];
}) {
  if (agents.length <= 1) return null;

  return (
    <GlassCard>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <Database size={16} style={{ opacity: 0.5 }} />
          <div className={styles.sectionLabel}>Per-Agent Breakdown</div>
        </div>
      </div>

      <table className={styles.agentTable}>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Calls</th>
            <th>Memories</th>
            <th>$/Memory</th>
          </tr>
        </thead>
        <tbody>
          {agents
            .sort((a, b) => b.tokens - a.tokens)
            .map((agent) => (
              <tr key={agent.agentId}>
                <td className={styles.agentName}>{agent.agentId}</td>
                <td>{formatTokens(agent.tokens)}</td>
                <td>{formatCostShort(agent.cost)}</td>
                <td>{agent.calls}</td>
                <td>{agent.memoryCount.toLocaleString()}</td>
                <td>{formatCostShort(agent.costPerMemory)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Main Usage Page
// ---------------------------------------------------------------------------

export default function UsagePage() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();
  const [days, setDays] = useState(30);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentId, setAgentId] = useState("");

  // Fetch agents on mount
  useEffect(() => {
    const init = async () => {
      try {
        const agentsList = await fetchAgents(daemonUrl);
        setAgents(agentsList);
        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AGENT_ID) : null;
        const resolved =
          stored && agentsList.some((a) => a.agentId === stored)
            ? stored
            : agentsList[0]?.agentId || "";
        if (resolved) {
          setAgentId(resolved);
          localStorage.setItem(STORAGE_KEYS.AGENT_ID, resolved);
        }
      } catch {
        // Silently fail
      }
    };
    init();
  }, [daemonUrl]);

  const handleAgentChange = (val: string) => {
    setAgentId(val);
    localStorage.setItem(STORAGE_KEYS.AGENT_ID, val);
  };

  const { summary, timeline, projections, pipelineBreakdown, byAgent, loading, error } = useUsage({
    daemonUrl,
    agentId: agentId || undefined,
    days,
  });

  // Check if mock mode by looking at byModel keys
  const isMock = summary?.byModel
    ? Object.keys(summary.byModel).some((k) => k === "mock")
    : false;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.title}>Usage & Cost</h2>
        <div className={styles.controls}>
          {agents.length > 1 && (
            <Select
              aria-label="Agent"
              value={agentId}
              onChange={handleAgentChange}
              size="xsmall"
              darkMode={darkMode}
            >
              {agents.map((a) => (
                <Option key={a.agentId} value={a.agentId}>
                  {a.agentId}
                </Option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {isMock && (
        <div className={styles.mockNotice}>
          <AlertTriangle size={16} />
          Mock mode active — token counts and costs are simulated (VOYAGE_MOCK=true)
        </div>
      )}

      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`skeleton ${styles.skeletonStat}`} />
          ))}
          <div className={`${styles.fullRow} skeleton ${styles.skeletonCard}`} />
          <div className={`${styles.fullRow} skeleton ${styles.skeletonCard}`} />
        </div>
      ) : error ? (
        <GlassCard glowColor="#DB3030">
          <div className={styles.emptyState}>
            <div style={{ opacity: 0.5 }}>Could not load usage data.</div>
            <div className={styles.emptySubtext}>{error}</div>
          </div>
        </GlassCard>
      ) : (
        <div className={styles.grid}>
          {/* Row 1 — Hero Stats */}
          <div className={styles.stagger1}>
            <StatCard
              icon={<Zap size={22} />}
              label="Tokens Used"
              value={formatTokens(summary?.totalTokens ?? 0)}
              subtitle={`${summary?.totalCalls ?? 0} API calls`}
              color="#016BF8"
            />
          </div>
          <div className={styles.stagger2}>
            <StatCard
              icon={<DollarSign size={22} />}
              label="Total Cost"
              value={formatCost(summary?.totalCostUsd ?? 0)}
              subtitle={`last ${days} days`}
              color="#00ED64"
            />
          </div>
          <div className={styles.stagger3}>
            <StatCard
              icon={<Database size={22} />}
              label="Cost / Memory"
              value={formatCost(summary?.costPerMemory ?? 0)}
              color="#FFC010"
            />
          </div>
          <div className={styles.stagger4}>
            <StatCard
              icon={<TrendingUp size={22} />}
              label="Monthly Projection"
              value={formatCost(projections?.projectedMonthlyCostUsd ?? 0)}
              subtitle={`based on ${projections?.windowDays ?? days}d`}
              color="#9050E9"
            />
          </div>

          {/* Row 2 — Cost Efficiency */}
          {projections && (
            <div className={`${styles.fullRow} ${styles.stagger5}`}>
              <CostEfficiency projections={projections} />
            </div>
          )}

          {/* Row 3 — Usage Timeline */}
          <div className={`${styles.fullRow} ${styles.stagger6}`}>
            <TimelineChart
              buckets={timeline?.buckets ?? []}
              days={days}
              onDaysChange={setDays}
            />
          </div>

          {/* Row 4 — Operation Breakdown */}
          <div className={`${styles.fullRow} ${styles.stagger7}`}>
            <OperationBreakdown byOperation={summary?.byOperation ?? {}} />
          </div>

          {/* Row 5 — Pipeline Cost Attribution */}
          {pipelineBreakdown && pipelineBreakdown.stages.length > 0 && (
            <div className={`${styles.fullRow} ${styles.stagger7}`}>
              <PipelineBreakdown
                stages={pipelineBreakdown.stages}
                totalPipelineTokens={pipelineBreakdown.totalPipelineTokens}
              />
            </div>
          )}

          {/* Row 6 — Per-Agent Breakdown (conditional) */}
          {byAgent && byAgent.agents.length > 1 && (
            <div className={`${styles.fullRow} ${styles.stagger7}`}>
              <AgentBreakdown agents={byAgent.agents} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
