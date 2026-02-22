"use client";

import { useState, useEffect } from "react";
import { Select, Option } from "@leafygreen-ui/select";
import Button from "@leafygreen-ui/button";
import Banner from "@leafygreen-ui/banner";
import { Chip } from "@leafygreen-ui/chip";
import Icon from "@leafygreen-ui/icon";
import IconButton from "@leafygreen-ui/icon-button";
import TextInput from "@leafygreen-ui/text-input";
import { Database } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { exportMemories, forgetMemory } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { GlassCard } from "@/components/cards/GlassCard";
import { MemoryDetailDrawer } from "@/components/browser/MemoryDetailDrawer";
import { DeleteConfirmDialog } from "@/components/browser/DeleteConfirmDialog";
import styles from "./page.module.css";

interface MemoryItem {
  _id: string;
  text: string;
  agentId: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface AgentInfo {
  agentId: string;
  count: number;
  lastUpdated: string | null;
}

export default function BrowserPage() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentId, setAgentId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AGENT_ID) || "";
    }
    return "";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoryScores, setMemoryScores] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Detail drawer
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(
    null
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Fetch available agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      setLoadingAgents(true);
      try {
        const response = await fetch(`${daemonUrl}/agents`);
        if (!response.ok) throw new Error("Failed to fetch agents");
        const data = await response.json();
        const agentsList = data.agents || [];
        setAgents(agentsList);

        const currentAgentId =
          agentId ||
          (typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.AGENT_ID)
            : null);
        if (!currentAgentId && agentsList.length > 0) {
          const firstAgent = agentsList[0].agentId;
          setAgentId(firstAgent);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.AGENT_ID, firstAgent);
          }
        } else if (
          currentAgentId &&
          !agentsList.find((a: AgentInfo) => a.agentId === currentAgentId)
        ) {
          if (agentsList.length > 0) {
            const firstAgent = agentsList[0].agentId;
            setAgentId(firstAgent);
            if (typeof window !== "undefined") {
              localStorage.setItem(STORAGE_KEYS.AGENT_ID, firstAgent);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setLoadingAgents(false);
      }
    };

    fetchAgents();
  }, [daemonUrl]);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    setSearchMode(false);
    setMemoryScores({});
    try {
      const data = await exportMemories(daemonUrl, agentId);
      const items = data.memories || data || [];
      setMemories(items);
      setHasLoaded(true);
      setPage(0);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError(null);
    setSearchMode(true);
    try {
      const url = new URL("/recall", daemonUrl);
      url.searchParams.set("agentId", agentId);
      url.searchParams.set("query", searchQuery);
      url.searchParams.set("limit", "50");

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();

      if (data.success && data.results) {
        // Map id to _id for consistency with export format
        const mappedResults = data.results.map((result: any) => ({
          ...result,
          _id: result.id || result._id,
        }));
        setMemories(mappedResults);

        // Store scores using the consistent _id
        const scores: Record<string, number> = {};
        mappedResults.forEach((result: any) => {
          if (result._id && result.score !== undefined) {
            scores[result._id] = result.score;
          }
        });
        setMemoryScores(scores);

        setHasLoaded(true);
        setPage(0);
      } else {
        setMemories([]);
        setMemoryScores({});
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await forgetMemory(daemonUrl, id);
      setMemories((prev) => prev.filter((m) => m._id !== id));
      setDrawerOpen(false);
      setSelectedMemory(null);
      setDeleteTarget(null);
    } catch (err) {
      setError(`Delete failed: ${String(err)}`);
    }
  };

  const handleRowClick = (memory: MemoryItem) => {
    setSelectedMemory(memory);
    setDrawerOpen(true);
  };

  const totalPages = Math.ceil(memories.length / rowsPerPage);
  const paginatedMemories = memories.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  const startItem = page * rowsPerPage + 1;
  const endItem = Math.min((page + 1) * rowsPerPage, memories.length);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Database size={24} className={styles.headerIcon} />
        <h2 className={styles.title}>Memory Browser</h2>
      </div>
      <p className={styles.description}>
        Browse, inspect, and manage all stored memories for an agent.
      </p>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.agentSelect}>
          <Select
            label="Agent ID"
            value={agentId}
            onChange={(val) => {
              setAgentId(val);
              if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEYS.AGENT_ID, val);
              }
            }}
            disabled={loadingAgents || agents.length === 0}
            darkMode={darkMode}
          >
            {agents.map((agent) => (
              <Option key={agent.agentId} value={agent.agentId}>
                {agent.agentId} ({agent.count} memories)
              </Option>
            ))}
          </Select>
        </div>
        <div className={styles.searchInput}>
          <TextInput
            label="Search Query (RAG)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim() && agentId) {
                handleSearch();
              }
            }}
            placeholder="Semantic search using embeddings..."
            disabled={loading || loadingAgents || !agentId}
            darkMode={darkMode}
          />
        </div>
        <Button
          variant="primary"
          onClick={handleSearch}
          disabled={
            loading || loadingAgents || !agentId || !searchQuery.trim()
          }
          leftGlyph={<Icon glyph="MagnifyingGlass" />}
          darkMode={darkMode}
        >
          {loading && searchMode ? "Searching..." : "Search"}
        </Button>
        <Button
          variant="default"
          onClick={handleLoad}
          disabled={loading || loadingAgents || !agentId}
          leftGlyph={<Icon glyph="Refresh" />}
          darkMode={darkMode}
        >
          {loading && !searchMode ? "Loading..." : "Load All"}
        </Button>
      </div>

      {loadingAgents && (
        <div className={styles.bannerWrap}>
          <Banner variant="info" darkMode={darkMode}>
            Loading available agents...
          </Banner>
        </div>
      )}

      {!loadingAgents && agents.length === 0 && (
        <div className={styles.bannerWrap}>
          <Banner variant="warning" darkMode={darkMode}>
            No agents found. Start by creating memories with /remember.
          </Banner>
        </div>
      )}

      {error && (
        <div className={styles.bannerWrap}>
          <Banner variant="danger" darkMode={darkMode}>
            {error}
          </Banner>
        </div>
      )}

      {/* Results Table */}
      {hasLoaded && (
        <GlassCard className={styles.tableCard}>
          {memories.length === 0 ? (
            <p className={styles.emptyState}>
              No memories found for this agent.
            </p>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: "50%" }}>Text</th>
                      <th>Tags</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMemories.map((memory) => (
                      <tr
                        key={memory._id}
                        className={styles.tableRow}
                        onClick={() => handleRowClick(memory)}
                      >
                        <td>
                          <div className={styles.cellText}>{memory.text}</div>
                        </td>
                        <td>
                          <div className={styles.cellTags}>
                            {memory.tags.slice(0, 3).map((tag, i) => (
                              <Chip key={i} label={tag} variant="gray" />
                            ))}
                            {memory.tags.length > 3 && (
                              <Chip
                                label={`+${memory.tags.length - 3}`}
                                variant="gray"
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={styles.cellDate}>
                            {new Date(memory.createdAt).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className={styles.pagination}>
                <Select
                  label=""
                  aria-label="Rows per page"
                  value={String(rowsPerPage)}
                  onChange={(val) => {
                    setRowsPerPage(parseInt(val, 10));
                    setPage(0);
                  }}
                  size="xsmall"
                  darkMode={darkMode}
                >
                  <Option value="5">5 / page</Option>
                  <Option value="10">10 / page</Option>
                  <Option value="25">25 / page</Option>
                  <Option value="50">50 / page</Option>
                </Select>
                <span className={styles.paginationInfo}>
                  {startItem}–{endItem} of {memories.length}
                </span>
                <div className={styles.paginationControls}>
                  <IconButton
                    aria-label="Previous page"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    darkMode={darkMode}
                  >
                    <Icon glyph="ChevronLeft" />
                  </IconButton>
                  <IconButton
                    aria-label="Next page"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    darkMode={darkMode}
                  >
                    <Icon glyph="ChevronRight" />
                  </IconButton>
                </div>
              </div>
            </>
          )}
        </GlassCard>
      )}

      {/* Detail Drawer */}
      <MemoryDetailDrawer
        open={drawerOpen}
        memory={selectedMemory}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedMemory(null);
        }}
        onDelete={(id) => setDeleteTarget(id)}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Delete Memory"
        description="Are you sure you want to permanently delete this memory? This action cannot be undone."
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
