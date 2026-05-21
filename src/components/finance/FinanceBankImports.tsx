"use client";

/* ===========================================================================
   FinanceBankImports — Phase 2.6 ingestion UI.

   Stepper flow:

     1. Pick a bank account
     2. Upload CSV / XLSX
     3. Parse + preview rows (duplicate badges, error states)
     4. Confirm → cash movements created, reconciliation rescan fires
     5. Hand off to /finance/reconciliation

   The page renders calm, dense, Hub-native. No spreadsheet feel; rows
   are compact cards in a single column with status pills and inline
   ready/skip toggles.
   ========================================================================== */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";
import { fmtMoney } from "@/lib/finance/calc";
import type {
  BankAccount,
  BankStatementImport,
  BankStatementRow,
  BankStatementRowDuplicateStatus,
  BankStatementRowImportStatus,
} from "@/lib/finance/types";

type StepKey = "pick" | "upload" | "preview" | "done";

export default function FinanceBankImports() {
  const { t } = useTranslation(financeT);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAccountId = searchParams.get("account");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>("pick");
  const [importRow, setImportRow] = useState<BankStatementImport | null>(null);
  const [rows, setRows] = useState<BankStatementRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postSummary, setPostSummary] = useState<{ imported: number; candidates: number; duplicates: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Initial load: bank accounts + import history. ── */
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/finance/treasury", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/bank-imports", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([t, imp]) => {
      if (cancelled) return;
      const a: BankAccount[] = Array.isArray(t.accounts) ? t.accounts : [];
      setAccounts(a);
      setImports(Array.isArray(imp.imports) ? imp.imports : []);
      if (!accountId) {
        const fromQuery = preselectedAccountId && a.find((x) => x.id === preselectedAccountId)
          ? preselectedAccountId
          : a[0]?.id ?? null;
        if (fromQuery) setAccountId(fromQuery);
      }
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* ── Step 1 → 2: account chosen, open file picker. ── */
  const startUpload = useCallback(() => {
    setError(null);
    setStep("upload");
    setTimeout(() => fileInputRef.current?.click(), 30);
  }, []);

  /* ── Step 2 → 3: upload file + parse. ── */
  const onFileChosen = useCallback(async (file: File) => {
    if (!accountId) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bank_account_id", accountId);
      const createRes = await fetch("/api/finance/bank-imports", {
        method: "POST",
        body: form,
      });
      const createJson = (await createRes.json().catch(() => ({}))) as {
        import?: BankStatementImport; error?: string;
      };
      if (!createRes.ok || !createJson.import) throw new Error(createJson.error ?? `HTTP ${createRes.status}`);
      const created = createJson.import;
      setImportRow(created);

      /* Parse step. */
      const parseRes = await fetch(`/api/finance/bank-imports/${created.id}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const parseJson = (await parseRes.json().catch(() => ({}))) as {
        import?: BankStatementImport; error?: string;
      };
      if (!parseRes.ok || !parseJson.import) throw new Error(parseJson.error ?? `HTTP ${parseRes.status}`);
      setImportRow(parseJson.import);

      /* Fetch parsed rows. */
      const detailRes = await fetch(`/api/finance/bank-imports/${created.id}`, { cache: "no-store" });
      const detailJson = (await detailRes.json().catch(() => ({}))) as {
        import?: BankStatementImport; rows?: BankStatementRow[]; error?: string;
      };
      if (!detailRes.ok || !detailJson.import) throw new Error(detailJson.error ?? `HTTP ${detailRes.status}`);
      setImportRow(detailJson.import);
      setRows(detailJson.rows ?? []);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("pick");
    } finally {
      setBusy(false);
    }
  }, [accountId]);

  /* ── Toggle ready/skipped on a row. ── */
  const toggleRow = useCallback(async (rowId: string, nextStatus: BankStatementRowImportStatus) => {
    if (!importRow) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/finance/bank-imports/${importRow.id}/rows`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ id: rowId, fields: { import_status: nextStatus } }] }),
      });
      const j = (await res.json().catch(() => ({}))) as { rows?: BankStatementRow[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const updated = j.rows?.[0];
      if (updated) {
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [importRow]);

  /* ── Step 3 → 4: confirm import. ── */
  const confirmImport = useCallback(async () => {
    if (!importRow) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/bank-imports/${importRow.id}/confirm`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as {
        import?: BankStatementImport;
        summary?: { imported_count: number; duplicate_count: number; error_count: number; new_reconciliation_candidates: number };
        error?: string;
      };
      if (!res.ok || !j.summary) throw new Error(j.error ?? `HTTP ${res.status}`);
      setImportRow(j.import ?? importRow);
      setPostSummary({
        imported: j.summary.imported_count,
        candidates: j.summary.new_reconciliation_candidates,
        duplicates: j.summary.duplicate_count,
        errors: j.summary.error_count,
      });
      setStep("done");
      /* Refresh history. */
      void fetch("/api/finance/bank-imports", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => setImports(data.imports ?? []))
        .catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [importRow]);

  /* ── Cancel — abort the in-progress import. ── */
  const cancelImport = useCallback(async () => {
    if (!importRow) {
      setStep("pick");
      return;
    }
    if (importRow.status !== "uploaded" && importRow.status !== "parsed") {
      setStep("pick");
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/finance/bank-imports/${importRow.id}/cancel`, { method: "POST" });
    } catch {
      /* ignore */
    } finally {
      setImportRow(null);
      setRows([]);
      setPostSummary(null);
      setStep("pick");
      setBusy(false);
    }
  }, [importRow]);

  /* ── Preview KPIs ── */
  const kpis = useMemo(() => {
    const ready = rows.filter((r) => r.import_status === "ready").length;
    const skipped = rows.filter((r) => r.import_status === "skipped").length;
    const errors = rows.filter((r) => r.import_status === "error").length;
    const duplicates = rows.filter((r) => r.duplicate_status !== "new").length;
    return { ready, skipped, errors, duplicates, total: rows.length };
  }, [rows]);

  const accountOptions = useMemo(() => accounts, [accounts]);
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("bankImports.title", "Bank Statement Import")}
          subtitle={t("bankImports.subtitle.long", "Upload a CSV or XLSX statement, preview the parsed rows, and hand the new cash movements to the reconciliation queue.")}
          action={
            step !== "pick" ? (
              <button
                onClick={cancelImport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-highlight)] transition hover:border-rose-500/30 hover:text-rose-300"
              >
                <RrIcon name="cross" size={11} />
                {t("bankImports.cancel", "Cancel")}
              </button>
            ) : null
          }
        />

        <Stepper step={step} />

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
            {error}
          </div>
        )}

        {/* Hidden file input — driven by the stepper "upload" CTA. */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFileChosen(f);
            e.target.value = "";
          }}
        />

        {/* STEP 1 — pick account */}
        {step === "pick" && (
          <div className="mt-5 space-y-4">
            <SectionCard title={t("bankImports.section.choose", "Choose a bank account")} subtitle={t("bankImports.section.chooseHint", "The cash movements will be booked against this account.")}>
              {accountOptions.length === 0 ? (
                <EmptyState
                  title={t("bankImports.empty.title", "No bank accounts yet")}
                  hint={t("bankImports.empty.hint", "Add a bank account from Treasury before importing a statement.")}
                />
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {accountOptions.map((a) => {
                    const active = a.id === accountId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAccountId(a.id)}
                        className={`rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-[var(--border-strong)] bg-[var(--bg-surface)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">{a.bank_name}</span>
                          {a.is_primary && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">{t("bankImports.primary", "Primary")}</span>}
                        </div>
                        <div className="mt-1 truncate text-[12px] text-[var(--text-secondary)]">{a.account_name}</div>
                        <div className="mt-1 text-[11px] text-[var(--text-dim)]">{a.currency} · {fmtMoney(a.available_balance, a.currency, { compact: true })}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <div className="flex items-center justify-end">
              <button
                onClick={startUpload}
                disabled={!accountId || busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <RrIcon name="loading" size={12} className="animate-spin" /> : <RrIcon name="upload" size={12} />}
                {t("bankImports.choose", "Choose statement file")}
              </button>
            </div>

            <RecentImports imports={imports} accounts={accounts} onOpen={(imp) => router.push(`/finance/bank-imports?open=${imp.id}`)} />
          </div>
        )}

        {/* STEP 2 — upload in progress */}
        {step === "upload" && (
          <div className="mt-5">
            <SectionCard title={t("bankImports.uploading", "Uploading and parsing")} subtitle={t("bankImports.uploadingHint", "The parser detects columns automatically. You'll review every row before anything lands in the cash book.")}>
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-dim)]">
                <RrIcon name="loading" size={14} className="animate-spin" />
                {busy ? t("bankImports.uploadingMsg", "Uploading + parsing…") : t("bankImports.pickFile", "Pick a file")}
              </div>
            </SectionCard>
          </div>
        )}

        {/* STEP 3 — preview rows */}
        {step === "preview" && importRow && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <MetricCard label={t("bankImports.kpi.parsed", "Parsed")} value={kpis.total} unit={t("bankImports.kpi.rows", "rows")} hint={t("bankImports.kpi.parsedHint", "Total rows in file")} loading={false} />
              <MetricCard label={t("bankImports.kpi.ready", "Ready")} value={kpis.ready} unit={t("bankImports.kpi.rows", "rows")} hint={t("bankImports.kpi.readyHint", "Will become cash movements")} loading={false} />
              <MetricCard label={t("bankImports.kpi.dups", "Duplicates")} value={kpis.duplicates} unit={t("bankImports.kpi.rows", "rows")} hint={t("bankImports.kpi.dupsHint", "Possible or hard duplicates")} loading={false} />
              <MetricCard label={t("bankImports.kpi.skipped", "Skipped")} value={kpis.skipped} unit={t("bankImports.kpi.rows", "rows")} hint={t("bankImports.kpi.skippedHint", "Excluded from import")} loading={false} />
              <MetricCard label={t("bankImports.kpi.errors", "Errors")} value={kpis.errors} unit={t("bankImports.kpi.rows", "rows")} hint={t("bankImports.kpi.errorsHint", "Parse failures")} loading={false} />
            </div>

            <SectionCard
              title={t("bankImports.preview.title", "Statement preview · {bank}").replace("{bank}", selectedAccount?.bank_name ?? "")}
              subtitle={t("bankImports.preview.fileInfo", "File {name} · {type} · {size} KB")
                .replace("{name}", importRow.file_name)
                .replace("{type}", importRow.file_type.toUpperCase())
                .replace("{size}", (importRow.file_size / 1024).toFixed(0))}
              action={
                <button
                  onClick={confirmImport}
                  disabled={busy || kpis.ready === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {busy ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
                  {t("bankImports.confirm", "Confirm import ({n})").replace("{n}", String(kpis.ready))}
                </button>
              }
            >
              {rows.length === 0 ? (
                <EmptyState title={t("bankImports.noParsed", "No rows parsed")} hint={t("bankImports.noParsedHint", "The file is empty, has no recognised header row, or every row was dropped as an error.")} />
              ) : (
                <div className="space-y-2">
                  {rows.map((r) => (
                    <RowCard key={r.id} row={r} accountCurrency={selectedAccount?.currency ?? "USD"} onToggle={toggleRow} />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* STEP 4 — done */}
        {step === "done" && postSummary && (
          <div className="mt-5">
            <SectionCard title={t("bankImports.done.title", "Import complete")} subtitle={t("bankImports.done.subtitle", "The new cash movements are in the ledger. The reconciliation engine has already scanned for matches.")}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label={t("bankImports.done.created", "Movements created")} value={postSummary.imported} unit={t("bankImports.kpi.rows", "rows")} hint="" loading={false} />
                <MetricCard label={t("bankImports.done.candidates", "New match candidates")} value={postSummary.candidates} unit={t("reconciliation.kpi.cand", "cand.")} hint={t("bankImports.done.candidatesHint", "In the reconciliation queue")} loading={false} />
                <MetricCard label={t("bankImports.done.dupsSkipped", "Duplicates skipped")} value={postSummary.duplicates} unit={t("bankImports.kpi.rows", "rows")} hint={t("bankImports.done.notBooked", "Not booked")} loading={false} />
                <MetricCard label={t("bankImports.done.errorsLabel", "Errors")} value={postSummary.errors} unit={t("bankImports.kpi.rows", "rows")} hint="" loading={false} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href="/finance/reconciliation"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
                >
                  <RrIcon name="arrow-up-right-from-square" size={12} />
                  {t("bankImports.done.openQueue", "Open reconciliation queue")}
                </Link>
                <button
                  onClick={() => { setStep("pick"); setImportRow(null); setRows([]); setPostSummary(null); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-highlight)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                >
                  <RrIcon name="plus" size={11} />
                  {t("bankImports.done.another", "Import another file")}
                </button>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Stepper — calm 4-dot row, no progress bar gimmickry.
   ──────────────────────────────────────────────────────────────────────── */

function Stepper({ step }: { step: StepKey }) {
  const { t } = useTranslation(financeT);
  const steps: { key: StepKey; label: string }[] = [
    { key: "pick",    label: t("bankImports.step.pick", "Pick account") },
    { key: "upload",  label: t("bankImports.step.upload", "Upload file") },
    { key: "preview", label: t("bankImports.step.preview", "Preview rows") },
    { key: "done",    label: t("bankImports.step.done", "Hand off") },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 px-3 py-2 text-[11px]">
      {steps.map((s, i) => {
        const active = i === idx;
        const past = i < idx;
        return (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              active ? "bg-emerald-500/30 text-emerald-200" : past ? "bg-emerald-500/15 text-emerald-300" : "bg-[var(--bg-surface-hover)] text-[var(--text-dim)]"
            }`}>
              {past ? <RrIcon name="check" size={9} /> : i + 1}
            </span>
            <span className={active ? "text-[var(--text-primary)] font-semibold" : past ? "text-[var(--text-highlight)]" : "text-[var(--text-dim)]"}>{s.label}</span>
            {i < steps.length - 1 && <span aria-hidden className="text-[var(--text-whisper)]">→</span>}
          </span>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   RowCard — one compact statement row.
   ──────────────────────────────────────────────────────────────────────── */

/* Phase S.4 — memoized. The parsed-rows view can render hundreds of
   RowCards; previously a single toggle re-rendered all of them. */
const RowCard = memo(function RowCard({
  row,
  accountCurrency,
  onToggle,
}: {
  row: BankStatementRow;
  accountCurrency: string;
  onToggle: (id: string, next: BankStatementRowImportStatus) => void;
}) {
  const { t } = useTranslation(financeT);
  const ccy = row.currency ?? accountCurrency;
  const amount = row.amount != null ? fmtMoney(row.amount, ccy, { compact: true }) : "—";
  const directionLabel = row.direction === "inflow" ? t("bankImports.row.moneyIn", "Money in") : row.direction === "outflow" ? t("bankImports.row.moneyOut", "Money out") : "—";
  const directionTone = row.direction === "inflow" ? "text-emerald-300" : row.direction === "outflow" ? "text-rose-300" : "text-[var(--text-secondary)]";

  const DUP_CHIP_LOCAL: Record<BankStatementRowDuplicateStatus, { label: string; cls: string }> = {
    new:                { label: t("bankImports.dup.new", "New"),       cls: "bg-emerald-500/15 text-emerald-300" },
    possible_duplicate: { label: t("bankImports.dup.possible", "Possible dup"), cls: "bg-amber-500/15 text-amber-300" },
    duplicate:          { label: t("bankImports.dup.dup", "Duplicate"), cls: "bg-rose-500/15 text-rose-300" },
  };
  const ROW_STATUS_CHIP_LOCAL: Record<BankStatementRowImportStatus, { label: string; cls: string }> = {
    ready:    { label: t("bankImports.status.ready", "Ready"),    cls: "bg-emerald-500/15 text-emerald-300" },
    skipped:  { label: t("bankImports.status.skipped", "Skipped"),  cls: "bg-gray-500/15 text-[var(--text-highlight)]" },
    imported: { label: t("bankImports.status.imported", "Imported"), cls: "bg-sky-500/15 text-sky-300" },
    error:    { label: t("bankImports.status.error", "Error"),    cls: "bg-rose-500/15 text-rose-300" },
  };

  const dupChip = DUP_CHIP_LOCAL[row.duplicate_status];
  const statusChip = ROW_STATUS_CHIP_LOCAL[row.import_status];

  return (
    <div className={`rounded-xl border bg-[var(--bg-primary)]/60 p-3 transition ${
      row.import_status === "error"   ? "border-rose-500/30"
      : row.duplicate_status === "duplicate" ? "border-amber-500/25 opacity-90"
      : row.import_status === "skipped" ? "border-[var(--border-faint)] opacity-70"
      : "border-[var(--border-subtle)]"
    }`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[12px] font-semibold tabular-nums ${directionTone}`}>{directionLabel}</span>
        <span className="text-[12px] font-bold tabular-nums">{amount}</span>
        <span className="text-[11px] text-[var(--text-dim)] tabular-nums">{row.movement_date ?? "—"}</span>
        {row.reference && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-highlight)]">{row.reference}</span>}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dupChip.cls}`}>{dupChip.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusChip.cls}`}>{statusChip.label}</span>
        </span>
      </div>

      {row.description && (
        <div className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">{row.description}</div>
      )}
      {row.counterparty_name && (
        <div className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]">↳ {row.counterparty_name}</div>
      )}
      {row.error_message && (
        <div className="mt-1 text-[11px] text-rose-300">{t("bankImports.row.parseError", "Parse error: {msg}").replace("{msg}", row.error_message)}</div>
      )}

      {/* Toggle row — only if not in error */}
      {row.import_status !== "error" && (
        <div className="mt-2 flex items-center gap-1.5">
          {row.import_status === "ready" ? (
            <button
              type="button"
              onClick={() => onToggle(row.id, "skipped")}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-medium text-[var(--text-highlight)] hover:border-rose-500/30 hover:text-rose-300"
            >
              <RrIcon name="cross" size={9} />
              {t("bankImports.row.skip", "Skip")}
            </button>
          ) : row.import_status === "skipped" ? (
            <button
              type="button"
              onClick={() => onToggle(row.id, "ready")}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-medium text-[var(--text-highlight)] hover:border-emerald-500/30 hover:text-emerald-300"
            >
              <RrIcon name="check" size={9} />
              {t("bankImports.row.include", "Include")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
});

/* ────────────────────────────────────────────────────────────────────────
   Recent imports — quick history below the stepper on step 1.
   ──────────────────────────────────────────────────────────────────────── */

function RecentImports({
  imports, accounts,
}: {
  imports: BankStatementImport[];
  accounts: BankAccount[];
  onOpen: (imp: BankStatementImport) => void;
}) {
  const { t } = useTranslation(financeT);
  if (imports.length === 0) return null;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const IMPORT_STATUS_LOCAL: Record<string, { label: string; cls: string }> = {
    uploaded:  { label: t("bankImports.impStatus.uploaded", "Uploaded"),  cls: "bg-gray-500/15 text-[var(--text-highlight)]" },
    parsed:    { label: t("bankImports.impStatus.parsed", "Parsed"),    cls: "bg-amber-500/15 text-amber-300" },
    confirmed: { label: t("bankImports.impStatus.confirmed", "Confirmed"), cls: "bg-emerald-500/15 text-emerald-300" },
    failed:    { label: t("bankImports.impStatus.failed", "Failed"),    cls: "bg-rose-500/15 text-rose-300" },
    cancelled: { label: t("bankImports.impStatus.cancelled", "Cancelled"), cls: "bg-gray-500/15 text-[var(--text-highlight)]" },
  };
  return (
    <SectionCard title={t("bankImports.recent.title", "Recent imports")} subtitle={t("bankImports.recent.subtitle", "Last 10 imports for this tenant. Confirmed imports are kept for audit.")}>
      <div className="divide-y divide-white/[0.04]">
        {imports.slice(0, 10).map((i) => {
          const a = byId.get(i.bank_account_id);
          const statusChip = IMPORT_STATUS_LOCAL[i.status] ?? IMPORT_STATUS_LOCAL.uploaded;
          return (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{i.file_name}</div>
                <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                  {a?.bank_name ?? "—"} · {i.file_type.toUpperCase()} · {new Date(i.uploaded_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusChip.cls}`}>{statusChip.label}</span>
                {i.status === "confirmed" && (
                  <span className="text-[10px] text-[var(--text-dim)]">{t("bankImports.recent.movements", "{n} movements").replace("{n}", String(i.imported_count))}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Style maps
   ──────────────────────────────────────────────────────────────────────── */

const DUP_CHIP: Record<BankStatementRowDuplicateStatus, { label: string; cls: string }> = {
  new:                { label: "New",       cls: "bg-emerald-500/15 text-emerald-300" },
  possible_duplicate: { label: "Possible dup", cls: "bg-amber-500/15 text-amber-300" },
  duplicate:          { label: "Duplicate", cls: "bg-rose-500/15 text-rose-300" },
};

const ROW_STATUS_CHIP: Record<BankStatementRowImportStatus, { label: string; cls: string }> = {
  ready:    { label: "Ready",    cls: "bg-emerald-500/15 text-emerald-300" },
  skipped:  { label: "Skipped",  cls: "bg-gray-500/15 text-[var(--text-highlight)]" },
  imported: { label: "Imported", cls: "bg-sky-500/15 text-sky-300" },
  error:    { label: "Error",    cls: "bg-rose-500/15 text-rose-300" },
};

const IMPORT_STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  uploaded:  { label: "Uploaded",  cls: "bg-gray-500/15 text-[var(--text-highlight)]" },
  parsed:    { label: "Parsed",    cls: "bg-amber-500/15 text-amber-300" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-300" },
  failed:    { label: "Failed",    cls: "bg-rose-500/15 text-rose-300" },
  cancelled: { label: "Cancelled", cls: "bg-gray-500/15 text-[var(--text-highlight)]" },
};
