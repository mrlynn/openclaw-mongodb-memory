import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppShell } from "@/components/layout/AppShell";

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

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
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
