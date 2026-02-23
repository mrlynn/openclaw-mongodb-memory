"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchStatus } from "@/lib/api";
import { STATUS_POLL_INTERVAL } from "@/lib/constants";

export interface DaemonStatus {
  daemon: string;
  mongodb: string;
  voyage: string;
  uptime: number;
  memory: { heapUsed: number; heapTotal: number };
  stats: { totalMemories: number };
}

export function useStatus(daemonUrl: string, intervalMs = STATUS_POLL_INTERVAL) {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const data = await fetchStatus(daemonUrl);
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(`Failed to connect to daemon: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [daemonUrl]);

  useEffect(() => {
    setLoading(true);
    refetch();
    const interval = setInterval(refetch, intervalMs);
    return () => clearInterval(interval);
  }, [refetch, intervalMs]);

  return { status, loading, error, refetch };
}
