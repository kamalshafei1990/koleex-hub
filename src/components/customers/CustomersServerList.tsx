"use client";

/* ---------------------------------------------------------------------------
   CustomersServerList — Phase 4 Wave 2A.1 PREVIEW-ONLY Customers directory.

   Server-driven list (search / filter / sort / pagination on the server) via
   `useServerList` + a permission-safe global summary. Rendered ONLY on
   non-production hosts (customers/page.tsx gate); production keeps legacy.

   Revision after Preview feedback: + list/card view, + quick create/edit
   (reuses createContact/updateContact — full profile still via /customers/[id]),
   + zh/ar/en i18n, + list-state persistence (returning from detail keeps the
   page/search/filter/sort).
   --------------------------------------------------------------------------- */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useServerList } from "@/lib/hooks/useServerList";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { useScopeContext } from "@/lib/use-scope";
import { useTranslation } from "@/lib/i18n";
import { customersListT } from "@/lib/translations/customers-list";
import { createContact, updateContact } from "@/lib/contacts-admin";

type Row = Record<string, unknown> & {
  id: string; display_name?: string; full_name?: string; company_name?: string;
  first_name?: string; last_name?: string; company?: string; country?: string;
  city?: string; customer_type?: string; is_active?: boolean; email?: string;
  phone?: string; mobile?: string; account_manager?: string;
};
type Summary = { summary: { total: number; active: number; inactive: number; byTier?: Record<string, number>; byCountry?: Record<string, number> } };
type EditState = { open: boolean; row: Row | null };

const PAGE_SIZE = 50;
const VIEW_KEY = "kx_customers_view";
const rowName = (r: Row) =>
  r.display_name || r.full_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.company_name || r.company || "—";

