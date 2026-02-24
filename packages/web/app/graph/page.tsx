"use client";

import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import styles from "./page.module.css";
import { H2, H3, Body, Subtitle } from "@leafygreen-ui/typography";
import Button from "@leafygreen-ui/button";
import { Select, Option } from "@leafygreen-ui/select";
import TextInput from "@leafygreen-ui/text-input";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import { Toast } from "@leafygreen-ui/toast";

import { useDaemonConfig } from "@/contexts/DaemonConfigContext";
import { STORAGE_KEYS } from "@/lib/constants";

interface AgentInfo {
  agentId: string;
  count: number;
  lastUpdated: string | null;
}

interface Memory {
  id: string;
  text: string;
  confidence?: number;
  strength?: number;
  layer?: string;
  memoryType?: string;
  tags?: string[];
  createdAt?: string;
  edges?: Array<{
    type: string;
    targetId: string;
    weight: number;
  }>;
}

export default function GraphPage() {
  const { daemonUrl } = useDaemonConfig();
  
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentId, setAgentId] = useState("");
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedMemoryId, setSelectedMemoryId] = useState("");
  const [maxDepth, setMaxDepth] = useState("2");
  const [direction, setDirection] = useState<"outbound" | "inbound" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [centerNode, setCenterNode] = useState<Memory | null>(null);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [showMemorySelector, setShowMemorySelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const loadGraph = async (memoryId?: string) => {
    const idToLoad = memoryId || selectedMemoryId;
    
    if (!idToLoad) {
      setError("Please enter a memory ID");
      return;
    }
    
    if (!agentId) {
      setError("Please select an agent");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${daemonUrl}/graph/traverse/${idToLoad}?` +
          `direction=${direction}&maxDepth=${maxDepth}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch graph: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error("Graph traversal failed");
      }

      setCenterNode(data.centerNode);

      // Build nodes
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      // Center node
      newNodes.push({
        id: data.centerNode.id,
        type: "default",
        position: { x: 400, y: 300 },
        data: {
          label: (
            <div style={{ padding: "10px", maxWidth: "200px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Center Node</div>
              <div style={{ fontSize: "12px" }}>{data.centerNode.text.slice(0, 60)}...</div>
              <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.7 }}>
                {data.centerNode.layer} • {(data.centerNode.confidence * 100).toFixed(0)}%
              </div>
            </div>
          ),
        },
        style: {
          background: "#00684A",
          color: "white",
          border: "2px solid #023430",
          borderRadius: "8px",
          fontSize: "12px",
        },
      });

      // Connected nodes (circular layout)
      const connectedCount = data.connectedMemories.length;
      const radius = 250;

      data.connectedMemories.forEach((connected: any, index: number) => {
        const angle = (index / connectedCount) * 2 * Math.PI;
        const x = 400 + radius * Math.cos(angle);
        const y = 300 + radius * Math.sin(angle);

        // Color by relationship type
        const relationshipColors: Record<string, string> = {
          PRECEDES: "#1C4587",
          CAUSES: "#CC0000",
          SUPPORTS: "#38761D",
          CONTRADICTS: "#E69138",
          DERIVES_FROM: "#6A1B9A",
          CO_OCCURS: "#0B5394",
          MENTIONS_ENTITY: "#990099",
        };

        const bgColor = relationshipColors[connected.relationship] || "#666666";

        newNodes.push({
          id: connected.id,
          type: "default",
          position: { x, y },
          data: {
            label: (
              <div style={{ padding: "8px", maxWidth: "180px" }}>
                <div style={{ fontSize: "11px", fontWeight: "500", marginBottom: "2px" }}>
                  {connected.relationship}
                </div>
                <div style={{ fontSize: "11px" }}>{connected.text.slice(0, 50)}...</div>
                <div style={{ fontSize: "9px", marginTop: "2px", opacity: 0.7 }}>
                  Depth: {connected.depth} • {(connected.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ),
          },
          style: {
            background: bgColor,
            color: "white",
            border: "1px solid rgba(0,0,0,0.2)",
            borderRadius: "6px",
            fontSize: "11px",
          },
        });

        // Add edge
        newEdges.push({
          id: `e-${data.centerNode.id}-${connected.id}`,
          source: data.centerNode.id,
          target: connected.id,
          type: "default",
          animated: connected.relationship === "PRECEDES",
          label: connected.relationship,
          labelStyle: { fontSize: "10px", fill: "#666" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: bgColor,
          },
          style: {
            stroke: bgColor,
            strokeWidth: 2,
          },
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  };

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
        } else if (currentAgentId) {
          setAgentId(currentAgentId);
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setLoadingAgents(false);
      }
    };
    fetchAgents();
  }, [daemonUrl]);

  // Load recent memories when agent changes
  useEffect(() => {
    if (agentId) {
      loadRecentMemories();
    }
  }, [agentId]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const loadRecentMemories = async () => {
    if (!agentId) return;
    
    try {
      const response = await fetch(
        `${daemonUrl}/memories?agentId=${agentId}&limit=20`
      );
      const data = await response.json();
      if (data.success && data.memories) {
        setRecentMemories(data.memories);
      }
    } catch (err) {
      console.error("Failed to load recent memories:", err);
    }
  };

  const searchMemories = async (query: string) => {
    if (!agentId) return;
    
    if (!query.trim()) {
      loadRecentMemories();
      return;
    }

    try {
      const response = await fetch(
        `${daemonUrl}/recall?agentId=${agentId}&query=${encodeURIComponent(query)}&limit=20`
      );
      const data = await response.json();
      if (data.success && data.results) {
        setRecentMemories(
          data.results.map((r: any) => ({
            id: r.id,
            text: r.text,
            tags: r.tags,
            confidence: r.confidence,
            layer: r.layer,
            memoryType: r.memoryType,
            createdAt: r.createdAt,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to search memories:", err);
    }
  };

  const selectMemory = (memory: Memory) => {
    setSelectedMemoryId(memory.id);
    setShowMemorySelector(false);
    setSearchQuery("");
    
    // Auto-load the graph after selection
    loadGraph(memory.id);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const timeoutId = setTimeout(() => searchMemories(value), 300);
    setSearchTimeout(timeoutId);
  };

  return (
    <div style={{ padding: "20px", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "20px" }}>
        <H2>Memory Graph Visualization</H2>
        <Subtitle>Explore relationships between memories</Subtitle>
      </div>

      {error && (
        <Toast variant="warning" title="Error" style={{ marginBottom: "16px" }}>
          {error}
        </Toast>
      )}

      <Card style={{ marginBottom: "20px", padding: "20px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 200px" }}>
            <Select
              label="Agent"
              aria-label="Select agent"
              value={agentId}
              onChange={(value) => {
                setAgentId(value);
                if (typeof window !== "undefined") {
                  localStorage.setItem(STORAGE_KEYS.AGENT_ID, value);
                }
              }}
              disabled={loadingAgents || agents.length === 0}
            >
              {agents.map((agent) => (
                <Option key={agent.agentId} value={agent.agentId}>
                  {agent.agentId} ({agent.count})
                </Option>
              ))}
            </Select>
          </div>
          
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ marginBottom: "8px" }}>
              <Body weight="medium">Select Memory</Body>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <TextInput
                label="Memory ID"
                aria-label="Memory ID input"
                placeholder="Memory ID or click Browse..."
                value={selectedMemoryId}
                onChange={(e) => setSelectedMemoryId(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button
                variant="default"
                onClick={() => setShowMemorySelector(!showMemorySelector)}
              >
                Browse
              </Button>
            </div>
          </div>

          <div style={{ flex: "0 0 150px" }}>
            <Select
              label="Direction"
              value={direction}
              onChange={(value) => setDirection(value as any)}
            >
              <Option value="outbound">Outbound</Option>
              <Option value="inbound">Inbound</Option>
              <Option value="both">Both</Option>
            </Select>
          </div>

          <div style={{ flex: "0 0 120px" }}>
            <Select label="Max Depth" value={maxDepth} onChange={(value) => setMaxDepth(value)}>
              <Option value="1">1</Option>
              <Option value="2">2</Option>
              <Option value="3">3</Option>
              <Option value="4">4</Option>
              <Option value="5">5</Option>
            </Select>
          </div>

          <Button onClick={loadGraph} disabled={loading || !selectedMemoryId}>
            {loading ? "Loading..." : "Load Graph"}
          </Button>
        </div>
      </Card>

      {/* Memory Selector Panel */}
      {showMemorySelector && (
        <Card style={{ marginBottom: "20px", padding: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <H3>Select a Memory</H3>
            <Body style={{ marginTop: "8px", marginBottom: "16px" }}>
              Choose from recent memories or search by keyword
            </Body>
            <TextInput
              label="Search"
              aria-label="Search memories"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {recentMemories.length === 0 ? (
              <Body style={{ textAlign: "center", padding: "32px", opacity: 0.6 }}>
                No memories found
              </Body>
            ) : (
              recentMemories.map((memory) => (
                <div
                  key={memory.id}
                  onClick={() => selectMemory(memory)}
                  style={{
                    padding: "12px 16px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    backgroundColor: selectedMemoryId === memory.id 
                      ? "rgba(0, 104, 74, 0.15)" 
                      : "rgba(255, 255, 255, 0.05)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#00ED95";
                    e.currentTarget.style.backgroundColor = "rgba(0, 104, 74, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    e.currentTarget.style.backgroundColor =
                      selectedMemoryId === memory.id 
                        ? "rgba(0, 104, 74, 0.15)" 
                        : "rgba(255, 255, 255, 0.05)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <Body weight="medium">
                        {memory.text.slice(0, 120)}
                        {memory.text.length > 120 ? "..." : ""}
                      </Body>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                        {memory.layer && <Badge variant="lightgray">{memory.layer}</Badge>}
                        {memory.memoryType && <Badge variant="blue">{memory.memoryType}</Badge>}
                        {memory.tags?.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="lightgray">
                            {tag}
                          </Badge>
                        ))}
                        {memory.edges && memory.edges.length > 0 && (
                          <Badge variant="green">{memory.edges.length} connections</Badge>
                        )}
                      </div>
                      <Body style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>
                        ID: {memory.id}
                      </Body>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {centerNode && (
        <Card style={{ marginBottom: "12px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Badge variant="green">Center Node</Badge>
            <Body>
              {centerNode.text.slice(0, 100)}
              {centerNode.text.length > 100 ? "..." : ""}
            </Body>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <Badge variant="lightgray">{centerNode.layer}</Badge>
              <Badge variant="blue">{(centerNode.confidence! * 100).toFixed(0)}% confidence</Badge>
            </div>
          </div>
        </Card>
      )}

      <div style={{ 
        flex: 1, 
        border: "1px solid rgba(255, 255, 255, 0.1)", 
        borderRadius: "8px", 
        overflow: "hidden",
        backgroundColor: "#001E17"
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          style={{ backgroundColor: "#001E17" }}
        >
          <Background 
            color="#00ED95" 
            gap={16} 
            style={{ backgroundColor: "#001E17" }}
          />
          <Controls 
            style={{ 
              button: { 
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "#00ED95",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              return node.style?.background?.toString() || "#00684A";
            }}
            maskColor="rgba(0, 237, 149, 0.1)"
            style={{
              backgroundColor: "rgba(0, 30, 23, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
          />
        </ReactFlow>
      </div>

      <div style={{ marginTop: "16px" }}>
        <Body>
          <strong>Legend:</strong>{" "}
          <span style={{ color: "#1C4587" }}>■ PRECEDES</span> •{" "}
          <span style={{ color: "#CC0000" }}>■ CAUSES</span> •{" "}
          <span style={{ color: "#38761D" }}>■ SUPPORTS</span> •{" "}
          <span style={{ color: "#E69138" }}>■ CONTRADICTS</span> •{" "}
          <span style={{ color: "#6A1B9A" }}>■ DERIVES_FROM</span> •{" "}
          <span style={{ color: "#0B5394" }}>■ CO_OCCURS</span>
        </Body>
      </div>
    </div>
  );
}
