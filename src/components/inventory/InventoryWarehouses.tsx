"use client";

/* ---------------------------------------------------------------------------
   /inventory/warehouses — Locations master.

   Despite the table name, this page covers every "stockable place":
   physical warehouses, ports, freight forwarders, customer sites,
   exhibitions, transit, etc. The location_type CHECK on the DB drives
   what shows up here; the UI lets the user create a typed location
   with contact info and toggles the new is_virtual flag automatically
   for non-physical types.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import {
  InventoryEmpty,
  LocationTypeChip,
  Panel,
} from "@/components/inventory/InventoryUi";
import { ALLOWED_LOCATION_TYPES, type LocationType, type Warehouse } from "@/lib/inventory/types";
import RrIcon from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { kxInspectAttrs } from "@/lib/qa/inspector";

/* Friendly labels for the picker. Mirrors the chip vocabulary in
   InventoryUi (which only handles display). */
const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  warehouse:           "Physical Warehouse",
  supplier_location:   "Supplier Site",
  port:                "Port",
  forwarder:           "Freight Forwarder",
  consolidation_point: "Consolidation Point",
  in_transit:          "In Transit",
  customer_location:   "Customer Location",
  exhibition_site:     "Exhibition / Booth",
  demo_location:       "Demo / Showroom",
  virtual_location:    "Virtual Location",
};

export default function InventoryWarehouses() {
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"" | LocationType>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/inventory/warehouses", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setRows((j.warehouses ?? []) as Warehouse[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    if (!filterType) return rows;
    return rows.filter((r) => (r.location_type ?? "warehouse") === filterType);
  }, [rows, filterType]);

  /* Group counts for the chip strip. */
  const counts = useMemo(() => {
    const acc = new Map<string, number>();
    for (const r of rows) {
      const k = r.location_type ?? "warehouse";
      acc.set(k, (acc.get(k) ?? 0) + 1);
    }
    return acc;
  }, [rows]);

  /* Page wrapper + InventoryHeader provided by /app/inventory/layout.tsx. */
  return (
    <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
          >
            <RrIcon name="plus" size={12} />
            New Location
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <button
            onClick={() => setFilterType("")}
            className={`rounded-md border px-2.5 py-1 ${filterType === "" ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"}`}
          >
            All <span className="text-gray-500 tabular-nums ml-1">{rows.length}</span>
          </button>
          {ALLOWED_LOCATION_TYPES.map((t) => {
            const c = counts.get(t) ?? 0;
            if (c === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${filterType === t ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"}`}
              >
                <LocationTypeChip type={t} />
                <span className="text-gray-500 tabular-nums">{c}</span>
              </button>
            );
          })}
        </div>

        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Address</th>
                <th className="px-4 py-2 text-left">Flags</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={6} className="px-0 py-0">
                  <InventoryEmpty
                    icon="building"
                    title={filterType ? "No locations of this type" : "No locations yet"}
                    hint={filterType ? "Try clearing the filter." : "Create your first warehouse — every receipt and shipment will need at least one."}
                    action={
                      <button
                        onClick={() => setDrawerOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1 text-[11.5px] hover:bg-white/[0.10]"
                      >
                        <RrIcon name="plus" size={11} />
                        New Location
                      </button>
                    }
                  />
                </td></tr>
              ) : (
                visible.map((w) => (
                  <tr key={w.id} {...kxInspectAttrs({ component: "InventoryWarehouseRow", module: "Inventory", section: "Warehouses", recordId: w.id })} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300 whitespace-nowrap">{w.code}</td>
                    <td className="px-4 py-2 text-gray-200">{w.name}</td>
                    <td className="px-4 py-2"><LocationTypeChip type={w.location_type} /></td>
                    <td className="px-4 py-2 text-[11.5px] text-gray-300">
                      {w.contact_person ? (
                        <>
                          {w.contact_person}
                          {w.contact_phone && <span className="text-gray-500"> · {w.contact_phone}</span>}
                        </>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[11.5px] text-gray-400 truncate max-w-[260px]">{w.address ?? w.location ?? "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {w.is_default && <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] text-emerald-200">Default</span>}
                        {w.is_virtual && <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] text-violet-200">Virtual</span>}
                        {!w.is_active && <span className="rounded-full border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] text-gray-400">Inactive</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>

      {drawerOpen && (
        <NewLocationDrawer
          onClose={() => setDrawerOpen(false)}
          onSuccess={() => { setDrawerOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

/* ─── New-location drawer ──────────────────────────────────── */

function NewLocationDrawer({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("warehouse");
  const [isDefault, setIsDefault] = useState(false);
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhysical = locationType === "warehouse" || locationType === "supplier_location";
  /* Only physical warehouses can be the tenant default — and only the
     "warehouse" type per the server-side rule. */
  const canBeDefault = locationType === "warehouse";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !name.trim()) { setError("Code and name required"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/inventory/warehouses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          location_type: locationType,
          is_default: canBeDefault ? isDefault : false,
          address: address.trim() || null,
          contact_person: contactPerson.trim() || null,
          contact_phone: contactPhone.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full sm:max-w-md flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-[var(--border-color)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h2 className="text-[14px] font-semibold">New Location</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] text-[20px] leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Code *</div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="WH-MAIN"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] font-mono"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Name *</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main Warehouse"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-gray-500">
              <span>Type</span>
              <LocationTypeChip type={locationType} />
            </div>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as LocationType)}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              {ALLOWED_LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <div className="mt-1 text-[10.5px] text-gray-500">
              {isPhysical ? "Physical location — stock will count as actually held." : "Virtual location — used for traceability without physical custody."}
            </div>
          </label>

          {canBeDefault && (
            <label className="flex items-center gap-2 text-[11.5px] text-gray-400">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default warehouse for movements
            </label>
          )}

          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Address</div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, country"
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Contact person</div>
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Warehouse manager / agent"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Contact phone</div>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+86 21 5555 0000"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            />
          </label>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50"
          >
            {!submitting && <RrIcon name="check" size={12} />}
            {submitting ? "Saving…" : "Create Location"}
          </button>
        </div>
      </form>
    </div>
  );
}
