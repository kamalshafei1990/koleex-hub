"use client";

/* ---------------------------------------------------------------------------
   /inventory/warehouses — Manage warehouse master data.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";

interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export default function InventoryWarehouses() {
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/inventory/warehouses", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Failed (${r.status})`);
      setRows((j.warehouses ?? []) as Warehouse[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!code.trim() || !name.trim()) { setSubmitError("Code and name required"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/inventory/warehouses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          location: location.trim() || null,
          is_default: isDefault,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setSubmitError(j.error ?? `Failed (${r.status})`); return; }
      setCode("");
      setName("");
      setLocation("");
      setIsDefault(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title="Warehouses" subtitle="Locations where stock is held." />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr,360px]">
          <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012]">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Location</th>
                  <th className="px-4 py-2 text-left">Default</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-[11px] text-gray-600">No warehouses yet.</td></tr>
                ) : (
                  rows.map((w) => (
                    <tr key={w.id} className="border-b border-white/[0.03]">
                      <td className="px-4 py-2 font-mono text-gray-300">{w.code}</td>
                      <td className="px-4 py-2 text-gray-300">{w.name}</td>
                      <td className="px-4 py-2 text-gray-500">{w.location ?? "—"}</td>
                      <td className="px-4 py-2 text-[11px]">
                        {w.is_default ? (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.10em] text-emerald-200">Default</span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 self-start">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">New Warehouse</div>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Code</div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="WH-MAIN"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main Warehouse"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Location</div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, country"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>
            <label className="flex items-center gap-2 text-[11.5px] text-gray-400">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Make default warehouse
            </label>

            {submitError && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-white/[0.06] disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Create Warehouse"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
