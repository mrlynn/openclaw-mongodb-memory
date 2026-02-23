"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@leafygreen-ui/card";
import Banner from "@leafygreen-ui/banner";
import Button from "@leafygreen-ui/button";
import { Body } from "@leafygreen-ui/typography";
import { CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";
import styles from "./SetupChecklist.module.css";

interface CheckItem {
  id: string;
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
  fix?: string;
}

interface SetupCheckResponse {
  success: boolean;
  complete: boolean;
  checks: CheckItem[];
}

const DISMISSED_KEY = "openclaw-setup-dismissed";

function StatusIcon({ status }: { status: CheckItem["status"] }) {
  switch (status) {
    case "ok":
      return <CheckCircle size={18} color="#00A35C" />;
    case "warning":
      return <AlertTriangle size={18} color="#FFC010" />;
    case "error":
      return <XCircle size={18} color="#DB3030" />;
  }
}

export function SetupChecklist({ daemonUrl }: { daemonUrl: string }) {
  const [data, setData] = useState<SetupCheckResponse | null>(null);
  const [dismissed, setDismissed] = useState(true); // Start dismissed to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    setDismissed(stored === "true");
  }, []);

  const fetchChecks = useCallback(async () => {
    try {
      const res = await fetch(`${daemonUrl}/health/setup`);
      if (res.ok) {
        const json: SetupCheckResponse = await res.json();
        setData(json);
      }
    } catch {
      // Daemon not reachable — don't show checklist
    }
  }, [daemonUrl]);

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "true");
  };

  // Don't render if: no data, all checks pass, or dismissed
  if (!data || data.complete || dismissed) return null;

  const actionableChecks = data.checks.filter((c) => c.status !== "ok");

  if (actionableChecks.length === 0) return null;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Body className={styles.title} weight="medium">
          Setup Status
        </Body>
        <button className={styles.dismiss} onClick={handleDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>

      <div className={styles.checks}>
        {data.checks.map((check) => (
          <div key={check.id} className={styles.checkItem}>
            <StatusIcon status={check.status} />
            <div className={styles.checkContent}>
              <Body className={styles.checkLabel}>{check.label}</Body>
              {check.fix && (
                <div className={styles.checkFix}>
                  <code>{check.fix}</code>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
