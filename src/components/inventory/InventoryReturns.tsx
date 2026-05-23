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
import { InventoryEmpty, Panel, StatusBadge } from "@/components/inventory/InventoryUi";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";
import InventoryReturnCreateDrawer from "./InventoryReturnCreateDrawer";

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

const TABS: TabKey[] = ["all", "draft", "pending", "approved", "processed", "completed", "voided"];

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
  const { t } = useTranslation(inventoryT);

  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<ContactRow[]>([]);
  const [suppliers, setSuppliers] = useState<ContactRow[]>([]);
  const [rollups, setRollups] = useState<Record<string, ReturnRollup>>({});
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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

        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((k) => (
            <TabBtn key={k} active={tab === k} onClick={() => setTab(k)}>
              {t(`inv.returns.tab.${k}`)}
            </TabBtn>
          ))}
          <div className="ml-auto text-[11px] text-[var(--text-dim)] tabular-nums">
            {loading ? "…" : `${filtered.length} of ${returns.length}`}
          </div>
        </div>

        <Panel>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                  <th className="px-3 py-2 text-left">{t("inv.returns.col.no")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.col.type")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.col.party")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.col.warehouse")}</th>
                  <th className="px-3 py-2 text-right">{t("inv.returns.col.items")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.col.status")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.col.created")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-[11px] text-[var(--text-dim)]">
                      {t("inv.returns.loading")}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-0 py-0">
                      <InventoryEmpty
                        title={t("inv.returns.empty.title")}
                        hint={t("inv.returns.empty.hint")}
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((rr) => {
                    const wh = warehouseMap.get(rr.warehouse_id);
                    const partyId = rr.return_type === "customer_return" ? rr.customer_id : rr.supplier_id;
                    const party = partyId ? contactMap.get(partyId) : undefined;
                    const roll = rollups[rr.id];
                    return (
                      <tr
                        key={rr.id}
                        className="border-b border-[var(--border-color)]/40 last:border-b-0 hover:bg-[var(--bg-surface)]/60"
                      >
                        <td className="px-3 py-1.5 font-mono text-[11.5px] text-[var(--text-secondary)]">
                          <Link href={`/inventory/returns/${rr.id}`} className="hover:underline">
                            {rr.return_no}
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                          {rr.return_type === "customer_return"
                            ? t("inv.returns.type.customer")
                            : t("inv.returns.type.supplier")}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                          {contactLabel(party)}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                          {wh ? `${wh.code} — ${wh.name}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                          {roll?.item_count ?? "—"}
                        </td>
                        <td className="px-3 py-1.5"><StatusBadge status={rr.status} /></td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-[var(--text-dim)]">
                          {new Date(rr.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <Link
                            href={`/inventory/returns/${rr.id}`}
                            className="text-[11px] text-[var(--text-secondary)] hover:underline"
                          >
                            Details →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
