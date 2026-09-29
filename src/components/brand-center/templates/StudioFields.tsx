"use client";

/* ---------------------------------------------------------------------------
   The template studio's slot editors (owner 29/09/2026: "everything
   editable"): text, choices, switches, sliders, pictures, the job-title
   library, the contact lines (label + value, add / hide / reorder / remove)
   and the QR codes (any number, each on the front or the back).
   --------------------------------------------------------------------------- */

import { useMemo, useRef, useState } from "react";
import type { FieldDef, TemplateItem, TemplateValue, TemplateValues } from "@/lib/brand-center/templates/types";
import { QR_CAPTIONS, QR_KINDS, ROW_KINDS, ROW_LABELS, asLang, isPictureQr, newId, qrsOf, rowsOf, type QrKind, type RowKind } from "@/lib/brand-center/templates/card/model";
import { TITLES, TITLE_GROUPS, type TitleEntry } from "@/lib/brand-center/templates/card/titles";
import Toggle from "@/components/kds/Toggle";
import RrIcon from "@/components/ui/RrIcon";
import AngleUpIcon from "@/components/icons/ui/AngleUpIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import { KX_RANGE_CLASS, kxRangeStyle } from "@/components/ui/rangeSlider";
import { SELECTED_CHIP } from "@/components/travel/fields";
import { FIELD } from "../ui";
import { readImage } from "./image-input";

type T = (k: string) => string;
export type SetMany = (patch: Record<string, TemplateValue>) => void;

const SMALL = "rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40";
const ICON_BTN = "rounded-md p-1 text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-30";

