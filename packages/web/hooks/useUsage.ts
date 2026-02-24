"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchUsageSummary,
  fetchUsageTimeline,
  fetchUsageProjections,
  fetchPipelineBreakdown,
  fetchUsageByAgent,
  UsageSummary,
  UsageTimelineResponse,
  UsageProjections,
  PipelineBreakdownResponse,
  UsageByAgentResponse,
} from "@/lib/api";

const USAGE_POLL_INTERVAL = 15_000; // 15 seconds

interface UseUsageOptions {
  daemonUrl: string;
  agentId?: string;
  days?: number;
  timelineGranularity?: string;
  pollInterval?: number;
}

interface UseUsageReturn {
  summary: UsageSummary | null;
  timeline: UsageTimelineResponse | null;
  projections: UsageProjections | null;
  pipelineBreakdown: PipelineBreakdownResponse | null;
  byAgent: UsageByAgentResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUsage({
  daemonUrl,
  agentId,
  days = 30,
  timelineGranularity,
  pollInterval = USAGE_POLL_INTERVAL,
}: UseUsageOptions): UseUsageReturn {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [timeline, setTimeline] = useState<UsageTimelineResponse | null>(null);
  const [projections, setProjections] = useState<UsageProjections | null>(null);
  const [pipelineBreakdown, setPipelineBreakdown] = useState<PipelineBreakdownResponse | null>(null);
  const [byAgent, setByAgent] = useState<UsageByAgentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect granularity based on days window
  const granularity = timelineGranularity || (days <= 1 ? "hour" : "day");

  const refetch = useCallback(async () => {
    try {
      const opts = { days, agentId };
      const [summaryData, timelineData, projectionsData, pipelineData, agentData] =
        await Promise.all([
          fetchUsageSummary(daemonUrl, opts),
          fetchUsageTimeline(daemonUrl, { ...opts, granularity }),
          fetchUsageProjections(daemonUrl, opts),
          fetchPipelineBreakdown(daemonUrl, opts),
          fetchUsageByAgent(daemonUrl, { days }),
        ]);

      setSummary(summaryData);
      setTimeline(timelineData);
      setProjections(projectionsData);
      setPipelineBreakdown(pipelineData);
      setByAgent(agentData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [daemonUrl, agentId, days, granularity]);

  useEffect(() => {
    setLoading(true);
    refetch();
    const interval = setInterval(refetch, pollInterval);
    return () => clearInterval(interval);
  }, [refetch, pollInterval]);

  return { summary, timeline, projections, pipelineBreakdown, byAgent, loading, error, refetch };
}
