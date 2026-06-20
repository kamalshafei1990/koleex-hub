"use client";

/* ---------------------------------------------------------------------------
   PaymentTermsManager — admin UI for the International Trade Payment
   Terms System. Lives inside the Settings → Workspace tab.

   Shows every category as an Apple-style card with its terms underneath.
   Filter chips at the top scope to a single category. Search filters by
   label / short_label / code. Each term shows:
     · its label + short label
     · the structured payment stages as compact chips ("30% Deposit",
       "70% Against B/L copy")
     · risk badges (exporter / buyer)
     · a "DEFAULT" pill if it's the tenant default for its category
     · a "SYSTEM" pill if it's an immutable seed

   Super-admins can:
     · Add a custom term (modal with category, label, structure builder)
     · Edit / disable / set-default on custom terms
     · Clone a system term into a tenant-customised copy
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import { CatalogEditorModal, deleteCatalogRow, type CatalogField } from "./CatalogEditorModal";

export interface PaymentTermStage {
  order: number;
  label: string;
  percent: number;
  trigger: string;
  days_after?: number;
}

export interface PaymentTermRow {
  id: string;
  tenant_id: string | null;
  category_id: string;
  code: string;
  label: string;
  short_label: string | null;
  structure: PaymentTermStage[];
  total_days: number | null;
  days_basis: string | null;
  exporter_risk: "low" | "medium" | "high" | null;
  buyer_risk: "low" | "medium" | "high" | null;
  suitable_for: string[];
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
}

export interface PaymentCategoryRow {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  default_risk_level: "low" | "medium" | "high" | null;
  is_advance: boolean;
  is_credit: boolean;
  is_bank_mediated: boolean;
  sort_order: number;
  terms: PaymentTermRow[];
}

const TRIGGER_LABELS: Record<string, string> = {
  order_confirmation: "Order confirmation",
  before_production: "Before production",
  before_shipment: "Before shipment",
  against_bl_copy: "Against B/L copy",
  against_original_docs: "Against original docs",
  on_delivery: "On delivery",
  days_after_invoice: "After invoice date",
  days_after_bl: "After B/L date",
  days_after_shipment: "After shipment",
  monthly_settlement: "Monthly settlement",
  quarterly_settlement: "Quarterly settlement",
  sight: "At sight",
  acceptance: "On acceptance",
  lc_negotiation: "L/C negotiation",
  after_installation: "After installation",
  after_commissioning: "After commissioning",
  after_sat: "After SAT",
  after_warranty: "After warranty",
};

function triggerLabel(stage: PaymentTermStage): string {
  const base = TRIGGER_LABELS[stage.trigger] ?? stage.trigger;
  if (stage.days_after != null) return `${stage.days_after}d ${base}`;
  return base;
}

function riskColour(level: "low" | "medium" | "high" | null | undefined): string {
  if (level === "low") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (level === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (level === "high") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
}

export default function PaymentTermsManager({
  isSuperAdmin,
}: {
  isSuperAdmin: boolean;
}) {
  const [categories, setCategories] = useState<PaymentCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategoryCode, setActiveCategoryCode] = useState<string | null>(null);
  const [editing, setEditing] = useState<PaymentTermRow | "new" | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payment-terms", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Load failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { categories: PaymentCategoryRow[] };
      setCategories(json.categories ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(async (term: PaymentTermRow) => {
    if (!confirm(`Delete "${term.label}"? It will be hidden from quotes, invoices & contracts.`)) return;
    const err = await deleteCatalogRow("/api/payment-terms", term.id);
    if (err) { alert(err); return; }
    void refresh();
  }, [refresh]);

  const RISK_OPTS = [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
  ];
  const termFields: CatalogField[] = useMemo(() => [
    { key: "category_id", label: "Category", type: "select", required: true,
      options: categories.map((c) => ({ value: c.id, label: c.name })) },
    { key: "code", label: "Code", type: "text", required: true, placeholder: "tt_30_70" },
    { key: "label", label: "Label", type: "text", required: true, placeholder: "30% deposit, 70% against B/L" },
    { key: "short_label", label: "Short label", type: "text", placeholder: "T/T 30/70" },
    { key: "total_days", label: "Total days", type: "number" },
    { key: "days_basis", label: "Days basis", type: "text", placeholder: "days_after_bl / none" },
    { key: "exporter_risk", label: "Exporter risk", type: "select", options: RISK_OPTS },
    { key: "buyer_risk", label: "Buyer risk", type: "select", options: RISK_OPTS },
    { key: "suitable_for", label: "Suitable for", type: "chips", full: true, placeholder: "new_customer, trusted (comma-separated)" },
    { key: "sort_order", label: "Sort order", type: "number" },
    { key: "is_default", label: "Default for category", type: "toggle" },
    { key: "is_active", label: "Active", type: "toggle" },
    { key: "notes", label: "Notes", type: "textarea" },
  ], [categories]);

  /* Filtered + searched view. We keep categories in the same order
     even when empty so chip filters stay stable. */
  const view = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return categories
      .filter((c) => !activeCategoryCode || c.code === activeCategoryCode)
      .map((c) => ({
        ...c,
        terms: !needle
          ? c.terms
          : c.terms.filter((t) =>
              (t.label + " " + (t.short_label ?? "") + " " + t.code).toLowerCase().includes(needle),
            ),
      }))
      .filter((c) => !needle || c.terms.length > 0);
  }, [categories, search, activeCategoryCode]);

  const totals = useMemo(() => {
    const allTerms = categories.flatMap((c) => c.terms);
    return {
      categories: categories.length,
      terms: allTerms.length,
      custom: allTerms.filter((t) => !t.is_system).length,
    };
  }, [categories]);

  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
            Payment Terms
          </h2>
          <p className="text-[12px] text-[var(--text-dim)]">
            Master list used by Quotations, Invoices, Sales Contracts, and the
            CRM customer profile. {totals.terms} terms across {totals.categories} categories
            {totals.custom > 0 && (
              <>
                {" "}
                · <span className="text-[var(--text-primary)]">{totals.custom}</span> custom
              </>
            )}
            .
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] rounded-lg hover:opacity-90 transition"
            onClick={() => setEditing("new")}
          >
            <PlusIcon size={14} />
            Add Custom Term
          </button>
        )}
      </div>

      {/* Search + category chips */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by label, short code, or term code (T/T, OA, L/C, …)"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-strong)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          type="button"
          onClick={() => setActiveCategoryCode(null)}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
            activeCategoryCode === null
              ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
              : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
          }`}
        >
          All ({totals.terms})
        </button>
        {categories.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setActiveCategoryCode(c.code)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              activeCategoryCode === c.code
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            }`}
          >
            {c.short_name ?? c.name} ({c.terms.length})
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-[var(--text-dim)]">
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading payment terms…</span>
        </div>
      )}
      {!loading && error && (
        <div className="py-16 text-center text-[13px] text-red-400">{error}</div>
      )}

      {/* Categories + term list */}
      {!loading && !error && (
        <div className="space-y-5">
          {view.map((cat) => (
            <div key={cat.code}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                    {cat.name}
                  </h3>
                  <span className="text-[11px] text-[var(--text-dim)]">
                    {cat.terms.length} terms
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cat.is_advance && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Advance
                    </span>
                  )}
                  {cat.is_credit && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Credit
                    </span>
                  )}
                  {cat.is_bank_mediated && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Bank-mediated
                    </span>
                  )}
                </div>
              </div>
              {cat.description && (
                <p className="text-[12px] text-[var(--text-dim)] mb-3">
                  {cat.description}
                </p>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {cat.terms.map((term) => (
                  <TermCard
                    key={term.id}
                    term={term}
                    canEdit={isSuperAdmin}
                    onChanged={refresh}
                    onEdit={() => setEditing(term)}
                    onDelete={() => handleDelete(term)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CatalogEditorModal
          open
          title={editing === "new" ? "Add Payment Term" : `Edit ${editing.label}`}
          endpoint="/api/payment-terms"
          fields={termFields}
          idValue={editing === "new" ? null : editing.id}
          initial={editing === "new"
            ? { category_id: categories[0]?.id ?? "", days_basis: "none", is_active: true, sort_order: 1000 }
            : (editing as unknown as Record<string, unknown>)}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
        />
      )}
    </section>
  );
}

function TermCard({
  term,
  canEdit,
  onChanged,
  onEdit,
  onDelete,
}: {
  term: PaymentTermRow;
  canEdit: boolean;
  onChanged: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const setDefault = useCallback(async () => {
    if (!canEdit || term.is_system) return;
    await fetch("/api/payment-terms", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: term.id, is_default: true }),
    });
    onChanged();
  }, [term, canEdit, onChanged]);

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-3 hover:border-[var(--border-strong)] transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {term.label}
            </span>
            {term.is_default && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] font-bold tracking-wide">
                DEFAULT
              </span>
            )}
            {term.is_system && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 font-bold tracking-wide">
                SYSTEM
              </span>
            )}
          </div>
          {term.short_label && (
            <p className="text-[11px] text-[var(--text-dim)] font-mono mb-2">
              {term.short_label} · <span className="opacity-70">{term.code}</span>
            </p>
          )}

          {/* Structured stages */}
          {Array.isArray(term.structure) && term.structure.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {term.structure.map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                >
                  <span className="font-bold">{s.percent}%</span>{" "}
                  <span className="opacity-70">{triggerLabel(s)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Risk + suitable-for badges */}
          <div className="flex flex-wrap gap-1">
            {term.exporter_risk && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${riskColour(term.exporter_risk)}`}>
                Exporter: {term.exporter_risk}
              </span>
            )}
            {term.buyer_risk && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${riskColour(term.buyer_risk)}`}>
                Buyer: {term.buyer_risk}
              </span>
            )}
            {term.suitable_for?.map((s) => (
              <span
                key={s}
                className="text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)] capitalize"
              >
                {s.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-start gap-1 shrink-0">
            {!term.is_system && !term.is_default && (
              <button
                type="button"
                onClick={setDefault}
                title="Set as the default for this category"
                className="p-1.5 text-[var(--text-dim)] hover:text-amber-400 hover:bg-amber-500/10 rounded transition"
              >
                <StarIcon size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition"
            >
              <PencilIcon className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="p-1.5 text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 rounded transition"
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
