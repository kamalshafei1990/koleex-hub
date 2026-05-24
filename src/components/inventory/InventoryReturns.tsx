"use client";

/* ---------------------------------------------------------------------------
   /inventory/returns — list page + "New Return" drawer launcher.

   Phase INV-H3B. Tabs: All · Draft · Pending · Approved ·
   Received/Shipped (processed) · Completed · Voided.

   The processed tab consolidates the two flow-specific terminal-ish
   statuses (customer "received" + supplier "shipped"). Status pill in
   the row still reads the underlying status verbatim.

   The page is read-only — actions happen on the detail page. The only
   mutating control here is "+ New Return".
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import RrIcon from "@/components/ui/RrIcon";
import { InventoryEmpty, Panel } from "@/components/inventory/InventoryUi";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";
import InventoryReturnCreateDrawer from "./InventoryReturnCreateDrawer";
import { HumanStatusPill, humanStatus, relativeTime } from "./InventoryUx";

/* INV-H5D — local i18n extension for the operator polish strings. */
const RT_T: Translations = {
  "inv.returns.action.open":      { en: "Open",           zh: "打开",            ar: "فتح" },
  "inv.returns.details.show":     { en: "View details",   zh: "查看详情",        ar: "عرض التفاصيل" },
  "inv.returns.details.hide":     { en: "Hide details",   zh: "隐藏详情",        ar: "إخفاء التفاصيل" },
  "inv.returns.filters.more":     { en: "More filters",   zh: "更多筛选",        ar: "مزيد من المرشحات" },
  "inv.returns.filters.fewer":    { en: "Fewer filters",  zh: "收起筛选",        ar: "تقليل المرشحات" },
  "inv.returns.row.items":        { en: "{n} items",      zh: "{n} 条",          ar: "{n} عناصر" },
};

type ReturnStatus =
  | "draft" | "pending" | "approved" | "received" | "shipped"
  | "completed" | "cancelled" | "voided";

type ReturnType = "customer_return" | "supplier_return";

interface ReturnRow {
  id: string;
  return_no: string;
  return_type: ReturnType;
  status: ReturnStatus;
  customer_id: string | null;
  supplier_id: string | null;
  warehouse_id: string;
  reason_code: string;
  notes: string | null;
  created_at: string;
}

