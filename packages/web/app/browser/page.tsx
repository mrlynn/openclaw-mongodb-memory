"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Alert,
  CircularProgress,
  Fade,
  useTheme,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Storage, Download, Refresh, Search } from "@mui/icons-material";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { exportMemories, forgetMemory } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { GlassCard } from "@/components/cards/GlassCard";
import { MemoryDetailDrawer } from "@/components/browser/MemoryDetailDrawer";
import { DeleteConfirmDialog } from "@/components/browser/DeleteConfirmDialog";
import { keyframes } from "@emotion/react";
import { CardContent } from "@mui/material";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

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
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

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
  const [memoryScores, setMemoryScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Detail drawer
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
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
        
        // Auto-select first agent if none selected
        const currentAgentId = agentId || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AGENT_ID) : null);
        if (!currentAgentId && agentsList.length > 0) {
          const firstAgent = agentsList[0].agentId;
          setAgentId(firstAgent);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.AGENT_ID, firstAgent);
          }
        } else if (currentAgentId && !agentsList.find((a: AgentInfo) => a.agentId === currentAgentId)) {
          // Stored agentId no longer exists, select first available
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
  }, [daemonUrl]); // Only run on mount or when daemonUrl changes

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
      const url = new URL('/recall', daemonUrl);
      url.searchParams.set('agentId', agentId);
      url.searchParams.set('query', searchQuery);
      url.searchParams.set('limit', '50');

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      
      if (data.success && data.results) {
        setMemories(data.results);
        
        const scores: Record<string, number> = {};
        data.results.forEach((result: any) => {
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

  const paginatedMemories = memories.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Storage sx={{ color: "primary.main", fontSize: 24, opacity: 0.8 }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              letterSpacing: "-0.02em",
              animation: `${fadeInUp} 0.4s ease-out`,
            }}
          >
            Memory Browser
          </Typography>
        </Box>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", mb: 3, maxWidth: 700 }}
        >
          Browse, inspect, and manage all stored memories for an agent. Use semantic search (RAG) with vector embeddings to find relevant memories by meaning, not just keywords.
        </Typography>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end", mb: 3, flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Agent ID</InputLabel>
            <Select
              value={agentId}
              label="Agent ID"
              onChange={(e) => {
                setAgentId(e.target.value);
                if (typeof window !== "undefined") {
                  localStorage.setItem(STORAGE_KEYS.AGENT_ID, e.target.value);
                }
              }}
              disabled={loadingAgents || agents.length === 0}
            >
              {agents.map((agent) => (
                <MenuItem key={agent.agentId} value={agent.agentId}>
                  {agent.agentId} ({agent.count} memories)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Search Query (RAG)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && searchQuery.trim() && agentId) {
                handleSearch();
              }
            }}
            size="small"
            sx={{ minWidth: 300 }}
            placeholder="Semantic search using embeddings..."
            disabled={loading || loadingAgents || !agentId}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading || loadingAgents || !agentId || !searchQuery.trim()}
            startIcon={loading && searchMode ? <CircularProgress size={18} /> : <Search />}
          >
            {loading && searchMode ? "Searching..." : "Search"}
          </Button>
          <Button
            variant="outlined"
            onClick={handleLoad}
            disabled={loading || loadingAgents || !agentId}
            startIcon={loading && !searchMode ? <CircularProgress size={18} /> : <Refresh />}
          >
            {loading && !searchMode ? "Loading..." : "Load All"}
          </Button>
        </Box>

        {loadingAgents && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Loading available agents...
          </Alert>
        )}

        {!loadingAgents && agents.length === 0 && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            No agents found. Start by creating memories with /remember.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Results Table */}
        {hasLoaded && (
          <GlassCard sx={{ animation: `${fadeInUp} 0.4s ease-out` }}>
            <CardContent sx={{ p: 0 }}>
              {searchMode && memories.length > 0 && (
                <Alert severity="info" sx={{ m: 2, borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>Search Results:</strong> Showing {memories.length} memories ranked by semantic relevance to "{searchQuery}"
                  </Typography>
                </Alert>
              )}
              {memories.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.disabled", fontStyle: "italic" }}
                  >
                    {searchMode 
                      ? `No memories found matching "${searchQuery}"`
                      : "No memories found for this agent."}
                  </Typography>
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          {searchMode && (
                            <TableCell sx={{ fontWeight: 500, width: "10%" }}>
                              Relevance
                            </TableCell>
                          )}
                          <TableCell sx={{ fontWeight: 500, width: searchMode ? "40%" : "50%" }}>
                            Text
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>Tags</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>Created</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedMemories.map((memory) => (
                          <TableRow
                            key={memory._id}
                            hover
                            sx={{
                              cursor: "pointer",
                              "&:hover": {
                                bgcolor: isDark
                                  ? "rgba(139, 156, 247, 0.03)"
                                  : "rgba(0,0,0,0.02)",
                              },
                            }}
                            onClick={() => handleRowClick(memory)}
                          >
                            {searchMode && (
                              <TableCell>
                                {memoryScores[memory._id] !== undefined && (
                                  <Chip
                                    label={memoryScores[memory._id].toFixed(3)}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ 
                                      height: 24, 
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                    }}
                                  />
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 400 }}>
                                {memory.text}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                {memory.tags.slice(0, 3).map((tag, i) => (
                                  <Chip
                                    key={i}
                                    label={tag}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 22, fontSize: "0.65rem" }}
                                  />
                                ))}
                                {memory.tags.length > 3 && (
                                  <Chip
                                    label={`+${memory.tags.length - 3}`}
                                    size="small"
                                    sx={{ height: 22, fontSize: "0.65rem" }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {new Date(memory.createdAt).toLocaleString()}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={memories.length}
                    page={page}
                    onPageChange={(_, p) => setPage(p)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                  />
                </>
              )}
            </CardContent>
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
          onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
          onCancel={() => setDeleteTarget(null)}
        />
      </Box>
    </Fade>
  );
}
