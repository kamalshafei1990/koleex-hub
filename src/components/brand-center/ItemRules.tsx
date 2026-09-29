"use client";

/* Brand Center item — its rules (plan steps C19–C39): the specification,
   the logo, do and don't, the vendor's brief, the templates that fill it
   and the book's chapters. Everyone reads them; the owner edits them here
   (a line per spec as "Label: value", a line per do / don't). */

import { useState } from "react";
import Link from "next/link";
import { CARD } from "@/components/travel/fields";
import { bc } from "@/lib/brand-center/client";
import { RULE_TEMPLATES, hasRules, type ItemRules as Rules } from "@/lib/brand-center/rules";
import { chapterByNumber, chapterHref } from "@/lib/brand-book/chapters";
import { FIELD } from "./ui";

type T = (k: string) => string;

export default function ItemRules({ t, itemId, rules, canEdit, onChanged }: { t: T; itemId: string; rules: Rules | null; canEdit: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const r = rules ?? {};
  return (
    <section data-kx-pane className={`${CARD} mt-4 px-4 py-4`} aria-label={t("item.rules")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("item.rules")}</h2>
        {canEdit && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("rules.edit")}</button>
        ) : null}
      </div>
      {editing ? (
        <RulesEditor t={t} itemId={itemId} rules={r} onDone={async (saved) => { if (saved) await onChanged(); setEditing(false); }} />
      ) : !hasRules(r) ? (
        <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{t("item.rulesSoon")}</p>
      ) : (
        <div className="mt-3 grid [&>*]:min-w-0 gap-4">
          {r.specs?.length ? (
            <dl className="grid grid-cols-1 border-t border-[var(--border-faint)] sm:grid-cols-[180px_minmax(0,1fr)]">
              {r.specs.map((p, i) => (
                <div key={i} className="contents">
                  <dt className="border-b border-[var(--border-faint)] py-2 pe-3 text-[12px] font-semibold text-[var(--text-secondary)]">{p.k}</dt>
                  <dd dir="auto" className="m-0 border-b border-[var(--border-faint)] py-2 text-[12.5px] leading-5 text-[var(--text-primary)]">{p.v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {r.logo ? <Block title={t("rules.logo")}>{r.logo}</Block> : null}
          {r.do?.length || r.dont?.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {r.do?.length ? <List title={t("rules.do")} items={r.do} mark="✓" tone="text-[var(--text-primary)]" /> : null}
              {r.dont?.length ? <List title={t("rules.dont")} items={r.dont} mark="✕" tone="text-red-500" /> : null}
            </div>
          ) : null}
          {r.vendor ? <Block title={t("rules.vendor")} boxed>{r.vendor}</Block> : null}
          {r.templates?.length || r.book?.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {r.templates?.map((id) => (
                <Link key={id} href={`/brand-center/templates/${id}`} className="rounded-lg bg-[var(--bg-inverted)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--text-inverted)]">
                  {t("rules.fill")}: {t(RULE_TEMPLATES[id] ?? id)}
                </Link>
              ))}
              {r.book?.map((n) => {
                const ch = chapterByNumber(n);
                if (!ch) return null;
                const label = `${t("rules.chapter")} ${n} · ${ch.title.en}`;
                return ch.ready
                  ? <Link key={n} href={chapterHref(ch.slug)} className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{label}</Link>
                  : <span key={n} className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11.5px] text-[var(--text-dim)]">{label}</span>;
              })}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Block({ title, children, boxed }: { title: string; children: string; boxed?: boolean }) {
  return (
    <div className={boxed ? "rounded-xl border border-[var(--border-subtle)] px-3 py-2.5" : ""}>
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{title}</h3>
      <p dir="auto" className="mt-1 whitespace-pre-line text-[12.5px] leading-6 text-[var(--text-primary)]">{children}</p>
    </div>
  );
}

function List({ title, items, mark, tone }: { title: string; items: string[]; mark: string; tone: string }) {
  return (
    <div>
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{title}</h3>
      <ul className="mt-1 grid [&>*]:min-w-0 gap-1">
        {items.map((x, i) => (
          <li key={i} dir="auto" className="flex gap-2 text-[12.5px] leading-5 text-[var(--text-primary)]">
            <span aria-hidden className={`shrink-0 font-semibold ${tone}`}>{mark}</span>
            <span className="min-w-0">{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* The owner's editor: plain text, a line per entry. */
const specsText = (r: Rules) => (r.specs ?? []).map((p) => `${p.k}: ${p.v}`).join("\n");
const listText = (x?: string[]) => (x ?? []).join("\n");
const toLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function RulesEditor({ t, itemId, rules, onDone }: { t: T; itemId: string; rules: Rules; onDone: (saved: boolean) => Promise<void> }) {
  const [specs, setSpecs] = useState(specsText(rules));
  const [logo, setLogo] = useState(rules.logo ?? "");
  const [does, setDoes] = useState(listText(rules.do));
  const [donts, setDonts] = useState(listText(rules.dont));
  const [vendor, setVendor] = useState(rules.vendor ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setBusy(true); setFailed(false);
    const next: Rules = {
      ...rules,
      specs: toLines(specs).map((l) => { const i = l.indexOf(":"); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: "·", v: l }; }),
      logo: logo.trim(), do: toLines(does), dont: toLines(donts), vendor: vendor.trim(),
    };
    const res = await bc.editItem(itemId, { rules: next });
    setBusy(false);
    if (!res.ok) { setFailed(true); return; }
    await onDone(true);
  };
  const area = (id: string, label: string, value: string, set: (v: string) => void, rows: number, hint?: string) => (
    <label htmlFor={id} className="block text-[12px] text-[var(--text-secondary)]">{label}
      {hint ? <span className="ms-1 text-[11px] text-[var(--text-dim)]">{hint}</span> : null}
      <textarea id={id} dir="auto" rows={rows} value={value} onChange={(e) => set(e.target.value)} className={`${FIELD} mt-1 resize-y font-mono !text-[12px]`} />
    </label>
  );
  return (
    <div className="mt-3 grid gap-3">
      {area("bc-rules-specs", t("rules.specs"), specs, setSpecs, 8, t("rules.specsHint"))}
      {area("bc-rules-logo", t("rules.logo"), logo, setLogo, 3)}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {area("bc-rules-do", t("rules.do"), does, setDoes, 5, t("rules.lineHint"))}
        {area("bc-rules-dont", t("rules.dont"), donts, setDonts, 5, t("rules.lineHint"))}
      </div>
      {area("bc-rules-vendor", t("rules.vendor"), vendor, setVendor, 4)}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">{t(busy ? "saving" : "rules.save")}</button>
        <button type="button" disabled={busy} onClick={() => void onDone(false)} className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-[12.5px] text-[var(--text-secondary)]">{t("item.cancel")}</button>
        {failed ? <span role="alert" className="text-[12px] text-red-500">{t("save.error")}</span> : null}
      </div>
    </div>
  );
}
