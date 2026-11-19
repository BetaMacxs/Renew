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
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          backgroundColor: "#f9fafb",
          color: "#111827",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#4b5563", marginBottom: "1.5rem", maxWidth: "28rem", textAlign: "center" }}>
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.625rem 1.25rem",
            backgroundColor: "#0d9488",
            color: "#ffffff",
            fontWeight: 500,
            borderRadius: "0.375rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
