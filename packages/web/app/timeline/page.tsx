"use client";

import { useState, useEffect, useCallback } from "react";
import { Chrono } from "react-chrono";
import { Select, Option } from "@leafygreen-ui/select";
import Banner from "@leafygreen-ui/banner";
import Icon from "@leafygreen-ui/icon";
import { Clock, ArrowDownWideNarrow, ArrowUpNarrowWide, Tag, Calendar } from "lucide-react";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { fetchMemoriesPage, forgetMemory, MemoryTimelineItem } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { GlassCard } from "@/components/cards/GlassCard";
import { MemoryDetailDrawer } from "@/components/browser/MemoryDetailDrawer";
import { DeleteConfirmDialog } from "@/components/browser/DeleteConfirmDialog";
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
          limit: 100, // Load more for timeline view
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

  // Load next page
  const loadNextPage = useCallback(async () => {
    if (!agentId || !hasMore || loadingMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const data = await fetchMemoriesPage(daemonUrl, agentId, {
        limit: 100,
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

  // Normalize memory for MemoryDetailDrawer
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

  // Format memories for React Chrono
  const chronoItems = allMemories.map((memory) => {
    const date = new Date(memory.createdAt);
    const title = date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    // Truncate text for card
    const cardTitle = memory.text.slice(0, 80) + (memory.text.length > 80 ? "..." : "");

    return {
      title,
      cardTitle,
      cardDetailedText: (
        <div
          className={styles.chronoCard}
          onClick={() => {
            setSelectedMemory(memory);
            setDrawerOpen(true);
          }}
        >
          <p className={styles.chronoText}>{memory.text.slice(0, 200)}</p>
          {memory.tags && memory.tags.length > 0 && (
            <div className={styles.chronoTags}>
              <Tag size={12} />
              {memory.tags.slice(0, 3).map((tag) => (
                <span key={tag} className={styles.chronoTag}>
                  {tag}
                </span>
              ))}
              {memory.tags.length > 3 && (
                <span className={styles.chronoTag}>+{memory.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      ),
    };
  });

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
              Interactive timeline of your memories. Scroll through time, click to explore.
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
              This agent has no memories stored. Create memories and they&apos;ll appear here on the
              timeline.
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

      {/* React Chrono Timeline */}
      {allMemories.length > 0 && (
        <div className={styles.timelineContainer}>
          <Chrono
            items={chronoItems}
            mode="VERTICAL_ALTERNATING"
            theme={{
              primary: darkMode ? "#00ED64" : "#00684A",
              secondary: darkMode ? "#001E2B" : "#E3FCF7",
              cardBgColor: darkMode ? "rgba(0, 30, 43, 0.6)" : "rgba(255, 255, 255, 0.8)",
              titleColor: darkMode ? "#00ED64" : "#00684A",
              titleColorActive: darkMode ? "#00ED64" : "#023430",
            }}
            cardHeight={150}
            hideControls={false}
            scrollable={{ scrollbar: false }}
            disableClickOnCircle={false}
            enableBreakPoint={true}
            verticalBreakPoint={768}
          />

          {/* Load more button */}
          {hasMore && (
            <div className={styles.loadMoreContainer}>
              <button
                className={styles.loadMoreButton}
                onClick={loadNextPage}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load More Memories"}
              </button>
            </div>
          )}
        </div>
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
