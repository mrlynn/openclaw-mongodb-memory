"use client";

import React, { useState, useEffect } from "react";
import { H3, Body, Subtitle } from "@leafygreen-ui/typography";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import { Toast } from "@leafygreen-ui/toast";
import TextInput from "@leafygreen-ui/text-input";
import TextArea from "@leafygreen-ui/text-area";
import ConfirmationModal from "@leafygreen-ui/confirmation-modal";

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7654";

interface ReflectionJob {
  id: string;
  agentId: string;
  sessionId?: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stages: Array<{
    stage: string;
    status: string;
    duration?: number;
    itemsProcessed?: number;
  }>;
  error?: string;
}

export function ReflectionPipelineControls({ agentId = "openclaw" }: { agentId?: string }) {
  const [jobs, setJobs] = useState<ReflectionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [sessionTranscript, setSessionTranscript] = useState("");
  const [triggerInProgress, setTriggerInProgress] = useState(false);

  useEffect(() => {
    loadRecentJobs();
  }, [agentId]);

  const loadRecentJobs = async () => {
    try {
      const response = await fetch(`${DAEMON_URL}/reflect/jobs?agentId=${agentId}&limit=5`);
      const data = await response.json();
      if (data.success && data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error("Failed to load reflection jobs:", err);
    }
  };

  const triggerReflection = async () => {
    setTriggerInProgress(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${DAEMON_URL}/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          sessionId: sessionId || undefined,
          sessionTranscript: sessionTranscript || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Reflection pipeline started (Job ID: ${data.jobId.slice(0, 8)}...)`);
        setShowTriggerModal(false);
        setSessionId("");
        setSessionTranscript("");
        setTimeout(() => loadRecentJobs(), 1000);
      } else {
        setError(data.error || "Failed to trigger reflection");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTriggerInProgress(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="green">Completed</Badge>;
      case "running":
        return <Badge variant="blue">Running</Badge>;
      case "failed":
        return <Badge variant="red">Failed</Badge>;
      case "pending":
        return <Badge variant="lightgray">Pending</Badge>;
      default:
        return <Badge variant="lightgray">{status}</Badge>;
    }
  };

  const formatDuration = (job: ReflectionJob) => {
    if (!job.startedAt || !job.completedAt) return "—";
    const duration = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  const formatDate = (date?: string) => {
    if (!date) return "—";
    return new Date(date).toLocaleTimeString();
  };

  return (
    <Card>
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
          <Icon glyph="Refresh" />
          <H3 style={{ marginLeft: "8px", marginBottom: 0 }}>Reflection Pipeline</H3>
        </div>

        <Body style={{ marginBottom: "24px" }}>
          Analyze and enrich memories through 9 stages: Extract → Deduplicate → Conflict-Check
          → Classify → Confidence-Update → Decay → Layer-Promote → Graph-Link → Entity-Update
        </Body>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <Button
            variant="primary"
            leftGlyph={<Icon glyph="Play" />}
            onClick={() => setShowTriggerModal(true)}
            disabled={loading}
          >
            Trigger Reflection
          </Button>
          <Button
            variant="default"
            leftGlyph={<Icon glyph="Refresh" />}
            onClick={loadRecentJobs}
            disabled={loading}
          >
            Refresh Jobs
          </Button>
        </div>

        {success && (
          <Toast variant="success" open={true} onClose={() => setSuccess("")}>
            {success}
          </Toast>
        )}
        {error && (
          <Toast variant="warning" open={true} onClose={() => setError("")}>
            {error}
          </Toast>
        )}

        <div style={{ marginTop: "24px" }}>
          <H3>Recent Jobs</H3>
          {jobs.length === 0 ? (
            <Body style={{ marginTop: "12px", opacity: 0.7 }}>
              No reflection jobs yet. Click "Trigger Reflection" to start one.
            </Body>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: "16px",
                    border: "1px solid #E8EDEB",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <code style={{ fontSize: "12px", color: "#001E17" }}>{job.id.slice(0, 8)}</code>
                      {getStatusBadge(job.status)}
                      <Body style={{ fontSize: "13px", opacity: 0.7 }}>
                        {job.stages?.length || 0}/9 stages
                      </Body>
                    </div>
                    {job.sessionId && (
                      <Body style={{ fontSize: "12px", opacity: 0.6 }}>
                        Session: {job.sessionId.slice(0, 12)}...
                      </Body>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Body style={{ fontSize: "13px" }}>
                      Started: {formatDate(job.startedAt)}
                    </Body>
                    <Body style={{ fontSize: "13px", opacity: 0.7 }}>
                      Duration: {formatDuration(job)}
                    </Body>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmationModal
          open={showTriggerModal}
          onConfirm={triggerReflection}
          onCancel={() => setShowTriggerModal(false)}
          title="Trigger Reflection Pipeline"
          buttonText="Start Pipeline"
          variant="primary"
          submitDisabled={triggerInProgress}
        >
          <Body style={{ marginBottom: "16px" }}>
            Run the full 9-stage reflection pipeline to analyze and enrich memories.
          </Body>

          <TextInput
            label="Session ID (optional)"
            description="Limit reflection to a specific session"
            placeholder="Leave blank to process all recent memories"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            style={{ marginBottom: "16px" }}
          />

          <TextArea
            label="Session Transcript (optional)"
            description="Provide context for better extraction"
            placeholder="e.g., User discussed TypeScript and MongoDB..."
            value={sessionTranscript}
            onChange={(e) => setSessionTranscript(e.target.value)}
            rows={4}
          />

          <Body style={{ marginTop: "16px", fontSize: "12px", opacity: 0.7 }}>
            The pipeline runs asynchronously and typically completes in 1-5 seconds.
            Refresh the jobs table to see progress.
          </Body>
        </ConfirmationModal>
      </div>
    </Card>
  );
}
