"use client";

import React, { useState, useEffect } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Card from "@leafygreen-ui/card";
import Button from "@leafygreen-ui/button";
import Badge from "@leafygreen-ui/badge";
import { Toast } from "@leafygreen-ui/toast";
import Icon from "@leafygreen-ui/icon";
import Checkbox from "@leafygreen-ui/checkbox";
import ConfirmationModal from "@leafygreen-ui/confirmation-modal";

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7654";

interface Memory {
  id: string;
  text: string;
  strength?: number;
  confidence?: number;
  layer?: string;
  memoryType?: string;
  createdAt: string;
  lastReinforcedAt?: string;
  tags: string[];
}

export function ExpirationContent() {
  const [candidates, setCandidates] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [agentId] = useState("openclaw");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadCandidates();
  }, [agentId]);

  const loadCandidates = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${DAEMON_URL}/decay/expiration-candidates?agentId=${agentId}`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error("Failed to load expiration candidates");
      }

      setCandidates(data.candidates || []);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const handleRescue = async () => {
    try {
      for (const id of selectedIds) {
        await fetch(`${DAEMON_URL}/decay/promote-archival/${id}`, {
          method: "POST",
        });
      }

      setSuccess(`Rescued ${selectedIds.size} ${selectedIds.size === 1 ? "memory" : "memories"}`);
      setShowRescueModal(false);
      loadCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rescue memories");
    }
  };

  const handleDelete = async () => {
    try {
      for (const id of selectedIds) {
        await fetch(`${DAEMON_URL}/forget/${id}`, {
          method: "DELETE",
        });
      }

      setSuccess(`Deleted ${selectedIds.size} ${selectedIds.size === 1 ? "memory" : "memories"}`);
      setShowDeleteModal(false);
      loadCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memories");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const daysSince = (dateStr: string) => {
    const then = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  return (
    <div style={{ maxWidth: "1200px" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <Badge variant={candidates.length > 0 ? "yellow" : "green"}>
            {candidates.length} Candidate{candidates.length !== 1 ? "s" : ""}
          </Badge>

          {selectedIds.size > 0 && (
            <>
              <Badge variant="blue">{selectedIds.size} Selected</Badge>
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                <Button
                  variant="primaryOutline"
                  onClick={() => setShowRescueModal(true)}
                  leftGlyph={<Icon glyph="Favorite" />}
                >
                  Rescue Selected
                </Button>
                <Button
                  variant="dangerOutline"
                  onClick={() => setShowDeleteModal(true)}
                  leftGlyph={<Icon glyph="Trash" />}
                >
                  Delete Selected
                </Button>
              </div>
            </>
          )}

          <Button onClick={loadCandidates} disabled={loading} size="small">
            <Icon glyph="Refresh" /> Refresh
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <Body>Loading expiration candidates...</Body>
        </Card>
      ) : candidates.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <Icon glyph="Checkmark" size={48} style={{ color: "#00684A", marginBottom: "16px" }} />
          <H3>No Memories Near Expiration</H3>
          <Body>All memories have healthy strength levels.</Body>
        </Card>
      ) : (
        <>
          <Card style={{ padding: "16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Checkbox
                label="Select All"
                checked={selectedIds.size === candidates.length}
                onChange={selectAll}
                bold
              />
              <Body style={{ fontSize: "12px", opacity: 0.7 }}>
                Memories with strength &lt; 0.10 are candidates for expiration
              </Body>
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {candidates.map((memory) => (
              <Card
                key={memory.id}
                style={{
                  padding: "16px",
                  opacity: selectedIds.has(memory.id) ? 1 : 0.85,
                  border: selectedIds.has(memory.id) ? "2px solid #00684A" : "1px solid #E8EDEB",
                }}
              >
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ paddingTop: "4px" }}>
                    <Checkbox
                      checked={selectedIds.has(memory.id)}
                      onChange={() => toggleSelection(memory.id)}
                      aria-label="Select memory"
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <Badge variant="red">
                        Strength: {((memory.strength || 0) * 100).toFixed(1)}%
                      </Badge>
                      {memory.confidence !== undefined && (
                        <Badge variant="lightgray">
                          Confidence: {(memory.confidence * 100).toFixed(0)}%
                        </Badge>
                      )}
                      {memory.layer && <Badge variant="blue">{memory.layer}</Badge>}
                    </div>

                    <Body style={{ marginBottom: "8px" }}>{memory.text}</Body>

                    <div
                      style={{
                        fontSize: "11px",
                        opacity: 0.6,
                        display: "flex",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>Created: {formatDate(memory.createdAt)}</span>
                      {memory.lastReinforcedAt && (
                        <span>
                          Last reinforced: {daysSince(memory.lastReinforcedAt)} days ago
                        </span>
                      )}
                    </div>

                    {memory.tags.length > 0 && (
                      <div style={{ marginTop: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {memory.tags.slice(0, 5).map((tag) => (
                          <Badge key={tag} variant="lightgray">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <Button
                      size="small"
                      variant="primaryOutline"
                      onClick={async () => {
                        try {
                          await fetch(`${DAEMON_URL}/decay/promote-archival/${memory.id}`, {
                            method: "POST",
                          });
                          setSuccess("Memory rescued");
                          loadCandidates();
                        } catch {
                          setError("Failed to rescue");
                        }
                      }}
                    >
                      Rescue
                    </Button>
                    <Button
                      size="small"
                      variant="dangerOutline"
                      onClick={async () => {
                        try {
                          await fetch(`${DAEMON_URL}/forget/${memory.id}`, {
                            method: "DELETE",
                          });
                          setSuccess("Memory deleted");
                          loadCandidates();
                        } catch {
                          setError("Failed to delete");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Rescue Confirmation */}
      <ConfirmationModal
        open={showRescueModal}
        onConfirm={handleRescue}
        onCancel={() => setShowRescueModal(false)}
        title="Rescue Memories"
        buttonText="Rescue"
        variant="primary"
      >
        <Body>
          Rescue {selectedIds.size} {selectedIds.size === 1 ? "memory" : "memories"} by promoting to
          archival layer?
        </Body>
        <Body style={{ marginTop: "8px", fontSize: "12px", opacity: 0.7 }}>
          This will prevent expiration and preserve {selectedIds.size === 1 ? "this memory" : "these memories"} permanently.
        </Body>
      </ConfirmationModal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={showDeleteModal}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        title="Delete Memories"
        buttonText="Delete"
        variant="danger"
      >
        <Body>
          Permanently delete {selectedIds.size} {selectedIds.size === 1 ? "memory" : "memories"}?
        </Body>
        <Body style={{ marginTop: "8px", fontSize: "12px", opacity: 0.7 }}>
          This action cannot be undone.
        </Body>
      </ConfirmationModal>
    </div>
  );
}
