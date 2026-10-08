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
import { useWarmData } from "@/lib/warm-cache";
import Link from "next/link";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import RrIcon from "@/components/ui/RrIcon";
import { InventoryEmpty, Panel } from "@/components/inventory/InventoryUi";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";
import InventoryReturnCreateDrawer from "./InventoryReturnCreateDrawer";
import { HumanStatusPill, humanStatus, relativeTime } from "./InventoryUx";
import { kxInspectAttrs } from "@/lib/qa/inspector";

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

type ReturnsSnap = {
  returns: ReturnRow[];
  warehouses: Warehouse[];
  customers: ContactRow[];
  suppliers: ContactRow[];
  rollups: Record<string, ReturnRollup>;
};

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

  const [tab, setTab] = useState<TabKey>("all");
  const [createOpen, setCreateOpen] = useState(false);

  /* INV-H5A — ?create=1 deep link */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") setCreateOpen(true);
  }, []);

  /* Warm: every call here is fixed — `type=customer` / `type=supplier` are
     the screen's own shape, not a user filter — so the response IS the
     default view. The per-row rollups are cached with it, so a return visit
     shows the table complete on the first frame. */
  const fetchAll = useCallback(async (): Promise<ReturnsSnap> => {
      const [rRes, whRes, cRes, sRes] = await Promise.all([
        fetch("/api/inventory/returns?limit=500", { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
        fetch("/api/contacts?type=customer", { cache: "no-store", credentials: "include" }),
        fetch("/api/contacts?type=supplier", { cache: "no-store", credentials: "include" }),
      ]);
      const rJ = await rRes.json();
      if (!rRes.ok) throw new Error(humanizeError(rJ.error ?? `HTTP ${rRes.status}`));
      const list = (rJ.returns ?? []) as ReturnRow[];
      const whJ = await whRes.json();
      const cJ = await cRes.json();
      const sJ = await sRes.json();
      /* KEEP THE SIX FIELDS THIS SCREEN DISPLAYS, DROP THE OTHER 243.
         /api/contacts returns the FULL contact record — measured at 2.0MB for
         343 contacts, 249 keys each — and this page uses exactly one thing
         from it: a name to put next to a return. Carried whole, the snapshot
         blew past the warm cache's 512KB ceiling and was dropped in silence,
         which is why Returns was the one Inventory tab still showing a
         spinner (2.8s) after every other tab went instant. Trimming here also
         spares the render and the JSON round-trip. The 2MB still crosses the
         wire, and that belongs to the contacts API, not to this screen. */
      const slim = (rows: unknown): ContactRow[] =>
        ((rows ?? []) as ContactRow[]).map((c) => ({
          id: c.id,
          display_name: c.display_name,
          company_name: c.company_name,
          full_name: c.full_name,
          first_name: c.first_name,
          last_name: c.last_name,
        }));

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
      return {
        returns: list,
        warehouses: (whJ.warehouses ?? []) as Warehouse[],
        customers: slim(cJ.contacts),
        suppliers: slim(sJ.contacts),
        rollups: rolls,
      };
  }, []);
  const { data, loading, error: loadError, reload: load } =
    useWarmData<ReturnsSnap>("inv:returns", fetchAll);
  const returns = useMemo(() => data?.returns ?? [], [data]);
  const warehouses = useMemo(() => data?.warehouses ?? [], [data]);
  const customers = useMemo(() => data?.customers ?? [], [data]);
  const suppliers = useMemo(() => data?.suppliers ?? [], [data]);
  const rollups = useMemo(() => data?.rollups ?? {}, [data]);
  const error = loadError ? humanizeError(loadError instanceof Error ? loadError.message : String(loadError)) : null;

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



  const filtered = useMemo(() => {
    if (tab === "all") return returns;
    if (tab === "processed") {
      return returns.filter((r) => r.status === "received" || r.status === "shipped");
    }
    return returns.filter((r) => r.status === tab);
  }, [returns, tab]);

  /* Page wrapper + InventoryHeader provided by /app/inventory/layout.tsx. */
  return (
    <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
          >
            <RrIcon name="plus" size={12} />
            {t("inv.returns.new")}
          </button>
        </div>

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
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
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
              icon="recycle"
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
                    {...kxInspectAttrs({ component: "InventoryReturnRow", module: "Inventory", section: "Returns", recordId: rr.id })}
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
                          className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1.5 h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
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
                          <dt className="text-[var(--text-dim)]">{t("inv.mv.raw_status", "Raw status")}</dt>
                          <dd className="text-[var(--text-secondary)]">{rr.status} → {humanStatus(rr.status)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.mv.raw_type", "Raw type")}</dt>
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
                          <dt className="text-[var(--text-dim)]">{t("inv.common.reason", "Reason")}</dt>
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
