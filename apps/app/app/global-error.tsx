"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Root error boundary for the App Router — catches render crashes that escape
// every nested boundary and reports them to Sentry (with the context/tags set on
// the current surface). Must render its own <html>/<body>.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ font: "14px system-ui, sans-serif", color: "#444", padding: "2rem", textAlign: "center" }}>
        <p style={{ margin: "0 0 12px" }}>Something went wrong.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: 8, background: "#fff", color: "#222", cursor: "pointer" }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
