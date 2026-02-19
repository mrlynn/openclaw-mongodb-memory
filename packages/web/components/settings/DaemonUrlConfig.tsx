"use client";

import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  useTheme,
  CardContent,
} from "@mui/material";
import { LinkOff, Check, Refresh } from "@mui/icons-material";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatusIndicator } from "@/components/cards/StatusIndicator";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { fetchHealth } from "@/lib/api";
import { DEFAULT_DAEMON_URL } from "@/lib/constants";

type TestStatus = "idle" | "testing" | "connected" | "error";

export function DaemonUrlConfig() {
  const { daemonUrl, setDaemonUrl, isDefault } = useDaemonConfig();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [inputUrl, setInputUrl] = useState(daemonUrl);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  const hasChanges = inputUrl !== daemonUrl;

  const handleTest = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      await fetchHealth(inputUrl);
      setTestStatus("connected");
      setTestMessage("Connection successful!");
    } catch (err) {
      setTestStatus("error");
      setTestMessage(`Connection failed: ${String(err)}`);
    }
  };

  const handleSave = () => {
    setDaemonUrl(inputUrl);
    setTestStatus("idle");
    setTestMessage("Saved!");
    setTimeout(() => setTestMessage(""), 2000);
  };

  const handleReset = () => {
    setInputUrl(DEFAULT_DAEMON_URL);
    setDaemonUrl(DEFAULT_DAEMON_URL);
    setTestStatus("idle");
    setTestMessage("Reset to default.");
    setTimeout(() => setTestMessage(""), 2000);
  };

  return (
    <GlassCard>
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 600,
            fontSize: "0.7rem",
            mb: 2,
          }}
        >
          Daemon Connection
        </Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
          <TextField
            label="Daemon URL"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              setTestStatus("idle");
            }}
            fullWidth
            size="small"
            placeholder="http://localhost:7654"
            sx={{ flex: 1, minWidth: 280 }}
          />
          <Button
            variant="outlined"
            onClick={handleTest}
            disabled={testStatus === "testing" || !inputUrl.trim()}
            startIcon={
              testStatus === "testing" ? (
                <Refresh sx={{ animation: "spin 1s linear infinite", "@keyframes spin": { "100%": { transform: "rotate(360deg)" } } }} />
              ) : testStatus === "connected" ? (
                <Check />
              ) : testStatus === "error" ? (
                <LinkOff />
              ) : undefined
            }
          >
            {testStatus === "testing" ? "Testing..." : "Test Connection"}
          </Button>
        </Box>

        {/* Status feedback */}
        {testMessage && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
            {testStatus === "connected" && (
              <StatusIndicator status="connected" size="small" />
            )}
            {testStatus === "error" && (
              <StatusIndicator status="error" size="small" />
            )}
            <Typography
              variant="body2"
              sx={{
                color:
                  testStatus === "connected"
                    ? "success.main"
                    : testStatus === "error"
                      ? "error.main"
                      : "text.secondary",
              }}
            >
              {testMessage}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 2, mt: 2.5 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!hasChanges || !inputUrl.trim()}
          >
            Save
          </Button>
          {!isDefault && (
            <Button variant="outlined" onClick={handleReset}>
              Reset to Default
            </Button>
          )}
        </Box>

        <Typography variant="caption" sx={{ color: "text.disabled", mt: 1.5, display: "block" }}>
          Current: {daemonUrl}
          {isDefault && " (default)"}
        </Typography>
      </CardContent>
    </GlassCard>
  );
}
