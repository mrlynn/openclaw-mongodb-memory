import type { Metadata } from "next";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import React from "react";

export const metadata: Metadata = {
  title: "OpenClaw Memory Dashboard",
  description: "Manage agent memories and embeddings",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
