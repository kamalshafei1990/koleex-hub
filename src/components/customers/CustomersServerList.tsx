"use client";

/* ---------------------------------------------------------------------------
   CustomersServerList — Phase 4 Wave 2A.1 PREVIEW-ONLY Customers directory.

   Server-driven list (search / filter / sort / pagination all on the server)
   via `useServerList` + a permission-safe global summary. Rendered ONLY on
   non-production hosts (see customers/page.tsx gate); production keeps the
   legacy Contacts UI unchanged.

   Scope: this is the LIST surface. Opening a customer routes to the existing
   /customers/[id] detail page. Create/Edit-in-place modals live in the legacy
   Contacts component and are intentionally OUT of scope for the preview list
   (documented in CUSTOMERS_SERVER_LIST_PILOT.md) — a "classic view" link is
   offered for those until they are ported.
   --------------------------------------------------------------------------- */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useServerList } from "@/lib/hooks/useServerList";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { useScopeContext } from "@/lib/use-scope";

type Row = Record<string, unknown> & {
  id: string; display_name?: string; full_name?: string; company_name?: string;
  first_name?: string; last_name?: string; company?: string; country?: string;
  city?: string; customer_type?: string; is_active?: boolean; email?: string;
  phone?: string; mobile?: string; account_manager?: string; photo_url?: string;
  logo_url?: string;
};
type Summary = { summary: { total: number; active: number; inactive: number } };

const PAGE_SIZE = 50;
const rowName = (r: Row) =>
  r.display_name || r.full_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.company_name || r.company || "—";

export default function CustomersServerList() {
  const router = useRouter();
  const scope = useScopeContext();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const list = useServerList<Row>({
    resource: "contacts:customer",
    endpoint: "/api/contacts",
    scope: { tenantId: scope?.tenant_id, accountId: scope?.account_id },
    fixedParams: { type: "customer", paged: "1" },
    pageSize: PAGE_SIZE,
    initialSort: { field: "name", dir: "asc" },
    enabled: !!scope,
  });

  // Global summary — correct tenant-wide totals, NOT derived from the page.
  const summary = useApiQuery<Summary>(
    ["contacts-summary", "customer", scope?.tenant_id ?? "anon"],
    scope ? "/api/contacts?type=customer&summary=1" : null,
  );
  const stats = summary.data?.summary;

  const totalPages = list.total != null ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : null;
  const pageIds = useMemo(() => list.rows.map((r) => r.id), [list.rows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const cell: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 13, textAlign: "left" };
  const head: React.CSSProperties = { ...cell, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", userSelect: "none", position: "sticky", top: 0, background: "var(--bg-surface)" };
  const sortMark = (f: string) => (list.sort === f ? (list.dir === "asc" ? " ▲" : " ▼") : "");
  const onSort = (f: string) => list.setSort(f, list.sort === f && list.dir === "asc" ? "desc" : "asc");

  return (
    <div style={{ padding: "16px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Customers</h1>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)", color: "var(--text-secondary)" }}>
          Preview · server-list
        </span>
      </div>

      {/* Global summary cards — sourced from the server aggregate, NOT the page. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total customers", val: stats?.total },
          { label: "Active", val: stats?.active },
          { label: "Inactive", val: stats?.inactive },
        ].map((c) => (
          <div key={c.label} style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px", background: "var(--bg-surface)" }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.label} <span title="tenant-wide total, not the current page">·&nbsp;all</span></div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.isLoading ? "…" : c.val ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          placeholder="Search customers…"
          aria-label="Search customers"
          style={{ flex: "1 1 260px", minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13 }}
        />
        <select
          value={list.filters.status ?? ""}
          onChange={(e) => list.setFilter("status", e.target.value || null)}
          aria-label="Status filter"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 13 }}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button onClick={() => router.push("/customers?serverlist=0")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", fontSize: 12, cursor: "pointer" }} title="Create/edit in the classic view">
          + New / classic view
        </button>
        {list.isRefreshing && <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Refreshing…</span>}
      </div>

      {/* States */}
      {list.isError ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--color-error, #ff3333)" }}>Couldn’t load customers. {list.error?.message}</p>
          <button onClick={() => list.refetch()} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-subtle)", cursor: "pointer" }}>Retry</button>
        </div>
      ) : list.isInitialLoading ? (
        <div style={{ padding: 24, color: "var(--text-tertiary)" }}>Loading customers…</div>
      ) : list.rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-tertiary)" }}>
          {list.query || list.filters.status ? "No customers match your search/filter." : "No customers yet."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...head, cursor: "default", width: 36 }}>
                  <input type="checkbox" checked={allPageSelected} onChange={toggleAllOnPage} aria-label="Select all on this page" />
                </th>
                <th style={head} onClick={() => onSort("name")}>Name{sortMark("name")}</th>
                <th style={head} onClick={() => onSort("company")}>Company{sortMark("company")}</th>
                <th style={{ ...head, cursor: "default" }}>Location</th>
                <th style={{ ...head, cursor: "default" }}>Tier</th>
                <th style={{ ...head, cursor: "default" }}>Status</th>
                <th style={{ ...head, cursor: "default" }}>Account mgr</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/customers/${r.id}`)}>
                  <td style={cell} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${rowName(r)}`} />
                  </td>
                  <td style={{ ...cell, fontWeight: 600 }}>{rowName(r)}</td>
                  <td style={cell}>{r.company_name || r.company || "—"}</td>
                  <td style={cell}>{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                  <td style={cell}>{r.customer_type ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-surface-active)" }}>{r.customer_type}</span> : "—"}</td>
                  <td style={cell}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: r.is_active ? "var(--color-success-bg, #e6f7ee)" : "var(--bg-surface-active)", color: r.is_active ? "var(--color-success, #00cc66)" : "var(--text-tertiary)" }}>
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={cell}>{r.account_manager || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination + selection status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
        <div>
          {selected.size > 0
            ? `${selected.size} selected on this page (page-only selection)`
            : list.total != null ? `${list.total} customers` : `${list.rows.length} shown`}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", cursor: list.page <= 1 ? "default" : "pointer", opacity: list.page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span>Page {list.page}{totalPages ? ` / ${totalPages}` : ""}</span>
          <button disabled={!list.hasMore} onClick={() => list.setPage(list.page + 1)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", cursor: list.hasMore ? "pointer" : "default", opacity: list.hasMore ? 1 : 0.5 }}>Next</button>
        </div>
      </div>
    </div>
  );
}
