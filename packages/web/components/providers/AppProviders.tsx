"use client";

import React from "react";
import "@/styles/globals.css";
import { ThemeContextProvider } from "@/contexts/ThemeContext";
import { DaemonConfigProvider } from "@/contexts/DaemonConfigContext";
import { RememberModalProvider } from "@/contexts/RememberModalContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContextProvider>
      <DaemonConfigProvider>
        <RememberModalProvider>{children}</RememberModalProvider>
      </DaemonConfigProvider>
    </ThemeContextProvider>
  );
}
