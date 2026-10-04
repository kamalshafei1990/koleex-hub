"use client";

/* ---------------------------------------------------------------------------
   Shipping → Port names (plan published 26/09/2026, owner: "do the right way").

   Each port's Arabic and Chinese name is approved here, one language at a
   time, before any screen shows it. The proposals come from Wikidata by
   UN/LOCODE and are wrong often enough (Lobito as «وبيتو») that a person
   decides each one: approve it as it stands, correct it and approve, or
   reject it. A port with no approved name keeps its Latin name everywhere.

   Review order is the owner's: Koleex's own ports, then China, Egypt and the
   Arab states. Decisions stay on screen until the list is reloaded — a row
   does not jump away from under the reviewer's hand.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { useTranslation } from "@/lib/i18n";
import { shippingT } from "@/lib/translations/shipping";
import { countryDisplayName, flagEmoji } from "@/lib/invitations/types";
import { checkPlaceName, type NameGroup, type PlaceNameLang, type PlaceNameStatus } from "@/lib/shipping/place-names";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import UndoIcon from "@/components/icons/ui/UndoIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";

type T = (k: string, f?: string) => string;
type Entry = { name: string; status: PlaceNameStatus; source: "wikidata" | "manual"; sourceRef: string | null };
type Row = {
  id: string; locode: string | null; name: string; nameOfficial: string | null;
  countryCode: string; countryName: string | null; inKoleexList: boolean;
  ar: Entry | null; zh: Entry | null;
};
type Counts = { ports: number; arApproved: number; zhApproved: number; arDecided: number; zhDecided: number };
type Filter = "todo" | "done" | "all";

const decided = (e: Entry | null) => !!e && e.status !== "proposed";

export default function PlaceNamesReview() {
  const { t, lang } = useTranslation(shippingT);
  const [group, setGroup] = useState<NameGroup>("koleex");
  const [filter, setFilter] = useState<Filter>("todo");
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "more" | "notReady" | "noRight" | "error">("loading");
  const ask = useRef(0);

  /* Typing settles for 300 ms before it asks. */
  useEffect(() => {
    const id = setTimeout(() => setQ(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  const load = useCallback(async (nextPage: number) => {
    const n = ++ask.current;
    setPhase(nextPage === 0 ? "loading" : "more");
    const p = new URLSearchParams({ group, status: filter, page: String(nextPage) });
    if (q) p.set("q", q);
    try {
      const res = await fetch(`/api/shipping/place-names?${p}`, { cache: "no-store" });
      if (n !== ask.current) return;
      if (res.status === 403) { setPhase("noRight"); return; }
      if (!res.ok) { setPhase("error"); return; }
      const body = await res.json() as { ready: boolean; rows?: Row[]; total?: number; counts?: Counts };
      if (n !== ask.current) return;
      if (!body.ready) { setPhase("notReady"); return; }
      setRows((prev) => (nextPage === 0 ? body.rows ?? [] : [...prev, ...(body.rows ?? [])]));
      setTotal(body.total ?? 0);
      setCounts(body.counts ?? null);
      setPage(nextPage);
      setPhase("ready");
    } catch {
      if (n === ask.current) setPhase("error");
    }
  }, [group, filter, q]);

  useEffect(() => { void Promise.resolve().then(() => load(0)); }, [load]);

  /* A decision updates its row in place and the progress line with it. The
     "before" is read from a ref, not inside the rows updater: an updater runs
     twice under StrictMode and must not set other state. */
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const onSaved = useCallback((id: string, l: PlaceNameLang, entry: Entry) => {
    const before = rowsRef.current.find((r) => r.id === id)?.[l] ?? null;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [l]: entry } : r)));
    setCounts((c) => {
      if (!c) return c;
      const approved = (e: Entry | null) => (e?.status === "approved" ? 1 : 0);
      const dec = (e: Entry | null) => (decided(e) ? 1 : 0);
      return l === "ar"
        ? { ...c, arApproved: c.arApproved - approved(before) + approved(entry), arDecided: c.arDecided - dec(before) + dec(entry) }
        : { ...c, zhApproved: c.zhApproved - approved(before) + approved(entry), zhDecided: c.zhDecided - dec(before) + dec(entry) };
    });
  }, []);

  const groups: Array<{ id: NameGroup; label: string }> = [
    { id: "koleex", label: t("names.group.koleex") },
    { id: "cn", label: t("names.group.cn") },
    { id: "eg", label: t("names.group.eg") },
    { id: "arab", label: t("names.group.arab") },
    { id: "all", label: t("names.group.all") },
  ];
  const filters: Array<{ id: Filter; label: string }> = [
    { id: "todo", label: t("names.filter.todo") },
    { id: "done", label: t("names.filter.done") },
    { id: "all", label: t("names.filter.all") },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-24">
      {/* titleNode: the system bar already says "Shipping" (M-1 hides a title
          that repeats it), but this page's own name is not the app's — it
          stays on screen. The back chip names where it goes. */}
      <PageHeader title={t("names.open")} titleNode={t("names.open")} subtitle={t("names.subtitle")}
        icon={<LanguagesIcon size={16} />} backLabel={t("app.title")} showTabs={false} />

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label={t("names.open")} className="flex flex-wrap gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1">
            {groups.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={group === g.id} onClick={() => setGroup(g.id)}
                className={`h-8 rounded-lg px-3 text-[12.5px] font-medium transition-colors ${group === g.id ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                {g.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label={t("names.filter.todo")} className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1">
            {filters.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
                className={`h-8 rounded-lg px-3 text-[12.5px] font-medium transition-colors ${filter === f.id ? "kx-seg-on bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative min-w-0 flex-1 basis-[220px]">
            <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]"><SearchIcon size={14} /></span>
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("names.search")} aria-label={t("names.search")}
              className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] ps-9 pe-3 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--border-focus)]" />
          </label>
        </div>

        {counts && phase !== "notReady" && phase !== "noRight" && (
          <p className="text-[12px] text-[var(--text-dim)] tabular-nums">
            {t("names.progress").replace("{ar}", String(counts.arDecided)).replace("{zh}", String(counts.zhDecided)).replaceAll("{n}", String(counts.ports))}
          </p>
        )}
        <p className="text-[12px] text-[var(--text-faint)]">{t("names.hint")}</p>

        {phase === "loading" && <div className="grid place-items-center py-16"><SpinnerIcon size={18} /></div>}
        {phase === "notReady" && <Notice text={t("names.notReady")} />}
        {phase === "noRight" && <Notice text={t("names.noRight")} />}
        {phase === "error" && <Notice text={t("names.loadFailed")} />}
        {(phase === "ready" || phase === "more") && (
          rows.length === 0 ? <Notice text={q ? t("names.noMatch") : t("names.empty")} /> : (
            <ul className="space-y-2">
              {rows.map((r) => <PortRow key={r.id} row={r} t={t} lang={lang} onSaved={onSaved} />)}
            </ul>
          )
        )}
        {(phase === "ready" || phase === "more") && rows.length < total && (
          <div className="flex justify-center pt-2">
            <button type="button" onClick={() => void load(page + 1)} disabled={phase === "more"}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60">
              {phase === "more" && <SpinnerIcon size={12} />}{t("names.more")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">{text}</p>;
}

function PortRow({ row, t, lang, onSaved }: { row: Row; t: T; lang: string; onSaved: (id: string, l: PlaceNameLang, e: Entry) => void }) {
  return (
    <li className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 sm:p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden className="text-[15px] leading-none">{flagEmoji(row.countryCode)}</span>
        {/* The Latin name is the port's own — shown as it is, left to right. */}
        <span dir="ltr" className="min-w-0 truncate text-[14px] font-semibold text-[var(--text-primary)] [unicode-bidi:isolate]">{row.name}</span>
        {row.locode && <span dir="ltr" className="rounded-md border border-[var(--border-subtle)] px-1.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">{row.locode}</span>}
        <span className="text-[12px] text-[var(--text-dim)]">{countryDisplayName(row.countryCode, row.countryName ?? row.countryCode, lang)}</span>
        {row.inKoleexList && <span className="rounded-md border border-[var(--border-subtle)] px-1.5 text-[10.5px] font-medium text-[var(--text-dim)]">{t("names.koleex")}</span>}
      </div>
      {row.nameOfficial && row.nameOfficial !== row.name && (
        <p dir="ltr" className="mt-0.5 truncate text-[11.5px] text-[var(--text-faint)] [unicode-bidi:isolate]">{row.nameOfficial}</p>
      )}
      {/* Keyed by what is stored, so a reloaded list never shows a cell's
          old typing over a newer decision. */}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <LangCell key={`ar|${row.ar?.status ?? "none"}|${row.ar?.name ?? ""}`} lang="ar" portId={row.id} entry={row.ar} t={t} onSaved={(e) => onSaved(row.id, "ar", e)} />
        <LangCell key={`zh|${row.zh?.status ?? "none"}|${row.zh?.name ?? ""}`} lang="zh" portId={row.id} entry={row.zh} t={t} onSaved={(e) => onSaved(row.id, "zh", e)} />
      </div>
    </li>
  );
}

const STATUS_CLS: Record<PlaceNameStatus | "none", string> = {
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
  rejected: "border-red-500/25 bg-red-500/10 text-red-500",
  proposed: "border-sky-500/25 bg-sky-500/10 text-sky-500",
  none: "border-[var(--border-subtle)] text-[var(--text-dim)]",
};

function LangCell({ lang, portId, entry, t, onSaved }: {
  lang: PlaceNameLang; portId: string; entry: Entry | null; t: T; onSaved: (e: Entry) => void;
}) {
  const [text, setText] = useState(entry?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const clean = checkPlaceName(lang, text);
  const status: PlaceNameStatus | "none" = entry?.status ?? "none";
  /* An approved name that was not changed has nothing to approve again. */
  const canApprove = !!clean && !busy && !(entry?.status === "approved" && entry.name === clean);
  const statusWord = status === "approved" ? t("names.status.approved") : status === "rejected" ? t("names.status.rejected")
    : status === "proposed" ? t("names.status.proposed") : t("names.status.none");
  const langWord = lang === "ar" ? t("names.lang.ar") : t("names.lang.zh");
  const invalidWord = lang === "ar" ? t("names.invalid.ar") : t("names.invalid.zh");

  const send = async (action: "approve" | "reject" | "reopen") => {
    setBusy(true); setProblem(null);
    try {
      const res = await fetch("/api/shipping/place-names", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portId, lang, action, ...(action === "approve" ? { name: text } : {}) }),
      });
      const body = await res.json().catch(() => ({})) as { entry?: Entry; error?: string };
      if (!res.ok || !body.entry) { setProblem(body.error === "invalid_name" ? invalidWord : t("names.failed")); return; }
      setText(body.entry.name);
      onSaved(body.entry);
    } catch {
      setProblem(t("names.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-[var(--text-secondary)]">{langWord}</span>
        <span className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10.5px] font-medium ${STATUS_CLS[status]}`}>{statusWord}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => { setText(e.target.value); setProblem(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && canApprove) void send("approve"); }}
          dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} maxLength={120} aria-label={`${langWord}`}
          aria-invalid={!!text.trim() && !clean ? true : undefined}
          className="h-9 min-w-0 flex-1 basis-[160px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
        <div className="flex shrink-0 items-center gap-1.5">
          {busy ? <SpinnerIcon size={13} /> : (
            <>
              <button type="button" onClick={() => void send("approve")} disabled={!canApprove} aria-label={`${t("names.approve")} — ${langWord}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--bg-inverted)] px-3 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-40">
                <CheckIcon size={13} />{t("names.approve")}
              </button>
              {entry && entry.status === "proposed" && (
                <button type="button" onClick={() => void send("reject")} aria-label={`${t("names.reject")} — ${langWord}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <CrossIcon size={12} />{t("names.reject")}
                </button>
              )}
              {entry && entry.status !== "proposed" && (
                <button type="button" onClick={() => void send("reopen")} aria-label={`${t("names.reopen")} — ${langWord}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <UndoIcon size={12} />{t("names.reopen")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex min-h-[16px] flex-wrap items-center gap-x-3 text-[11px]">
        {problem ? <span role="alert" className="text-red-500">{problem}</span>
          : text.trim() && !clean ? <span className="text-amber-500">{invalidWord}</span>
          : entry?.source === "wikidata" && entry.sourceRef ? (
            <a href={`https://www.wikidata.org/wiki/${encodeURIComponent(entry.sourceRef)}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <ExternalLinkIcon size={11} /><span dir="ltr">Wikidata {entry.sourceRef}</span>
            </a>
          ) : entry?.source === "manual" ? <span className="text-[var(--text-dim)]">{t("names.manual")}</span> : null}
      </div>
    </div>
  );
}
