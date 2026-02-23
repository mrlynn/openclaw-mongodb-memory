import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "OpenClaw Memory",
  description: "MongoDB-backed semantic memory for AI agents and workflows",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "OpenClaw Memory",
    description: "MongoDB-backed semantic memory for AI agents and workflows",
    images: [{ url: "/icon-512.png", width: 512, height: 512 }],
  },
};

// Inline script to set data-theme before first paint, preventing FOUC.
// Reads the user's stored preference from localStorage; defaults to "dark".
const themeScript = `
(function() {
  try {
    var mode = localStorage.getItem('openclaw-theme-mode');
    if (mode !== 'light' && mode !== 'dark') mode = 'dark';
    document.body.setAttribute('data-theme', mode);
  } catch(e) {
    document.body.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
