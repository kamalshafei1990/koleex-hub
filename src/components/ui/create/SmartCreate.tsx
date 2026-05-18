"use client";

/* ---------------------------------------------------------------------------
   SmartCreate — unified ERP creation primitives.

   One vocabulary for every "New X" flow (Expense / Customer / Supplier /
   Inventory Item / Asset / SO / PO …). The brief is emphatic: same
   layout, sections, spacing, buttons, save behaviour.

   Exports:
     · SmartCreatePage    Shell with title + intro + workflow rail +
                          left form / right side-panel + footer actions.
     · SmartSection       Titled group with optional help text.
     · SmartField         Label + input + hint + required dot + impact
                          badges (Affects Accounting / Inventory).
     · SmartImpactBadge   "Affects Accounting" / "Affects Inventory" pill.
     · SmartHelpCard      Sidebar info card (what this means / next
                          step / required).
     · WorkflowRail       Previous · Current · Next.
     · InlineEntityPicker A combobox-style picker with "+ Add new …"
                          that opens a nested modal (no page leave).
     · SmartEmptyState    Branded empty state with CTA.

   The primitives don't talk to any specific endpoint. Callers wire
   their own onCreate / onChange / onSubmit handlers.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { ErpHairline } from "@/components/ui/erp/ErpUi";

/* ─── Page shell ─────────────────────────────────────────── */

export interface WorkflowStep {
  key: string;
  label: string;
  icon: RrIconName;
  href?: string;
  state: "done" | "current" | "next";
  hint?: string;
}

export function SmartCreatePage({
  title, kind, intro, backHref = "/", icon,
  workflow, primaryAction, secondaryAction, side, children,
}: {
  title: string;
  kind: string;                  // e.g. "New Expense"
  intro: string;                 // one-line explanation
  backHref?: string;
  icon: RrIconName;
  workflow?: WorkflowStep[];
  primaryAction: { label: string; onClick: () => void; busy?: boolean; disabled?: boolean };
  secondaryAction?: { label: string; onClick: () => void };
  side?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href={backHref} aria-label="Back"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <RrIcon name="arrow-left" size={16} />
            </Link>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
              <RrIcon name={icon} size={16} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{kind}</div>
              <h1 className="text-xl font-bold tracking-tight md:text-[22px]">{title}</h1>
              <p className="mt-0.5 text-[11.5px] text-gray-500">{intro}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {secondaryAction && (
              <button type="button" onClick={secondaryAction.onClick}
                      className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
                {secondaryAction.label}
              </button>
            )}
            <button type="button" onClick={primaryAction.onClick} disabled={!!primaryAction.busy || !!primaryAction.disabled}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14] disabled:opacity-50">
              <RrIcon name={primaryAction.busy ? "loading" : "check"} size={12} />
              {primaryAction.busy ? "Saving…" : primaryAction.label}
            </button>
          </div>
        </div>

        {/* Workflow */}
        {workflow && workflow.length > 0 && (
          <div className="mt-4">
            <WorkflowRail steps={workflow} />
          </div>
        )}

        {/* Body */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">{children}</div>
          {side && <aside className="space-y-3">{side}</aside>}
        </div>
      </div>
    </div>
  );
}

/* ─── Section ─────────────────────────────────────────────── */

export function SmartSection({
  title, subtitle, help, children,
}: {
  title: string;
  subtitle?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.05] bg-white/[0.012]">
      <header className="flex items-baseline justify-between px-4 pt-3.5">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <div className="text-[10.5px] text-gray-500">{subtitle}</div>}
        </div>
        {help && (
          <span className="text-[10.5px] text-gray-500" title={help}>
            <RrIcon name="info" size={10} className="inline-block align-baseline" /> Help
          </span>
        )}
      </header>
      <ErpHairline className="my-3" />
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </section>
  );
}

/* ─── Field ──────────────────────────────────────────────── */

export type FieldImpact = "accounting" | "inventory";

export function SmartField({
  label, required, hint, impact, error, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  impact?: FieldImpact[];
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-gray-300">
        {label}
        {required && <span className="text-rose-300" aria-label="required">*</span>}
        {impact?.map((i) => <SmartImpactBadge key={i} impact={i} />)}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[10.5px] text-gray-500">{hint}</span>}
      {error && <span className="mt-1 block text-[10.5px] text-rose-300">{error}</span>}
    </label>
  );
}

/* ─── Impact badge ───────────────────────────────────────── */

