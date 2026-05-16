"use client";

/* ---------------------------------------------------------------------------
   /finance/reports/[exportId]/print
   Chrome-less rendering of a saved report export. Fetches the
   rendered HTML from /api/reports/exports/[id]/html and isolates it
   inside a full-bleed iframe so the printed output is byte-identical
   to what the PDF route emits (same HTML, same styles).

   The iframe approach keeps Next.js's own document untouched and
   uses `srcDoc` so there's no second HTTP roundtrip for the iframe
   content. `?auto=1` forwards to the API which embeds the
   auto-print bootstrap.
   --------------------------------------------------------------------------- */

import { use, useEffect, useState } from "react";

export default function ReportPrintPage({
  params,
}: {
  params: Promise<{ exportId: string }>;
}) {
  const { exportId } = use(params);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const auto = new URLSearchParams(window.location.search).get("auto") ?? "0";
        const res = await fetch(
          `/api/reports/exports/${encodeURIComponent(exportId)}/html?auto=${auto}`,
          { cache: "no-store", credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) setError(`Could not load report (${res.status})`);
          return;
        }
        const text = await res.text();
        if (!cancelled) setHtml(text);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [exportId]);

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Report could not be loaded</h1>
        <p>{error}</p>
      </main>
    );
  }
  if (!html) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", color: "#666" }}>
        Loading report…
      </main>
    );
  }
  return (
    <iframe
      title="Report"
      srcDoc={html}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
        background: "#fff",
      }}
    />
  );
}
