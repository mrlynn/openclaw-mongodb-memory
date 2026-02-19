"use client";

import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Chip,
  Typography,
  Collapse,
  IconButton,
  useTheme,
  Grow,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  CheckCircle,
} from "@mui/icons-material";
import { GlassCard } from "@/components/cards/GlassCard";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { rememberMemory } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { keyframes } from "@emotion/react";
import { CardContent } from "@mui/material";

const checkPop = keyframes`
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
`;

const ringExpand = keyframes`
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
`;

export function RememberForm() {
  const { daemonUrl } = useDaemonConfig();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [agentId, setAgentId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AGENT_ID) || "demo-agent";
    }
    return "demo-agent";
  });
  const [text, setText] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metadata, setMetadata] = useState("");
  const [ttl, setTtl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleAgentIdChange = (value: string) => {
    setAgentId(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.AGENT_ID, value);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      let parsedMetadata = {};
      if (metadata.trim()) {
        try {
          parsedMetadata = JSON.parse(metadata);
        } catch {
          setError("Invalid JSON in metadata field");
          setSubmitting(false);
          return;
        }
      }

      await rememberMemory(daemonUrl, agentId, text, {
        tags: parsedTags,
        metadata: parsedMetadata,
        ttl: ttl ? parseInt(ttl, 10) : undefined,
      });

      setText("");
      setTagsInput("");
      setMetadata("");
      setTtl("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassCard sx={{ position: "relative", overflow: "hidden" }}>
      {/* Success overlay */}
      {success && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 10,
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Box sx={{ position: "relative" }}>
            <CheckCircle
              sx={{
                fontSize: 64,
                color: "#7ec8a4",
                animation: `${checkPop} 0.4s ease-out`,
              }}
            />
            <Box
              sx={{
                position: "absolute",
                inset: -8,
                borderRadius: "50%",
                border: "2px solid #7ec8a4",
                animation: `${ringExpand} 0.6s ease-out forwards`,
              }}
            />
          </Box>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Memory stored!
          </Typography>
        </Box>
      )}

      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <TextField
            label="Agent ID"
            value={agentId}
            onChange={(e) => handleAgentIdChange(e.target.value)}
            fullWidth
            size="small"
          />

          <Box>
            <TextField
              label="Memory text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              multiline
              rows={5}
              fullWidth
              placeholder="Enter a memory to store..."
            />
            <Typography
              variant="caption"
              sx={{ color: "text.disabled", mt: 0.5, display: "block", textAlign: "right" }}
            >
              {text.length} characters
            </Typography>
          </Box>

          <Box>
            <TextField
              label="Tags (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. project, important, meeting"
            />
            {parsedTags.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                {parsedTags.map((tag, i) => (
                  <Chip
                    key={i}
                    label={tag}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Advanced options */}
          <Box>
            <Box
              onClick={() => setShowAdvanced(!showAdvanced)}
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                color: "text.secondary",
                "&:hover": { color: "text.primary" },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Advanced options
              </Typography>
              <IconButton size="small">
                {showAdvanced ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            <Collapse in={showAdvanced}>
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
              >
                <TextField
                  label="Metadata (JSON)"
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  placeholder='{"key": "value"}'
                />
                <TextField
                  label="TTL (seconds)"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="Leave empty for permanent"
                />
              </Box>
            </Collapse>
          </Box>

          {error && (
            <Typography variant="body2" sx={{ color: "error.main" }}>
              {error}
            </Typography>
          )}

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            size="large"
            sx={{ mt: 1 }}
          >
            {submitting ? "Storing..." : "Store Memory"}
          </Button>
        </Box>
      </CardContent>
    </GlassCard>
  );
}
