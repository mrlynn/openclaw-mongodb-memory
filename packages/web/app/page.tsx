"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
} from "@mui/material";
import { daemonApi } from "@/lib/api";

interface DaemonStatus {
  daemon: string;
  mongodb: string;
  voyage: string;
  uptime: number;
  memory: { heapUsed: number; heapTotal: number };
  stats: { totalMemories: number };
}

interface RecallResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agentId, setAgentId] = useState("demo-agent");
  const [rememberText, setRememberText] = useState("");
  const [recallResults, setRecallResults] = useState<RecallResult[]>([]);
  const [recallQuery, setRecallQuery] = useState("");
  const [recalling, setRecalling] = useState(false);

  // Fetch status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await daemonApi.status();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError(`Failed to connect to daemon: ${String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const handleRemember = async () => {
    if (!rememberText.trim()) return;
    try {
      await daemonApi.remember(agentId, rememberText, {
        tags: ["dashboard-test"],
      });
      setRememberText("");
      alert("Memory stored!");
    } catch (err) {
      alert(`Error: ${String(err)}`);
    }
  };

  const handleRecall = async () => {
    if (!recallQuery.trim()) return;
    setRecalling(true);
    try {
      const results = await daemonApi.recall(agentId, recallQuery);
      setRecallResults(results);
    } catch (err) {
      alert(`Error: ${String(err)}`);
    } finally {
      setRecalling(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 4 }}>
        🧠 Memory Dashboard
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <CircularProgress />
      ) : (
        <Grid container spacing={3}>
          {/* Status Card */}
          {status && (
            <Grid item xs={12}>
              <Card>
                <CardHeader title="Daemon Status" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography color="textSecondary">Daemon</Typography>
                      <Typography variant="h6">{status.daemon}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography color="textSecondary">MongoDB</Typography>
                      <Typography variant="h6">{status.mongodb}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography color="textSecondary">Voyage</Typography>
                      <Typography variant="h6">{status.voyage}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography color="textSecondary">Total Memories</Typography>
                      <Typography variant="h6">{status.stats.totalMemories}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Remember Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Remember" />
              <CardContent>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="Agent ID"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Memory text"
                    value={rememberText}
                    onChange={(e) => setRememberText(e.target.value)}
                    multiline
                    rows={4}
                    fullWidth
                  />
                  <Button variant="contained" onClick={handleRemember}>
                    Store Memory
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Recall Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Recall" />
              <CardContent>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="Search query"
                    value={recallQuery}
                    onChange={(e) => setRecallQuery(e.target.value)}
                    multiline
                    rows={4}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    onClick={handleRecall}
                    disabled={recalling}
                  >
                    {recalling ? "Searching..." : "Search"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Results */}
          {recallResults.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title={`Search Results (${recallResults.length})`}
                />
                <CardContent>
                  <List>
                    {recallResults.map((result) => (
                      <ListItem key={result.id}>
                        <ListItemText
                          primary={result.text}
                          secondary={`Score: ${result.score.toFixed(3)} | Tags: ${result.tags.join(", ") || "none"}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Container>
  );
}
