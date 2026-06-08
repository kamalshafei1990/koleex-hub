/* NeedsAttention — 0–3 ranked items, or a calm "All clear" (Phase 2A · A3).
   The empty state is the signal, so it is rendered (never hidden). Actions are
   inert in A3 (the investigation drawer arrives in A4). RSC-safe. */

import type { AttentionItem } from "@/lib/security/view-model";
import SeverityChip from "./SeverityChip";

export interface NeedsAttentionProps {
  items: AttentionItem[];
}

export default function NeedsAttention({ items }: NeedsAttentionProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 px-4 py-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-dim)]" aria-hidden="true">✓</span>
        <p className="text-sm text-[var(--text-secondary)]">All clear — nothing needs your attention.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/60">
      <ul className="divide-y divide-[var(--border)]">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-3 px-4 py-3">
            <SeverityChip severity={it.severity} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{it.title}</p>
              <p className="mt-0.5 text-sm text-[var(--text-dim)]">{it.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
