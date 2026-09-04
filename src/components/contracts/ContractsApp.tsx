"use client";

/* ---------------------------------------------------------------------------
   Contracts — /contracts

   Every sales contract Koleex has raised, in one list.

   ── Why this app exists ────────────────────────────────────────────────────
   A contract was reachable only from the invoice it was raised on. That is
   fine while you are looking AT that invoice, and useless the moment the
   question is "what did we sign with this buyer", "which agreements are
   waiting for a signature", or "where is KL-CN-12351". The document existed;
   the way in did not.

   ── One list, every state ──────────────────────────────────────────────────
   Superseded and cancelled contracts stay in All rather than being hidden.
   A retired agreement is exactly the thing you go looking for when a dispute
   starts, and a list that quietly drops it teaches people not to trust it.
   The filters are there to narrow on purpose, not to hide by default.

   ── Raising one ────────────────────────────────────────────────────────────
   A contract is always raised FROM an invoice — that is where the parties,
   goods, incoterm and payment term already live, and re-keying them onto a
   blank contract form is how two documents of the same deal start to
   disagree. So "New contract" opens a list of invoices rather than an empty
   form. An invoice that already has a contract still appears, and picking it
   OPENS that contract instead of minting a second one.

   Requests on open: ONE. Filtering and search are client-side over the loaded
   page, so switching states costs nothing. No poller — contracts do not
   change under you the way a chat does.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { contractsT } from "@/lib/translations/contracts";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import Button from "@/components/ui/Button";
import SharedKpiCard from "@/components/ui/KpiCard";
import ContractIcon from "@/components/icons/ui/ContractIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { CARD } from "@/components/travel/fields";
import { dmy } from "@/components/orders/types";

type ContractStatus = "draft" | "ready" | "signed" | "superseded" | "cancelled";
type Filter = "all" | ContractStatus;

/** The slim row `GET /api/sales-contracts` returns for a list — never `terms`
    and never `snapshot`, which are the whole agreement and the whole rendered
    document respectively. */
interface ContractRow {
  id: string;
  contract_no: string;
  deal_no: number | null;
  status: ContractStatus;
  currency: string | null;
  total: number | null;
  contract_date: string | null;
  signed_at: string | null;
  created_at: string;
  amends_id: string | null;
  invoice_id: string | null;
  order_id: string | null;
  buyer_company: string | null;
  buyer_name: string | null;
  orders: { customer_name: string | null; company_name: string | null; customer_code: string | null } | null;
  invoices: { inv_no: string | null } | null;
}

interface InvoiceCandidate {
  id: string;
  inv_no: string | null;
  deal_no: number | null;
  status: string | null;
  currency: string | null;
  total: number | null;
  issue_date: string | null;
  party: string | null;
  contract: { id: string; contract_no: string } | null;
}

const STATUS_BADGE: Record<ContractStatus, string> = {
  draft:      "bg-slate-500/12 text-slate-300 border-slate-500/35",
  ready:      "bg-blue-500/12 text-blue-300 border-blue-500/35",
  signed:     "bg-emerald-500/12 text-emerald-400 border-emerald-500/35",
  superseded: "bg-amber-500/12 text-amber-300 border-amber-500/35",
  cancelled:  "bg-rose-500/12 text-rose-400 border-rose-500/35",
};

/* The buyer, read the way a person would: the company on the paper, then the
   person on the paper, then whatever the order recorded. `orders` carries a
   denormalised name; `terms` carries what the contract actually PRINTS, and
   when they differ the printed one is the truth about this document. */
function party(c: ContractRow): string {
  return (
    c.buyer_company ||
    c.buyer_name ||
    c.orders?.company_name ||
    c.orders?.customer_name ||
    c.orders?.customer_code ||
    "—"
  );
}

