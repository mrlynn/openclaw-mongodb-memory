"use client";

import React, { useState, useEffect } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import { Toast } from "@leafygreen-ui/toast";
import ConfirmationModal from "@leafygreen-ui/confirmation-modal";
import { useThemeMode } from "@/contexts/ThemeContext";

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7654";

interface DecayStats {
  totalMemories: number;
  decayed: number;
  archivalCandidates: number;
  expirationCandidates: number;
  duration: number;
}

export function DecaySchedulerControls({ agentId = "openclaw" }: { agentId?: string }) {
  const { darkMode } = useThemeMode();
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [lastStats, setLastStats] = useState<DecayStats | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showTriggerModal, setShowTriggerModal] = useState(false);

  useEffect(() => {
    // Try to load last run info from localStorage
    const stored = localStorage.getItem("decay-last-run");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setLastRun(data.timestamp);
        setLastStats(data.stats);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleTrigger = async () => {
    setRunning(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${DAEMON_URL}/decay${agentId ? `?agentId=${agentId}` : ""}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to trigger decay");
      }

      const stats: DecayStats = data.stats;

      setLastStats(stats);
      const timestamp = new Date().toISOString();
      setLastRun(timestamp);

      // Store in localStorage
      localStorage.setItem(
        "decay-last-run",
        JSON.stringify({
          timestamp,
          stats,
        }),
      );

      setSuccess(
        `Decay complete: ${stats.decayed} memories decayed, ${stats.expirationCandidates} candidates flagged`,
      );
      setShowTriggerModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger decay");
    } finally {
      setRunning(false);
    }
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card style={{ padding: "20px" }}>
      {success && (
        <Toast
          variant="success"
          title="Success"
          onClose={() => setSuccess("")}
          style={{ marginBottom: "16px" }}
        >
          {success}
        </Toast>
      )}

      {error && (
        <Toast
          variant="warning"
          title="Error"
          onClose={() => setError("")}
          style={{ marginBottom: "16px" }}
        >
          {error}
        </Toast>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <H3>Decay Scheduler</H3>
          <Body style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
            Temporal decay runs automatically at 02:00 daily
          </Body>
        </div>
        <Badge variant="green">
          <Icon glyph="Checkmark" size={12} style={{ marginRight: "4px" }} />
          Active
        </Badge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E8EDEB",
            borderRadius: "8px",
            padding: "16px",
            backgroundColor: darkMode ? "rgba(255, 255, 255, 0.03)" : "transparent",
          }}
        >
          <Body style={{ fontSize: "12px", opacity: 0.7, marginBottom: "8px" }}>Schedule</Body>
          <Body style={{ fontWeight: 600 }}>Daily at 02:00</Body>
          <Body style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>24-hour interval</Body>
        </div>

        <div
          style={{
            border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E8EDEB",
            borderRadius: "8px",
            padding: "16px",
            backgroundColor: darkMode ? "rgba(255, 255, 255, 0.03)" : "transparent",
          }}
        >
          <Body style={{ fontSize: "12px", opacity: 0.7, marginBottom: "8px" }}>Last Run</Body>
          <Body style={{ fontWeight: 600 }}>{lastRun ? formatDate(lastRun) : "Never"}</Body>
          {lastStats && (
            <Body style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>
              {lastStats.duration}ms duration
            </Body>
          )}
        </div>

        {lastStats && (
          <div
            style={{
              border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E8EDEB",
              borderRadius: "8px",
              padding: "16px",
              backgroundColor: darkMode ? "rgba(255, 255, 255, 0.03)" : "transparent",
            }}
          >
            <Body style={{ fontSize: "12px", opacity: 0.7, marginBottom: "8px" }}>
              Last Results
            </Body>
            <Body style={{ fontWeight: 600 }}>
              {lastStats.decayed}/{lastStats.totalMemories} decayed
            </Body>
            {lastStats.expirationCandidates > 0 && (
              <Body style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px", color: "#CC0000" }}>
                ⚠ {lastStats.expirationCandidates} expiration candidates
              </Body>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E8EDEB",
          paddingTop: "16px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <Button
          onClick={() => setShowTriggerModal(true)}
          disabled={running}
          variant="primary"
          leftGlyph={<Icon glyph="Refresh" />}
        >
          {running ? "Running..." : "Trigger Decay Now"}
        </Button>

        <Body style={{ fontSize: "11px", opacity: 0.6 }}>
          <Icon glyph="InfoWithCircle" size={12} style={{ marginRight: "4px" }} />
          Manual trigger applies decay to all memories immediately
        </Body>
      </div>

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          backgroundColor: darkMode ? "rgba(255, 255, 255, 0.05)" : "#F9FBFA",
          borderRadius: "6px",
          border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #E8EDEB",
        }}
      >
        <Body style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
          Decay Rates by Layer
        </Body>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <Body style={{ fontSize: "11px" }}>
            <strong>Working:</strong> 0.05/day (fast)
          </Body>
          <Body style={{ fontSize: "11px" }}>
            <strong>Episodic:</strong> 0.015/day
          </Body>
          <Body style={{ fontSize: "11px" }}>
            <strong>Semantic:</strong> 0.003/day
          </Body>
          <Body style={{ fontSize: "11px" }}>
            <strong>Archival:</strong> 0.001/day (slow)
          </Body>
        </div>
      </div>

      {/* Trigger Confirmation Modal */}
      <ConfirmationModal
        open={showTriggerModal}
        onConfirm={handleTrigger}
        onCancel={() => setShowTriggerModal(false)}
        title="Trigger Decay Pass"
        buttonText="Run Decay"
        variant="primary"
      >
        <Body>Manually trigger a decay pass for all memories?</Body>
        <Body style={{ marginTop: "8px", fontSize: "12px", opacity: 0.7 }}>
          This will apply exponential decay based on time since last reinforcement. The scheduler
          will continue to run daily at 02:00.
        </Body>
      </ConfirmationModal>
    </Card>
  );
}
