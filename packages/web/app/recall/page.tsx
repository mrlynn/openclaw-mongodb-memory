"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Fade,
  Alert,
  CircularProgress,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Search } from "@mui/icons-material";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { recallMemory, forgetMemory } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { RecallResultCard } from "@/components/recall/RecallResultCard";
import { keyframes } from "@emotion/react";

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

interface RecallResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
}

export default function RecallPage() {
  const { daemonUrl } = useDaemonConfig();
  const theme = useTheme();

  const [agentId, setAgentId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEYS.AGENT_ID) || "demo-agent";
    }
    return "demo-agent";
  });
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [results, setResults] = useState<RecallResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const data = await recallMemory(daemonUrl, agentId, query, { limit });
      setResults(data);
      setHasSearched(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await forgetMemory(daemonUrl, id);
      setResults((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(`Delete failed: ${String(err)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Search sx={{ color: "primary.main", fontSize: 28 }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              animation: `${fadeInUp} 0.5s ease-out`,
            }}
          >
            Recall
          </Typography>
        </Box>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", mb: 3, maxWidth: 600 }}
        >
          Search memories using semantic similarity. Results are ranked by how
          closely they match your query.
        </Typography>

        {/* Search Form */}
        <Box sx={{ maxWidth: 800, mb: 4 }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Agent ID"
                value={agentId}
                onChange={(e) => {
                  setAgentId(e.target.value);
                  if (typeof window !== "undefined") {
                    localStorage.setItem(STORAGE_KEYS.AGENT_ID, e.target.value);
                  }
                }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 8, sm: 5 }}>
              <TextField
                label="Search query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                fullWidth
                size="small"
                placeholder="What are you looking for?"
              />
            </Grid>
            <Grid size={{ xs: 4, sm: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Limit</InputLabel>
                <Select
                  value={limit}
                  label="Limit"
                  onChange={(e) => setLimit(e.target.value as number)}
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={!query.trim() || searching}
            sx={{ mt: 2 }}
            startIcon={searching ? <CircularProgress size={18} /> : <Search />}
          >
            {searching ? "Searching..." : "Search Memories"}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Results */}
        {hasSearched && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: "text.secondary",
                mb: 2,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 600,
                fontSize: "0.7rem",
              }}
            >
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </Typography>

            {results.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: "text.disabled", fontStyle: "italic" }}
              >
                No memories matched your query.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 800 }}>
                {results.map((result, i) => (
                  <Box
                    key={result.id}
                    sx={{
                      animation: `${fadeInUp} 0.4s ease-out ${i * 0.05}s both`,
                    }}
                  >
                    <RecallResultCard {...result} onDelete={handleDelete} />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Fade>
  );
}
