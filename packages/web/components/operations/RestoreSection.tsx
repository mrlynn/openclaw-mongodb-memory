"use client";

import { useState, useRef, useEffect } from "react";
import Button from "@leafygreen-ui/button";
import TextInput from "@leafygreen-ui/text-input";
import Banner from "@leafygreen-ui/banner";
import { Upload, FileCheck, AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { GlassCard } from "@/components/cards/GlassCard";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { restoreMemories, RestoreResponse } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";

interface ParsedBackup {
  agentId: string;
  count: number;
  exportedAt: string;
  memories: Array<{
    text: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
    expiresAt?: string | null;
  }>;
}

export function RestoreSection() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [agentIdOverride, setAgentIdOverride] = useState("");
  const [parsedFile, setParsedFile] = useState<ParsedBackup | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<RestoreResponse | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.AGENT_ID);
    if (stored) setAgentIdOverride(stored);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setParsedFile(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Validate shape
        if (!json.memories || !Array.isArray(json.memories)) {
          setParseError(
            "Invalid backup file: missing 'memories' array. Make sure this is an OpenClaw export file.",
          );
          return;
        }
        if (json.memories.length === 0) {
          setParseError("Backup file contains no memories.");
          return;
        }

        // Validate each memory has a text field
        const invalid = json.memories.findIndex(
          (m: Record<string, unknown>) => !m.text || typeof m.text !== "string",
        );
        if (invalid !== -1) {
          setParseError(`Memory at index ${invalid} is missing the required 'text' field.`);
          return;
        }

        setParsedFile({
          agentId: json.agentId || "unknown",
          count: json.memories.length,
          exportedAt: json.exportedAt || "unknown",
          memories: json.memories,
        });

        // Pre-fill agent ID from backup if not already set
        if (json.agentId && json.agentId !== "all") {
          setAgentIdOverride(json.agentId);
        }
      } catch {
        setParseError("Failed to parse JSON file. Is this a valid JSON file?");
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!parsedFile || !agentIdOverride.trim()) return;
    setRestoring(true);
    setResult(null);
    try {
      const resp = await restoreMemories(daemonUrl, agentIdOverride, parsedFile.memories);
      setResult(resp);
    } catch (err) {
      setResult({
        success: false,
        totalReceived: parsedFile.count,
        totalInserted: 0,
        errors: [
          {
            index: -1,
            snippet: "",
            error: err instanceof Error ? err.message : String(err),
          },
        ],
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleClear = () => {
    setParsedFile(null);
    setFileName("");
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatDate = (iso: string) => {
    try {
      if (iso === "unknown") return "Unknown";
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
          <Upload size={16} style={{ opacity: 0.7 }} />
          <span
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 500,
              fontSize: "0.68rem",
              opacity: 0.6,
            }}
          >
            Restore
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
          Upload a previously exported backup file to restore memories. Each memory will be
          re-embedded using the current embedding model.
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {/* File selection */}
        {!parsedFile && !parseError && (
          <Button
            variant="default"
            leftGlyph={<Upload size={16} />}
            onClick={() => fileInputRef.current?.click()}
            darkMode={darkMode}
          >
            Select Backup File
          </Button>
        )}

        {/* Parse error */}
        {parseError && (
          <div style={{ marginBottom: 16 }}>
            <Banner variant="danger" darkMode={darkMode}>
              {parseError}
            </Banner>
            <div style={{ marginTop: 12 }}>
              <Button variant="default" size="small" onClick={handleClear} darkMode={darkMode}>
                Try another file
              </Button>
            </div>
          </div>
        )}

        {/* File preview */}
        {parsedFile && !result && (
          <div>
            {/* Preview card */}
            <div
              style={{
                border: darkMode
                  ? "1px solid rgba(0, 237, 100, 0.15)"
                  : "1px solid rgba(0, 104, 74, 0.12)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
                background: darkMode ? "rgba(0, 237, 100, 0.03)" : "rgba(0, 104, 74, 0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <FileCheck size={16} style={{ color: "#00ED64" }} />
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: "0.88rem",
                  }}
                >
                  {fileName}
                </span>
                <button
                  onClick={handleClear}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    opacity: 0.4,
                    padding: 4,
                  }}
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                  fontSize: "0.82rem",
                }}
              >
                <div>
                  <span style={{ opacity: 0.5, display: "block" }}>Memories</span>
                  <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>
                    {parsedFile.count.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ opacity: 0.5, display: "block" }}>Source Agent</span>
                  <span style={{ fontWeight: 500 }}>{parsedFile.agentId}</span>
                </div>
                <div>
                  <span style={{ opacity: 0.5, display: "block" }}>Exported</span>
                  <span style={{ fontWeight: 500 }}>{formatDate(parsedFile.exportedAt)}</span>
                </div>
              </div>
            </div>

            {/* Agent ID override */}
            <div style={{ marginBottom: 20, maxWidth: 340 }}>
              <TextInput
                label="Restore as Agent ID"
                description="Which agent should own these memories?"
                value={agentIdOverride}
                onChange={(e) => setAgentIdOverride(e.target.value)}
                darkMode={darkMode}
              />
            </div>

            {/* Warning */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 20,
                fontSize: "0.78rem",
                opacity: 0.5,
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Restoring will create new copies of all memories, even if identical ones already
                exist. Each memory will be re-embedded, which may take a moment.
              </span>
            </div>

            {/* Restore button */}
            <Button
              variant="primary"
              leftGlyph={<Upload size={16} />}
              onClick={handleRestore}
              disabled={restoring || !agentIdOverride.trim()}
              darkMode={darkMode}
            >
              {restoring
                ? `Restoring ${parsedFile.count} memories...`
                : `Restore ${parsedFile.count} Memories`}
            </Button>

            {/* Loading indicator */}
            {restoring && (
              <div
                style={{
                  marginTop: 16,
                  fontSize: "0.82rem",
                  opacity: 0.6,
                }}
              >
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 2,
                      background: "#00ED64",
                      animation: "restoreProgress 2s ease-in-out infinite",
                    }}
                  />
                </div>
                <style>
                  {`@keyframes restoreProgress {
                    0% { width: 0%; margin-left: 0%; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                  }`}
                </style>
                Re-embedding and inserting memories... This may take a moment for large backups.
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ marginTop: parsedFile ? 0 : 16 }}>
            <Banner variant={result.success ? "success" : "warning"} darkMode={darkMode}>
              {result.success
                ? `Successfully restored ${result.totalInserted} memories.`
                : `Restored ${result.totalInserted} of ${result.totalReceived} memories with ${result.errors.length} error(s).`}
            </Banner>

            {/* Error details */}
            {result.errors.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.78rem",
                    opacity: 0.6,
                    padding: 0,
                    color: "inherit",
                  }}
                >
                  {showErrors ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {result.errors.length} error(s)
                </button>

                {showErrors && (
                  <div
                    style={{
                      marginTop: 8,
                      maxHeight: 200,
                      overflow: "auto",
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      background: darkMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)",
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: 8,
                          paddingBottom: 8,
                          borderBottom:
                            i < result.errors.length - 1
                              ? "1px solid rgba(128,128,128,0.15)"
                              : "none",
                        }}
                      >
                        <div style={{ opacity: 0.5 }}>
                          {err.index >= 0 ? `Memory #${err.index + 1}` : "Request error"}
                        </div>
                        {err.snippet && (
                          <div
                            style={{
                              opacity: 0.7,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 400,
                            }}
                          >
                            {err.snippet}...
                          </div>
                        )}
                        <div style={{ color: "#DB3030" }}>{err.error}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <Button variant="default" size="small" onClick={handleClear} darkMode={darkMode}>
                Restore another file
              </Button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
