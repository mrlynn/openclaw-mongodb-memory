"use client";

import { useEffect, useState } from "react";
import { Database, HardDrive, Cpu, Zap } from "lucide-react";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatCard } from "@/components/cards/StatCard";
import { StatusIndicator } from "@/components/cards/StatusIndicator";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { fetchStatus, fetchAgents, AgentInfo } from "@/lib/api";

export function DatabaseStatsSection() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();

  const [totalMemories, setTotalMemories] = useState(0);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [mongoStatus, setMongoStatus] = useState<"ready" | "error" | "unknown">("unknown");
  const [voyageStatus, setVoyageStatus] = useState<"ready" | "error" | "unknown">("unknown");
  const [tier, setTier] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [status, agentsList] = await Promise.all([
          fetchStatus(daemonUrl),
          fetchAgents(daemonUrl),
        ]);
        setTotalMemories(status.stats?.totalMemories || 0);
        setAgents(agentsList);
        setMongoStatus(status.mongodb === "connected" ? "ready" : "error");
        setVoyageStatus(status.voyage === "ready" ? "ready" : "error");
        setTier(status.tier?.label || "");
      } catch {
        setMongoStatus("error");
        setVoyageStatus("error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [daemonUrl]);

  return (
    <GlassCard>
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Database size={16} style={{ opacity: 0.7 }} />
          <span
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 500,
              fontSize: "0.68rem",
              opacity: 0.6,
            }}
          >
            Database Overview
          </span>
        </div>

        {loading ? (
          <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>Loading stats...</div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <StatCard
                icon={<Database size={18} />}
                label="Total Memories"
                value={totalMemories.toLocaleString()}
                color="#016BF8"
              />
              <StatCard
                icon={<HardDrive size={18} />}
                label="Agents"
                value={agents.length}
                color="#00ED64"
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                fontSize: "0.82rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusIndicator status={mongoStatus} size="small" />
                <span style={{ opacity: 0.7 }}>MongoDB</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusIndicator status={voyageStatus} size="small" />
                <span style={{ opacity: 0.7 }}>Voyage Embeddings</span>
              </div>
              {tier && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={13} style={{ opacity: 0.5 }} />
                  <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>{tier}</span>
                </div>
              )}
            </div>

            {agents.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    opacity: 0.4,
                    marginBottom: 8,
                  }}
                >
                  Agents
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {agents.map((a) => (
                    <span
                      key={a.agentId}
                      style={{
                        fontSize: "0.78rem",
                        padding: "3px 10px",
                        borderRadius: 12,
                        background: darkMode ? "rgba(0, 237, 100, 0.08)" : "rgba(0, 104, 74, 0.06)",
                        border: darkMode
                          ? "1px solid rgba(0, 237, 100, 0.15)"
                          : "1px solid rgba(0, 104, 74, 0.12)",
                        opacity: 0.8,
                      }}
                    >
                      {a.agentId} <span style={{ opacity: 0.5 }}>({a.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </GlassCard>
  );
}
