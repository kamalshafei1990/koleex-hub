"use client";

/* ---------------------------------------------------------------------------
   ReportBlocks — the Phase 4A blocks of a report (owner's pick, 25 Sep 2026):
   a checklist (OK / problem / not applicable, a note and a photo per point),
   a 1–5 score over weighted criteria, a table of numbers and money, links to
   the customers, suppliers, products and orders it is about, and a signature
   drawn with a finger. One editor and one view per kind; the stored shape
   and its limits are templates.ts (normalizeSections), the same on the
   server. Phase 4B adds a choice (one fixed answer) and the numbers from the
   apps — shown live while drafting, frozen when sent — and a date column.

   Loaded only by a report whose template has a block (next/dynamic from
   ReportView), so the plain daily never carries it. Photos and the
   signature are the report's own attachments (the same private bucket and
   route); the general photos-and-files list leaves them out.
   --------------------------------------------------------------------------- */

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import {
  REPORT_CURRENCIES, REPORT_LIMITS, scoreAverage, tableSummary,
  type CheckState, type ReportDataRow, type ReportDataSource, type ReportDataValue, type ReportLink, type ReportLinkType, type ReportSectionDef, type ReportSectionValue,
} from "@/lib/reports/templates";
import { DATA_COLUMNS, DATA_MODULE, dataRowHref, dataTotals, statusWordKey, type DataColumn } from "@/lib/reports/report-data";
import { reportFileUrl, type ReportAttachment } from "@/lib/reports/attachments";
import { preparePhoto } from "@/lib/reports/prepare-photo";
import { deleteReportAttachment, dmyDate, dmyTime, searchReportLinks, uploadReportAttachment, type LinkHit } from "@/lib/work-reports";
import { entityHref } from "@/lib/reports/link-targets";
import { PhotoViewer } from "./AttachmentsView";
import { FIELD, type T } from "./shared";

interface EditorProps {
  t: T;
  tplKey: string;
  def: ReportSectionDef;
  value: ReportSectionValue;
  reportId: string;
  version: number;
  onChange: (v: ReportSectionValue) => void;
  /** An upload is on its way (Send waits for it). */
  onBusy: (busy: boolean) => void;
  /** A numbers block: what the server computed for this draft just now. */
  live?: ReportDataValue;
}

const num = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
const photoOf = (id: string, name: string, caption: string, thumb = true): ReportAttachment =>
  ({ id, name, mime: "image/jpeg", size: 0, width: null, height: null, caption, image: true, hasThumb: thumb });

/* ── The editors ────────────────────────────────────────────────────── */

export function BlockEditor(p: EditorProps) {
  switch (p.def.kind) {
    case "checklist": return <ChecklistEditor {...p} />;
    case "score": return <ScoreEditor {...p} />;
    case "table": return <TableEditor {...p} />;
    case "links": return <LinksEditor {...p} />;
    case "signature": return <SignatureEditor {...p} />;
    case "choice": return <ChoiceEditor {...p} />;
    case "data": return <DataEditor {...p} />;
    default: return null;
  }
}

const STATES: CheckState[] = ["ok", "issue", "na"];
const STATE_ON: Record<CheckState, string> = {
  ok: "bg-emerald-500/15 text-emerald-500",
  issue: "bg-red-500/15 text-red-500",
  na: "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
};