export function SmartImpactBadge({ impact }: { impact: FieldImpact }) {
  const cfg =
    impact === "accounting"
      ? { label: "Affects Accounting", cls: "border-amber-300/40 bg-amber-300/[0.08] text-amber-200", icon: "books" as RrIconName }
      : { label: "Affects Inventory",  cls: "border-blue-300/40 bg-blue-300/[0.08] text-blue-200",  icon: "box-open" as RrIconName };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[9.5px] uppercase tracking-[0.06em] ${cfg.cls}`}>
      <RrIcon name={cfg.icon} size={8} />
      {cfg.label}
    </span>
  );
}

/* ─── Help card (side panel) ─────────────────────────────── */

export function SmartHelpCard({
  title, meaning, required, nextStep, accountingImpact, inventoryImpact,
}: {
  title: string;
  meaning: string;
  required?: string[];
  nextStep?: string;
  accountingImpact?: string;
  inventoryImpact?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 text-[11.5px] text-gray-300">
      <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{title}</div>
      <p className="mt-1.5 leading-snug">{meaning}</p>
      {required && required.length > 0 && (
        <div className="mt-3">
          <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Required</div>
          <ul className="mt-1 list-inside list-disc text-gray-300">
            {required.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      {accountingImpact && (
        <ImpactBlock icon="books" tone="amber" title="Accounting" body={accountingImpact} />
      )}
      {inventoryImpact && (
        <ImpactBlock icon="box-open" tone="blue" title="Inventory" body={inventoryImpact} />
      )}
      {nextStep && (
        <ImpactBlock icon="arrow-up-right" tone="neutral" title="Next step" body={nextStep} />
      )}
    </div>
  );
}

function ImpactBlock({ icon, tone, title, body }: { icon: RrIconName; tone: "amber" | "blue" | "neutral"; title: string; body: string }) {
  const dot =
    tone === "amber" ? "text-amber-200" :
    tone === "blue"  ? "text-blue-200"  :
                       "text-gray-300";
  return (
    <div className="mt-3 border-t border-white/[0.05] pt-2">
      <div className={`flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.10em] ${dot}`}>
        <RrIcon name={icon} size={9} /> {title}
      </div>
      <p className="mt-1 text-gray-300">{body}</p>
    </div>
  );
}

/* ─── Workflow rail ──────────────────────────────────────── */

export function WorkflowRail({ steps }: { steps: WorkflowStep[] }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => {
        const tone =
          s.state === "done"    ? "border-emerald-400/30 bg-emerald-500/[0.06]" :
          s.state === "current" ? "border-amber-400/40 bg-amber-500/[0.10]"   :
                                  "border-white/[0.06] bg-white/[0.012]";
        const dotCls =
          s.state === "done"    ? "bg-emerald-400/80" :
          s.state === "current" ? "bg-amber-300/80"   :
                                  "bg-white/[0.10]";
        const inner = (
          <div className={`flex h-full items-center gap-2 rounded-xl border px-3 py-2 ${tone}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300">
              <RrIcon name={s.icon} size={12} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${dotCls}`} />
                <span className="text-[10px] uppercase tracking-[0.10em] text-gray-500">{`Step ${i + 1}`}</span>
              </div>
              <div className="text-[12.5px] font-medium">{s.label}</div>
              {s.hint && <div className="text-[10px] text-gray-500">{s.hint}</div>}
            </div>
          </div>
        );
        return (
          <li key={s.key} className="flex">
            {s.href ? <Link href={s.href} className="block hover:opacity-95">{inner}</Link> : inner}
            {i < steps.length - 1 && (
              <span aria-hidden className="mx-1 hidden self-center text-gray-600 sm:inline">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Empty state ─────────────────────────────────────────── */

export function SmartEmptyState({
  icon, title, body, actionHref, actionLabel, onAction, secondaryHref, secondaryLabel,
}: {
  icon: RrIconName;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] bg-white/[0.012] px-6 py-10 text-center">
      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-400">
        <RrIcon name={icon} size={18} />
      </span>
      <div className="text-[13px] font-medium">{title}</div>
      <p className="mt-1 max-w-md text-[11px] text-gray-500">{body}</p>
      <div className="mt-3 flex gap-2">
        {actionHref ? (
          <Link href={actionHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[11.5px] text-emerald-100 hover:bg-emerald-300/[0.14]">
            <RrIcon name="plus" size={10} />
            {actionLabel}
          </Link>
        ) : onAction && actionLabel ? (
          <button type="button" onClick={onAction}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[11.5px] text-emerald-100 hover:bg-emerald-300/[0.14]">
            <RrIcon name="plus" size={10} />
            {actionLabel}
          </button>
        ) : null}
        {secondaryHref && secondaryLabel && (
          <Link href={secondaryHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11.5px] hover:bg-white/[0.08]">
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Inline-create entity picker ─────────────────────────── */

export interface PickerOption { id: string; label: string; sub?: string }

export function InlineEntityPicker({
  label, value, options, onChange, onCreate, onRefresh, placeholder = "Select…",
  createLabel, required, impact, hint,
}: {
  label: string;
  value: string | null;
  options: PickerOption[];
  onChange: (id: string | null) => void;
  /** Render a creation form. Resolves with the new option (added to
   *  the parent's option list by the caller) or null on cancel. */
  onCreate: () => Promise<PickerOption | null>;
  /** Optional refresh callback — re-pulls the list from the server.
   *  Useful when another tab or operator added an entry. */
  onRefresh?: () => Promise<void> | void;
  placeholder?: string;
  createLabel: string;
  required?: boolean;
  impact?: FieldImpact[];
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function clickOutside(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [open]);

  const filtered = filter
    ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
    : options;
  const chosen = options.find((o) => o.id === value);

  async function handleCreate() {
    setOpen(false);
    const created = await onCreate();
    if (created) onChange(created.id);
  }

  return (
    <SmartField label={label} required={required} hint={hint} impact={impact}>
      <div ref={wrap} className="relative" id={id}>
        <button type="button" onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-left text-[12.5px] hover:bg-white/[0.04]">
          <span className={chosen ? "" : "text-gray-500"}>
            {chosen ? chosen.label : placeholder}
          </span>
          <RrIcon name="arrow-down-left" size={10} className="rotate-[225deg] text-gray-500" />
        </button>
        {open && (
          <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-white/[0.10] bg-[var(--bg-primary)] shadow-xl">
            <input
              autoFocus
              value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Search…"
              className="w-full border-b border-white/[0.06] bg-transparent px-3 py-2 text-[12px] outline-none"
            />
            <ul className="py-1">
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-[11px] text-gray-500">No match.</li>
              )}
              {filtered.map((o) => (
                <li key={o.id}>
                  <button type="button"
                          onClick={() => { onChange(o.id); setOpen(false); setFilter(""); }}
                          className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-white/[0.04]">
                    <span>{o.label}</span>
                    {o.sub && <span className="text-[10px] text-gray-500">{o.sub}</span>}
                  </button>
                </li>
              ))}
              <li className="border-t border-white/[0.06]">
                <button type="button" onClick={handleCreate}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-emerald-200 hover:bg-emerald-300/[0.05]">
                  <RrIcon name="plus" size={10} />
                  {createLabel}
                </button>
                {onRefresh && (
                  <button type="button"
                          onClick={async () => { await onRefresh(); setFilter(""); }}
                          className="flex w-full items-center gap-2 border-t border-white/[0.04] px-3 py-2 text-left text-[11.5px] text-gray-300 hover:bg-white/[0.04]">
                    <RrIcon name="loading" size={10} />
                    Refresh list
                  </button>
                )}
              </li>
            </ul>
          </div>
        )}
      </div>
    </SmartField>
  );
}

/* ─── Simple modal for inline creation ────────────────────── */

export function InlineCreateModal({
  open, title, intro, onClose, busy, primaryLabel = "Create", onSubmit, children,
}: {
  open: boolean;
  title: string;
  intro?: string;
  onClose: () => void;
  busy?: boolean;
  primaryLabel?: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-primary)] shadow-2xl">
        <header className="border-b border-white/[0.06] px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Add</div>
          <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
          {intro && <p className="mt-0.5 text-[10.5px] text-gray-500">{intro}</p>}
        </header>
        <div className="space-y-3 px-4 py-4">{children}</div>
        <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-white/[0.012] px-4 py-3">
          <button type="button" onClick={onClose}
                  className="rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.08]">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={onSubmit}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14] disabled:opacity-50">
            <RrIcon name={busy ? "loading" : "check"} size={12} />
            {busy ? "Saving…" : primaryLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ─── Plain input + textarea helpers ─────────────────────── */

export function SmartInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-white/[0.20] ${props.className ?? ""}`}
    />
  );
}
export function SmartTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-white/[0.20] ${props.className ?? ""}`}
    />
  );
}
export function SmartSelect({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-white/[0.20] ${rest.className ?? ""}`}
    >
      {children}
    </select>
  );
}
