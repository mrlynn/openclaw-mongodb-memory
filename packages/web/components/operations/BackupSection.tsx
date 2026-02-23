"use client";

import { useState, useEffect } from "react";
import { Select, Option } from "@leafygreen-ui/select";
import Button from "@leafygreen-ui/button";
import Banner from "@leafygreen-ui/banner";
import Toggle from "@leafygreen-ui/toggle";
import { Download, Clock } from "lucide-react";
import { GlassCard } from "@/components/cards/GlassCard";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { exportAllMemories, fetchAgents, AgentInfo } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";

const LAST_BACKUP_KEY = "openclaw-last-backup";

export function BackupSection() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentId, setAgentId] = useState("");
  const [exportAll, setExportAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.AGENT_ID);
    if (stored) setAgentId(stored);
    const lastBackupTime = localStorage.getItem(LAST_BACKUP_KEY);
    if (lastBackupTime) setLastBackup(lastBackupTime);

    fetchAgents(daemonUrl)
      .then((list) => {
        setAgents(list);
        if (!stored && list.length > 0) {
          setAgentId(list[0].agentId);
        }
      })
      .catch(() => {});
  }, [daemonUrl]);

  const handleDownload = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await exportAllMemories(daemonUrl, exportAll ? undefined : agentId);

      // Create browser download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const agentLabel = exportAll ? "all-agents" : agentId;
      a.href = url;
      a.download = `openclaw-backup-${agentLabel}-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem(LAST_BACKUP_KEY, now);
      setLastBackup(now);
      setMessage({
        type: "success",
        text: `Exported ${data.count} memories to file`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

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
          <Download size={16} style={{ opacity: 0.7 }} />
          <span
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 500,
              fontSize: "0.68rem",
              opacity: 0.6,
            }}
          >
            Backup
          </span>
        </div>

        <p
          style={{
            fontSize: "0.85rem",
            opacity: 0.6,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Export your memories as a JSON file. Embeddings are excluded to save space — they will be
          regenerated on restore.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          {!exportAll && agents.length > 0 && (
            <div style={{ minWidth: 180 }}>
              <Select
                label="Agent"
                value={agentId}
                onChange={(val: string) => setAgentId(val)}
                size="small"
                darkMode={darkMode}
              >
                {agents.map((a) => (
                  <Option key={a.agentId} value={a.agentId}>
                    {a.agentId} ({a.count})
                  </Option>
                ))}
              </Select>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingBottom: 4,
            }}
          >
            <Toggle
              aria-label="Export all agents"
              size="small"
              checked={exportAll}
              onChange={(checked) => setExportAll(checked)}
              darkMode={darkMode}
            />
            <span style={{ fontSize: "0.82rem", opacity: 0.7 }}>Export all agents</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Button
            variant="primary"
            leftGlyph={<Download size={16} />}
            onClick={handleDownload}
            disabled={loading || (!exportAll && !agentId.trim())}
            darkMode={darkMode}
          >
            {loading ? "Exporting..." : "Download Backup"}
          </Button>

          {lastBackup && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.75rem",
                opacity: 0.4,
              }}
            >
              <Clock size={12} />
              Last backup: {formatDate(lastBackup)}
            </span>
          )}
        </div>

        {message && (
          <div style={{ marginTop: 16 }}>
            <Banner
              variant={message.type === "success" ? "success" : "danger"}
              darkMode={darkMode}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Banner>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
