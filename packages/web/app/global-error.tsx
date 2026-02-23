"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: 40, fontFamily: "monospace", background: "#001E2B", color: "#fff" }}>
        <h2 style={{ color: "#DB3030" }}>Something went wrong</h2>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 14, opacity: 0.8 }}>
          {error.message}
        </pre>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.5, marginTop: 16 }}>
          {error.stack}
        </pre>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "8px 16px",
            background: "#00ED64",
            color: "#001E2B",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
