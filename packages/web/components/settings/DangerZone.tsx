"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  useTheme,
  CardContent,
} from "@mui/material";
import { Warning, DeleteForever } from "@mui/icons-material";
import { GlassCard } from "@/components/cards/GlassCard";
import { DeleteConfirmDialog } from "@/components/browser/DeleteConfirmDialog";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { clearMemories, purgeMemories } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";

export function DangerZone() {
  const { daemonUrl } = useDaemonConfig();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [agentId, setAgentId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AGENT_ID) || "demo-agent";
    }
    return "demo-agent";
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [clearDialog, setClearDialog] = useState(false);
  const [purgeDialog, setPurgeDialog] = useState(false);

  const handleClear = async () => {
    try {
      await clearMemories(daemonUrl, agentId);
      setMessage({ type: "success", text: `All memories cleared for agent "${agentId}"` });
      setClearDialog(false);
    } catch (err) {
      setMessage({ type: "error", text: String(err) });
      setClearDialog(false);
    }
  };

  const handlePurge = async () => {
    try {
      await purgeMemories(daemonUrl, agentId);
      setMessage({ type: "success", text: `Memories purged for agent "${agentId}"` });
      setPurgeDialog(false);
    } catch (err) {
      setMessage({ type: "error", text: String(err) });
      setPurgeDialog(false);
    }
  };

  return (
    <GlassCard
      glowColor="#e87878"
      sx={{
        border: isDark
          ? "1px solid rgba(232, 120, 120, 0.12)"
          : "1px solid rgba(196, 88, 88, 0.15)",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Warning sx={{ color: "error.main", fontSize: 20 }} />
          <Typography
            variant="subtitle2"
            sx={{
              color: "error.main",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 500,
              fontSize: "0.68rem",
            }}
          >
            Danger Zone
          </Typography>
        </Box>

        <TextField
          label="Agent ID"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          size="small"
          fullWidth
          sx={{ mb: 2.5 }}
        />

        {message && (
          <Alert
            severity={message.type}
            sx={{ mb: 2, borderRadius: 2 }}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForever />}
            onClick={() => setClearDialog(true)}
            disabled={!agentId.trim()}
          >
            Clear All Memories
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForever />}
            onClick={() => setPurgeDialog(true)}
            disabled={!agentId.trim()}
          >
            Purge Old Memories
          </Button>
        </Box>

        <Typography variant="caption" sx={{ color: "text.disabled", mt: 1.5, display: "block" }}>
          These actions are irreversible. All matching memories will be permanently deleted.
        </Typography>
      </CardContent>

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
