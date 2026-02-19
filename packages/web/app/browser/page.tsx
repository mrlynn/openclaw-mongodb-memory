"use client";

import { useState } from "react";
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
} from "@mui/material";
import { Storage, Download, Refresh } from "@mui/icons-material";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { exportMemories, forgetMemory } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { GlassCard } from "@/components/cards/GlassCard";
import { MemoryDetailDrawer } from "@/components/browser/MemoryDetailDrawer";
import { DeleteConfirmDialog } from "@/components/browser/DeleteConfirmDialog";
import { keyframes } from "@emotion/react";
import { CardContent } from "@mui/material";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
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

export default function BrowserPage() {
  const { daemonUrl } = useDaemonConfig();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [agentId, setAgentId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AGENT_ID) || "demo-agent";
    }
    return "demo-agent";
  });
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Detail drawer
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
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
          <Storage sx={{ color: "primary.main", fontSize: 28 }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              animation: `${fadeInUp} 0.5s ease-out`,
            }}
          >
            Memory Browser
          </Typography>
        </Box>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", mb: 3, maxWidth: 600 }}
        >
          Browse, inspect, and manage all stored memories for an agent.
        </Typography>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end", mb: 3, flexWrap: "wrap" }}>
          <TextField
            label="Agent ID"
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEYS.AGENT_ID, e.target.value);
              }
            }}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <Button
            variant="contained"
            onClick={handleLoad}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} /> : <Refresh />}
          >
            {loading ? "Loading..." : "Load Memories"}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Results Table */}
        {hasLoaded && (
          <GlassCard sx={{ animation: `${fadeInUp} 0.4s ease-out` }}>
            <CardContent sx={{ p: 0 }}>
              {memories.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.disabled", fontStyle: "italic" }}
                  >
                    No memories found for this agent.
                  </Typography>
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, width: "50%" }}>
                            Text
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Tags</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
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
                                  ? "rgba(0, 229, 255, 0.04)"
                                  : "rgba(0,0,0,0.02)",
                              },
                            }}
                            onClick={() => handleRowClick(memory)}
                          >
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
                                {new Date(memory.createdAt).toLocaleDateString()}
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
