"use client";

/* ---------------------------------------------------------------------------
   IncotermsManager — admin UI for the Incoterms 2020 master list.

   Mirrors PaymentTermsManager visually so the Workspace tab has a
   consistent feel. Each row shows code, name, transport mode, and a
   horizontal "responsibility track" of chips that explicitly says what
   the seller is paying for (export clearance, main carriage, insurance,
   import clearance, import duty, unloading). The track is read straight
   off the includes_* flags — same source the landed-cost engine uses,
   so the doc preview, this card, and the calculator all stay in sync.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import { CatalogEditorModal, deleteCatalogRow, type CatalogField } from "./CatalogEditorModal";

const INCOTERM_FIELDS: CatalogField[] = [
  { key: "code", label: "Code", type: "text", required: true, placeholder: "FOB" },
  { key: "name", label: "Name", type: "text", required: true, placeholder: "Free On Board" },
  { key: "short_name", label: "Short name", type: "text" },
  { key: "transport_mode", label: "Transport mode", type: "select", options: [{ value: "any", label: "Any mode" }, { value: "sea", label: "Sea only" }] },
  { key: "standing", label: "Standing", type: "select", options: [{ value: "icc_2020", label: "ICC 2020" }, { value: "icc_2010", label: "ICC 2010" }, { value: "variant", label: "Variant" }, { value: "custom", label: "Custom" }] },
  { key: "includes_export_clearance", label: "Seller: export clearance", type: "toggle" },
  { key: "includes_main_carriage", label: "Seller: main carriage", type: "toggle" },
  { key: "includes_insurance", label: "Seller: insurance", type: "toggle" },
  { key: "includes_import_clearance", label: "Seller: import clearance", type: "toggle" },
  { key: "includes_import_duty", label: "Seller: import duty", type: "toggle" },
  { key: "includes_unloading_at_dest", label: "Seller: unload at destination", type: "toggle" },
  { key: "risk_transfer_point", label: "Risk transfer point", type: "text", full: true, placeholder: "On board the vessel at the named port" },
  { key: "named_location_required", label: "Named location required", type: "toggle" },
  { key: "is_obsolete", label: "Obsolete", type: "toggle" },
  { key: "is_default", label: "Default", type: "toggle" },
  { key: "is_active", label: "Active", type: "toggle" },
  { key: "sort_order", label: "Sort order", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
];

interface IncotermRow {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  short_name: string | null;
  transport_mode: "any" | "sea";
  includes_export_clearance: boolean;
  includes_main_carriage: boolean;
  includes_insurance: boolean;
  includes_import_clearance: boolean;
  includes_import_duty: boolean;
  includes_unloading_at_dest: boolean;
  risk_transfer_point: string | null;
  named_location_required: boolean;
  named_location_label: string | null;
  standing: "icc_2020" | "icc_2010" | "variant" | "custom";
  is_obsolete: boolean;
  effort_score: number;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
}

const RESPONSIBILITY_AXIS: {
  field: keyof Pick<IncotermRow,
    | "includes_export_clearance"
    | "includes_main_carriage"
    | "includes_insurance"
    | "includes_import_clearance"
    | "includes_import_duty"
    | "includes_unloading_at_dest">;
  label: string;
}[] = [
  { field: "includes_export_clearance",   label: "Export clearance" },
  { field: "includes_main_carriage",      label: "Main carriage" },
  { field: "includes_insurance",          label: "Insurance" },
  { field: "includes_import_clearance",   label: "Import clearance" },
  { field: "includes_import_duty",        label: "Import duty" },
  { field: "includes_unloading_at_dest",  label: "Unload at destination" },
];

export default function IncotermsManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [rows, setRows] = useState<IncotermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"all" | "any" | "sea">("all");
  const [editing, setEditing] = useState<IncotermRow | "new" | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/incoterms", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Load failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { rows: IncotermRow[] };
      setRows(json.rows ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleDelete = useCallback(async (row: IncotermRow) => {
    if (!confirm(`Delete "${row.code} — ${row.name}"? It will be hidden from quotes.`)) return;
    const err = await deleteCatalogRow("/api/incoterms", row.id);
    if (err) { alert(err); return; }
    void refresh();
  }, [refresh]);

  const view = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (mode !== "all" && r.transport_mode !== mode) return false;
      if (!needle) return true;
      return (
        r.code + " " + r.name + " " + (r.short_name ?? "") + " " + (r.notes ?? "")
      ).toLowerCase().includes(needle);
    });
  }, [rows, search, mode]);

  const totals = useMemo(() => ({
    all: rows.length,
    any: rows.filter((r) => r.transport_mode === "any").length,
    sea: rows.filter((r) => r.transport_mode === "sea").length,
    custom: rows.filter((r) => !r.is_system).length,
  }), [rows]);

  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">
            Incoterms (Price Types)
          </h2>
          <p className="text-[12px] text-[var(--text-dim)]">
            Cost &amp; risk-transfer rules referenced by every quote, invoice
            and landed-cost calc. {totals.all} terms — {totals.any} any-mode,
            {" "}{totals.sea} sea-only
            {totals.custom > 0 && (
              <> · <span className="text-[var(--text-primary)]">{totals.custom}</span> custom</>
            )}.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] rounded-lg hover:opacity-90 transition"
            onClick={() => setEditing("new")}
          >
            <PlusIcon size={14} />
            Add Custom Incoterm
          </button>
        )}
      </div>

      {/* Search + transport-mode chips */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name (FOB, CIF, Delivered Duty Paid…)"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "any", "sea"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                mode === m
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)]"
                  : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
              }`}
            >
              {m === "all" ? `All (${totals.all})` : m === "any" ? `Any mode (${totals.any})` : `Sea only (${totals.sea})`}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-[var(--text-dim)]">
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading Incoterms…</span>
        </div>
      )}
      {!loading && error && (
        <div className="py-16 text-center text-[13px] text-red-400">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-2">
          {view.map((row) => (
            <IncotermCard key={row.id} row={row} canEdit={isSuperAdmin} onEdit={() => setEditing(row)} onDelete={() => handleDelete(row)} />
          ))}
          {view.length === 0 && (
            <div className="py-12 text-center text-[var(--text-dim)] text-[13px]">
              No Incoterms match {search ? `"${search}"` : "this filter"}.
            </div>
          )}
        </div>
      )}

      {editing && (
        <CatalogEditorModal
          open
          title={editing === "new" ? "Add Incoterm" : `Edit ${editing.code}`}
          endpoint="/api/incoterms"
          fields={INCOTERM_FIELDS}
          idValue={editing === "new" ? null : editing.id}
          initial={editing === "new"
            ? { transport_mode: "any", standing: "icc_2020", named_location_required: true, is_active: true, sort_order: 1000 }
            : (editing as unknown as Record<string, unknown>)}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
        />
      )}
    </section>
  );
}

function IncotermCard({ row, canEdit, onEdit, onDelete }: { row: IncotermRow; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-3 hover:border-[var(--border-strong)] transition">
      <div className="flex items-start gap-3">
        {/* Code badge */}
        <div className="shrink-0 w-14 h-14 flex flex-col items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <div className="text-[14px] font-mono font-bold tracking-wide text-[var(--text-primary)]">
            {row.code}
          </div>
          <div className="text-[8px] uppercase tracking-wider text-[var(--text-dim)]">
            {row.transport_mode === "sea" ? "Sea" : "Any"}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{row.name}</span>
            {row.is_default && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] font-bold tracking-wide">
                DEFAULT
              </span>
            )}
            {row.standing === "icc_2020" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold tracking-wide">
                ICC 2020
              </span>
            )}
            {row.standing === "icc_2010" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold tracking-wide">
                ICC 2010
              </span>
            )}
            {row.standing === "variant" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 font-bold tracking-wide">
                VARIANT
              </span>
            )}
            {row.is_obsolete && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold tracking-wide">
                OBSOLETE
              </span>
            )}
          </div>

          {/* Responsibility track — green chip = seller pays, gray = buyer pays */}
          <div className="flex flex-wrap gap-1 mb-2">
            {RESPONSIBILITY_AXIS.map((axis) => {
              const sellerPays = row[axis.field];
              return (
                <span
                  key={axis.field}
                  className={`text-[9px] px-1.5 py-0.5 rounded border ${
                    sellerPays
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                  }`}
                  title={sellerPays ? "Seller pays" : "Buyer pays"}
                >
                  {sellerPays ? "✓" : "○"} {axis.label}
                </span>
              );
            })}
          </div>

          {row.risk_transfer_point && (
            <p className="text-[11px] text-[var(--text-dim)] mb-1">
              <span className="font-semibold text-[var(--text-primary)]">Risk passes:</span>{" "}
              {row.risk_transfer_point}
            </p>
          )}
          {row.notes && (
            <p className="text-[11px] text-[var(--text-dim)] italic">{row.notes}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-col gap-1 shrink-0">
            <button type="button" onClick={onEdit} title="Edit" className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition">
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onDelete} title="Delete" className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-red-400 hover:border-red-500/40 transition">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
