"use client";

import { useState } from "react";
import TextInput from "@leafygreen-ui/text-input";
import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import { Unlink } from "lucide-react";
import { GlassCard } from "@/components/cards/GlassCard";
import { StatusIndicator } from "@/components/cards/StatusIndicator";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { fetchHealth } from "@/lib/api";
import { DEFAULT_DAEMON_URL } from "@/lib/constants";
import styles from "./DaemonUrlConfig.module.css";

type TestStatus = "idle" | "testing" | "connected" | "error";

export function DaemonUrlConfig() {
  const { daemonUrl, setDaemonUrl, isDefault } = useDaemonConfig();
  const { darkMode } = useThemeMode();

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
      <div className={styles.content}>
        <div className={styles.sectionLabel}>Daemon Connection</div>

        <div className={styles.urlRow}>
          <div className={styles.urlInput}>
            <TextInput
              label="Daemon URL"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setTestStatus("idle");
              }}
              placeholder="http://localhost:7654"
              darkMode={darkMode}
            />
          </div>
          <Button
            variant="default"
            onClick={handleTest}
            disabled={testStatus === "testing" || !inputUrl.trim()}
            darkMode={darkMode}
            leftGlyph={
              testStatus === "connected" ? (
                <Icon glyph="Checkmark" />
              ) : testStatus === "error" ? (
                <Unlink size={16} />
              ) : undefined
            }
          >
            {testStatus === "testing" ? "Testing..." : "Test Connection"}
          </Button>
        </div>

        {testMessage && (
          <div className={styles.feedback}>
            {testStatus === "connected" && (
              <StatusIndicator status="connected" size="small" />
            )}
            {testStatus === "error" && (
              <StatusIndicator status="error" size="small" />
            )}
            <span
              className={
                testStatus === "connected"
                  ? styles.feedbackSuccess
                  : testStatus === "error"
                    ? styles.feedbackError
                    : styles.feedbackNeutral
              }
            >
              {testMessage}
            </span>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasChanges || !inputUrl.trim()}
            darkMode={darkMode}
          >
            Save
          </Button>
          {!isDefault && (
            <Button variant="default" onClick={handleReset} darkMode={darkMode}>
              Reset to Default
            </Button>
          )}
        </div>

        <span className={styles.currentUrl}>
          Current: {daemonUrl}
          {isDefault && " (default)"}
        </span>
      </div>
    </GlassCard>
  );
}
