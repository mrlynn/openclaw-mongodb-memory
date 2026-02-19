"use client";

import React from "react";
import { ThemeContextProvider } from "@/contexts/ThemeContext";
import { DaemonConfigProvider } from "@/contexts/DaemonConfigContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContextProvider>
      <DaemonConfigProvider>{children}</DaemonConfigProvider>
    </ThemeContextProvider>
  );
}