function ChecklistEditor({ t, tplKey, def, value, reportId, onChange, onBusy }: EditorProps) {
  const checks = useMemo(() => value.checks ?? {}, [value.checks]);
  const points = def.points ?? [];
  const label = (pid: string) => t(`tpl.${tplKey}.s.${def.id}.i.${pid}`);
  const set = (pid: string, patch: Record<string, unknown>) => onChange({ ...value, checks: { ...checks, [pid]: { ...checks[pid], ...patch } } });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const answered = points.filter((pt) => checks[pt.id]?.state).length;
  const problems = points.filter((pt) => checks[pt.id]?.state === "issue").length;
  const photos = points.filter((pt) => checks[pt.id]?.photo).map((pt) => photoOf(checks[pt.id]!.photo!, label(pt.id), label(pt.id)));

  const upload = async (pid: string, file: File) => {
    setBusy(pid); setFailed(null); onBusy(true);
    try {
      const prep = await preparePhoto(file);
      if (!prep) { setFailed(pid); return; }
      const res = await uploadReportAttachment(reportId, { file: prep.file, name: prep.file.name, thumb: prep.thumb, width: prep.width, height: prep.height });
      if (res.ok) set(pid, { photo: res.data.attachment.id }); else setFailed(pid);
    } finally { setBusy(null); onBusy(false); }
  };
  const removePhoto = (pid: string) => {
    const id = checks[pid]?.photo;
    set(pid, { photo: undefined });
    if (id) void deleteReportAttachment(reportId, id);
  };

  return (
    <div>
      <p className="mb-2 text-[11.5px] text-[var(--text-dim)] tabular-nums">
        {t("blk.checked").replace("{n}", String(answered)).replace("{m}", String(points.length))}
        {problems > 0 && <span className="text-red-500"> · {t("blk.problems").replace("{n}", String(problems))}</span>}
      </p>
      <ul className="space-y-2">
        {points.map((pt) => {
          const c = checks[pt.id] ?? {};
          return (
            <li key={pt.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5 sm:p-3">
              {/* On a phone the three answers sit under the point, full width,
                  in the same place on every card — tapped going down the
                  list; beside it from sm up. */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <span className="min-w-0 text-[13px] font-medium text-[var(--text-primary)]">{label(pt.id)}</span>
                <div role="radiogroup" aria-label={label(pt.id)} className="flex shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] sm:inline-flex">
                  {STATES.map((st) => (
                    <button key={st} type="button" role="radio" aria-checked={c.state === st}
                      onClick={() => set(pt.id, { state: c.state === st ? undefined : st })}
                      className={`h-9 flex-1 px-2.5 text-[12px] font-semibold transition-colors sm:h-8 sm:flex-none ${c.state === st ? STATE_ON[st] : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                      {t(`blk.${st}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input value={c.note ?? ""} onChange={(e) => set(pt.id, { note: e.target.value })} maxLength={REPORT_LIMITS.item} dir="auto"
                  placeholder={t("blk.note")} aria-label={`${label(pt.id)} — ${t("blk.note")}`} className={`${FIELD} h-9 min-w-0 flex-1 py-1.5`} />
                {c.photo ? (
                  <span className="relative shrink-0">
                    <button type="button" onClick={() => setOpen(photos.findIndex((ph) => ph.id === c.photo))} aria-label={`${label(pt.id)} — ${t("blk.photo")}`}
                      className="block h-9 w-9 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file */}
                      <img src={reportFileUrl(c.photo, "thumb")} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button type="button" onClick={() => removePhoto(pt.id)} aria-label={t("blk.photoRemove")}
                      className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)]">
                      <RrIcon name="cross" size={8} />
                    </button>
                  </span>
                ) : (
                  <label className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed ${failed === pt.id ? "border-red-500/60 text-red-500" : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
                    aria-label={`${label(pt.id)} — ${t("blk.photo")}`}>
                    {busy === pt.id ? <SpinnerIcon size={13} /> : <RrIcon name="camera" size={14} />}
                    <input type="file" accept="image/*" capture="environment" hidden disabled={!!busy}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(pt.id, f); }} />
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {open !== null && open >= 0 && photos[open] && <PhotoViewer t={t} photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ScoreEditor({ t, tplKey, def, value, onChange }: EditorProps) {
  const scores = value.scores ?? {};
  const avg = scoreAverage(def, value);
  const weights = (def.points ?? []).map((pt) => pt.weight ?? 1);
  const total = weights.reduce((a, w) => a + w, 0);
  const uneven = new Set(weights).size > 1;
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2 text-[12px] text-[var(--text-dim)]">
        {t("blk.overall")}
        <span className="text-[18px] font-semibold text-[var(--text-primary)] tabular-nums">{avg ?? "—"}</span>
        <span className="tabular-nums">/ 5</span>
      </p>
      <ul className="space-y-2">
        {(def.points ?? []).map((pt) => {
          const n = scores[pt.id] ?? 0;
          const name = t(`tpl.${tplKey}.s.${def.id}.i.${pt.id}`);
          return (
            <li key={pt.id} className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
              <span className="min-w-0 text-[13px] text-[var(--text-primary)]">
                {name}
                {uneven && <span className="ms-1.5 text-[11px] text-[var(--text-faint)] tabular-nums">{Math.round(((pt.weight ?? 1) / total) * 100)}%</span>}
              </span>
              <div role="radiogroup" aria-label={name} className="flex shrink-0 gap-1 sm:inline-flex">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={n === k} aria-label={`${name}: ${k}`}
                    onClick={() => { const next = { ...scores }; if (n === k) delete next[pt.id]; else next[pt.id] = k; onChange({ ...value, scores: next }); }}
                    className={`grid h-9 flex-1 place-items-center rounded-lg text-[12.5px] font-semibold tabular-nums transition-colors sm:h-8 sm:w-8 sm:flex-none ${k <= n ? "bg-[#567FB2] text-white" : "border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                    {k}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TableEditor({ t, tplKey, def, value, onChange }: EditorProps) {
  const cols = def.columns ?? [];
  const rows = value.rows?.length ? value.rows : [{}];
  const money = cols.some((c) => c.type === "money");
  const currency = value.currency ?? "USD";
  const colName = (cid: string) => t(`tpl.${tplKey}.s.${def.id}.c.${cid}`);
  const setRows = (next: Array<Record<string, string>>) => onChange({ ...value, rows: next, ...(money ? { currency } : {}) });
  const setCell = (ri: number, cid: string, v: string) => setRows(rows.map((r, i) => (i === ri ? { ...r, [cid]: v } : r)));
  return (
    <div className="space-y-2">
      {money && (
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
          {t("blk.currency")}
          <select value={currency} onChange={(e) => onChange({ ...value, currency: e.target.value })} className={`${FIELD} h-8 w-auto py-1`}>
            {REPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}
      {rows.map((r, ri) => (
        <div key={ri} className="relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5 pe-9">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {cols.map((c) => (
              <label key={c.id} className="min-w-0">
                <span className="mb-0.5 block truncate text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-faint)]">
                  {colName(c.id)}{c.type === "money" ? ` (${currency})` : ""}
                </span>
                <input value={r[c.id] ?? ""} onChange={(e) => setCell(ri, c.id, e.target.value)} maxLength={REPORT_LIMITS.cell}
                  type={c.type === "date" ? "date" : "text"}
                  inputMode={c.type === "number" || c.type === "money" ? "decimal" : undefined} dir={c.type === "text" ? "auto" : "ltr"}
                  className={`${FIELD} h-9 py-1.5 ${c.type === "text" ? "" : "tabular-nums"}`} />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setRows(rows.length > 1 ? rows.filter((_, i) => i !== ri) : [{}])} aria-label={t("blk.removeRow")}
            className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-md text-[var(--text-dim)] hover:text-red-500">
            <RrIcon name="cross" size={10} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => rows.length < REPORT_LIMITS.rows && setRows([...rows, {}])} disabled={rows.length >= REPORT_LIMITS.rows}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50">
          <RrIcon name="plus" size={10} />{t("blk.addRow")}
        </button>
        <TableTotals t={t} tplKey={tplKey} def={def} rows={rows} currency={currency} />
      </div>
    </div>
  );
}

function TableTotals({ t, tplKey, def, rows, currency }: { t: T; tplKey: string; def: ReportSectionDef; rows: Array<Record<string, string>>; currency: string }) {
  const figures = tableSummary(def, rows);
  if (!figures.length) return null;
  return (
    <p className="flex flex-wrap gap-x-3 text-[12px] text-[var(--text-dim)] tabular-nums">
      {figures.map((f) => (
        <span key={f.col.id}>
          {t(`tpl.${tplKey}.s.${def.id}.c.${f.col.id}`)} · {t(f.kind === "lowest" ? "blk.lowest" : "blk.total")}{" "}
          <b className="text-[var(--text-primary)]">{num(f.value)}{f.col.type === "money" ? ` ${currency}` : ""}</b>
          {f.who && <span dir="auto"> ({f.who})</span>}
        </span>
      ))}
    </p>
  );
}

function LinksEditor({ t, def, value, onChange }: EditorProps) {
  const links = value.links ?? [];
  const types = def.linkTypes ?? ["customer", "supplier", "product", "order"];
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportLinkType>(types[0]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<LinkHit[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [searching, setSearching] = useState(false);
  const ask = useRef(0);
  useEffect(() => {
    if (!open) return;
    const n = ++ask.current;
    const id = setTimeout(() => {
      setSearching(true);
      void searchReportLinks(type, q.trim()).then((res) => {
        if (n !== ask.current) return;
        setSearching(false);
        setDenied(res.ok && !!res.data.denied);
        setHits(res.ok ? res.data.hits : []);
      });
    }, q.trim() ? 250 : 0);
    return () => clearTimeout(id);
  }, [open, type, q]);
  const add = (h: LinkHit) => {
    if (links.some((l) => l.type === type && l.id === h.id) || links.length >= REPORT_LIMITS.links) return;
    onChange({ ...value, links: [...links, { type, id: h.id, label: h.label }] });
  };
  const remove = (l: ReportLink) => onChange({ ...value, links: links.filter((x) => !(x.type === l.type && x.id === l.id)) });
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => (
          <span key={`${l.type}|${l.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-1 ps-2.5 pe-1 text-[12px]">
            <span className="text-[var(--text-faint)]">{t(`blk.link.${l.type}`)}</span>
            <span className="max-w-[200px] truncate text-[var(--text-primary)]" dir="auto">{l.label}</span>
            <button type="button" onClick={() => remove(l)} aria-label={`${l.label} ×`} className="grid h-5 w-5 place-items-center text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <RrIcon name="cross" size={9} />
            </button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          <RrIcon name="plus" size={10} />{t("blk.addLink")}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2">
          {types.length > 1 && (
            <div role="tablist" className="mb-2 flex flex-wrap gap-1">
              {types.map((ty) => (
                <button key={ty} type="button" role="tab" aria-selected={ty === type} onClick={() => { setType(ty); setHits(null); }}
                  className={`h-7 rounded-lg px-2.5 text-[12px] font-medium ${ty === type ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                  {t(`blk.link.${ty}`)}
                </button>
              ))}
            </div>
          )}
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("blk.search")} aria-label={t("blk.search")} dir="auto" className={`${FIELD} h-8 py-1`} />
          <ul className="mt-1 max-h-60 overflow-y-auto">
            {searching && !hits && <li className="grid place-items-center py-3"><SpinnerIcon size={13} /></li>}
            {hits && hits.length === 0 && <li className="px-2 py-2 text-[12px] text-[var(--text-dim)]">{denied ? t("blk.noAccess") : t("blk.noMatch")}</li>}
            {(hits ?? []).map((h) => {
              const added = links.some((l) => l.type === type && l.id === h.id);
              return (
                <li key={h.id}>
                  <button type="button" disabled={added} onClick={() => add(h)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[12.5px] hover:bg-[var(--bg-surface)] disabled:opacity-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[var(--text-primary)]" dir="auto">{h.label}</span>
                      {h.sub && <span className="block truncate text-[10.5px] text-[var(--text-dim)]" dir="auto">{h.sub}</span>}
                    </span>
                    {added && <RrIcon name="check" size={12} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A finger signature: drawn on a white pad (paper, whatever the theme),
 *  saved as a PNG attachment of the report with the signer's name and the
 *  moment, stamped with the version it was signed on. */
function SignatureEditor({ t, value, reportId, version, onChange, onBusy }: EditorProps) {
  const sig = value.signature ?? null;
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  const fit = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width === Math.round(w * dpr) && c.height === Math.round(h * dpr)) return;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = 2.4; g.strokeStyle = "#111111";
    setDrawn(false);
  }, []);
  useLayoutEffect(() => { if (!sig) fit(); }, [sig, fit]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = at(e); };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const g = canvas.current?.getContext("2d");
    if (!g) return;
    const p = at(e);
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke();
    last.current = p;
    if (!drawn) setDrawn(true);
  };
  const up = () => { last.current = null; };
  const clear = () => { const c = canvas.current; const g = c?.getContext("2d"); if (c && g) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.restore(); } setDrawn(false); };

  const save = async () => {
    const c = canvas.current;
    if (!c || !drawn || !name.trim()) return;
    setSaving(true); setFailed(false); onBusy(true);
    try {
      /* White under the ink, so the PNG reads on any page. */
      const out = document.createElement("canvas");
      out.width = c.width; out.height = c.height;
      const g = out.getContext("2d")!;
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, out.width, out.height); g.drawImage(c, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
      if (!blob) { setFailed(true); return; }
      const res = await uploadReportAttachment(reportId, { file: new File([blob], "signature.png", { type: "image/png" }), name: "signature.png", width: out.width, height: out.height });
      if (!res.ok) { setFailed(true); return; }
      onChange({ ...value, signature: { file: res.data.attachment.id, name: name.trim().slice(0, REPORT_LIMITS.signer), at: new Date().toISOString(), version } });
    } finally { setSaving(false); onBusy(false); }
  };
  const redo = () => {
    const old = sig?.file;
    onChange({ ...value, signature: null });
    if (old) void deleteReportAttachment(reportId, old);
  };

  if (sig) {
    return (
      <div className="space-y-2">
        <SignatureView t={t} value={value} version={version} />
        <button type="button" onClick={redo} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <RrIcon name="pencil" size={11} />{t("blk.signRedo")}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
        <canvas ref={canvas} aria-label={t("blk.signHere")} className="block h-40 w-full touch-none"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      </div>
      <p className="text-[11.5px] text-[var(--text-dim)]">{t("blk.signHere")}</p>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={REPORT_LIMITS.signer} dir="auto"
        placeholder={t("blk.signName")} aria-label={t("blk.signName")} className={`${FIELD} h-9 py-1.5`} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={clear} disabled={!drawn || saving}
          className="inline-flex h-9 items-center rounded-xl border border-[var(--border-subtle)] px-3 text-[12.5px] text-[var(--text-secondary)] disabled:opacity-50">{t("blk.signClear")}</button>
        <button type="button" onClick={() => void save()} disabled={!drawn || !name.trim() || saving}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--bg-inverted)] px-3 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-50 ${failed ? "ring-1 ring-red-500" : ""}`}>
          {saving ? <><SpinnerIcon size={12} />{t("blk.saving")}</> : t("blk.signSave")}
        </button>
      </div>
    </div>
  );
}

/* ── A choice (4B): one of a few fixed answers ──────────────────────── */

function ChoiceEditor({ t, tplKey, def, value, onChange }: EditorProps) {
  return (
    <div role="radiogroup" aria-label={t(`tpl.${tplKey}.s.${def.id}`)} className="flex flex-wrap gap-1.5">
      {(def.options ?? []).map((o) => {
        const on = value.choice === o;
        return (
          <button key={o} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, choice: on ? undefined : o })}
            className={`h-9 rounded-lg px-3 text-[12.5px] font-semibold transition-colors ${on ? "bg-[#567FB2] text-white" : "border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
            {t(`tpl.${tplKey}.s.${def.id}.o.${o}`)}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceView({ t, tplKey, def, value }: { t: T; tplKey: string; def: ReportSectionDef; value: ReportSectionValue }) {
  if (!value.choice) return <p className="text-[13px] text-[var(--text-faint)]">{t("reader.empty")}</p>;
  return (
    <span className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-1 text-[13px] font-medium text-[var(--text-primary)]">
      {t(`tpl.${tplKey}.s.${def.id}.o.${value.choice}`)}
    </span>
  );
}

/* ── Numbers from the apps (4B) ────────────────────────────────────────
   The author's own documents, as the server read them: live while the
   draft is written, frozen when it is sent. A row opens its document; a
   block that takes notes has one line per document for the author's word
   (what the customer said, the next step). One card per document on a
   phone, a table from sm up; money totals never mix currencies. */

function DataEditor({ t, def, value, live, onChange }: EditorProps) {
  const notes = value.notes ?? {};
  const setNote = (key: string, text: string) => {
    const next = { ...notes };
    if (text) next[key] = text; else delete next[key];
    onChange({ ...value, notes: next });
  };
  return <DataBlock t={t} def={def} data={live} notes={notes} onNote={def.notes ? setNote : undefined} composing />;
}

const statusWord = (t: T, source: ReportDataSource, s: unknown) => {
  const key = typeof s === "string" ? statusWordKey(source, s) : null;
  return key ? t(key) : String(s ?? "—");
};

function dataCell(t: T, source: ReportDataSource, r: ReportDataRow, c: DataColumn): string {
  const v = r.cells[c.id];
  if (v === null || v === undefined || v === "") return "—";
  switch (c.type) {
    case "date": return dmyDate(String(v));
    case "money": return typeof v === "number" ? `${num(v)}${r.currency ? ` ${r.currency}` : ""}` : "—";
    case "number": return String(v);
    case "status": return statusWord(t, source, v);
    default: return String(v);
  }
}

/** Late money, long waits and a quotation past its validity read at a
 *  glance (`asOf`: the day the numbers were taken). */
function dataTone(r: ReportDataRow, c: DataColumn, asOf: string): string {
  const v = r.cells[c.id];
  if ((c.id === "overdue" || c.id === "late") && Number(v) > 0) return "font-semibold text-red-500";
  if (c.id === "missing" && Number(v) > 0) return "font-semibold text-amber-500";
  if (c.id === "days" && Number(v) >= 14) return "font-semibold text-amber-500";
  if (c.id === "valid" && typeof v === "string" && v < asOf) return "font-semibold text-red-500";
  return "text-[var(--text-primary)]";
}

function DataBlock({ t, def, data, notes, onNote, composing }: {
  t: T; def: ReportSectionDef; data: ReportDataValue | undefined; notes: Record<string, string>;
  onNote?: (key: string, text: string) => void; composing: boolean;
}) {
  if (!data) return <p className="text-[13px] text-[var(--text-faint)]">{t("reader.empty")}</p>;
  if (data.denied) return <p className="text-[12.5px] text-[var(--text-dim)]">{t("blk.dataNoAccess").replace("{app}", DATA_MODULE[data.source])}</p>;
  if (data.failed) return <p className="text-[12.5px] text-amber-500">{t("blk.dataFailed")}</p>;
  const foot = (
    <p className="text-[11px] text-[var(--text-faint)] tabular-nums">
      {composing ? t("blk.dataLive") : t("blk.dataAsOf").replace("{at}", dmyTime(data.capturedAt))}
      {data.truncated ? ` · ${t("blk.dataTruncated").replace("{n}", String(REPORT_LIMITS.dataRows))}` : ""}
    </p>
  );
  if (!data.rows.length) return <div className="space-y-1"><p className="text-[13px] text-[var(--text-dim)]">{t(`blk.de.${data.source}`)}</p>{foot}</div>;
  const cols = DATA_COLUMNS[data.source];
  const totals = dataTotals(data);
  const asOf = data.capturedAt.slice(0, 10);
  const colName = (id: string) => t(`blk.dc.${id}`);
  /* The first column names the document (its number, or an expense's
     title) and opens it. */
  const first = cols[0];
  const docLink = (r: ReportDataRow) => {
    const href = dataRowHref(data.source, r.key);
    const text = String(r.cells[first.id] ?? "—");
    return href
      ? <Link href={href} target={composing ? "_blank" : undefined} rel={composing ? "noopener" : undefined} className="font-semibold text-[var(--text-primary)] underline-offset-2 hover:underline">{text}</Link>
      : <span className="font-semibold text-[var(--text-primary)]">{text}</span>;
  };
  const note = (r: ReportDataRow) => (onNote ? (
    <input value={notes[r.key] ?? ""} onChange={(e) => onNote(r.key, e.target.value)} maxLength={REPORT_LIMITS.item} dir="auto"
      placeholder={t(`blk.dn.${data.source}`)} aria-label={`${String(r.cells[first.id] ?? "")} — ${t(`blk.dn.${data.source}`)}`} className={`${FIELD} h-8 py-1`} />
  ) : notes[r.key] ? <p className="text-[12.5px] text-[var(--text-secondary)]" dir="auto">{notes[r.key]}</p> : null);
  return (
    <div className="space-y-2">
      <ul className="space-y-2 sm:hidden">
        {data.rows.map((r) => (
          <li key={r.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5">
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              {docLink(r)}
              <span className="min-w-0 truncate text-[var(--text-secondary)]" dir="auto">{dataCell(t, data.source, r, cols[1])}</span>
            </div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {cols.slice(2).map((c) => (
                <div key={c.id} className="min-w-0">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-faint)]">{colName(c.id)}</dt>
                  <dd className={`truncate text-[12.5px] tabular-nums ${dataTone(r, c, asOf)}`}>{dataCell(t, data.source, r, c)}</dd>
                </div>
              ))}
            </dl>
            {def.notes && <div className="mt-2">{note(r)}</div>}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-faint)]">
              {cols.map((c) => <th key={c.id} className={`px-2 py-1.5 ${c.type === "money" || c.type === "number" ? "text-end" : "text-start"}`}>{colName(c.id)}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <Fragment key={r.key}>
                <tr className={def.notes ? "" : "border-b border-[var(--border-subtle)] last:border-0"}>
                  {cols.map((c) => (
                    <td key={c.id} dir={c.type === "text" ? "auto" : "ltr"}
                      className={`px-2 py-1.5 ${c.type === "money" || c.type === "number" ? "text-end tabular-nums" : "text-start"} ${c.type !== "text" || c.id === "no" ? "whitespace-nowrap" : ""} ${c === first ? "" : dataTone(r, c, asOf)}`}>
                      {c === first ? docLink(r) : dataCell(t, data.source, r, c)}
                    </td>
                  ))}
                </tr>
                {def.notes && (
                  <tr className="border-b border-[var(--border-subtle)] last:border-0">
                    <td colSpan={cols.length} className="px-2 pb-2">{note(r)}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {totals.length > 0 && (
        <p className="flex flex-wrap gap-x-3 text-[12px] text-[var(--text-dim)] tabular-nums">
          {totals.map((x) => (
            <span key={`${x.col}|${x.currency}`}>{colName(x.col)} · {t("blk.total")} <b className="text-[var(--text-primary)]">{num(x.value)} {x.currency}</b></span>
          ))}
        </p>
      )}
      {foot}
    </div>
  );
}

/* ── The views (the reader, and the signature once saved) ──────────── */

export function BlockView({ t, tplKey, def, value, version }: { t: T; tplKey: string; def: ReportSectionDef; value: ReportSectionValue | undefined; version: number }) {
  const v = value ?? { id: def.id };
  switch (def.kind) {
    case "checklist": return <ChecklistView t={t} tplKey={tplKey} def={def} value={v} />;
    case "score": return <ScoreView t={t} tplKey={tplKey} def={def} value={v} />;
    case "table": return <TableView t={t} tplKey={tplKey} def={def} value={v} />;
    case "links": return <LinksView t={t} value={v} />;
    case "signature": return v.signature ? <SignatureView t={t} value={v} version={version} /> : <p className="text-[13px] text-[var(--text-faint)]">{t("reader.empty")}</p>;
    case "choice": return <ChoiceView t={t} tplKey={tplKey} def={def} value={v} />;
    case "data": return <DataBlock t={t} def={def} data={v.data} notes={v.notes ?? {}} composing={false} />;
    default: return null;
  }
}

const MARK: Record<CheckState, { sign: string; cls: string }> = {
  ok: { sign: "✓", cls: "text-emerald-500" },
  issue: { sign: "✗", cls: "text-red-500" },
  na: { sign: "—", cls: "text-[var(--text-faint)]" },
};

function ChecklistView({ t, tplKey, def, value }: { t: T; tplKey: string; def: ReportSectionDef; value: ReportSectionValue }) {
  const checks = value.checks ?? {};
  const points = def.points ?? [];
  const label = (pid: string) => t(`tpl.${tplKey}.s.${def.id}.i.${pid}`);
  const photos = points.filter((pt) => checks[pt.id]?.photo).map((pt) => photoOf(checks[pt.id]!.photo!, label(pt.id), [label(pt.id), checks[pt.id]?.note].filter(Boolean).join(" — ")));
  const [open, setOpen] = useState<number | null>(null);
  const answered = points.filter((pt) => checks[pt.id]?.state).length;
  const problems = points.filter((pt) => checks[pt.id]?.state === "issue").length;
  return (
    <div>
      <p className="mb-2 text-[11.5px] text-[var(--text-dim)] tabular-nums">
        {t("blk.checked").replace("{n}", String(answered)).replace("{m}", String(points.length))}
        {problems > 0 && <span className="text-red-500"> · {t("blk.problems").replace("{n}", String(problems))}</span>}
      </p>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {points.map((pt) => {
          const c = checks[pt.id] ?? {};
          const m = c.state ? MARK[c.state] : null;
          return (
            <li key={pt.id} className="flex items-start gap-2.5 py-2">
              <span aria-hidden className={`w-4 shrink-0 text-center text-[14px] font-bold leading-5 ${m?.cls ?? "text-[var(--text-faint)]"}`}>{m?.sign ?? "·"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-5 text-[var(--text-primary)]">
                  {label(pt.id)}
                  <span className="sr-only"> — {c.state ? t(`blk.${c.state}`) : "—"}</span>
                </p>
                {c.note && <p className="text-[12.5px] leading-snug text-[var(--text-secondary)]"><AutoTranslatedText text={c.note} plain /></p>}
              </div>
              {c.photo && (
                <button type="button" onClick={() => setOpen(photos.findIndex((ph) => ph.id === c.photo))} aria-label={`${label(pt.id)} — ${t("blk.photo")}`}
                  className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file */}
                  <img src={reportFileUrl(c.photo, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {open !== null && open >= 0 && photos[open] && <PhotoViewer t={t} photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ScoreView({ t, tplKey, def, value }: { t: T; tplKey: string; def: ReportSectionDef; value: ReportSectionValue }) {
  const avg = scoreAverage(def, value);
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2 text-[12px] text-[var(--text-dim)]">
        {t("blk.overall")}<span className="text-[18px] font-semibold text-[var(--text-primary)] tabular-nums">{avg ?? "—"}</span><span className="tabular-nums">/ 5</span>
      </p>
      <ul className="space-y-1.5">
        {(def.points ?? []).map((pt) => {
          const n = value.scores?.[pt.id] ?? 0;
          return (
            <li key={pt.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 text-[var(--text-primary)]">{t(`tpl.${tplKey}.s.${def.id}.i.${pt.id}`)}</span>
              <span className="inline-flex shrink-0 items-center gap-1" aria-label={`${n} / 5`}>
                {[1, 2, 3, 4, 5].map((k) => <span key={k} aria-hidden className={`h-2.5 w-5 rounded-full ${k <= n ? "bg-[#567FB2]" : "bg-[var(--bg-surface-subtle)] ring-1 ring-inset ring-[var(--border-subtle)]"}`} />)}
                <span className="ms-1 w-3 text-end text-[12px] text-[var(--text-dim)] tabular-nums">{n || "—"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TableView({ t, tplKey, def, value }: { t: T; tplKey: string; def: ReportSectionDef; value: ReportSectionValue }) {
  const cols = def.columns ?? [];
  const rows = value.rows ?? [];
  const currency = value.currency ?? "USD";
  /* A comparison's best offer stands out: each column's lowest cell. */
  const best = new Map(tableSummary(def, rows).filter((f) => f.kind === "lowest").map((f) => [f.col.id, f.row]));
  if (!rows.length) return <p className="text-[13px] text-[var(--text-faint)]">{t("reader.empty")}</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-faint)]">
              {cols.map((c) => <th key={c.id} className={`px-2 py-1.5 ${c.type === "text" || c.type === "date" ? "text-start" : "text-end"}`}>{t(`tpl.${tplKey}.s.${def.id}.c.${c.id}`)}{c.type === "money" ? ` (${currency})` : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                {cols.map((c) => (
                  <td key={c.id} className={`px-2 py-1.5 ${best.get(c.id) === i ? "font-semibold text-[#567FB2] dark:text-[#7FA9D6]" : "text-[var(--text-primary)]"} ${c.type === "text" ? "text-start" : c.type === "date" ? "text-start tabular-nums" : "text-end tabular-nums"}`} dir={c.type === "text" ? "auto" : "ltr"}>
                    {r[c.id] ? (c.type === "text" ? r[c.id] : c.type === "date" ? dmyDate(r[c.id]) : num(Number(r[c.id]))) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TableTotals t={t} tplKey={tplKey} def={def} rows={rows} currency={currency} />
    </div>
  );
}

function LinksView({ t, value }: { t: T; value: ReportSectionValue }) {
  const links = value.links ?? [];
  if (!links.length) return <p className="text-[13px] text-[var(--text-faint)]">{t("reader.empty")}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => {
        const href = entityHref(l.type, l.id);
        const body = (
          <>
            <span className="text-[var(--text-faint)]">{t(`blk.link.${l.type}`)}</span>
            <span className="max-w-[240px] truncate text-[var(--text-primary)]" dir="auto">{l.label}</span>
          </>
        );
        return href ? (
          <Link key={`${l.type}|${l.id}`} href={href} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[12px] hover:border-[var(--border-focus)]">{body}</Link>
        ) : (
          <span key={`${l.type}|${l.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[12px]">{body}</span>
        );
      })}
    </div>
  );
}

export function SignatureView({ t, value, version }: { t: T; value: ReportSectionValue; version: number }) {
  const sig = value.signature;
  if (!sig) return null;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid h-24 w-56 max-w-full place-items-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file */}
        <img src={reportFileUrl(sig.file)} alt={t("blk.signedBy").replace("{name}", sig.name)} className="max-h-full max-w-full object-contain" />
      </div>
      <p className="text-[12px] leading-snug text-[var(--text-dim)]">
        <span className="block text-[13px] text-[var(--text-primary)]" dir="auto">{t("blk.signedBy").replace("{name}", sig.name || "—")}</span>
        <span className="tabular-nums">{dmyTime(sig.at)}</span>
        {sig.version !== version && <span className="block">{t("blk.signedOn").replace("{v}", String(sig.version))}</span>}
      </p>
    </div>
  );
}
