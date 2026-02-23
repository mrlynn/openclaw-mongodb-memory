"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { STORAGE_KEYS, DEFAULT_DAEMON_URL } from "@/lib/constants";

interface DaemonConfigContextValue {
  daemonUrl: string;
  setDaemonUrl: (url: string) => void;
  isDefault: boolean;
}

const DaemonConfigContext = createContext<DaemonConfigContextValue>({
  daemonUrl: DEFAULT_DAEMON_URL,
  setDaemonUrl: () => {},
  isDefault: true,
});

function resolveDefaultUrl(): string {
  // NEXT_PUBLIC_DAEMON_URL is baked in at build time by Next.js
  const envUrl = process.env.NEXT_PUBLIC_DAEMON_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  return DEFAULT_DAEMON_URL;
}

export function DaemonConfigProvider({ children }: { children: ReactNode }) {
  // Always start with the default URL to match server render.
  const [daemonUrl, setDaemonUrlState] = useState(resolveDefaultUrl);

  // On mount, read the user's stored preference.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.DAEMON_URL);
    if (stored) setDaemonUrlState(stored);
  }, []);

  const setDaemonUrl = (url: string) => {
    const trimmed = url.replace(/\/+$/, "");
    localStorage.setItem(STORAGE_KEYS.DAEMON_URL, trimmed);
    setDaemonUrlState(trimmed);
  };

  return (
    <DaemonConfigContext.Provider
      value={{
        daemonUrl,
        setDaemonUrl,
        isDefault: daemonUrl === DEFAULT_DAEMON_URL,
      }}
    >
      {children}
    </DaemonConfigContext.Provider>
  );
}

export function useDaemonConfig() {
  return useContext(DaemonConfigContext);
}
