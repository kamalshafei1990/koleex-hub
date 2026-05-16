import "server-only";

/* ===========================================================================
   Phase R — html-renderer.ts is now a thin compatibility shim.

   The real renderer lives in document.ts and is composed from:
     · design-system.ts  — typography, spacing, palette, A4 geometry
     · formatters.ts     — accounting-grade number/date/currency helpers
     · layout.ts         — header, footer, recipient, summary, totals, …
     · table.ts          — enterprise table with subtotal/total rows
     · document.ts       — orchestrator

   This file exists ONLY so the two existing API routes — and any
   future caller — can keep importing renderReportHtml without
   knowing about the new architecture.
   ========================================================================== */

import { renderReportDocument, type DocumentRenderOptions } from "./document";
import type { ReportPayload } from "./types";

/* Re-export with the historical name + option type. */
export type RenderOptions = DocumentRenderOptions;

export function renderReportHtml(payload: ReportPayload, opts: RenderOptions = {}): string {
  return renderReportDocument(payload, opts);
}
