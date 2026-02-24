"use client";

import React, { useState, useEffect } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import { Select, Option } from "@leafygreen-ui/select";
import { Toast } from "@leafygreen-ui/toast";
import TextArea from "@leafygreen-ui/text-area";
import ConfirmationModal from "@leafygreen-ui/confirmation-modal";
import Icon from "@leafygreen-ui/icon";

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7654";

interface Conflict {
  id: string;
  memoryA: {
    id: string;
    text: string;
    confidence?: number;
    createdAt: string;
    tags: string[];
  };
  memoryB: {
    id: string;
    text: string;
    confidence?: number;
    createdAt: string;
    tags: string[];
  };
  detectedAt: string;
  resolution: string;
}

export function ConflictsContent() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [agentId, setAgentId] = useState("openclaw");

  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [resolutionType, setResolutionType] = useState<"superseded" | "context-dependent" | "temporal">("superseded");
  const [resolutionNote, setResolutionNote] = useState("");
  const [supersededMemoryId, setSupersededMemoryId] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);

  useEffect(() => {
    loadConflicts();
  }, [agentId]);

  const loadConflicts = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${DAEMON_URL}/conflicts?agentId=${agentId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error("Failed to load conflicts");
      }

      setConflicts(data.conflicts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conflicts");
    } finally {
      setLoading(false);
    }
  };

  const openResolveModal = (conflict: Conflict) => {
    setSelectedConflict(conflict);
    setResolutionType("superseded");
    setResolutionNote("");
    setSupersededMemoryId("");
    setShowResolveModal(true);
  };

  const handleResolve = async () => {
    if (!selectedConflict) return;

    try {
      const response = await fetch(
        `${DAEMON_URL}/conflicts/${selectedConflict.id}/resolve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolution: resolutionType,
            resolutionNote,
            supersededMemoryId: resolutionType === "superseded" ? supersededMemoryId : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to resolve conflict");
      }

      setSuccess("Conflict resolved successfully");
      setShowResolveModal(false);
      setSelectedConflict(null);
      loadConflicts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve conflict");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

      <Card style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <Badge variant={conflicts.length > 0 ? "red" : "green"}>
            {conflicts.length} Unresolved Conflict{conflicts.length !== 1 ? "s" : ""}
          </Badge>
          <Button onClick={loadConflicts} disabled={loading} size="small">
            <Icon glyph="Refresh" /> Refresh
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <Body>Loading conflicts...</Body>
        </Card>
      ) : conflicts.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <Icon glyph="Checkmark" size={48} style={{ color: "#00684A", marginBottom: "16px" }} />
          <H3>No Conflicts Found</H3>
          <Body>All memories are consistent. Great work!</Body>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {conflicts.map((conflict) => (
            <Card key={conflict.id} style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <Badge variant="red">Contradiction</Badge>
                  <Body style={{ marginTop: "8px", fontSize: "12px", opacity: 0.7 }}>
                    Detected: {formatDate(conflict.detectedAt)}
                  </Body>
                </div>
                <Button onClick={() => openResolveModal(conflict)}>Resolve</Button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginTop: "16px",
                }}
              >
                {/* Memory A */}
                <div
                  style={{
                    border: "1px solid #E8EDEB",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <Badge variant="lightgray">Memory A</Badge>
                    {conflict.memoryA.confidence !== undefined && (
                      <Badge variant="blue">
                        {(conflict.memoryA.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    )}
                  </div>
                  <Body style={{ marginBottom: "12px" }}>{conflict.memoryA.text}</Body>
                  <div style={{ fontSize: "11px", opacity: 0.6 }}>
                    Created: {formatDate(conflict.memoryA.createdAt)}
                  </div>
                  {conflict.memoryA.tags.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {conflict.memoryA.tags.map((tag) => (
                        <Badge key={tag} variant="lightgray">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Memory B */}
                <div
                  style={{
                    border: "1px solid #E8EDEB",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <Badge variant="lightgray">Memory B</Badge>
                    {conflict.memoryB.confidence !== undefined && (
                      <Badge variant="blue">
                        {(conflict.memoryB.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    )}
                  </div>
                  <Body style={{ marginBottom: "12px" }}>{conflict.memoryB.text}</Body>
                  <div style={{ fontSize: "11px", opacity: 0.6 }}>
                    Created: {formatDate(conflict.memoryB.createdAt)}
                  </div>
                  {conflict.memoryB.tags.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {conflict.memoryB.tags.map((tag) => (
                        <Badge key={tag} variant="lightgray">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {selectedConflict && (
        <ConfirmationModal
          open={showResolveModal}
          onConfirm={handleResolve}
          onCancel={() => {
            setShowResolveModal(false);
            setSelectedConflict(null);
          }}
          title="Resolve Conflict"
          buttonText="Resolve"
          variant="primary"
        >
          <div style={{ marginBottom: "20px" }}>
            <Body style={{ marginBottom: "16px" }}>
              How should this contradiction be resolved?
            </Body>

            <Select
              label="Resolution Type"
              value={resolutionType}
              onChange={(value) => setResolutionType(value as any)}
              style={{ marginBottom: "16px" }}
            >
              <Option value="superseded">Superseded — One memory is newer/better</Option>
              <Option value="context-dependent">Context-Dependent — Both are valid in different contexts</Option>
              <Option value="temporal">Temporal — Describes change over time</Option>
            </Select>

            {resolutionType === "superseded" && (
              <Select
                label="Which memory is superseded (will have reduced confidence)?"
                value={supersededMemoryId}
                onChange={(value) => setSupersededMemoryId(value)}
                style={{ marginBottom: "16px" }}
              >
                <Option value="">Select...</Option>
                <Option value={selectedConflict.memoryA.id}>
                  Memory A (older)
                </Option>
                <Option value={selectedConflict.memoryB.id}>
                  Memory B (newer)
                </Option>
              </Select>
            )}

            <TextArea
              label="Resolution Note (optional)"
              placeholder="Explain why this resolution was chosen..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
            />
          </div>
        </ConfirmationModal>
      )}
    </div>
  );
}
