"use client";

import { useState, useEffect, useCallback } from "react";
import { Select, Option } from "@leafygreen-ui/select";
import Banner from "@leafygreen-ui/banner";
import Icon from "@leafygreen-ui/icon";
import { Clock, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { fetchMemoriesPage, forgetMemory, MemoryTimelineItem } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { GlassCard } from "@/components/cards/GlassCard";
import { MemoryDetailDrawer } from "@/components/browser/MemoryDetailDrawer";
import { DeleteConfirmDialog } from "@/components/browser/DeleteConfirmDialog";
import { TimelineContainer } from "@/components/timeline-browse/TimelineContainer";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface AgentInfo {
  agentId: string;
  count: number;
  lastUpdated: string | null;
}

export default function TimelinePage() {
  const { daemonUrl } = useDaemonConfig();
  const { darkMode } = useThemeMode();

  // Agent state
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentId, setAgentId] = useState("");

  // Memory state
  const [allMemories, setAllMemories] = useState<MemoryTimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<{
    cursor: string;
    cursorId: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Detail drawer
  const [selectedMemory, setSelectedMemory] = useState<MemoryTimelineItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Fetch agents on mount
  useEffect(() => {
    const init = async () => {
      try {
        const response = await fetch(`${daemonUrl}/agents`);
        if (!response.ok) return;
        const data = await response.json();
        const agentsList: AgentInfo[] = data.agents || [];
        setAgents(agentsList);

        const stored =
          typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AGENT_ID) : null;
        const resolvedAgent =
          stored && agentsList.some((a) => a.agentId === stored)
            ? stored
            : agentsList[0]?.agentId || "";

        setAgentId(resolvedAgent);
        if (resolvedAgent) {
          localStorage.setItem(STORAGE_KEYS.AGENT_ID, resolvedAgent);
        }
      } catch {
        // Daemon not reachable
      }
    };
    init();
  }, [daemonUrl]);

  // Load first page when agentId or sortOrder changes
  useEffect(() => {
    if (!agentId) return;

    const loadFirst = async () => {
      setLoading(true);
      setError(null);
      setAllMemories([]);
      setNextCursor(null);
      setHasMore(false);

      try {
        const data = await fetchMemoriesPage(daemonUrl, agentId, {
          limit: 50,
          sort: sortOrder,
        });
        setAllMemories(data.memories);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load memories");
      } finally {
        setLoading(false);
      }
    };

    loadFirst();
  }, [agentId, sortOrder, daemonUrl]);

  // Load next page (for infinite scroll)
  const loadNextPage = useCallback(async () => {
    if (!agentId || !hasMore || loadingMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const data = await fetchMemoriesPage(daemonUrl, agentId, {
        limit: 50,
        cursor: nextCursor.cursor,
        cursorId: nextCursor.cursorId,
        sort: sortOrder,
      });
      setAllMemories((prev) => [...prev, ...data.memories]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more memories");
    } finally {
      setLoadingMore(false);
    }
  }, [agentId, daemonUrl, hasMore, loadingMore, nextCursor, sortOrder]);

  // Handle card click → open drawer
  const handleCardClick = (memory: MemoryTimelineItem) => {
    setSelectedMemory(memory);
    setDrawerOpen(true);
  };

  // Handle agent change
  const handleAgentChange = (val: string) => {
    setAgentId(val);
    localStorage.setItem(STORAGE_KEYS.AGENT_ID, val);
  };

  // Handle sort toggle
  const toggleSort = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  // Handle delete
  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await forgetMemory(daemonUrl, deleteTarget);
      setAllMemories((prev) => prev.filter((m) => m.id !== deleteTarget));
      setDrawerOpen(false);
      setSelectedMemory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory");
    } finally {
      setDeleteTarget(null);
    }
  };

  // Normalize memory for MemoryDetailDrawer (expects _id, not id)
  const drawerMemory = selectedMemory
    ? {
        _id: selectedMemory.id,
        text: selectedMemory.text,
        agentId,
        tags: selectedMemory.tags,
        metadata: selectedMemory.metadata,
        createdAt: selectedMemory.createdAt,
        updatedAt: selectedMemory.updatedAt,
      }
    : null;

  const isEmpty = !loading && allMemories.length === 0 && !error;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Clock size={22} className={styles.headerIcon} />
          <div>
            <h2 className={styles.title}>Memory Timeline</h2>
            <p className={styles.description}>
              Browse your memories chronologically. Scroll to explore, click to view details.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {agents.length > 0 && (
          <div className={styles.agentSelect}>
            <Select
              aria-label="Agent"
              value={agentId}
              onChange={handleAgentChange}
              size="xsmall"
              darkMode={darkMode}
            >
              {agents.map((a) => (
                <Option key={a.agentId} value={a.agentId}>
                  {a.agentId} ({a.count})
                </Option>
              ))}
            </Select>
          </div>
        )}

        <button
          className={styles.sortButton}
          onClick={toggleSort}
          title={sortOrder === "desc" ? "Showing newest first" : "Showing oldest first"}
        >
          {sortOrder === "desc" ? (
            <ArrowDownWideNarrow size={16} />
          ) : (
            <ArrowUpNarrowWide size={16} />
          )}
          <span>{sortOrder === "desc" ? "Newest first" : "Oldest first"}</span>
        </button>

        {allMemories.length > 0 && (
          <span className={styles.memoryCount}>
            {allMemories.length} memories{hasMore ? "+" : ""}
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <Banner variant="danger" darkMode={darkMode} style={{ marginBottom: 16 }}>
          {error}
        </Banner>
      )}

      {/* Loading state */}
      {loading && (
        <GlassCard>
          <div className={styles.loadingState}>
            <div className={styles.shimmerRow}>
              <div className={styles.shimmer} />
              <div className={styles.shimmer} />
              <div className={styles.shimmer} />
              <div className={styles.shimmer} />
            </div>
          </div>
        </GlassCard>
      )}

      {/* Empty state */}
      {isEmpty && agentId && (
        <GlassCard>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Clock size={40} />
            </div>
            <h3 className={styles.emptyTitle}>No memories yet</h3>
            <p className={styles.emptyDesc}>
              This agent has no memories stored. Create memories using the Remember page or through
              the API, and they&apos;ll appear here on the timeline.
            </p>
          </div>
        </GlassCard>
      )}

      {/* No agent selected */}
      {!agentId && !loading && (
        <GlassCard>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Icon glyph="Person" size={40} />
            </div>
            <h3 className={styles.emptyTitle}>No agents found</h3>
            <p className={styles.emptyDesc}>
              Start the daemon and create some memories to see them on the timeline.
            </p>
          </div>
        </GlassCard>
      )}

      {/* Timeline */}
      {allMemories.length > 0 && (
        <GlassCard>
          <TimelineContainer
            memories={allMemories}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadNextPage}
            onCardClick={handleCardClick}
          />
        </GlassCard>
      )}

      {/* Detail drawer */}
      <MemoryDetailDrawer
        open={drawerOpen}
        memory={drawerMemory}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedMemory(null);
        }}
        onDelete={handleDeleteRequest}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title="Delete Memory"
        description="This memory will be permanently deleted. This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
