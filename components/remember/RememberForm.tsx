"use client";

import { useState } from "react";
import TextInput from "@leafygreen-ui/text-input";
import TextArea from "@leafygreen-ui/text-area";
import Button from "@leafygreen-ui/button";
import { Chip } from "@leafygreen-ui/chip";
import Icon from "@leafygreen-ui/icon";
import { CheckCircle } from "lucide-react";
import { GlassCard } from "@/components/cards/GlassCard";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { rememberMemory } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import styles from "./RememberForm.module.css";

export function RememberForm() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();

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
    <GlassCard className={styles.form}>
      {success && (
        <div className={styles.successOverlay}>
          <CheckCircle size={64} className={styles.successIcon} />
          <div className={styles.successText}>Memory stored!</div>
        </div>
      )}

      <div className={styles.fields}>
        <TextInput
          label="Agent ID"
          value={agentId}
          onChange={(e) => handleAgentIdChange(e.target.value)}
          darkMode={darkMode}
        />

        <div>
          <TextArea
            label="Memory text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Enter a memory to store..."
            darkMode={darkMode}
          />
          <div className={styles.charCount}>{text.length} characters</div>
        </div>

        <div>
          <TextInput
            label="Tags (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. project, important, meeting"
            darkMode={darkMode}
          />
          {parsedTags.length > 0 && (
            <div className={styles.tagPreview}>
              {parsedTags.map((tag, i) => (
                <Chip key={i} label={tag} variant="blue" darkMode={darkMode} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div
            className={styles.advancedToggle}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Advanced options
            <Icon glyph={showAdvanced ? "ChevronUp" : "ChevronDown"} size={16} />
          </div>
          <div
            className={`${styles.advancedFields} ${showAdvanced ? styles.open : ""}`}
          >
            <TextArea
              label="Metadata (JSON)"
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              rows={3}
              placeholder='{"key": "value"}'
              darkMode={darkMode}
            />
            <TextInput
              label="TTL (seconds)"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              type="number"
              placeholder="Leave empty for permanent"
              darkMode={darkMode}
            />
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          darkMode={darkMode}
          className={styles.submitBtn}
        >
          {submitting ? "Storing..." : "Store Memory"}
        </Button>
      </div>
    </GlassCard>
  );
}