function money(v: number | null | undefined, currency?: string | null): string {
  if (v == null) return "—";
  return `${currency ?? ""} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
}

export default function ContractsApp() {
  const { t } = useTranslation(contractsT);
  const router = useRouter();

  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/sales-contracts?limit=300", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { contracts: ContractRow[] };
      setRows(body.contracts ?? []);
    } catch {
      setError(t("error.load"));
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, ready: 0, signed: 0, superseded: 0, cancelled: 0 };
    for (const r of rows ?? []) {
      c.all++;
      if (r.status in c) c[r.status]++;
    }
    return c;
  }, [rows]);

  /* One line per currency. A contract in CNY and a contract in USD do not add
     up, and a single figure pretending they did would be worse than none.
     Only SIGNED contracts count — a draft is a proposal, not an obligation. */
  const signedValue = useMemo(() => {
    const sums = new Map<string, number>();
    for (const r of rows ?? []) {
      if (r.status !== "signed") continue;
      const cur = r.currency ?? "";
      sums.set(cur, (sums.get(cur) ?? 0) + Number(r.total ?? 0));
    }
    return [...sums.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cur, n]) => `${cur} ${Math.round(n).toLocaleString()}`.trim());
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return [r.contract_no, r.invoices?.inv_no, String(r.deal_no ?? ""), party(r)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, filter, query]);

  return (
    /* A flowing list page, so it lives in the Hub scroller — min-h-full, not
       h-full, and pt-12 to clear the frosted header ramp. max-w-[1500px] is
       the Hub shell width: the owner's standing rule is that a page fits the
       screen it is on. */
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 pt-12 pb-8 sm:px-6 lg:px-8">
        <PageHeader
          title={t("app.title")}
          subtitle={t("app.subtitle")}
          icon={<ContractIcon size={16} />}
          showTabs={false}
          action={
            <Button variant="primary" onClick={() => setPicking(true)}>
              {t("action.new")}
            </Button>
          }
        />

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <SharedKpiCard label={t("kpi.contracts")} value={String(counts.all)} icon="contract" />
          <SharedKpiCard label={t("kpi.signed")} value={String(counts.signed)} icon="signature" />
          <SharedKpiCard
            label={t("kpi.value")}
            value={signedValue[0] ?? "—"}
            hint={signedValue.length > 1 ? signedValue.slice(1).join("  ·  ") : undefined}
            icon="money"
          />
          <SharedKpiCard
            label={t("kpi.awaiting")}
            value={String(counts.draft + counts.ready)}
            icon="clock"
            tone={counts.ready > 0 ? "info" : undefined}
          />
        </div>

        <div className="mt-4 mb-3">
          <AppHomeMenu
            searchPlaceholder={t("search.placeholder")}
            onSearchSubmit={setQuery}
            navItems={[
              { key: "all", onClick: () => setFilter("all"), icon: "contract", label: t("nav.all"), count: counts.all, active: filter === "all" },
              { key: "draft", onClick: () => setFilter("draft"), icon: "pencil", label: t("nav.draft"), count: counts.draft, active: filter === "draft" },
              { key: "ready", onClick: () => setFilter("ready"), icon: "clock", label: t("nav.ready"), count: counts.ready, active: filter === "ready" },
              { key: "signed", onClick: () => setFilter("signed"), icon: "signature", label: t("nav.signed"), count: counts.signed, active: filter === "signed" },
              { key: "superseded", onClick: () => setFilter("superseded"), icon: "file", label: t("nav.superseded"), count: counts.superseded, active: filter === "superseded" },
              /* Cancelled gets a chip of its own rather than living only
                 inside All. An abandoned agreement is a thing people go
                 looking for deliberately — usually to prove it WAS
                 abandoned — and a state with a count but no way to isolate
                 it is a state you can only find by scrolling. */
              { key: "cancelled", onClick: () => setFilter("cancelled"), icon: "cross-circle", label: t("nav.cancelled"), count: counts.cancelled, active: filter === "cancelled" },
            ]}
          />
        </div>

        {rows === null ? (
          /* The Hub's ONE loading shape — never a bespoke spinner. */
          <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
            <SpinnerIcon size={28} />
          </div>
        ) : error ? (
          <div className={`${CARD} p-6 text-center`}>
            <p className="text-[var(--text-secondary)]">{error}</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void load()}>
                {t("action.retry")}
              </Button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className={`${CARD} px-6 py-14 text-center`}>
            <p className="text-base font-medium">
              {counts.all === 0 ? t("empty.title") : t("empty.filtered")}
            </p>
            {counts.all === 0 && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("empty.body")}</p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => router.push(`/contracts/${c.id}`)}
                  className={`${CARD} w-full text-start flex flex-col gap-2 px-4 py-3 transition-colors hover:border-[var(--border-strong)]`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-mono text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                      {c.contract_no}
                    </span>
                    <span
                      className={`inline-flex items-center h-[20px] px-2 rounded-full border text-[10.5px] font-semibold ${STATUS_BADGE[c.status]}`}
                    >
                      {t(`status.${c.status}`)}
                    </span>
                    {/* An amendment is a different document from the agreement
                        it revises, and reading the list without knowing which
                        is which is how the wrong one gets sent. */}
                    {c.amends_id && (
                      <span className="inline-flex items-center h-[20px] px-2 rounded-full border border-[var(--border-subtle)] text-[10.5px] font-semibold text-[var(--text-secondary)]">
                        {t("row.amendment")}
                      </span>
                    )}
                    <span className="text-[13px] text-[var(--text-primary)] truncate">{party(c)}</span>
                    <span className="ms-auto text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {money(c.total, c.currency)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[var(--text-secondary)]">
                    {c.invoices?.inv_no && (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{t("row.invoice")}</span>
                        <span className="font-mono text-[var(--text-primary)]">{c.invoices.inv_no}</span>
                      </span>
                    )}
                    {c.deal_no != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{t("row.deal")}</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">{c.deal_no}</span>
                      </span>
                    )}
                    <span className="ms-auto text-[var(--text-faint)]">
                      {/* Signature date when there is one — that is the date
                          that matters about a contract — otherwise when it was
                          raised, clearly labelled as such. */}
                      {c.signed_at
                        ? `${t("row.signedOn")} ${dmy(c.signed_at)}`
                        : `${t("row.raisedOn")} ${dmy(c.contract_date ?? c.created_at)}`}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {picking && (
        <RaiseContractDialog
          onClose={() => setPicking(false)}
          onOpened={(id) => router.push(`/contracts/${id}`)}
          t={t}
        />
      )}
    </div>
  );
}

/* ── Raise a contract ───────────────────────────────────────────────────────
   Asks the one question that cannot be derived: which invoice. Everything
   else the contract needs is already on that invoice, and the POST copies it.
   --------------------------------------------------------------------------- */
function RaiseContractDialog({
  onClose,
  onOpened,
  t,
}: {
  onClose: () => void;
  onOpened: (contractId: string) => void;
  t: (k: string) => string;
}) {
  const [invoices, setInvoices] = useState<InvoiceCandidate[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/sales-contracts?candidates=1", { cache: "no-store" });
        const json = (await res.json()) as { invoices?: InvoiceCandidate[]; error?: string };
        if (!alive) return;
        if (!res.ok) throw new Error(json.error ?? "");
        setInvoices(json.invoices ?? []);
      } catch {
        if (alive) {
          setError(t("error.load"));
          setInvoices([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return invoices ?? [];
    return (invoices ?? []).filter((i) =>
      [i.inv_no, i.party, String(i.deal_no ?? "")].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [invoices, q]);

  const choose = useCallback(
    async (inv: InvoiceCandidate) => {
      /* Already contracted — open what exists. Minting a second contract on
         one invoice is how a deal ends up with two agreements that disagree;
         a real amendment is raised from inside the contract, deliberately. */
      if (inv.contract) {
        onOpened(inv.contract.id);
        return;
      }
      setBusy(inv.id);
      setError(null);
      try {
        const res = await fetch("/api/sales-contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_id: inv.id }),
        });
        const json = (await res.json()) as { contract?: { id: string }; error?: string };
        if (!res.ok || !json.contract) throw new Error(json.error ?? t("new.failed"));
        onOpened(json.contract.id);
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : t("new.failed"));
        setBusy(null);
      }
    },
    [onOpened, t],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="kx-pop-clear flex flex-col"
        style={{
          maxWidth: 680,
          width: "100%",
          maxHeight: "86vh",
          borderRadius: 16,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("new.title")}</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{t("new.body")}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("action.cancel")}
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <CrossIcon size={14} />
          </button>
        </div>

        <div className="px-5 pb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("new.search")}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {invoices === null ? (
            <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
              <SpinnerIcon size={24} />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[var(--text-secondary)]">{t("new.none")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visible.map((inv) => (
                <li key={inv.id}>
                  <button
                    disabled={busy !== null}
                    onClick={() => void choose(inv)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 text-start transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  >
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-mono text-[12.5px] font-semibold text-[var(--text-primary)]">
                        {inv.inv_no ?? "—"}
                      </span>
                      <span className="truncate text-[12.5px] text-[var(--text-primary)]">{inv.party ?? "—"}</span>
                      {inv.contract && (
                        <span className="inline-flex items-center h-[18px] px-1.5 rounded-full border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-secondary)]">
                          {t("new.hasContract")} · {inv.contract.contract_no}
                        </span>
                      )}
                      <span className="ms-auto shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                        {busy === inv.id ? <SpinnerIcon size={14} /> : money(inv.total, inv.currency)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{dmy(inv.issue_date)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-3 text-[12px] text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
