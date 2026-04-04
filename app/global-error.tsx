"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "app/global-error",
        message: error.message,
        digest: error.digest,
        t: new Date().toISOString(),
      })
    );
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 480, margin: "48px auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: 20 }}>
            A critical error occurred. Please refresh the page or try again later.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
