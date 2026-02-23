"use client";

import { useState, useEffect } from "react";
import TextInput from "@leafygreen-ui/text-input";
import Button from "@leafygreen-ui/button";
import Banner from "@leafygreen-ui/banner";
import Icon from "@leafygreen-ui/icon";
import { Trash2 } from "lucide-react";
import { GlassCard } from "@/components/cards/GlassCard";
import { DeleteConfirmDialog } from "@/components/browser/DeleteConfirmDialog";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { clearMemories, purgeMemories } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";

export function DangerZone() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();

  const [agentId, setAgentId] = useState("demo-agent");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.AGENT_ID);
    if (stored) setAgentId(stored);
  }, []);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [clearDialog, setClearDialog] = useState(false);
  const [purgeDialog, setPurgeDialog] = useState(false);

  const handleClear = async () => {
    try {
      await clearMemories(daemonUrl, agentId);
      setMessage({
        type: "success",
        text: `All memories cleared for agent "${agentId}"`,
      });
      setClearDialog(false);
    } catch (err) {
      setMessage({ type: "error", text: String(err) });
      setClearDialog(false);
    }
  };

  const handlePurge = async () => {
    try {
      await purgeMemories(daemonUrl, agentId);
      setMessage({
        type: "success",
        text: `Memories purged for agent "${agentId}"`,
      });
      setPurgeDialog(false);
    } catch (err) {
      setMessage({ type: "error", text: String(err) });
      setPurgeDialog(false);
    }
  };

  return (
    <GlassCard
      glowColor="#DB3030"
      style={{
        border: darkMode
          ? "1px solid rgba(219, 48, 48, 0.12)"
          : "1px solid rgba(196, 88, 88, 0.15)",
      }}
    >
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Icon glyph="Warning" fill="#DB3030" />
          <span
            style={{
              color: "#DB3030",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 500,
              fontSize: "0.68rem",
            }}
          >
            Danger Zone
          </span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <TextInput
            label="Agent ID"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            darkMode={darkMode}
          />
        </div>

        {message && (
          <div style={{ marginBottom: 16 }}>
            <Banner
              variant={message.type === "success" ? "success" : "danger"}
              darkMode={darkMode}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Banner>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button
            variant="danger"
            leftGlyph={<Trash2 size={16} />}
            onClick={() => setClearDialog(true)}
            disabled={!agentId.trim()}
            darkMode={darkMode}
          >
            Clear All Memories
          </Button>
          <Button
            variant="danger"
            leftGlyph={<Trash2 size={16} />}
            onClick={() => setPurgeDialog(true)}
            disabled={!agentId.trim()}
            darkMode={darkMode}
          >
            Purge Old Memories
          </Button>
        </div>

        <span
          style={{
            display: "block",
            marginTop: 12,
            fontSize: "0.75rem",
            opacity: 0.4,
          }}
        >
          These actions are irreversible. All matching memories will be
          permanently deleted.
        </span>
      </div>

      <DeleteConfirmDialog
        open={clearDialog}
        title="Clear All Memories"
        description={`This will permanently delete ALL memories for agent "${agentId}". This action cannot be undone.`}
        requireConfirmText
        onConfirm={handleClear}
        onCancel={() => setClearDialog(false)}
      />

      <DeleteConfirmDialog
        open={purgeDialog}
        title="Purge Memories"
        description={`This will purge memories for agent "${agentId}". This action cannot be undone.`}
        requireConfirmText
        onConfirm={handlePurge}
        onCancel={() => setPurgeDialog(false)}
      />
    </GlassCard>
  );
}
