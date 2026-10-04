/* ---------------------------------------------------------------------------
   notification-templates — a notification written ONCE, read in every
   language.

   Writers used to store one English sentence, and every Arabic or Chinese
   reader's bell sent it to the AI translator row by row: "…" while it
   waited, a machine's guess when it came, a model call per row per tenant.
   Now a writer also stores WHAT it said — `metadata.tpl = { k, p }`, a
   template key and its parameters — and the bell and Koleex Mail render it
   from the dictionary (translations/notif-templates.ts) in the reader's own
   language, instantly.

   Template syntax (the same in en / zh / ar; validate:notification-types
   checks that the three agree):
     {name}           a parameter, as given (a number, a D/M/Y date, a code)
     {name:free}      text a PERSON wrote (a task title, a reason): shown as
                      is, and the screen may auto-translate that piece alone
     {name:enum}      a code looked up as `enum.<enum>.<code>` (a status)
     [[ … ]]          an optional part, dropped when any parameter inside it
                      is missing
   A required parameter that is missing makes the whole render null, and the
   caller falls back to the stored English text — never a half-filled
   sentence.

   Keys: `<k>.s` is the subject (required), `<k>.b` the body (optional — a
   template without one keeps the row's stored body: a comment, a list of
   reports; that is data, and free text still reaches the reader through
   auto-translation).

   The stored subject/body stay the English render (prepareTpl), so search,
   push and any old client read exactly what the template says in English.
   Pure data + string work: imported by server writers and client renderers.
   --------------------------------------------------------------------------- */
import type { Lang } from "@/lib/i18n";
import { notifTemplatesT } from "@/lib/translations/notif-templates";

export type TplParams = Record<string, string | number | null | undefined>;

/** What a writer stores in `metadata.tpl`. */
export interface NotifTpl {
  k: string;
  p?: TplParams;
}

const TOKEN = /\[\[|\]\]|\{(\w+)(?::(\w+))?\}/g;

const present = (v: unknown) => v !== undefined && v !== null && v !== "";

function word(key: string, lang: Lang): string | null {
  const e = notifTemplatesT[key];
  if (!e) return null;
  return e[lang] || e.en || null;
}

/** A filled template, in pieces: plain text, and `free` pieces — a value the
 *  user wrote (a task title, a reason) that the screen may auto-translate
 *  on its own, while the sentence around it comes from the dictionary. */
export type TplPart = string | { free: string };

type Node = { text: string } | { name: string; mod?: string } | { opt: Node[] };

function parse(src: string): Node[] {
  const root: Node[] = [];
  const stack: Node[][] = [root];
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const cur = stack[stack.length - 1];
    if (m.index! > last) cur.push({ text: src.slice(last, m.index) });
    last = m.index! + m[0].length;
    if (m[0] === "[[") { const opt: Node[] = []; cur.push({ opt }); stack.push(opt); }
    else if (m[0] === "]]") { if (stack.length > 1) stack.pop(); }
    else cur.push({ name: m[1], mod: m[2] });
  }
  if (last < src.length) stack[stack.length - 1].push({ text: src.slice(last) });
  return root;
}

/** Render parsed nodes. null = a required value is missing (unless lenient,
 *  which writes "—"); an optional group with a missing value is dropped. */
function renderNodes(nodes: Node[], lang: Lang, params: TplParams, lenient: boolean): TplPart[] | null {
  const out: TplPart[] = [];
  for (const n of nodes) {
    if ("text" in n) { out.push(n.text); continue; }
    if ("opt" in n) { const inner = renderNodes(n.opt, lang, params, false); if (inner) out.push(...inner); continue; }
    const v = params[n.name];
    if (!present(v)) { if (!lenient) return null; out.push("—"); continue; }
    if (n.mod === "free") out.push({ free: String(v) });
    else if (n.mod) out.push(word(`enum.${n.mod}.${String(v)}`, lang) ?? String(v));
    else out.push(String(v));
  }
  return out;
}

/** One dictionary entry, in pieces. null when the key is unknown or a
 *  required value is missing. */
export function templateParts(key: string, lang: Lang, params: TplParams = {}): TplPart[] | null {
  const src = word(key, lang);
  return src === null ? null : renderNodes(parse(src), lang, params, false);
}

/** Pieces back to plain text (a push, a stored subject): free pieces as
 *  written. */
export const partsText = (parts: TplPart[]) => parts.map((x) => (typeof x === "string" ? x : x.free)).join("");
const join = partsText;

/** One dictionary entry, filled, as plain text. null when the key is unknown
 *  or a required value is missing — unless `lenient`, which writes "—" for
 *  it (the stored English must never be lost over one missing value). */
export function fillTemplate(key: string, lang: Lang, params: TplParams = {}, lenient = false): string | null {
  const src = word(key, lang);
  if (src === null) return null;
  const parts = renderNodes(parse(src), lang, params, lenient);
  return parts ? join(parts) : null;
}

/** A stored row's `metadata.tpl`, if it is one. */
export function readTpl(meta: unknown): NotifTpl | null {
  const tpl = (meta as { tpl?: unknown } | null | undefined)?.tpl as NotifTpl | undefined;
  if (!tpl || typeof tpl !== "object" || typeof tpl.k !== "string" || !tpl.k) return null;
  return { k: tpl.k, p: tpl.p && typeof tpl.p === "object" ? tpl.p : {} };
}

/** The row in `lang`, in pieces: `subject` always, `body` only when the
 *  template has one (undefined = show the row's stored body). null = not
 *  templated, or the template cannot be filled — show the stored text as
 *  before. */
export function renderNotification(meta: unknown, lang: Lang): { subject: TplPart[]; body?: TplPart[] } | null {
  const tpl = readTpl(meta);
  if (!tpl) return null;
  const subject = templateParts(`${tpl.k}.s`, lang, tpl.p);
  if (subject === null) return null;
  if (!notifTemplatesT[`${tpl.k}.b`]) return { subject };
  const body = templateParts(`${tpl.k}.b`, lang, tpl.p);
  return body === null ? { subject } : { subject, body };
}

/** What a writer stores: the English subject/body, and the template itself
 *  — or `tpl: null` when it does not fully render (an unknown key, a missing
 *  value). Then the row is stored as plain English and every reader falls
 *  back to it, exactly like a row written before templates: a notification
 *  is never lost, and never shown half-filled. */
export function prepareTpl(tpl: NotifTpl): { subject: string; body: string | null; tpl: NotifTpl | null } {
  const p = tpl.p ?? {};
  const strictSubject = fillTemplate(`${tpl.k}.s`, "en", p);
  const hasBody = !!notifTemplatesT[`${tpl.k}.b`];
  const strictBody = hasBody ? fillTemplate(`${tpl.k}.b`, "en", p) : null;
  const ok = strictSubject !== null && (!hasBody || strictBody !== null);
  if (!ok) console.error(`[notification-templates] ${tpl.k} did not render — stored as plain English`);
  return {
    subject: strictSubject ?? fillTemplate(`${tpl.k}.s`, "en", p, true) ?? tpl.k,
    body: hasBody ? strictBody ?? fillTemplate(`${tpl.k}.b`, "en", p, true) : null,
    tpl: ok ? { k: tpl.k, p } : null,
  };
}