interface Warehouse { id: string; code: string; name: string; is_default: boolean }
interface ContactRow {
  id: string;
  display_name: string | null;
  company_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface ReturnRollup { item_count: number; total_qty: number }

type TabKey = "all" | "draft" | "pending" | "approved" | "processed" | "completed" | "voided";

/* INV-H5D — primary chips are the three statuses an operator usually
 * cares about; the rest hide behind "More filters". */
const PRIMARY_TABS: TabKey[] = ["all", "pending", "processed"];
const SECONDARY_TABS: TabKey[] = ["draft", "approved", "completed", "voided"];

function contactLabel(c: ContactRow | undefined): string {
  if (!c) return "—";
  return (
    c.display_name ||
    c.company_name ||
    c.full_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    "—"
  );
}

export default function InventoryReturns() {
  const { t } = useTranslation({ ...inventoryT, ...RT_T });
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<ContactRow[]>([]);
  const [suppliers, setSuppliers] = useState<ContactRow[]>([]);
  const [rollups, setRollups] = useState<Record<string, ReturnRollup>>({});
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  /* INV-H5A — ?create=1 deep link */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") setCreateOpen(true);
  }, []);

  const warehouseMap = useMemo(() => {
    const m = new Map<string, Warehouse>();
    for (const w of warehouses) m.set(w.id, w);
    return m;
  }, [warehouses]);

  const contactMap = useMemo(() => {
    const m = new Map<string, ContactRow>();
    for (const c of customers) m.set(c.id, c);
    for (const c of suppliers) m.set(c.id, c);
    return m;
  }, [customers, suppliers]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, whRes, cRes, sRes] = await Promise.all([
        fetch("/api/inventory/returns?limit=500", { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
        fetch("/api/contacts?type=customer", { cache: "no-store", credentials: "include" }),
        fetch("/api/contacts?type=supplier", { cache: "no-store", credentials: "include" }),
      ]);
      const rJ = await rRes.json();
      if (!rRes.ok) throw new Error(humanizeError(rJ.error ?? `HTTP ${rRes.status}`));
      const list = (rJ.returns ?? []) as ReturnRow[];
      setReturns(list);

      const whJ = await whRes.json();
      setWarehouses((whJ.warehouses ?? []) as Warehouse[]);

      const cJ = await cRes.json();
      const sJ = await sRes.json();
      setCustomers((cJ.contacts ?? []) as ContactRow[]);
      setSuppliers((sJ.contacts ?? []) as ContactRow[]);

      /* Pull rollups (item count) for the visible returns. */
      const rolls: Record<string, ReturnRollup> = {};
      await Promise.all(
        list.slice(0, 100).map(async (rr) => {
          try {
            const d = await fetch(`/api/inventory/returns/${rr.id}`, {
              cache: "no-store",
              credentials: "include",
            });
            const dj = await d.json();
            if (d.ok) {
              const items = (dj.items ?? []) as Array<{ quantity: number }>;
              rolls[rr.id] = {
                item_count: items.length,
                total_qty: items.reduce((a, b) => a + Number(b.quantity || 0), 0),
              };
            }
          } catch {/* ignore */}
        }),
      );
      setRollups(rolls);
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (tab === "all") return returns;
    if (tab === "processed") {
      return returns.filter((r) => r.status === "received" || r.status === "shipped");
    }
    return returns.filter((r) => r.status === tab);
  }, [returns, tab]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title={t("inv.returns.title")}
          subtitle={t("inv.returns.subtitle")}
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)]"
            >
              <RrIcon name="plus" size={12} />
              {t("inv.returns.new")}
            </button>
          }
        />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-300 dark:text-rose-200">
            {error}
          </div>
        )}

        {/* INV-H5D — filter strip: primary chips + "More filters" disclosure */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRIMARY_TABS.map((k) => (
            <TabBtn key={k} active={tab === k} onClick={() => setTab(k)}>
              {t(`inv.returns.tab.${k}`)}
            </TabBtn>
          ))}
          {showMoreFilters && SECONDARY_TABS.map((k) => (
            <TabBtn key={k} active={tab === k} onClick={() => setTab(k)}>
              {t(`inv.returns.tab.${k}`)}
            </TabBtn>
          ))}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className="rounded-md border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            {showMoreFilters ? t("inv.returns.filters.fewer") : t("inv.returns.filters.more")}
          </button>
          <div className="ml-auto text-[11px] text-[var(--text-dim)] tabular-nums">
            {loading ? "…" : `${filtered.length} of ${returns.length}`}
          </div>
        </div>

        <Panel>
          {loading && filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-[var(--text-dim)]">
              {t("inv.returns.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <InventoryEmpty
              title={t("inv.returns.empty.title")}
              hint={t("inv.returns.empty.hint")}
            />
          ) : (
            <ul role="list" className="divide-y divide-[var(--border-color)]/40">
              {filtered.map((rr) => {
                const wh = warehouseMap.get(rr.warehouse_id);
                const partyId = rr.return_type === "customer_return" ? rr.customer_id : rr.supplier_id;
                const party = partyId ? contactMap.get(partyId) : undefined;
                const roll = rollups[rr.id];
                const isExpanded = expanded.has(rr.id);
                const typeLabel =
                  rr.return_type === "customer_return"
                    ? t("inv.returns.type.customer")
                    : t("inv.returns.type.supplier");
                const icon = rr.return_type === "customer_return" ? "recycle" : "truck-side";
                return (
                  <li
                    key={rr.id}
                    className="px-3 py-3.5 transition-colors hover:bg-[var(--bg-surface)]/60 sm:px-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
                        <RrIcon name={icon} size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-medium text-[var(--text-primary)]">
                          {contactLabel(party)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[var(--text-dim)]">
                          {typeLabel}
                          {roll?.item_count != null && (
                            <> · {t("inv.returns.row.items").replace("{n}", String(roll.item_count))}</>
                          )}
                          {" · "}
                          {relativeTime(rr.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:ml-auto">
                        <HumanStatusPill status={rr.status} />
                        <Link
                          href={`/inventory/returns/${rr.id}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-1.5"
                        >
                          {t("inv.returns.action.open")}
                        </Link>
                      </div>
                    </div>

                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => toggleExpand(rr.id)}
                        className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:underline"
                      >
                        {isExpanded ? t("inv.returns.details.hide") : t("inv.returns.details.show")}
                      </button>
                    </div>
                    {isExpanded && (
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 px-3 py-2 text-[11px] sm:grid-cols-2">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.returns.col.no")}</dt>
                          <dd className="font-mono text-[var(--text-secondary)]">{rr.return_no}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">Raw status</dt>
                          <dd className="text-[var(--text-secondary)]">{rr.status} → {humanStatus(rr.status)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">Raw type</dt>
                          <dd className="text-[var(--text-secondary)]">{rr.return_type}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.returns.col.warehouse")}</dt>
                          <dd className="text-[var(--text-secondary)]">{wh ? `${wh.code} — ${wh.name}` : "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.returns.col.created")}</dt>
                          <dd className="text-[var(--text-secondary)]">{new Date(rr.created_at).toLocaleString()}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">Reason</dt>
                          <dd className="text-[var(--text-secondary)]">{rr.reason_code || "—"}</dd>
                        </div>
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {createOpen && (
          <InventoryReturnCreateDrawer
            onClose={() => setCreateOpen(false)}
            onCreated={async () => {
              setCreateOpen(false);
              await load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-[11.5px] transition-colors ${
        active
          ? "border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          : "border-[var(--border-color)] bg-transparent text-[var(--text-dim)] hover:bg-[var(--bg-surface)]"
      }`}
    >
      {children}
    </button>
  );
}
