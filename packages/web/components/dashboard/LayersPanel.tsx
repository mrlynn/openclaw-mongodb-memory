"use client";

import React, { useState, useEffect } from "react";
import { H3, Body } from "@leafygreen-ui/typography";
import Card from "@leafygreen-ui/card";
import Badge from "@leafygreen-ui/badge";
import Icon from "@leafygreen-ui/icon";
import { useDaemonConfig } from "@/contexts/DaemonConfigContext";

interface LayerStats {
  working: number;
  episodic: number;
  semantic: number;
  archival: number;
  total: number;
  avgConfidence: Record<string, number>;
}

export function LayersPanel({ agentId = "openclaw" }: { agentId?: string }) {
  const { daemonUrl } = useDaemonConfig();
  const [stats, setStats] = useState<LayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      loadStats();
    }
  }, [agentId, daemonUrl]);

  const loadStats = async () => {
    if (!agentId) return;
    
    setLoading(true);
    setError(null);

    try {
      // Fetch all memories in batches (API limit is 100)
      let allMemories: any[] = [];
      let hasMore = true;
      let cursor: string | undefined = undefined;
      const batchSize = 100;
      let fetchCount = 0;
      const maxFetches = 100; // Cap at 10,000 memories (100 * 100)

      while (hasMore && fetchCount < maxFetches) {
        const url = cursor 
          ? `${daemonUrl}/memories?agentId=${agentId}&limit=${batchSize}&cursor=${cursor}`
          : `${daemonUrl}/memories?agentId=${agentId}&limit=${batchSize}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to load memories");
        }

        allMemories = allMemories.concat(data.memories || []);
        hasMore = data.hasMore || false;
        cursor = data.nextCursor?.cursor;
        fetchCount++;
      }

      console.log(`[LayersPanel] Loaded ${allMemories.length} memories in ${fetchCount} batches`);

      // Calculate layer distribution
      const memories = allMemories;
      const layerCounts: Record<string, number> = {
        working: 0,
        episodic: 0,
        semantic: 0,
        archival: 0,
      };

      const layerConfidence: Record<string, number[]> = {
        working: [],
        episodic: [],
        semantic: [],
        archival: [],
      };

      memories.forEach((m: any) => {
        const layer = m.layer || "episodic";
        layerCounts[layer] = (layerCounts[layer] || 0) + 1;
        if (m.confidence !== undefined) {
          layerConfidence[layer].push(m.confidence);
        }
      });

      const avgConfidence: Record<string, number> = {};
      Object.keys(layerConfidence).forEach((layer) => {
        const vals = layerConfidence[layer];
        avgConfidence[layer] =
          vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });

      setStats({
        working: layerCounts.working,
        episodic: layerCounts.episodic,
        semantic: layerCounts.semantic,
        archival: layerCounts.archival,
        total: memories.length,
        avgConfidence,
      });
    } catch (err) {
      console.error("[LayersPanel] Failed to load layer stats:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card style={{ padding: "20px" }}>
        <H3 style={{ marginBottom: "16px" }}>Memory Layers</H3>
        <Body style={{ textAlign: "center", opacity: 0.5 }}>Loading...</Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ padding: "20px" }}>
        <H3 style={{ marginBottom: "16px" }}>Memory Layers</H3>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Icon glyph="Warning" size={24} style={{ opacity: 0.5, marginBottom: "8px" }} />
          <Body style={{ opacity: 0.7, marginBottom: "8px" }}>Failed to load layer statistics</Body>
          <Body style={{ fontSize: "12px", opacity: 0.5 }}>{error}</Body>
          <div style={{ marginTop: "12px" }}>
            <button
              onClick={() => loadStats()}
              style={{
                padding: "8px 16px",
                background: "#00684A",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card style={{ padding: "20px" }}>
        <H3 style={{ marginBottom: "16px" }}>Memory Layers</H3>
        <Body style={{ textAlign: "center", opacity: 0.5 }}>No memories yet</Body>
      </Card>
    );
  }

  const layers = [
    {
      name: "Working",
      count: stats.working,
      color: "#FFB800",
      description: "Active session memories",
    },
    {
      name: "Episodic",
      count: stats.episodic,
      color: "#00684A",
      description: "Recent experiences",
    },
    {
      name: "Semantic",
      count: stats.semantic,
      color: "#1C4587",
      description: "Established knowledge",
    },
    {
      name: "Archival",
      count: stats.archival,
      color: "#6A1B9A",
      description: "Long-term storage",
    },
  ];

  return (
    <Card style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <H3>Memory Layers</H3>
        <Badge variant="blue">{stats.total.toLocaleString()} Total</Badge>
      </div>

      <div style={{ marginBottom: "20px" }}>
        {layers.map((layer) => {
          const percentage = stats.total > 0 ? (layer.count / stats.total) * 100 : 0;
          const avgConf = stats.avgConfidence[layer.name.toLowerCase()] || 0;

          return (
            <div key={layer.name} style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "3px",
                      backgroundColor: layer.color,
                    }}
                  />
                  <Body style={{ fontWeight: 500, fontSize: "14px" }}>{layer.name}</Body>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Body style={{ fontSize: "12px", opacity: 0.7 }}>
                    {layer.count.toLocaleString()} ({percentage.toFixed(1)}%)
                  </Body>
                  {avgConf > 0 && (
                    <Badge variant="lightgray" style={{ fontSize: "10px" }}>
                      {(avgConf * 100).toFixed(0)}% avg
                    </Badge>
                  )}
                </div>
              </div>

              {/* Bar */}
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "#F3F4F4",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${percentage}%`,
                    height: "100%",
                    backgroundColor: layer.color,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              <Body style={{ fontSize: "11px", opacity: 0.6, marginTop: "2px" }}>
                {layer.description}
              </Body>
            </div>
          );
        })}
      </div>

      <div
        style={{
          borderTop: "1px solid #E8EDEB",
          paddingTop: "12px",
          fontSize: "11px",
          opacity: 0.7,
        }}
      >
        <Body style={{ fontSize: "11px" }}>
          <Icon glyph="InfoWithCircle" size={12} style={{ marginRight: "4px" }} />
          Memories promote from working → episodic → semantic → archival over time
        </Body>
      </div>
    </Card>
  );
}
