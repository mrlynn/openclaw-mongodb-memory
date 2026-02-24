"use client";

import React, { useState, useEffect } from "react";
import { Body } from "@leafygreen-ui/typography";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import { Toast } from "@leafygreen-ui/toast";
import Icon from "@leafygreen-ui/icon";
import ExpandableCard from "@leafygreen-ui/expandable-card";

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7654";

interface StageResult {
  stage: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  itemsProcessed?: number;
  itemsCreated?: number;
  itemsUpdated?: number;
  error?: string;
}

interface Job {
  id: string;
  agentId: string;
  sessionId?: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stageCount: number;
  completedStages: number;
  error?: string;
  stages?: StageResult[];
}

export function ReflectionJobsContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agentId] = useState("openclaw");

  useEffect(() => {
    loadJobs();
  }, [agentId]);

  const loadJobs = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${DAEMON_URL}/reflect/jobs?agentId=${agentId}&limit=20`);
      const data = await response.json();

      if (!data.success) {
        throw new Error("Failed to load reflection jobs");
      }

      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const loadJobDetails = async (jobId: string) => {
    try {
      const response = await fetch(`${DAEMON_URL}/reflect/status?jobId=${jobId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error("Failed to load job details");
      }

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                stages: data.job.stages,
              }
            : j
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job details");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "yellow",
      running: "blue",
      complete: "green",
      failed: "red",
    };
    return <Badge variant={variants[status] || "lightgray"}>{status}</Badge>;
  };

  return (
    <div style={{ maxWidth: "1400px" }}>
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

      <Card style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Badge variant="blue">{jobs.length} Recent Jobs</Badge>
          <Button onClick={loadJobs} disabled={loading} size="small">
            <Icon glyph="Refresh" /> Refresh
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <Body>Loading jobs...</Body>
        </Card>
      ) : jobs.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <Icon glyph="InviteUser" size={48} style={{ opacity: 0.3, marginBottom: "16px" }} />
          <Body>No reflection jobs found</Body>
          <Body style={{ fontSize: "12px", marginTop: "8px", opacity: 0.7 }}>
            Trigger a job with: POST /reflect
          </Body>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {jobs.map((job) => (
            <ExpandableCard
              key={job.id}
              title={
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {getStatusBadge(job.status)}
                  <span>Job {job.id.slice(0, 8)}...</span>
                  {job.sessionId && (
                    <Badge variant="lightgray">Session: {job.sessionId.slice(0, 8)}</Badge>
                  )}
                </div>
              }
              description={
                <span style={{ fontSize: "12px" }}>
                  {formatDate(job.createdAt)} •{" "}
                  {job.completedStages}/{job.stageCount} stages •{" "}
                  {job.completedAt
                    ? `Completed in ${Math.round(
                        (new Date(job.completedAt).getTime() -
                          new Date(job.startedAt || job.createdAt).getTime()) /
                          1000
                      )}s`
                    : "In progress"}
                </span>
              }
              onClick={() => !job.stages && loadJobDetails(job.id)}
            >
              {job.error && (
                <Card
                  style={{
                    padding: "12px",
                    backgroundColor: "#FFE4E4",
                    marginBottom: "12px",
                  }}
                >
                  <Body style={{ color: "#CC0000", fontSize: "12px" }}>
                    <strong>Error:</strong> {job.error}
                  </Body>
                </Card>
              )}

              {job.stages ? (
                <div style={{ marginTop: "16px" }}>
                  <Body style={{ fontWeight: 600, marginBottom: "12px" }}>
                    Stage Breakdown ({job.stages.length} stages)
                  </Body>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {job.stages.map((stage, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1px solid #E8EDEB",
                          borderRadius: "6px",
                          padding: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <Badge variant={stage.status === "complete" ? "green" : "lightgray"}>
                            {stage.stage}
                          </Badge>
                          {stage.status === "complete" && stage.duration && (
                            <span style={{ fontSize: "11px", opacity: 0.6 }}>
                              {stage.duration}ms
                            </span>
                          )}
                        </div>

                        {stage.status === "complete" && (
                          <div
                            style={{
                              fontSize: "11px",
                              opacity: 0.7,
                              display: "flex",
                              gap: "16px",
                            }}
                          >
                            {stage.itemsProcessed !== undefined && (
                              <span>Processed: {stage.itemsProcessed}</span>
                            )}
                            {stage.itemsCreated !== undefined && stage.itemsCreated > 0 && (
                              <span>Created: {stage.itemsCreated}</span>
                            )}
                            {stage.itemsUpdated !== undefined && stage.itemsUpdated > 0 && (
                              <span>Updated: {stage.itemsUpdated}</span>
                            )}
                          </div>
                        )}

                        {stage.error && (
                          <Body style={{ color: "#CC0000", fontSize: "11px", marginTop: "4px" }}>
                            {stage.error}
                          </Body>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Body style={{ textAlign: "center", padding: "20px", opacity: 0.5 }}>
                  Loading stage details...
                </Body>
              )}
            </ExpandableCard>
          ))}
        </div>
      )}
    </div>
  );
}
