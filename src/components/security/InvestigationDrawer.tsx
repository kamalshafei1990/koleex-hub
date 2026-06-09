"use client";

/* InvestigationDrawer — entity-scoped slide-over / sheet (Phase 2A · A4).
   Fed ENTIRELY from the in-memory report (no fetch, no fabricated per-attempt
   detail). Right slide-over on desktop, full-screen sheet on mobile. ESC /
   backdrop / X close; focus moves in on open and returns to the trigger.
   Read-only — no actions, no enforcement controls. */

import { useEffect, useRef } from "react";
import type { SecurityReport } from "@/lib/security/view-model";
import { buildDrawerModel, type Entity } from "./investigation";

export interface InvestigationDrawerProps {
  entity: Entity | null;
  report: SecurityReport;
  onClose: () => void;
}

export default function InvestigationDrawer({ entity, report, onClose }: InvestigationDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!entity) return;
    triggerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: keep Tab cycling inside the dialog.
      if (e.key === "Tab" && panelRef.current) {
        const f = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        if (!panelRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [entity, onClose]);

  if (!entity) return null;
  const model = buildDrawerModel(report, entity);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={model ? `${model.subtitle}: ${model.title}` : "Investigation"}
        className="absolute inset-0 flex flex-col bg-[var(--bg-surface)] md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:border-l md:border-[var(--border)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{model?.subtitle ?? "Investigation"}</p>
            <p className="truncate font-mono text-base text-[var(--text-primary)]">{model?.title ?? entity.id}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-[var(--text-dim)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!model ? (
            <p className="text-sm text-[var(--text-dim)]">No detail available for this item in the current window.</p>
          ) : (
            <div className="space-y-6">
              <Section title="Summary">
                <dl className="divide-y divide-[var(--border)]">
                  {model.summary.map((f) => (
                    <div key={f.label} className="flex items-center justify-between gap-4 py-1.5">
                      <dt className="text-sm text-[var(--text-dim)]">{f.label}</dt>
                      <dd className="text-sm tabular-nums text-[var(--text-secondary)]">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </Section>

              <Section title="Signals">
                <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                  {model.signals.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Section>

              <Section title="Recommended action">
                <p className="text-sm text-[var(--text-secondary)]">{model.recommendation}</p>
                <p className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface-hover)] px-3 py-2 text-xs text-[var(--text-dim)]">
                  Advisory only. This view never blocks, unblocks, or enables enforcement. Detailed per-attempt history isn’t available here.
                </p>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h3>
      {children}
    </section>
  );
}