export default function CustomersServerList() {
  const router = useRouter();
  const scope = useScopeContext();
  const { t, lang } = useTranslation(customersListT);
  const rtl = lang === "ar";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "card">("list");
  const [edit, setEdit] = useState<EditState>({ open: false, row: null });

  useEffect(() => {
    try { const v = window.localStorage.getItem(VIEW_KEY); if (v === "card" || v === "list") setView(v); } catch {}
  }, []);
  const changeView = (v: "list" | "card") => { setView(v); try { window.localStorage.setItem(VIEW_KEY, v); } catch {} };

  const list = useServerList<Row>({
    resource: "contacts:customer",
    endpoint: "/api/contacts",
    scope: { tenantId: scope?.tenant_id, accountId: scope?.account_id },
    fixedParams: { type: "customer", paged: "1" },
    pageSize: PAGE_SIZE,
    initialSort: { field: "name", dir: "asc" },
    enabled: !!scope,
    persistKey: scope ? `kx_customers_list:${scope.tenant_id}` : undefined,
  });

  const summary = useApiQuery<Summary>(
    ["contacts-summary", "customer", scope?.tenant_id ?? "anon"],
    scope ? "/api/contacts?type=customer&summary=1" : null,
  );
  const stats = summary.data?.summary;

  const totalPages = list.total != null ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : null;
  const pageIds = useMemo(() => list.rows.map((r) => r.id), [list.rows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAllOnPage = () =>
    setSelected((prev) => { const n = new Set(prev); if (allPageSelected) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n; });
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const afterSave = () => { setEdit({ open: false, row: null }); list.refetch(); summary.refetch(); };

  const cellS: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 13, textAlign: "start" };
  const headS: React.CSSProperties = { ...cellS, fontWeight: 600, color: "var(--text-secondary)", position: "sticky", top: 0, background: "var(--bg-surface)" };
  const btnS: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 12, cursor: "pointer" };
  const sortMark = (f: string) => (list.sort === f ? (list.dir === "asc" ? " ▲" : " ▼") : "");
  const onSort = (f: string) => list.setSort(f, list.sort === f && list.dir === "asc" ? "desc" : "asc");
  const statusChip = (r: Row) => (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: r.is_active ? "var(--color-success-bg, #e6f7ee)" : "var(--bg-surface-active)", color: r.is_active ? "var(--color-success, #00cc66)" : "var(--text-tertiary)" }}>
      {r.is_active ? t("cl.active") : t("cl.inactive")}
    </span>
  );

  const tierEntries = Object.entries(stats?.byTier ?? {}).sort((a, b) => b[1] - a[1]);
  const countryEntries = Object.entries(stats?.byCountry ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t("cl.title")}</h1>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)", color: "var(--text-secondary)" }}>{t("cl.preview")}</span>
      </div>

      {/* Global summary (server aggregate, NOT the page) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
        {[{ l: t("cl.total"), v: stats?.total }, { l: t("cl.active"), v: stats?.active }, { l: t("cl.inactive"), v: stats?.inactive }].map((c) => (
          <div key={c.l} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px", background: "var(--bg-surface)" }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.l} · {t("cl.allSuffix")}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.isLoading ? "…" : c.v ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Tier + country breakdowns (global aggregate, not the page) */}
      {(tierEntries.length > 0 || countryEntries.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginBottom: 16 }}>
          {[{ h: t("cl.byTier"), rows: tierEntries }, { h: t("cl.byCountry"), rows: countryEntries }].map((b) => (
            <div key={b.h} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 12px", background: "var(--bg-surface)" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>{b.h} · {t("cl.allSuffix")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b.rows.length === 0 ? <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("cl.noBreakdown")}</span> : b.rows.map(([k, n]) => (
                  <span key={k} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)" }}>{k} <b>{n}</b></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input value={list.query} onChange={(e) => list.setQuery(e.target.value)} placeholder={t("cl.searchPh")} aria-label={t("cl.searchPh")}
          style={{ flex: "1 1 240px", minWidth: 180, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13 }} />
        <select value={list.filters.status ?? ""} onChange={(e) => list.setFilter("status", e.target.value || null)} aria-label={t("cl.colStatus")}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13 }}>
          <option value="">{t("cl.allStatuses")}</option>
          <option value="true">{t("cl.active")}</option>
          <option value="false">{t("cl.inactive")}</option>
        </select>
        <div style={{ display: "flex", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
          <button onClick={() => changeView("list")} style={{ ...btnS, border: "none", borderRadius: 0, background: view === "list" ? "var(--bg-surface-active)" : "var(--bg-surface)" }}>{t("cl.viewList")}</button>
          <button onClick={() => changeView("card")} style={{ ...btnS, border: "none", borderRadius: 0, background: view === "card" ? "var(--bg-surface-active)" : "var(--bg-surface)" }}>{t("cl.viewCard")}</button>
        </div>
        <button onClick={() => setEdit({ open: true, row: null })} style={{ ...btnS, background: "var(--text-primary, #000)", color: "var(--bg-surface, #fff)", borderColor: "transparent" }}>+ {t("cl.new")}</button>
        {list.isRefreshing && <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("cl.refreshing")}</span>}
      </div>

      {/* States */}
      {list.isError ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--color-error, #ff3333)" }}>{t("cl.loadError")} {list.error?.message}</p>
          <button onClick={() => list.refetch()} style={btnS}>{t("cl.retry")}</button>
        </div>
      ) : list.isInitialLoading ? (
        <div style={{ padding: 24, color: "var(--text-tertiary)" }}>{t("cl.loading")}</div>
      ) : list.rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>{list.query || list.filters.status ? t("cl.emptySearch") : t("cl.emptyNone")}</div>
      ) : view === "card" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {list.rows.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14, background: "var(--bg-surface)", cursor: "pointer" }} onClick={() => router.push(`/customers/${r.id}`)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{rowName(r)}</div>{statusChip(r)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{r.company_name || r.company || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{[r.city, r.country].filter(Boolean).join(", ") || "—"}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); setEdit({ open: true, row: r }); }} style={btnS}>{t("cl.edit")}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...headS, width: 36 }}><input type="checkbox" checked={allPageSelected} onChange={toggleAllOnPage} aria-label="select page" /></th>
              <th style={{ ...headS, cursor: "pointer" }} onClick={() => onSort("name")}>{t("cl.colName")}{sortMark("name")}</th>
              <th style={{ ...headS, cursor: "pointer" }} onClick={() => onSort("company")}>{t("cl.colCompany")}{sortMark("company")}</th>
              <th style={headS}>{t("cl.colLocation")}</th>
              <th style={headS}>{t("cl.colTier")}</th>
              <th style={headS}>{t("cl.colStatus")}</th>
              <th style={headS}></th>
            </tr></thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/customers/${r.id}`)}>
                  <td style={cellS} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`select ${rowName(r)}`} /></td>
                  <td style={{ ...cellS, fontWeight: 600 }}>{rowName(r)}</td>
                  <td style={cellS}>{r.company_name || r.company || "—"}</td>
                  <td style={cellS}>{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                  <td style={cellS}>{r.customer_type ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)" }}>{r.customer_type}</span> : "—"}</td>
                  <td style={cellS}>{statusChip(r)}</td>
                  <td style={cellS} onClick={(e) => e.stopPropagation()}><button onClick={() => setEdit({ open: true, row: r })} style={btnS}>{t("cl.edit")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination + selection */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
        <div>{selected.size > 0 ? `${selected.size} ${t("cl.selectedPage")}` : list.total != null ? `${list.total} ${t("cl.customers")}` : `${list.rows.length}`}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)} style={{ ...btnS, opacity: list.page <= 1 ? 0.5 : 1 }}>{t("cl.prev")}</button>
          <span>{t("cl.page")} {list.page}{totalPages ? ` / ${totalPages}` : ""}</span>
          <button disabled={!list.hasMore} onClick={() => list.setPage(list.page + 1)} style={{ ...btnS, opacity: list.hasMore ? 1 : 0.5 }}>{t("cl.next")}</button>
        </div>
      </div>

      {edit.open && <QuickEditModal row={edit.row} t={t} onClose={() => setEdit({ open: false, row: null })} onSaved={afterSave} onOpenFull={(id) => router.push(`/customers/${id}`)} />}
    </div>
  );
}

/* Quick create/edit — focused fields; full profile lives at /customers/[id]. */
function QuickEditModal({ row, t, onClose, onSaved, onOpenFull }: {
  row: Row | null; t: (k: string) => string; onClose: () => void; onSaved: () => void; onOpenFull: (id: string) => void;
}) {
  const isEdit = !!row;
  const [f, setF] = useState({
    first_name: String(row?.first_name ?? ""), last_name: String(row?.last_name ?? ""),
    company_name: String(row?.company_name ?? row?.company ?? ""), email: String(row?.email ?? ""),
    phone: String(row?.phone ?? row?.mobile ?? ""), country: String(row?.country ?? ""),
    is_active: row?.is_active ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.first_name && !f.last_name && !f.company_name) { setErr(t("cl.nameOrCompanyReq")); return; }
    setSaving(true); setErr(null);
    const payload = { contact_type: "customer", ...f };
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
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{isEdit ? t("cl.editTitle") : t("cl.createTitle")}</h2>
          {isEdit && row && <button onClick={() => onOpenFull(row.id)} style={{ ...btn, fontSize: 12 }}>{t("cl.fullEdit")}</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={lbl}>{t("cl.fFirst")}<input style={inp} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} /></label>
          <label style={lbl}>{t("cl.fLast")}<input style={inp} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></label>
          <label style={{ ...lbl, gridColumn: "1 / -1" }}>{t("cl.fCompany")}<input style={inp} value={f.company_name} onChange={(e) => set("company_name", e.target.value)} /></label>
          <label style={lbl}>{t("cl.fEmail")}<input style={inp} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
          <label style={lbl}>{t("cl.fPhone")}<input style={inp} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          <label style={lbl}>{t("cl.fCountry")}<input style={inp} value={f.country} onChange={(e) => set("country", e.target.value)} /></label>
          <label style={lbl}>{t("cl.fStatus")}
            <select style={inp} value={f.is_active ? "true" : "false"} onChange={(e) => set("is_active", e.target.value === "true")}>
              <option value="true">{t("cl.active")}</option>
              <option value="false">{t("cl.inactive")}</option>
            </select>
          </label>
        </div>
        {err && <p style={{ color: "var(--color-error, #ff3333)", fontSize: 12, marginTop: 10 }}>{err}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btn}>{t("cl.cancel")}</button>
          <button onClick={save} disabled={saving} style={{ ...btn, background: "var(--text-primary, #000)", color: "var(--bg-surface, #fff)", borderColor: "transparent", opacity: saving ? 0.6 : 1 }}>{saving ? t("cl.saving") : t("cl.save")}</button>
        </div>
      </div>
    </div>
  );
}
