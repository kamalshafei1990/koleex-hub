"use client";

/* ---------------------------------------------------------------------------
   SuppliersServerList — Phase 4 Wave 2A.2 Suppliers directory (server-driven).

   A thin Suppliers ADAPTER over the SHARED server-list foundation — it reuses
   `useServerList` (server search/filter/sort/pagination + AbortController
   cancellation + tenant/account-scoped cache + state persistence) and the same
   permission-safe `?summary=1` global aggregate, exactly like CustomersServerList.
   It does NOT clone the 11k-line legacy Contacts component; complex supplier
   fields (factory, negotiation, risk, catalogs, banking) stay on the legacy
   "Full profile" route (/suppliers/[id]), which this list links to.

   Supplier-specific vs Customers: company-first naming, a supplier_type column
   + filter + "By type" summary breakdown (not customer tier). No sensitive
   supplier fields (costs, payment/bank, internal notes, ratings) are shown,
   searched, or summarised here — the endpoint enforces that server-side.
   --------------------------------------------------------------------------- */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useServerList } from "@/lib/hooks/useServerList";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { useScopeContext } from "@/lib/use-scope";
import { useTranslation } from "@/lib/i18n";
import { suppliersListT } from "@/lib/translations/suppliers-list";
import { createContact, updateContact, deleteContact } from "@/lib/contacts-admin";

type Row = Record<string, unknown> & {
  id: string; display_name?: string; full_name?: string; company_name?: string;
  company_name_en?: string; company_name_cn?: string;
  first_name?: string; last_name?: string; company?: string; country?: string;
  city?: string; supplier_type?: string; is_active?: boolean; email?: string;
  phone?: string; mobile?: string;
};
type Summary = { summary: { total: number; active: number; inactive: number; byTier?: Record<string, number>; byCountry?: Record<string, number> } };
type EditState = { open: boolean; row: Row | null };

const PAGE_SIZE = 50;
const VIEW_KEY = "kx_suppliers_view";
const rowName = (r: Row) =>
  r.company_name || r.company_name_en || r.display_name || r.full_name ||
  [r.first_name, r.last_name].filter(Boolean).join(" ") || r.company || "—";

