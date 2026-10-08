"use client";

/* ---------------------------------------------------------------------------
   components/ai/DraftCard — the quotation-draft result card.

   Phase 2J, sliced verbatim from KoleexAiApp.tsx. Rendered when an assistant
   message carries a tool-result step for createQuotationDraft.

   It shows the draft id, customer and total and links into the Quotations app
   for a human to finalise. It never surfaces cost or margin — those do not
   reach the client at all, and this card is not the place they start to.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import type { QuotationDraftPayload } from "@/components/ai/types";
import { COPY } from "@/components/ai/copy";
import type { Lang } from "@/lib/i18n";


/* ── Draft quotation card ──
   Rendered when an assistant message has a tool-result step with
   tool="createQuotationDraft". Shows the draft id, customer, total,
   and a prominent "Review in Quotations" button that deep-links into
   the existing Quotations app for the human to finalise. Never
   surfaces cost / margin side — those never reach the client. */
export default function DraftCard({ payload, lang = "en" }: { payload: QuotationDraftPayload; lang?: Lang }) {
  const copy = COPY[lang];
  const needsApproval = payload.approval_required;
  return (
    <div
      className={`rounded-2xl border backdrop-blur-md px-4 py-3.5 ${
        needsApproval
          ? "border-[var(--kx-ai-warning-line)] bg-[var(--kx-ai-warning-soft)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/75"
      }`}
      style={{ maxWidth: 460 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-bold tracking-wide uppercase ${
          needsApproval
            ? "bg-[var(--kx-ai-warning-soft)] text-[var(--kx-ai-warning-text)] border border-[var(--kx-ai-warning-line)]"
            : "bg-[var(--bg-surface)]/80 text-[var(--text-muted)] border border-[var(--border-subtle)]"
        }`}>
          {needsApproval ? copy.draftNeedsApproval : copy.draftLabel}
        </span>
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {payload.quote_no}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
          {payload.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-[12px] text-[var(--text-muted)]">{payload.currency}</span>
        <span className="text-[12px] text-[var(--text-dim)] ms-auto">
          {(payload.line_count === 1 ? copy.lineOne : copy.linesCount).replace("{n}", String(payload.line_count))}
        </span>
      </div>
      <Link
        href={payload.review_url}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold"
      >
        {copy.reviewInQuotations}
      </Link>
    </div>
  );
}