export function Field({ t, f, values, setMany, personPhoto }: { t: T; f: FieldDef; values: TemplateValues; setMany: SetMany; personPhoto: string | null }) {
  const value = values[f.key];
  const set = (v: TemplateValue) => setMany({ [f.key]: v });
  const id = `bc-tpl-${f.key}`;
  switch (f.kind) {
    case "switch":
      return (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-[var(--text-secondary)]">{t(f.labelKey)}</span>
          <Toggle checked={value !== false} onChange={set} label={t(f.labelKey)} />
        </div>
      );
    case "choice":
      return (
        <div>
          <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
          <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t(f.labelKey)}>
            {f.options.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => set(o.value)}
                className={`rounded-lg border px-2.5 py-1 text-[12px] ${value === o.value ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>
                {t(o.labelKey)}
              </button>
            ))}
          </div>
        </div>
      );
    case "range": {
      const n = typeof value === "number" ? value : f.min;
      return (
        <label htmlFor={id} className="block">
          <span className="flex items-center justify-between text-[11.5px] text-[var(--text-dim)]">
            <span>{t(f.labelKey)}</span>
            <span className="tabular-nums text-[var(--text-secondary)]">{n}{f.unit === "%" ? "%" : ""}</span>
          </span>
          <input id={id} type="range" min={f.min} max={f.max} step={f.step} value={n} onChange={(e) => set(Number(e.target.value))}
            className={`${KX_RANGE_CLASS} mt-1.5`} style={kxRangeStyle(((n - f.min) / (f.max - f.min)) * 100)} />
        </label>
      );
    }
    case "image":
      return <ImageField t={t} label={t(f.labelKey)} hint={f.hintKey ? t(f.hintKey) : ""} id={id} value={typeof value === "string" ? value : ""}
        keep={f.fromPerson ? "photo" : "graphic"} onChange={set} personPhoto={f.fromPerson ? personPhoto : null}
        /* A cut-out portrait needs no softened edges (the owner's card). */
        onPicked={f.fromPerson ? (url, transparent) => setMany({ [f.key]: url, ...(transparent ? { soft: false } : { soft: true }) }) : undefined} />;
    case "title":
      return <TitleField t={t} f={f} values={values} setMany={setMany} />;
    case "rows":
      return <RowsField t={t} f={f} values={values} setMany={setMany} />;
    case "qrs":
      return <QrsField t={t} f={f} values={values} setMany={setMany} />;
    default:
      return (
        <label htmlFor={id} className="block">
          <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
          {f.kind === "text" && (f.lines ?? 1) > 1 ? (
            <textarea id={id} dir="auto" rows={f.lines} value={typeof value === "string" ? value : ""} maxLength={f.max} placeholder={f.placeholder}
              onChange={(e) => set(e.target.value)} className={`${FIELD} mt-1 resize-y leading-5`} />
          ) : (
            <input id={id} dir="auto" value={typeof value === "string" ? value : ""} maxLength={f.max} placeholder={f.placeholder}
              onChange={(e) => set(e.target.value)} className={`${FIELD} mt-1`} />
          )}
          {f.hintKey ? <span className="mt-1 block text-[11px] leading-4 text-[var(--text-dim)]">{t(f.hintKey)}</span> : null}
        </label>
      );
  }
}

/* ── pictures ──────────────────────────────────────────────────────────── */

export function ImageField({ t, label, hint, id, value, keep, onChange, onPicked, personPhoto, compact }: {
  t: T; label: string; hint?: string; id: string; value: string; keep: "photo" | "graphic"; onChange: (v: string) => void;
  /** Called instead of onChange for a picture chosen on this computer. */
  onPicked?: (url: string, transparent: boolean) => void; personPhoto: string | null; compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setFailed(false);
    const got = await readImage(file, keep);
    setBusy(false);
    if (!got) { setFailed(true); return; }
    if (onPicked) onPicked(got.url, got.transparent); else onChange(got.url);
  };
  return (
    <div>
      {label ? <span className="text-[11.5px] text-[var(--text-dim)]">{label}</span> : null}
      <div className={`${label ? "mt-1 " : ""}flex items-center gap-3`}>
        <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : null}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <button type="button" className={SMALL} disabled={busy} onClick={() => input.current?.click()}>{value ? t("studio.replace") : t("studio.upload")}</button>
          {personPhoto && value !== personPhoto ? <button type="button" className={SMALL} onClick={() => onChange(personPhoto)}>{t("studio.usePhoto")}</button> : null}
          {value ? <button type="button" className={SMALL} onClick={() => onChange("")}>{t("studio.remove")}</button> : null}
        </span>
        <input ref={input} id={id} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-[var(--text-dim)]">{hint}</p> : null}
      {failed ? <p role="alert" className="mt-1 text-[11.5px] text-red-500">{t("studio.imageError")}</p> : null}
    </div>
  );
}

/* ── the job-title library ─────────────────────────────────────────────── */

function TitleField({ t, f, values, setMany }: { t: T; f: Extract<FieldDef, { kind: "title" }>; values: TemplateValues; setMany: SetMany }) {
  const lang = asLang(values[f.langKey]);
  const value = typeof values[f.key] === "string" ? (values[f.key] as string) : "";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const hit = (e: TitleEntry) => !s || e.en.toLowerCase().includes(s) || e.zh.includes(q.trim()) || e.ar.includes(q.trim());
    return TITLE_GROUPS.map((g) => ({ g, items: TITLES.filter((e) => e.group === g && hit(e)) })).filter((x) => x.items.length);
  }, [q]);
  const pick = (e: TitleEntry) => { setMany({ [f.key]: e[lang], [`${f.key}Key`]: e.en }); setOpen(false); setQ(""); };
  return (
    <div>
      <label htmlFor={`bc-tpl-${f.key}`} className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</label>
      <div className="mt-1 flex gap-1.5">
        <input id={`bc-tpl-${f.key}`} dir="auto" value={value} maxLength={80} onChange={(e) => setMany({ [f.key]: e.target.value, [`${f.key}Key`]: "" })} className={FIELD} />
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${SMALL} shrink-0 whitespace-nowrap`}>{t("studio.titleLibrary")}</button>
      </div>
      {/* Opens in place, under the box: the panel is glass already, and a
          second glass layer over it would not blur (one blur, the canon). */}
      {open ? (
        <div className="mt-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2">
          <input autoFocus dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("studio.titleSearch")} className={`${FIELD} !py-1.5`} />
          <p className="mt-1 px-1 text-[11px] text-[var(--text-dim)]">{t("studio.titleCount").replace("{n}", String(TITLES.length))}</p>
          <div className="mt-1 max-h-[300px] overflow-y-auto pe-1">
            {shown.map(({ g, items }) => (
              <div key={g} className="mb-1.5">
                <p className="px-1 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">{t(`tgroup.${g}`)}</p>
                {items.map((e) => (
                  <button key={e.en} type="button" onClick={() => pick(e)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-start text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]">
                    <span dir="auto" className="truncate">{e[lang]}</span>
                    {lang !== "en" ? <span className="shrink-0 truncate text-[11px] text-[var(--text-dim)]">{e.en}</span> : null}
                  </button>
                ))}
              </div>
            ))}
            {!shown.length ? <p className="px-2 py-3 text-[12px] text-[var(--text-dim)]">{t("studio.titleNone")}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── contact lines ─────────────────────────────────────────────────────── */

function RowsField({ t, f, values, setMany }: { t: T; f: Extract<FieldDef, { kind: "rows" }>; values: TemplateValues; setMany: SetMany }) {
  const lang = asLang(values[f.langKey]);
  const rows = rowsOf(values, f.key);
  const kinds = (f.kinds ?? ROW_KINDS) as readonly RowKind[];
  const [adding, setAdding] = useState<RowKind>(kinds.includes("tel") ? "tel" : kinds[0]);
  const save = (next: typeof rows) => setMany({ [f.key]: next.map((r) => ({ ...r })) as TemplateItem[] });
  const patch = (i: number, p: Partial<(typeof rows)[number]>) => save(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => { const next = [...rows]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); save(next); };
  return (
    <div>
      <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
      <ul className="mt-1 grid [&>*]:min-w-0 gap-1.5">
        {rows.map((r, i) => (
          <li key={r.id} className={`grid grid-cols-[auto_84px_minmax(0,1fr)_auto] items-center gap-1.5 ${r.on ? "" : "opacity-55"}`}>
            <input type="checkbox" checked={r.on} onChange={(e) => patch(i, { on: e.target.checked })} aria-label={t("studio.rowShow")} className="h-3.5 w-3.5 accent-[var(--text-primary)]" />
            <input dir="auto" value={r.label} onChange={(e) => patch(i, { label: e.target.value })} aria-label={t("studio.rowLabel")} placeholder={t("studio.rowLabel")} className={`${FIELD} !px-2 !py-1.5 !text-[12px] font-semibold`} />
            <input dir="auto" value={r.value} onChange={(e) => patch(i, { value: e.target.value })} aria-label={t(`row.${r.kind}`)} placeholder={t(`row.${r.kind}`)} className={`${FIELD} !px-2 !py-1.5 !text-[12px]`} />
            <span className="flex">
              <button type="button" className={ICON_BTN} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("studio.up")}><AngleUpIcon size={13} /></button>
              <button type="button" className={ICON_BTN} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={t("studio.down")}><AngleDownIcon size={13} /></button>
              <button type="button" className={ICON_BTN} onClick={() => save(rows.filter((_, j) => j !== i))} aria-label={t("studio.remove")}><RrIcon name="cross" size={11} /></button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {kinds.length > 1 ? (
          <select aria-label={t("studio.rowKind")} value={adding} onChange={(e) => setAdding(e.target.value as RowKind)} className={`${FIELD} !w-auto !py-1 !text-[12px]`}>
            {kinds.map((k) => <option key={k} value={k}>{t(`row.${k}`)}</option>)}
          </select>
        ) : null}
        <button type="button" className={SMALL} onClick={() => save([...rows, { id: newId("r"), kind: adding, label: (f.labels ?? ROW_LABELS)[lang]?.[adding] ?? "", value: "", on: true }])}>
          {t("studio.rowAdd")}
        </button>
      </div>
    </div>
  );
}

/* ── QR codes ──────────────────────────────────────────────────────────── */

function QrsField({ t, f, values, setMany }: { t: T; f: Extract<FieldDef, { kind: "qrs" }>; values: TemplateValues; setMany: SetMany }) {
  const lang = asLang(values[f.langKey]);
  const qrs = qrsOf(values);
  const save = (next: typeof qrs) => setMany({ [f.key]: next.map((q) => ({ ...q })) as TemplateItem[] });
  const patch = (i: number, p: Partial<(typeof qrs)[number]>) => save(qrs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const move = (i: number, d: -1 | 1) => { const next = [...qrs]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); save(next); };
  return (
    <div>
      <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
      <ul className="mt-1 grid [&>*]:min-w-0 gap-2">
        {qrs.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-[var(--border-subtle)] px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <select aria-label={t("studio.qrKind")} value={q.kind} onChange={(e) => patch(i, { kind: e.target.value as QrKind })} className={`${FIELD} !w-auto !py-1 !text-[12px]`}>
                {QR_KINDS.map((k) => <option key={k} value={k}>{t(`qr.${k}`)}</option>)}
              </select>
              <span className="flex gap-1" role="radiogroup" aria-label={t("studio.qrSide")}>
                {(["front", "back"] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={q.side === s} onClick={() => patch(i, { side: s })}
                    className={`rounded-lg border px-2 py-0.5 text-[11.5px] ${q.side === s ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>{t(`tpl.page.${s}`)}</button>
                ))}
              </span>
              <span className="ms-auto flex">
                <button type="button" className={ICON_BTN} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("studio.up")}><AngleUpIcon size={13} /></button>
                <button type="button" className={ICON_BTN} disabled={i === qrs.length - 1} onClick={() => move(i, 1)} aria-label={t("studio.down")}><AngleDownIcon size={13} /></button>
                <button type="button" className={ICON_BTN} onClick={() => save(qrs.filter((_, j) => j !== i))} aria-label={t("studio.remove")}><RrIcon name="cross" size={11} /></button>
              </span>
            </div>
            {q.kind === "link" ? (
              <input dir="ltr" value={q.link} onChange={(e) => patch(i, { link: e.target.value })} placeholder="https://" aria-label={t("qr.link")} className={`${FIELD} mt-1.5 !py-1.5 !text-[12px]`} />
            ) : null}
            {isPictureQr(q) ? (
              <div className="mt-1.5">
                <ImageField t={t} label="" id={`bc-qr-${q.id}`} value={q.image} keep="graphic" onChange={(v) => patch(i, { image: v })} personPhoto={null} compact
                  hint={q.kind === "wechat" ? t("tpl.f.wechatQrHint") : ""} />
              </div>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <input dir="auto" value={q.caption} onChange={(e) => patch(i, { caption: e.target.value })} placeholder={QR_CAPTIONS[q.kind][lang] || t("studio.qrCaption")}
                aria-label={t("studio.qrCaption")} className={`${FIELD} !w-auto flex-1 !py-1 !text-[12px]`} />
              {!isPictureQr(q) ? (
                <label className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]">
                  <input type="checkbox" checked={q.logo} onChange={(e) => patch(i, { logo: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--text-primary)]" />
                  {t("studio.qrLogo")}
                </label>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className={`${SMALL} mt-2`}
        onClick={() => save([...qrs, { id: newId("q"), kind: "contact", side: "back", caption: "", link: "", image: "", logo: false }])}>
        {t("studio.qrAdd")}
      </button>
    </div>
  );
}