export default function SuppliersServerList() {
  const router = useRouter();
  const scope = useScopeContext();
  const { t, lang } = useTranslation(suppliersListT);
  const rtl = lang === "ar";
  const [view, setView] = useState<"list" | "card">("list");
  const [edit, setEdit] = useState<EditState>({ open: false, row: null });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    try { const v = window.localStorage.getItem(VIEW_KEY); if (v === "card" || v === "list") setView(v); } catch {}
  }, []);
  const changeView = (v: "list" | "card") => { setView(v); try { window.localStorage.setItem(VIEW_KEY, v); } catch {} };

  const list = useServerList<Row>({
    resource: "contacts:supplier",
    endpoint: "/api/contacts",
    scope: { tenantId: scope?.tenant_id, accountId: scope?.account_id },
    fixedParams: { type: "supplier", paged: "1" },
    pageSize: PAGE_SIZE,
    initialSort: { field: "name", dir: "asc" },
    enabled: !!scope,
    persistKey: scope ? `kx_suppliers_list:${scope.tenant_id}` : undefined,
  });

  const summary = useApiQuery<Summary>(
    ["contacts-summary", "supplier", scope?.tenant_id ?? "anon"],
    scope ? "/api/contacts?type=supplier&summary=1" : null,
  );
  const stats = summary.data?.summary;

  /* Privacy-safe error telemetry — one event per session on a list load error. */
  const errFiredRef = useRef(false);
  useEffect(() => {
    if (list.isError && !errFiredRef.current) {
      errFiredRef.current = true;
      try {
        const body = JSON.stringify({ eventType: "suppliers_server_list_error", route: "/suppliers" });
        navigator.sendBeacon?.("/api/activity/track", new Blob([body], { type: "application/json" }));
      } catch { /* best-effort */ }
    }
  }, [list.isError]);

  const totalPages = list.total != null ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : null;

  const afterSave = () => { setEdit({ open: false, row: null }); list.refetch(); summary.refetch(); };

  /* Per-row actions — parity with the legacy Suppliers directory (which has NO
     bulk/multi-select: only per-row edit, archive-via-is_active, and delete).
     Both endpoints revalidate module permission + tenant scope server-side
     (PATCH/DELETE /api/contacts/[id]); on success we invalidate the current
     server-list query + the summary aggregate — never a full-list refetch. */
  const runRow = async (id: string, fn: () => Promise<{ ok: boolean; error: string | null }>) => {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (!res.ok) { window.alert(res.error ?? t("sl.actionFailed")); return; }
    list.refetch(); summary.refetch();
  };
  const toggleArchive = (r: Row) => runRow(r.id, () => updateContact(r.id, { contact_type: "supplier", is_active: !r.is_active }));
  const removeRow = (r: Row) => {
    if (!window.confirm(`${t("sl.confirmDelete")} ${rowName(r)}?`)) return;
    runRow(r.id, () => deleteContact(r.id));
  };

  const cellS: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 13, textAlign: "start" };
  const headS: React.CSSProperties = { ...cellS, fontWeight: 600, color: "var(--text-secondary)", position: "sticky", top: 0, background: "var(--bg-surface)" };
  const btnS: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 12, cursor: "pointer" };
  const sortMark = (f: string) => (list.sort === f ? (list.dir === "asc" ? " ▲" : " ▼") : "");
  const onSort = (f: string) => list.setSort(f, list.sort === f && list.dir === "asc" ? "desc" : "asc");
  const statusChip = (r: Row) => (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: r.is_active ? "var(--color-success-bg, #e6f7ee)" : "var(--bg-surface-active)", color: r.is_active ? "var(--color-success, #00cc66)" : "var(--text-tertiary)" }}>
      {r.is_active ? t("sl.active") : t("sl.inactive")}
    </span>
  );

  const rowActions = (r: Row) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setEdit({ open: true, row: r })} style={btnS} disabled={busyId === r.id}>{t("sl.edit")}</button>
      <button onClick={() => toggleArchive(r)} style={btnS} disabled={busyId === r.id}>{busyId === r.id ? "…" : r.is_active ? t("sl.archive") : t("sl.activate")}</button>
      <button onClick={() => removeRow(r)} style={{ ...btnS, color: "var(--color-error, #ff3333)" }} disabled={busyId === r.id}>{t("sl.delete")}</button>
    </div>
  );

  const typeEntries = Object.entries(stats?.byTier ?? {}).sort((a, b) => b[1] - a[1]);
  const countryEntries = Object.entries(stats?.byCountry ?? {}).sort((a, b) => b[1] - a[1]);
  // Supplier-type filter options come from the global summary (never the page).
  const typeOptions = typeEntries.map(([k]) => k);

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("sl.title")}</h1>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)", color: "var(--text-secondary)" }}>{t("sl.preview")}</span>
      </div>

      {/* Global summary (server aggregate, NOT the page) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
        {[{ l: t("sl.total"), v: stats?.total }, { l: t("sl.active"), v: stats?.active }, { l: t("sl.inactive"), v: stats?.inactive }].map((c) => (
          <div key={c.l} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px", background: "var(--bg-surface)" }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.l} · {t("sl.allSuffix")}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.isLoading ? "…" : c.v ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Type + country breakdowns (global aggregate, not the page) */}
      {(typeEntries.length > 0 || countryEntries.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 16 }}>
          {[{ h: t("sl.byType"), rows: typeEntries }, { h: t("sl.byCountry"), rows: countryEntries }].map((b) => (
            <div key={b.h} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 12px", background: "var(--bg-surface)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>{b.h} · {t("sl.allSuffix")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b.rows.length === 0 ? <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("sl.noBreakdown")}</span> : b.rows.map(([k, n]) => (
                  <span key={k} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)" }}>{k} <b>{n}</b></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input value={list.query} onChange={(e) => list.setQuery(e.target.value)} placeholder={t("sl.searchPh")} aria-label={t("sl.searchPh")}
          style={{ flex: "1 1 240px", minWidth: 180, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13 }} />
        <select value={list.filters.status ?? ""} onChange={(e) => list.setFilter("status", e.target.value || null)} aria-label={t("sl.colStatus")}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13 }}>
          <option value="">{t("sl.allStatuses")}</option>
          <option value="true">{t("sl.active")}</option>
          <option value="false">{t("sl.inactive")}</option>
        </select>
        {typeOptions.length > 0 && (
          <select value={list.filters.supplierType ?? ""} onChange={(e) => list.setFilter("supplierType", e.target.value || null)} aria-label={t("sl.colType")}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13 }}>
            <option value="">{t("sl.allTypes")}</option>
            {typeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <div style={{ display: "flex", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => changeView("list")} style={{ ...btnS, border: "none", borderRadius: 0, background: view === "list" ? "var(--bg-surface-active)" : "var(--bg-surface)" }}>{t("sl.viewList")}</button>
          <button onClick={() => changeView("card")} style={{ ...btnS, border: "none", borderRadius: 0, background: view === "card" ? "var(--bg-surface-active)" : "var(--bg-surface)" }}>{t("sl.viewCard")}</button>
        </div>
        <button onClick={() => setEdit({ open: true, row: null })} style={{ ...btnS, background: "var(--text-primary, #000)", color: "var(--bg-surface, #fff)", borderColor: "transparent" }}>+ {t("sl.new")}</button>
        {list.isRefreshing && <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("sl.refreshing")}</span>}
      </div>

      {/* States */}
      {list.isError ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--color-error, #ff3333)" }}>{t("sl.loadError")} {list.error?.message}</p>
          <button onClick={() => list.refetch()} style={btnS}>{t("sl.retry")}</button>
        </div>
      ) : list.isInitialLoading ? (
        <div style={{ padding: 24, color: "var(--text-tertiary)" }}>{t("sl.loading")}</div>
      ) : list.rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>{list.query || list.filters.status || list.filters.supplierType ? t("sl.emptySearch") : t("sl.emptyNone")}</div>
      ) : view === "card" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {list.rows.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14, background: "var(--bg-surface)", cursor: "pointer" }} onClick={() => router.push(`/suppliers/${r.id}`)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{rowName(r)}</div>{statusChip(r)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{r.supplier_type || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{[r.city, r.country].filter(Boolean).join(", ") || "—"}</div>
              <div style={{ marginTop: 10 }}>{rowActions(r)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...headS, cursor: "pointer" }} onClick={() => onSort("name")}>{t("sl.colName")}{sortMark("name")}</th>
              <th style={headS}>{t("sl.colType")}</th>
              <th style={{ ...headS, cursor: "pointer" }} onClick={() => onSort("country")}>{t("sl.colLocation")}{sortMark("country")}</th>
              <th style={headS}>{t("sl.colStatus")}</th>
              <th style={headS}></th>
            </tr></thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/suppliers/${r.id}`)}>
                  <td style={{ ...cellS, fontWeight: 600 }}>{rowName(r)}</td>
                  <td style={cellS}>{r.supplier_type ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)" }}>{r.supplier_type}</span> : "—"}</td>
                  <td style={cellS}>{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                  <td style={cellS}>{statusChip(r)}</td>
                  <td style={cellS}>{rowActions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination + selection */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
        <div>{list.total != null ? `${list.total} ${t("sl.suppliers")}` : `${list.rows.length}`}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)} style={{ ...btnS, opacity: list.page <= 1 ? 0.5 : 1 }}>{t("sl.prev")}</button>
          <span>{t("sl.page")} {list.page}{totalPages ? ` / ${totalPages}` : ""}</span>
          <button disabled={!list.hasMore} onClick={() => list.setPage(list.page + 1)} style={{ ...btnS, opacity: list.hasMore ? 1 : 0.5 }}>{t("sl.next")}</button>
        </div>
      </div>

      {edit.open && <QuickEditModal row={edit.row} t={t} onClose={() => setEdit({ open: false, row: null })} onSaved={afterSave} onOpenFull={(id) => router.push(`/suppliers/${id}`)} />}
    </div>
  );
}

/* Quick create/edit — focused fields; full supplier profile lives at
   /suppliers/[id] (factory, negotiation, risk, catalogs, banking, etc.). */
function QuickEditModal({ row, t, onClose, onSaved, onOpenFull }: {
  row: Row | null; t: (k: string) => string; onClose: () => void; onSaved: () => void; onOpenFull: (id: string) => void;
}) {
  const isEdit = !!row;
  const [f, setF] = useState({
    company_name: String(row?.company_name ?? row?.company ?? ""),
    supplier_type: String(row?.supplier_type ?? ""),
    first_name: String(row?.first_name ?? ""), last_name: String(row?.last_name ?? ""),
    email: String(row?.email ?? ""), phone: String(row?.phone ?? row?.mobile ?? ""),
    country: String(row?.country ?? ""), is_active: row?.is_active ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.company_name.trim()) { setErr(t("sl.companyReq")); return; }
    setSaving(true); setErr(null);
    const payload = { contact_type: "supplier", ...f };
    if (isEdit && row) {
      const res = await updateContact(row.id, payload);
      setSaving(false);
      if (!res.ok) { setErr(res.error ?? "Failed"); return; }
    } else {
      const res = await createContact(payload);
      setSaving(false);
      if (res.error) { setErr(res.error); return; }
    }
    onSaved();
  };

  const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13, marginTop: 4 };
  const lbl: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)" };
  const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13, cursor: "pointer" };

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface, #fff)", borderRadius: 14, padding: 20, width: "min(460px,100%)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{isEdit ? t("sl.editTitle") : t("sl.createTitle")}</h2>
          {isEdit && row && <button onClick={() => onOpenFull(row.id)} style={{ ...btn, fontSize: 12 }}>{t("sl.fullEdit")}</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ ...lbl, gridColumn: "1 / -1" }}>{t("sl.fCompany")}<input style={inp} value={f.company_name} onChange={(e) => set("company_name", e.target.value)} /></label>
          <label style={{ ...lbl, gridColumn: "1 / -1" }}>{t("sl.fType")}<input style={inp} value={f.supplier_type} onChange={(e) => set("supplier_type", e.target.value)} /></label>
          <label style={lbl}>{t("sl.fContactFirst")}<input style={inp} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} /></label>
          <label style={lbl}>{t("sl.fContactLast")}<input style={inp} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></label>
          <label style={lbl}>{t("sl.fEmail")}<input style={inp} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
          <label style={lbl}>{t("sl.fPhone")}<input style={inp} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          <label style={lbl}>{t("sl.fCountry")}<input style={inp} value={f.country} onChange={(e) => set("country", e.target.value)} /></label>
          <label style={lbl}>{t("sl.fStatus")}
            <select style={inp} value={f.is_active ? "true" : "false"} onChange={(e) => set("is_active", e.target.value === "true")}>
              <option value="true">{t("sl.active")}</option>
              <option value="false">{t("sl.inactive")}</option>
            </select>
          </label>
        </div>
        {err && <p style={{ color: "var(--color-error, #ff3333)", fontSize: 12, marginTop: 10 }}>{err}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btn}>{t("sl.cancel")}</button>
          <button onClick={save} disabled={saving} style={{ ...btn, background: "var(--text-primary, #000)", color: "var(--bg-surface, #fff)", borderColor: "transparent", opacity: saving ? 0.6 : 1 }}>{saving ? t("sl.saving") : t("sl.save")}</button>
        </div>
      </div>
    </div>
  );
}
