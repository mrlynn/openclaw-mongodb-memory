"use client";

import { useState, useEffect, useCallback } from "react";
import TextInput from "@leafygreen-ui/text-input";
import Button from "@leafygreen-ui/button";
import Toggle from "@leafygreen-ui/toggle";
import Banner from "@leafygreen-ui/banner";
import { GlassCard } from "@/components/cards/GlassCard";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import styles from "./SemanticConfig.module.css";

type SemanticLevel = "off" | "basic" | "enhanced" | "full";

interface StageConfig {
  useLlm: boolean;
}

interface LlmProvider {
  endpoint?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface ResolvedSettings {
  stages: Record<string, { useLlm: boolean }>;
  llmProvider: {
    endpoint: string;
    model: string;
    apiKey?: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
}

interface SettingsResponse {
  success: boolean;
  settings: {
    agentId: string;
    semanticLevel: SemanticLevel;
    stages: Record<string, StageConfig>;
    llmProvider: LlmProvider;
  } | null;
  resolved: ResolvedSettings;
  source: string;
}

const STAGE_INFO: Array<{ key: string; label: string; description: string }> = [
  {
    key: "extract",
    label: "Extract",
    description: "LLM identifies facts, preferences, and decisions from transcripts",
  },
  {
    key: "classify",
    label: "Classify",
    description: "LLM determines memory type, layer, and confidence",
  },
  {
    key: "entityUpdate",
    label: "Entity Update",
    description: "LLM performs named entity recognition with alias detection",
  },
  {
    key: "graphLink",
    label: "Graph Link",
    description: "LLM discovers semantic edges (causes, supports, etc.)",
  },
  {
    key: "layerPromote",
    label: "Layer Promote",
    description: "LLM reviews borderline promotion/demotion decisions",
  },
];

const LEVEL_INFO: Array<{ value: SemanticLevel; label: string; description: string }> = [
  { value: "off", label: "Off", description: "All heuristic-based (no LLM calls)" },
  { value: "basic", label: "Basic", description: "Extract stage only" },
  { value: "enhanced", label: "Enhanced", description: "Extract + Classify + Entity Update" },
  { value: "full", label: "Full", description: "All 5 stages use LLM" },
];

// Agent ID for settings — using _global for now
const SETTINGS_AGENT_ID = "_global";

export function SemanticConfig() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [semanticLevel, setSemanticLevel] = useState<SemanticLevel>("off");
  const [stageOverrides, setStageOverrides] = useState<Record<string, boolean>>({});
  const [llmEndpoint, setLlmEndpoint] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");

  const [resolved, setResolved] = useState<ResolvedSettings | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${daemonUrl}/settings/${SETTINGS_AGENT_ID}`);
      const data: SettingsResponse = await res.json();

      if (data.success) {
        if (data.settings) {
          setSemanticLevel(data.settings.semanticLevel || "off");
          const overrides: Record<string, boolean> = {};
          if (data.settings.stages) {
            for (const [key, config] of Object.entries(data.settings.stages)) {
              overrides[key] = config.useLlm;
            }
          }
          setStageOverrides(overrides);
          setLlmEndpoint(data.settings.llmProvider?.endpoint || "");
          setLlmModel(data.settings.llmProvider?.model || "");
          setLlmApiKey(data.settings.llmProvider?.apiKey || "");
        }
        setResolved(data.resolved);
      }
    } catch (err) {
      setError(`Failed to load settings: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [daemonUrl]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const body: Record<string, unknown> = { semanticLevel };

      // Only include non-empty provider fields
      const llmProvider: LlmProvider = {};
      if (llmEndpoint) llmProvider.endpoint = llmEndpoint;
      if (llmModel) llmProvider.model = llmModel;
      if (llmApiKey) llmProvider.apiKey = llmApiKey;
      if (Object.keys(llmProvider).length > 0) {
        body.llmProvider = llmProvider;
      }

      // Include stage overrides
      const stages: Record<string, StageConfig> = {};
      for (const [key, value] of Object.entries(stageOverrides)) {
        stages[key] = { useLlm: value };
      }
      if (Object.keys(stages).length > 0) {
        body.stages = stages;
      }

      const res = await fetch(`${daemonUrl}/settings/${SETTINGS_AGENT_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg("Settings saved successfully");
        setTimeout(() => setSuccessMsg(""), 3000);
        await loadSettings(); // Reload to get resolved view
      } else {
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      setError(`Failed to save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestLlm = async () => {
    setTestStatus("testing");
    setTestMessage("");

    try {
      const res = await fetch(`${daemonUrl}/settings/${SETTINGS_AGENT_ID}/test-llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.success) {
        setTestStatus("success");
        setTestMessage(`Connected to ${data.model} (${data.responseTime}ms)`);
      } else {
        setTestStatus("error");
        setTestMessage(data.error || "Connection failed");
      }
    } catch (err) {
      setTestStatus("error");
      setTestMessage(`Test failed: ${String(err)}`);
    }
  };

  const handleStageToggle = (stageKey: string, value: boolean) => {
    setStageOverrides((prev) => ({ ...prev, [stageKey]: value }));
  };

  if (loading) {
    return (
      <GlassCard>
        <div className={styles.loadingState}>Loading semantic settings...</div>
      </GlassCard>
    );
  }

  return (
    <div className={styles.container}>
      {error && <Banner variant="danger">{error}</Banner>}
      {successMsg && <Banner variant="success">{successMsg}</Banner>}

      {/* Semantic Level */}
      <GlassCard>
        <h3 className={styles.sectionTitle}>Semantic Level</h3>
        <p className={styles.sectionDescription}>
          Choose how much LLM processing to apply during memory reflection.
        </p>
        <div className={styles.levelGrid}>
          {LEVEL_INFO.map((level) => (
            <button
              key={level.value}
              className={`${styles.levelOption} ${semanticLevel === level.value ? styles.levelOptionActive : ""}`}
              onClick={() => setSemanticLevel(level.value)}
            >
              <span className={styles.levelLabel}>{level.label}</span>
              <span className={styles.levelDescription}>{level.description}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Per-Stage Toggles */}
      <GlassCard>
        <h3 className={styles.sectionTitle}>Stage Overrides</h3>
        <p className={styles.sectionDescription}>
          Fine-tune which stages use LLM. Overrides the semantic level setting above.
        </p>
        <div className={styles.stageList}>
          {STAGE_INFO.map((stage) => {
            const resolvedValue = resolved?.stages?.[stage.key]?.useLlm ?? false;
            const hasOverride = stageOverrides[stage.key] !== undefined;

            return (
              <div key={stage.key} className={styles.stageRow}>
                <div className={styles.stageInfo}>
                  <span className={styles.stageLabel}>{stage.label}</span>
                  <span className={styles.stageDescription}>{stage.description}</span>
                </div>
                <div className={styles.stageToggle}>
                  <Toggle
                    aria-label={`Enable LLM for ${stage.label}`}
                    darkMode={darkMode}
                    checked={hasOverride ? stageOverrides[stage.key] : resolvedValue}
                    onChange={(checked) => handleStageToggle(stage.key, checked)}
                    size="small"
                  />
                  {resolved && (
                    <span
                      className={`${styles.resolvedBadge} ${resolvedValue ? styles.badgeOn : styles.badgeOff}`}
                    >
                      {resolvedValue ? "LLM" : "Heuristic"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* LLM Provider */}
      <GlassCard>
        <h3 className={styles.sectionTitle}>LLM Provider</h3>
        <p className={styles.sectionDescription}>
          Configure the LLM endpoint used for semantic processing. Leave blank to use environment
          defaults.
        </p>
        <div className={styles.providerForm}>
          <TextInput
            label="Endpoint URL"
            placeholder="http://localhost:11434/api/generate"
            value={llmEndpoint}
            onChange={(e) => setLlmEndpoint(e.target.value)}
            darkMode={darkMode}
          />
          <TextInput
            label="Model"
            placeholder="llama3.2:3b"
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            darkMode={darkMode}
          />
          <TextInput
            label="API Key (optional)"
            placeholder="For OpenAI-compatible APIs"
            value={llmApiKey}
            onChange={(e) => setLlmApiKey(e.target.value)}
            type="password"
            darkMode={darkMode}
          />
          <div className={styles.testRow}>
            <Button
              variant="default"
              size="small"
              onClick={handleTestLlm}
              disabled={testStatus === "testing"}
              darkMode={darkMode}
            >
              {testStatus === "testing" ? "Testing..." : "Test Connection"}
            </Button>
            {testMessage && (
              <span
                className={`${styles.testMessage} ${testStatus === "success" ? styles.testSuccess : styles.testError}`}
              >
                {testMessage}
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Save Button */}
      <div className={styles.saveRow}>
        <Button variant="primary" onClick={handleSave} disabled={saving} darkMode={darkMode}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
