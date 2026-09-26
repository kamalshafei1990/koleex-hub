/* validate:notification-types — the notification registry tells the truth.

   src/lib/notification-types.ts is the one place a notification type is
   defined (its app, its Settings switch, its weight, its lifecycle). This
   guard keeps it from drifting from the code that actually sends:

     A  every entry is well-formed: a real APP_REGISTRY app, a switch or a
        written reason for having none, a note on every lifecycle gap
     B  every entry's switch equals what the pre-registry substring rules
        returned — adopting the registry moved no one's mute or chime. A
        deliberate change goes in RECLASSIFIED with its reason.
     C  every type a writer emits is registered (a new writer cannot ship an
        unregistered type — it would land under "Other", unmutable)
     D  every registered type has a live emitter (the owner's rule: no switch,
        no key, without something real behind it)
     E  every declared lifecycle is backed by code: a clear/supersede key is
        passed to a lifecycle verb somewhere, a settle list is settled
     F  the open lifecycle gaps are counted, so their closing is visible
     G  the templates (translations/notif-templates): every entry in en, zh
        and ar with the same placeholders; every key a writer stores exists;
        no template without a writer; every type has one (or a reason)
     H  the template travels: a push sent beside a templated row carries it
        (so it is written in the reader's language), and a notifyLite call
        with a template never also hand-writes the subject
     I  every date a notification shows is D/M/Y: date parameters are made by
        a day-first formatter (each one proven), the surfaces never format by
        locale, and no template writes a date of its own
     J  the words name the app, never a path: no template, parameter or
        hand-written subject / push title carries a route
     K  every link a writer stores opens a page that exists in src/app
     L  the bell stays light: the header's Gate reaches the open bell only
        through import(), and the bell reads the slim, capped feed
        (its built weight is measured by validate:budgets §L)
     M  each Home tile shows its app's unread notifications — counted through
        the registry (security left out), published by the Gate with the
        count it already reads; Discuss, To-do, Projects and Planning keep
        their own numbers; Home asks again only when the count moved alone
     N  the installed app's icon carries the bell's number: set by the Gate and
        the bell (never during view-as), cleared at sign-out, carried by every
        push as the recipient's own count and painted by the service worker
     O  a device's push belongs to whoever is signed in: sign-out releases it
        before the session is revoked (bounded), every signed-in open and the
        settings card re-save an EXISTING subscription for the current account
        — never a prompt, never a new subscription

   The registry is READ AS TEXT, not imported, so the mutation harness can
   hand this guard an edited copy without touching the real file (the tree is
   shared). Comments are stripped with scripts/lib/strip-comments.ts. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";
import { classifyBySubstring } from "../src/lib/notification-activity";
import { notifTemplatesT } from "../src/lib/translations/notif-templates";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p: string) => path.join(ROOT, p);
const REGISTRY = "src/lib/notification-types.ts";
let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

/* ── the registry, parsed ───────────────────────────────────────────── */
const regSrc = stripComments(fs.readFileSync(R(REGISTRY), "utf8"));
const block = regSrc.slice(regSrc.indexOf("export const NOTIFICATION_TYPES"), regSrc.indexOf("} as const satisfies"));
/* Any key at the object's first level starts an entry — so an entry split
   over several lines is reported as unparseable, never silently skipped. */
const ENTRY_START = /^ {2}["']?([A-Za-z][\w-]*)["']?\s*:/;
const ENTRY = /^\s+([a-z][a-z0-9_]*):\s*\{\s*app:\s*"([a-z-]+)",\s*activity:\s*(null|"([a-z_]+)")(?:,\s*activityNote:\s*(SA_CRITICAL|"[^"]+"))?,\s*severity:\s*"(info|action|warning|critical)",\s*lifecycle:\s*([A-Za-z]\w*|\{[^{}]*\})\s*\},?\s*$/;
/* Shared lifecycles (`const qaOpen = { … } as const;`) resolve to their text. */
const SHARED = new Map([...regSrc.matchAll(/^const ([A-Za-z]\w*) = (\{[^{}]*\}) as const;/gm)].map((m) => [m[1], m[2]]));
type Entry = { app: string; activity: string | null; note: string | null; lifecycle: string };
const entries = new Map<string, Entry>();
const unparsed: string[] = [];
for (const line of block.split("\n")) {
  if (!ENTRY_START.test(line)) continue;
  const m = ENTRY.exec(line);
  if (!m) { unparsed.push(line.trim().slice(0, 60)); continue; }
  const lifecycle = m[7].startsWith("{") ? m[7] : SHARED.get(m[7]);
  if (!lifecycle) { unparsed.push(`${m[1]}: unknown lifecycle ${m[7]}`); continue; }
  entries.set(m[1], { app: m[2], activity: m[4] ?? null, note: m[5] ?? null, lifecycle });
}

console.log("\nA. every entry is well-formed");
check("the registry parses — one entry per line, none skipped", unparsed.length === 0 && entries.size > 0,
  unparsed.length ? `unparseable: ${unparsed.join(" | ")}` : "no entries found");
const nav = fs.readFileSync(R("src/lib/navigation.ts"), "utf8");
const appIds = new Set([...nav.matchAll(/\{\s*id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]));
const badApp = [...entries].filter(([, e]) => !appIds.has(e.app)).map(([t, e]) => `${t}→${e.app}`);
check("every app is a real APP_REGISTRY id", badApp.length === 0, badApp.join(", "));
const silentNull = [...entries].filter(([, e]) => e.activity === null && !e.note).map(([t]) => t);
check("every type without a switch says why (activityNote)", silentNull.length === 0, silentNull.join(", "));
const bareGap = [...entries].filter(([, e]) => /kind:\s*"gap"/.test(e.lifecycle) && !/note:\s*"[^"]+"/.test(e.lifecycle)).map(([t]) => t);
check("every lifecycle gap says what it should become", bareGap.length === 0, bareGap.join(", "));

/* ── B: same switch as the legacy rules ─────────────────────────────── */
console.log("\nB. the registry kept every mute and chime where it was");
/* A deliberate reclassification is listed here with its reason, never made
   silently in the registry. Empty on purpose: C1 moved nothing. */
const RECLASSIFIED: Record<string, string> = {};
const moved = [...entries]
  .filter(([t, e]) => !(t in RECLASSIFIED) && classifyBySubstring(t) !== e.activity)
  .map(([t, e]) => `${t}: registry ${e.activity} ≠ legacy ${classifyBySubstring(t)}`);
check("each registered switch equals the legacy classifier's", moved.length === 0, moved.join("; "));

/* ── C / D: the registry against the writers ────────────────────────── */
const files: string[] = [];
const walk = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
};
walk(R("src"));
const WRITER = /notifyLite\(|notifySuperAdmins\(|notifyIssue\(|sendPushToAccounts\(|from\("inbox_messages"\)\s*\.insert|from\(INBOX\)\s*\.insert|\bdeliver\(\{/;
/* Literals the patterns below pick up in writer files that are NOT a
   notification's type — each with the reason, so the list cannot hide one. */
const NOT_A_TYPE: Record<string, string> = {
  absent: "reports/events: an attendance FACT kind inside a report prompt",
  late: "reports/events: an attendance FACT kind inside a report prompt",
  collect: "finance reminder ROW type (collect | pay), not the notification",
  customer: "Discuss channel kind (a column), not a notification",
  request: "attendance record kind (a column), not a notification",
  evidence_added: "metadata sub-kind on a qa_status_changed row — type wins over kind",
  mention: "todo-notify's `kind` PARAMETER union — emitted as todo_mention",
  rescheduled: "calendar-notify's `kind` PARAMETER union — emitted as calendar_rescheduled",
};
/* Template emitters and every value their hole can take. A new template
   fails until it is listed here with its expansions registered. */
const TEMPLATES: Record<string, string[]> = {
  "transfer_${next}": ["transfer_approved", "transfer_cancelled"],
  "calendar_rsvp_${verb}": ["calendar_rsvp_accepted", "calendar_rsvp_declined"],
  "todo_${kind}": ["todo_mention", "todo_observer"],
};
const emitted = new Map<string, Set<string>>();
const unknownTemplates: string[] = [];
const add = (t: string, f: string) => { if (!emitted.has(t)) emitted.set(t, new Set()); emitted.get(t)!.add(f); };
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (rel === REGISTRY || /inbox-lifecycle\.ts$/.test(rel)) continue;
  const src = stripComments(fs.readFileSync(f, "utf8"));
  if (!WRITER.test(src)) continue;
  for (const m of src.matchAll(/\b(?:type|kind)\s*:\s*"([a-z][a-z0-9_]*)"/g)) add(m[1], rel);
  for (const m of src.matchAll(/\b(?:type|kind)\s*[:=]\s*[^,;\n{}]*?\?\s*"([a-z][a-z0-9_]*)"(?:\s+as const)?\s*:\s*"([a-z][a-z0-9_]*)"/g)) { add(m[1], rel); add(m[2], rel); }
  for (const m of src.matchAll(/\b(?:type|kind)\s*:\s*`([^`]*\$\{[^`]*)`/g)) {
    if (TEMPLATES[m[1]]) for (const t of TEMPLATES[m[1]]) add(t, rel);
    else unknownTemplates.push(`\`${m[1]}\` in ${rel}`);
  }
  /* audit.ts derives the Super-Admin kind from the action name. */
  const fn = src.indexOf("function alertKindForAction");
  if (fn >= 0) {
    const body = src.slice(fn, src.indexOf("\n}", fn));
    for (const m of body.matchAll(/return\s+"([a-z][a-z0-9_]*)"/g)) add(m[1], rel);
  }
}
console.log("\nC. every type a writer emits is registered");
check("no unlisted template emitter", unknownTemplates.length === 0, unknownTemplates.join("; "));
const unregistered = [...emitted.keys()].filter((t) => !entries.has(t) && !(t in NOT_A_TYPE))
  .map((t) => `${t} (${[...emitted.get(t)!].join(", ")})`);
check("every emitted type is in the registry", unregistered.length === 0, unregistered.join("; "));
const staleIgnore = Object.keys(NOT_A_TYPE).filter((t) => !emitted.has(t));
check("every NOT_A_TYPE exception still occurs (no stale excuses)", staleIgnore.length === 0, staleIgnore.join(", "));

console.log("\nD. every registered type has a live emitter");
/* A quoted occurrence outside the registry and outside type-union lines
   counts: ternaries, returns and tables all emit. A union member alone does
   not — declaring a type is not sending it. */
const quoted = new Set<string>();
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (rel === REGISTRY || /translations\/|notification-activity\.ts$|notificationSound\.ts$/.test(rel)) continue;
  for (const line of stripComments(fs.readFileSync(f, "utf8")).split("\n")) {
    if (/^\s*\|\s*"/.test(line)) continue;
    for (const m of line.matchAll(/"([a-z][a-z0-9_]*)"/g)) quoted.add(m[1]);
  }
}
for (const exp of Object.values(TEMPLATES)) for (const t of exp) quoted.add(t);
const dead = [...entries.keys()].filter((t) => !quoted.has(t));
check("no registered type without an emitter", dead.length === 0, dead.join(", "));

/* ── E: every declared lifecycle has code behind it ─────────────────── */
console.log("\nE. every declared lifecycle is backed by code");
/* The files that call a lifecycle verb (or hand notifyLite a `supersede`),
   and the property / string tokens they use. A declared key found nowhere
   among them is a lifecycle that exists only on paper. */
const VERB = /\b(?:supersedeUnread|clearUnreadByMeta|clearUnreadByMetaIn|settleListedItems)\(|\bsupersede:\s*[{\w]/;
const verbTokens = new Set<string>();
const settledLists = new Set<string>();
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (rel === REGISTRY) continue;
  const src = stripComments(fs.readFileSync(f, "utf8"));
  if (!VERB.test(src)) continue;
  for (const m of src.matchAll(/\b([a-z][a-z0-9_]*)\s*:|"([a-z][a-z0-9_]*)"/g)) verbTokens.add(m[1] ?? m[2]);
  for (const m of src.matchAll(/settleListedItems\(\{[^}]*?listKey:\s*"([a-z_]+)"/g)) settledLists.add(m[1]);
}
/* "subject" is supersedeUnread's own `subject` filter; "type" is always
   carried in the metadata the verbs match on. */
const unbacked: string[] = [];
for (const [t, e] of entries) {
  const kind = /kind:\s*"(\w[\w-]*)"/.exec(e.lifecycle)?.[1];
  if (kind === "clear" || kind === "supersede") {
    const key = /key:\s*"([^"]+)"/.exec(e.lifecycle)?.[1] ?? "";
    for (const k of key.split("+")) if (!verbTokens.has(k)) unbacked.push(`${t}: ${kind} key "${k}"`);
  } else if (kind === "settle") {
    const list = /list:\s*"([^"]+)"/.exec(e.lifecycle)?.[1] ?? "";
    if (!settledLists.has(list)) unbacked.push(`${t}: settle list "${list}"`);
  }
}
check("every clear / supersede key and settle list reaches a lifecycle verb", unbacked.length === 0, unbacked.join("; "));

/* ── F: the open gaps ───────────────────────────────────────────────── */
const gaps = [...entries].filter(([, e]) => /kind:\s*"gap"/.test(e.lifecycle)).map(([t]) => t);
console.log(`\nF. open lifecycle gaps: ${gaps.length} of ${entries.size} types`);
for (const g of gaps) console.log(`  · ${g}`);

/* ── G: the templates ───────────────────────────────────────────────── */
console.log("\nG. every notification reads in en, zh and ar");
const LANGS = ["en", "zh", "ar"] as const;
const shape = (text: string) => {
  const ph = [...text.matchAll(/\{(\w+)(?::(\w+))?\}/g)].map((m) => `${m[1]}${m[2] ? `:${m[2]}` : ""}`).sort().join(",");
  return `${ph}|${(text.match(/\[\[/g) ?? []).length}/${(text.match(/\]\]/g) ?? []).length}`;
};
const tplKeys = Object.keys(notifTemplatesT);
const badLang: string[] = [];
const badShape: string[] = [];
const enumsUsed = new Set<string>();
for (const key of tplKeys) {
  const e = notifTemplatesT[key] as Record<string, string | undefined>;
  const missing = LANGS.filter((l) => !e[l] || !e[l]!.trim());
  if (missing.length) { badLang.push(`${key} (${missing.join("/")})`); continue; }
  const en = shape(e.en!);
  const [open, close] = en.split("|")[1].split("/");
  if (open !== close) badShape.push(`${key}: unbalanced [[ ]]`);
  for (const l of ["zh", "ar"] as const) if (shape(e[l]!) !== en) badShape.push(`${key} ${l}: ${shape(e[l]!)} ≠ en ${en}`);
  for (const m of e.en!.matchAll(/\{\w+:(\w+)\}/g)) if (m[1] !== "free") enumsUsed.add(m[1]);
}
check("every template entry has en, zh and ar", badLang.length === 0, badLang.join("; "));
check("zh and ar carry exactly the placeholders and [[optional]] parts of en", badShape.length === 0, badShape.join("; "));
const noEnum = [...enumsUsed].filter((en) => !tplKeys.some((k) => k.startsWith(`enum.${en}.`)));
check("every {x:enum} placeholder has its enum.<name>.* words", noEnum.length === 0, noEnum.join(", "));

/* Keys writers store: `k: "…"` in any file that builds a template. */
const usedK = new Map<string, string>();
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (/translations\/notif-templates|notification-templates\.ts$/.test(rel)) continue;
  const src = stripComments(fs.readFileSync(f, "utf8"));
  if (!/\btpl\b|prepareTpl\(/.test(src)) continue;
  for (const m of src.matchAll(/\bk:\s*"([a-z][\w.]*)"/g)) usedK.set(m[1], rel);
}
const tplOf = new Set(tplKeys.filter((k) => /\.(s|b)$/.test(k)).map((k) => k.replace(/\.(s|b)$/, "")));
const unknownK = [...usedK].filter(([k]) => !notifTemplatesT[`${k}.s`]).map(([k, f]) => `${k} (${f})`);
check("every template a writer stores exists (<k>.s)", unknownK.length === 0, unknownK.join("; "));
const bodyOnly = [...tplOf].filter((k) => !notifTemplatesT[`${k}.s`]);
check("every body template has its subject", bodyOnly.length === 0, bodyOnly.join(", "));
const deadTpl = [...tplOf].filter((k) => !usedK.has(k));
check("no template without a writer", deadTpl.length === 0, deadTpl.join(", "));
/* Types that deliberately have no template, each with its reason. */
const NO_TEMPLATE: Record<string, string> = {
  ai_brief: "written in the reader's own language already — briefText(counts, lang)",
  discuss_message: "push-only: never an inbox row",
  test: "push-only: the user's own test push",
};
const staleNoTpl = Object.keys(NO_TEMPLATE).filter((t) => !entries.has(t));
check("every NO_TEMPLATE exception is a registered type", staleNoTpl.length === 0, staleNoTpl.join(", "));
const untemplated = [...entries.keys()].filter((t) => !(t in NO_TEMPLATE) && ![...usedK.keys()].some((k) => k === t || k.startsWith(`${t}.`)));
check("every registered type has a template (or a NO_TEMPLATE reason)", untemplated.length === 0, `${untemplated.length}: ${untemplated.join(", ")}`);

/* ── H: the template travels with the push ──────────────────────────── */
console.log("\nH. a templated notification's push is templated too");
/* The argument text of every `name(` call, balanced on parentheses. */
const callArgs = (src: string, name: string): string[] => {
  const out: string[] = [];
  for (const m of src.matchAll(new RegExp(`\\b${name}\\(`, "g"))) {
    let depth = 0, i = m.index! + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    out.push(src.slice(m.index! + m[0].length, i));
  }
  return out;
};
const untemplatedPush: string[] = [];
const doubleSubject: string[] = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (/lib\/server\/web-push\.ts$/.test(rel)) continue;
  const src = stripComments(fs.readFileSync(f, "utf8"));
  if (!/prepareTpl\(|\btpl:/.test(src)) continue;
  for (const a of callArgs(src, "sendPushToAccounts")) if (!/\btpl\b/.test(a)) untemplatedPush.push(`${rel}: sendPushToAccounts(${a.replace(/\s+/g, " ").slice(0, 50)}…`);
  for (const a of callArgs(src, "notifyLite")) {
    /* Only the options object's OWN keys: a template parameter may well be
       named `subject` (p: { subject: … }) — that is not a hand-written one. */
    let depth = 0, top = "";
    for (const ch of a) {
      if (ch === "{" || ch === "(" || ch === "[") depth++;
      else if (ch === "}" || ch === ")" || ch === "]") depth--;
      else if (depth === 1) top += ch;
    }
    if (/\btpl:/.test(top) && /\bsubject:/.test(top)) doubleSubject.push(rel);
  }
}
check("every push beside a templated row passes its tpl", untemplatedPush.length === 0, untemplatedPush.join("; "));
check("no notifyLite call has both a template and a hand-written subject", doubleSubject.length === 0, doubleSubject.join(", "));

/* ── shared: the notification writers and their template parameters ─── */
const writerFiles = files.filter((f) => {
  const rel = path.relative(ROOT, f);
  if (rel === REGISTRY || /translations\/notif-templates|notification-templates\.ts$/.test(rel)) return false;
  return WRITER.test(stripComments(fs.readFileSync(f, "utf8")));
});
/* The text between a `{`, `(` or `[` at `open` and its match. */
const balanced = (src: string, open: number): string => {
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if ("{([".includes(src[i])) depth++;
    else if ("})]".includes(src[i]) && --depth === 0) break;
  }
  return src.slice(open + 1, i);
};
/* The top-level `key: value` pairs of an object body (shorthand `key` → value = key). */
const pairs = (body: string): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  let depth = 0, cur = "";
  const flush = () => {
    const t = cur.trim(); cur = "";
    if (!t || t.startsWith("...")) return;
    const m = t.match(/^["']?(\w+)["']?\s*:\s*([\s\S]+)$/);
    if (m) out.push([m[1], m[2].trim()]);
    else if (/^\w+$/.test(t)) out.push([t, t]);
  };
  let quote = "";
  for (const ch of body) {
    if (quote) { cur += ch; if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; cur += ch; continue; }
    if ("{([".includes(ch)) depth++;
    else if ("})]".includes(ch)) depth--;
    if (ch === "," && depth === 0) flush(); else cur += ch;
  }
  flush();
  return out;
};
/* Every template parameter object a writer builds: `p: { … }` inside a tpl,
   or a `const p = { … }` handed to one. */
const tplParams: Array<{ rel: string; src: string; at: number; key: string; value: string }> = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (/translations\/notif-templates|notification-templates\.ts$/.test(rel)) continue;
  const src = stripComments(fs.readFileSync(f, "utf8"));
  if (!/\btpl\b|prepareTpl\(/.test(src)) continue;
  for (const m of src.matchAll(/(?:\bp:\s*|\bconst p\s*=\s*)\{/g)) {
    for (const [key, value] of pairs(balanced(src, m.index! + m[0].length - 1))) tplParams.push({ rel, src, at: m.index!, key, value });
  }
}

/* ── I: every date a notification shows reads day first ─────────────── */
console.log("\nI. every date a notification shows reads D/M/Y");
/* The owner's rule (dates are D/M/Y, everywhere). The audit found three
   formats in one bell — 9/18/2026 from toLocaleDateString, "Sep 18" on the
   page, 2026-09-20 inside the text — and not one of them day first. */
const DATE_KEYS = new Set(["date", "day", "due", "from", "to", "when", "until", "deadline", "expires"]);
/* A date parameter is made by a day-first formatter, each proven below. */
const DMY_MAKERS = /\bdmyDate\(|\bfmt\(|\bformatWhen\(|\bw\.when\b|\bspan\(/;
/* Values that pass for a reason other than their own text. */
const DATE_OK: Record<string, string> = {
  "src/app/api/hr/attendance/overtime/route.ts date: only.date": "Decided.date, built with dmyDate(x.rec.date) where the day is decided",
};
/* `to` and `from` are also words for a status move ("from draft to sent"):
   a value that is the transition's status, not a date, is not one. */
const NOT_A_DATE = /^(to|from|next|prev|nextStatus|prevStatus)$/;
const rawDates: string[] = [];
for (const { rel, src, at, key, value } of tplParams) {
  if (!DATE_KEYS.has(key)) continue;
  const where = `${rel} ${key}: ${value.replace(/\s+/g, " ").slice(0, 60)}`;
  if (DATE_OK[`${rel} ${key}: ${value}`]) continue;
  if (DMY_MAKERS.test(value)) continue;
  /* A bare name is fine when that name was made by a formatter in this file. */
  if (/^\w+$/.test(value)) {
    if (NOT_A_DATE.test(value) && !new RegExp(`\\b(?:const|let)\\s+${value}\\s*=\\s*[^;\\n]*(?:date|_at|Date)\\b`).test(src)) continue;
    /* The assignment nearest before the use — a file may reuse the name. */
    const made = [...src.slice(0, at).matchAll(new RegExp(`\\b(?:const|let)\\s+${value}\\s*=\\s*([^;\\n]+)`, "g"))].pop();
    if (made && DMY_MAKERS.test(made[1])) continue;
  }
  rawDates.push(where);
}
check("every date parameter a writer stores is made by a day-first formatter", rawDates.length === 0, rawDates.join("; "));
/* …and each formatter really is day first. */
const fileSrc = (rel: string) => stripComments(fs.readFileSync(R(rel), "utf8"));
const dmyBody = fileSrc("src/lib/work-reports.ts").match(/export function dmyDate\([\s\S]*?\n\}/)?.[0] ?? "";
const planningFmt = fileSrc("src/lib/server/planning-notify.ts").match(/const fmt = [\s\S]*?\n\};/)?.[0] ?? "";
const calendarWhen = fileSrc("src/lib/server/calendar-notify.ts").match(/function whenParts[\s\S]*?\n\}/)?.[0] ?? "";
const formatterOk = [
  ["work-reports dmyDate", /`\$\{m\[3\]\}\/\$\{m\[2\]\}\/\$\{m\[1\]\}`/.test(dmyBody) && /getDate\(\)[^`]*\/\$\{[^`]*getMonth\(\)/.test(dmyBody)],
  ["planning-notify fmt", /getUTCDate\(\)\)\}\/\$\{p\(d\.getUTCMonth\(\)/.test(planningFmt)],
  ["calendar-notify whenParts", /"en-GB"/.test(calendarWhen) && /reverse\(\)\.join\("\/"\)/.test(calendarWhen)],
].filter(([, ok]) => !ok).map(([n]) => n);
check("each of those formatters writes the day first", formatterOk.length === 0, formatterOk.join(", "));
/* The surfaces that show a notification never format a date by locale. */
const SURFACES = [
  "src/components/layout/NotificationBell.tsx",
  "src/components/layout/NotificationBellGate.tsx",
  "src/components/layout/NotificationList.tsx",
  "src/components/layout/NotificationText.tsx",
  "src/lib/notification-view.ts",
  "src/app/inbox/page.tsx",
];
const localeDates = SURFACES.filter((f) => /toLocaleDateString|toLocaleTimeString|toLocaleString\(|toDateString\(|Intl\.DateTimeFormat/.test(fileSrc(f)));
check("the bell and the center never format a date by the browser's locale", localeDates.length === 0, localeDates.join(", "));
/* Rows stored before the templates keep their writers' ISO dates; the
   screen shows them day first — the subject and the body both. */
const nt = fileSrc("src/components/layout/NotificationText.tsx");
const disp = fileSrc("src/lib/inbox-display.ts");
check("old rows' stored dates show day first (subject and body)",
  /text=\{cleanInboxSubject\(subject\)\}/.test(nt) && /text=\{cleanInboxBody\(body\)\}/.test(nt)
  && /"\$3\/\$2\/\$1"/.test(disp) && /export function cleanInboxBody[\s\S]*?dayFirst\(/.test(disp));
/* No template writes a date shape of its own. */
const tplDates = tplKeys.filter((k) => LANGS.some((l) => /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test((notifTemplatesT[k] as Record<string, string>)[l] ?? "")));
check("no template carries a written-out date", tplDates.length === 0, tplDates.join(", "));

/* ── J: no technical path in the words ──────────────────────────────── */
console.log("\nJ. a notification names the app, never its path");
/* The audit found "In Product Data (/product-data)". A route is for the
   link, which the row carries; the words say the app's name. */
const PATHISH = /(^|[\s(（"“])\/(?:api\/)?[a-z][\w-]*(?:\/[\w\-[\]]*)*(?=$|[\s).,）"”;:])/;
const pathTpl = tplKeys.filter((k) => LANGS.some((l) => PATHISH.test((notifTemplatesT[k] as Record<string, string>)[l] ?? "")));
check("no template shows a path", pathTpl.length === 0, pathTpl.join(", "));
const routeHoles = tplKeys.filter((k) => /\{(?:route|path|pathname|href)(?::\w+)?\}/.test((notifTemplatesT[k] as Record<string, string>).en ?? ""));
check("no template has a hole for a route", routeHoles.length === 0, routeHoles.join(", "));
const routeParams = tplParams.filter(({ key, value }) =>
  /^(route|path|pathname|href)$/.test(key) || /^["'`]\/[a-z]/.test(value) || /\bpathname\b|\.route\b/.test(value) && !/moduleForRoute/.test(value));
check("no writer hands a route to a template", routeParams.length === 0, routeParams.map(({ rel, key, value }) => `${rel} ${key}: ${value.slice(0, 40)}`).join("; "));
/* Words written without a template (push titles, digest bodies) too. */
const pathWords: string[] = [];
for (const f of writerFiles) {
  const rel = path.relative(ROOT, f);
  const src = stripComments(fs.readFileSync(f, "utf8"));
  for (const m of src.matchAll(/\b(subject|body|title)\s*:\s*(`[^`]*`|"[^"]*")/g)) {
    const text = m[2].slice(1, -1).replace(/\$\{[^}]*\}/g, "x");
    if (PATHISH.test(text)) pathWords.push(`${rel} ${m[1]}: ${m[2].slice(0, 50)}`);
  }
}
check("no hand-written subject, body or push title shows a path", pathWords.length === 0, pathWords.join("; "));

const resolveImport = (from: string, spec: string): string | null => {
  const base = spec.startsWith("@/") ? R(`src/${spec.slice(2)}`) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
};

/* ── K: every link opens a real screen ──────────────────────────────── */
console.log("\nK. every notification's link opens a screen that exists");
const APP = R("src/app");
const isPage = (d: string) => ["page.tsx", "page.ts"].some((p) => fs.existsSync(path.join(d, p)));
const routeExists = (dir: string, segs: string[]): boolean => {
  const dirs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const g of dirs.filter((n) => /^\(.*\)$/.test(n))) if (routeExists(path.join(dir, g), segs)) return true;
  if (segs.length === 0) {
    const opt = dirs.find((n) => /^\[\[\.\.\.\w+\]\]$/.test(n));
    return isPage(dir) || (!!opt && isPage(path.join(dir, opt)));
  }
  const [seg, ...rest] = segs;
  if (dirs.includes(seg) && routeExists(path.join(dir, seg), rest)) return true;
  const dyn = dirs.find((n) => /^\[\w+\]$/.test(n));
  if (dyn && seg === "*" && routeExists(path.join(dir, dyn), rest)) return true;
  if (dyn && !dirs.includes(seg) && routeExists(path.join(dir, dyn), rest)) return true;
  const all = dirs.find((n) => /^\[\[?\.\.\.\w+\]\]?$/.test(n));
  return !!all && isPage(path.join(dir, all));
};
/* Each literal path a link can take: the literals inside a `link:` / `url:`
   value, and inside the body of any *Link helper that value calls. */
/* A helper is looked up where the call can see it: defined in the same file,
   else in the module it is imported from — never by name across the tree. */
const helperIn = (file: string, name: string): string[] | null => {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const def = new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=)`).exec(src);
  if (!def) return null;
  /* The helper's body: to the end of its statement (arrow) or its block. */
  const from = def.index;
  const brace = src.indexOf("{", from);
  const semi = src.indexOf(";\n", from);
  const body = brace >= 0 && (semi < 0 || brace < semi) && /function/.test(def[0])
    ? balanced(src, brace)
    : src.slice(from, semi < 0 ? from + 400 : semi);
  return [...body.matchAll(/(["'`])(\/[a-z][^"'`]*)\1/g)].map((x) => x[2]);
};
const helperPathsFor = (file: string, name: string): string[] => {
  const own = helperIn(file, name);
  if (own) return own;
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const imp = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`).exec(src);
  const target = imp ? resolveImport(file, imp[1]) : null;
  return target ? helperIn(target, name) ?? [] : [];
};
const linkPaths: Array<{ rel: string; p: string }> = [];
for (const f of writerFiles) {
  const rel = path.relative(ROOT, f);
  const src = stripComments(fs.readFileSync(f, "utf8"));
  for (const m of src.matchAll(/\b(?:link|url)\s*:\s*/g)) {
    /* The value runs to the next top-level comma / closing brace. */
    let depth = 0, i = m.index! + m[0].length, quote = "";
    const start = i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (quote) { if (ch === quote) quote = ""; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
      if ("{([".includes(ch)) depth++;
      else if ("})]".includes(ch)) { if (depth === 0) break; depth--; }
      else if ((ch === "," || ch === "\n") && depth === 0) break;
    }
    const value = src.slice(start, i);
    for (const x of value.matchAll(/(["'`])(\/[a-z][^"'`]*)\1/g)) linkPaths.push({ rel, p: x[2] });
    for (const x of value.matchAll(/\b(\w*[Ll]ink)\(/g)) for (const p of helperPathsFor(f, x[1])) linkPaths.push({ rel, p });
  }
}
const deadLinks = linkPaths.filter(({ p }) => {
  const pathOnly = p.split(/[?#]/)[0].replace(/\$\{[^}]*\}/g, "*");
  const segs = pathOnly.split("/").filter(Boolean);
  if (segs[0] === "api") return true;
  return !routeExists(APP, segs);
}).map(({ rel, p }) => `${p} (${rel})`);
check(`every link resolves to a page — ${new Set(linkPaths.map((l) => l.p)).size} distinct paths`, linkPaths.length > 20 && deadLinks.length === 0,
  deadLinks.length ? deadLinks.join("; ") : `only ${linkPaths.length} links found — the scan lost its way`);

/* ── L: the bell stays light ────────────────────────────────────────── */
console.log("\nL. the bell stays light");
/* The Gate rides the header on EVERY page. It may reach the bell only
   through import(): the list, its words, the templates and the decisions
   load the first time the bell is wanted, never with the page. (Measured on
   the build output by validate:budgets §J.) */
const HEAVY = /NotificationBell(?!Gate)\b|NotificationList|NotificationText|notif-ui|notif-templates|notification-templates|notification-decisions|notification-view|PushNudge|push-nudge/;
const eager = new Set<string>();
const leaks: string[] = [];
const visit = (f: string, via: string[]) => {
  if (eager.has(f)) return;
  eager.add(f);
  const src = stripComments(fs.readFileSync(f, "utf8"));
  for (const m of src.matchAll(/^\s*import\s+(?!type\b)(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm)) {
    const target = resolveImport(f, m[1]);
    if (!target) continue;
    const rel = path.relative(ROOT, target);
    if (HEAVY.test(rel)) leaks.push([...via, path.relative(ROOT, f), rel].map((x) => path.basename(x)).join(" → "));
    else visit(target, [...via, path.relative(ROOT, f)]);
  }
};
visit(R("src/components/layout/NotificationBellGate.tsx"), []);
check(`the header's Gate reaches no part of the open bell (${eager.size} files load with every page)`, leaks.length === 0, leaks.join("; "));
/* What the bell asks the server for: the slim rows, never avatars. */
const feed = fileSrc("src/app/api/inbox/feed/route.ts");
const slimProj = feed.match(/const projection: string = slim\s*\?\s*`([^`]*)`/)?.[1] ?? "";
check("the bell's rows are the slim projection — no avatar, no *", !!slimProj && !/avatar_url|\*/.test(slimProj), slimProj ? "" : "slim projection not found");
check("the feed never answers more than 300 rows", /Math\.min\(Number\(url\.searchParams\.get\("limit"\)\)\s*\|\|\s*\d+,\s*300\)/.test(feed));
/* A row's quick actions (read / archive) sit at the end of its second line
   in a slot kept for them, and the time stays in view: the owner saw them
   cut off a long title, then asked for the time to stay. */
const listSrc = fileSrc("src/components/layout/NotificationList.tsx");
const slot = listSrc.slice(listSrc.indexOf("function ActionSlot"), listSrc.indexOf("function RowActions"));
check("a row's quick actions sit in their own slot on the second line, the time always in view",
  [...listSrc.matchAll(/<RowActions\b/g)].length === 1 && /<RowActions\b/.test(slot)
  && /min-w-\[42px\]/.test(slot) && /\bh-4\b/.test(slot)
  && [...listSrc.matchAll(/<ActionSlot\b/g)].length === 2
  && /grid h-4 w-5/.test(listSrc) && !/absolute end-3 top-2/.test(listSrc)
  && !/group-hover\/row:invisible/.test(listSrc));
const bellSrc = fileSrc("src/components/layout/NotificationBell.tsx");
check("the bell asks for slim rows", /fetchInboxMessagesOrNull\(\{[^}]*slim:\s*true/.test(bellSrc));

/* ── M: each Home tile counts its own app's unread notifications ─────── */
console.log("\nM. the Home tiles count each app's unread notifications");
/* Owner, 26/09: a number on every app's tile. Four tiles already count
   something of their own and keep it — To-do's is open tasks on purpose
   (the owner, looking at 37 unread task MESSAGES: "I don't know this
   notifications for what"). The rest count the app's unread notifications,
   read from the registry, and cost no request of their own. */
const feedSrc = fileSrc("src/app/api/inbox/feed/route.ts");
const badgesCase = feedSrc.slice(feedSrc.indexOf('case "badges"'), feedSrc.indexOf("default:", feedSrc.indexOf('case "badges"')));
check("the badges reply counts unread per app through the registry, security left out",
  /notificationTypeDef\(r\.type \?\? r\.kind\)\?\.app/.test(badgesCase) && /app === "activity-monitor"/.test(badgesCase) && /byApp\s*\}/.test(badgesCase));
const gateSrc = fileSrc("src/components/layout/NotificationBellGate.tsx");
check("the Gate publishes the per-app numbers with the count it already reads",
  /publishInboxUnread\(accountId,\s*unreadInbox,\s*inbox\.data\?\.byApp/.test(gateSrc));
const homeSrc = fileSrc("src/app/page.tsx");
const own = homeSrc.match(/const OWN_TILE_NUMBER = new Set\(\[([^\]]*)\]\)/)?.[1].replace(/\s/g, "") ?? "";
check("Discuss, To-do, Projects and Planning keep their own numbers — and only they",
  own === '"discuss","todo","projects","planning"' && /OWN_TILE_NUMBER\.has\(app\.id\)\s*\?\s*0\s*:\s*unreadByApp\[app\.id\]/.test(homeSrc), own || "OWN_TILE_NUMBER not found");
/* Home reads them again only when the count moved without them. */
const homeReads = [...homeSrc.matchAll(/fetchUnreadByApp\(\)/g)].length;
check("Home never asks for them on its own load — only when the count moved without them",
  homeReads === 1 && /const needsRead = badgesReady && tileCounts\.published && !tileCounts\.fresh;/.test(homeSrc) && /if \(!needsRead\) return;/.test(homeSrc));

/* ── N: the installed app's icon carries the bell's number ────────────── */
console.log("\nN. the installed app's icon carries the bell's number");
/* Owner, 26/09: a number on the app's icon — iPhone / iPad Home Screen,
   installed Chrome / Edge, the Mac desktop app (Electron maps the same
   Badging API call to the dock). The page sets it while the Hub is open;
   the service worker keeps it moving while it is closed. */
const iconSrc = fileSrc("src/lib/app-icon-badge.ts");
check("the icon never shows another person's number (view-as) and sums the bell's two halves",
  /if \(!currentScopeKey\(\)\.endsWith\(":self"\)\) return;/.test(iconSrc) && /paint\(i \+ d\)/.test(iconSrc));
const bellSrcN = fileSrc("src/components/layout/NotificationBell.tsx");
check("the Gate and the bell set it from the number they show, once both halves are known",
  /if \(inbox && channels\) setIconBadge\(unreadInbox, discussUnreadOf\(channels\)\)/.test(gateSrc)
  && /if \(!accountId \|\| !iconKnown\.inbox \|\| !iconKnown\.discuss\) return;\s*setIconBadge\(inboxUnread, discussUnread\)/.test(bellSrcN));
check("sign-out clears it", /clearIconBadge\(\)/.test(fileSrc("src/lib/session-caches.ts")));
const pushSrc = fileSrc("src/lib/server/web-push.ts");
check("each push carries its recipient's own unread count",
  /unread: unreadOf\.get\(s\.account_id\)/.test(pushSrc) && /\.is\("read_at", null\)[\s\S]{0,60}\.is\("archived_at", null\)/.test(pushSrc.slice(pushSrc.indexOf("unreadOf"))));
const sw = fs.readFileSync(R("public/sw.js"), "utf8");
check("the service worker paints it on every push, and keeps the halves the open Hub tells it",
  /event\.waitUntil\(Promise\.all\(\[showPush\(payload\), badgeFromPush\(payload\)\]\)\)/.test(sw)
  && /if \(typeof payload\.unread === "number"\) parts\.inbox = payload\.unread;/.test(sw)
  && /d\.type !== "kx-icon-badge"/.test(sw));

/* ── O: a device's push belongs to whoever is signed in ─────────────── */
console.log("\nO. a device's push belongs to whoever is signed in");
/* 26/09/2026: the owner's iPhone, enabled while signed in as another user,
   kept receiving THAT user's notifications after he signed back in as
   himself — the server gives a push endpoint to whoever saved it last, and
   the settings card only asked the phone. */
const pushClient = fileSrc("src/lib/push-client.ts");
const fnBody = (src: string, name: string) => {
  const i = src.indexOf(`export async function ${name}`);
  return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i));
};
const resync = fnBody(pushClient, "resyncPushSubscription");
check("re-saving never prompts and never creates a subscription — only an existing one, permission already granted",
  !!resync && !/requestPermission\(|pushManager\.subscribe\(/.test(resync) && /permissionState\(\) !== "granted"/.test(resync) && /getSubscription\(\)/.test(resync));
const release = fnBody(pushClient, "releasePushOnSignOut");
check("releasing on sign-out is bounded — it can never hold a sign-out up", /within\(unsubscribeCurrent\(\),\s*\d+\)/.test(release));
/* Both sign-out paths release the device BEFORE the session is revoked. */
const menu = fileSrc("src/components/layout/UserMenu.tsx");
const menuOut = menu.slice(menu.indexOf("const handleSignOut"), menu.indexOf("}, [", menu.indexOf("const handleSignOut")));
const home = fileSrc("src/app/page.tsx");
const homeOut = home.lastIndexOf('fetch("/api/auth/signout"');
const outOrder = [
  ["UserMenu", menuOut.indexOf("releasePushOnSignOut"), menuOut.indexOf('fetch("/api/auth/signout"')],
  ["Home (rejected session)", home.slice(Math.max(0, homeOut - 700), homeOut).indexOf("releasePushOnSignOut"), 700],
].filter(([, rel, out]) => (rel as number) < 0 || (out as number) < 0 || (rel as number) > (out as number)).map(([n]) => n);
check("every sign-out releases the device before it revokes the session", outOrder.length === 0, outOrder.join(", "));
const registrar = fileSrc("src/components/pwa/ServiceWorkerRegistrar.tsx");
const card = fileSrc("src/components/settings/tabs/NotificationsTab.tsx");
check("every signed-in open, and the settings card, re-save the device for whoever is signed in",
  /resyncPushSubscription\(accountId\)/.test(registrar) && /useCurrentAccountId\(\)/.test(registrar) && /resyncPushSubscription\(getCurrentAccountIdSync\(\)\)/.test(card));

/* ── P: the bell offers push on a device that doesn't have it ─────────── */
console.log("\nP. the bell offers push on a device that doesn't have it");
/* 26/09/2026: one device in the company received push (the owner's iPhone);
   the only switch sat in Settings. The bell now offers it — decided before
   the panel opens, never a prompt the reader didn't ask for, never for
   someone else or where it cannot work. */
const nudgeLib = fileSrc("src/lib/push-nudge.ts");
const nudgeCard = fileSrc("src/components/layout/PushNudge.tsx");
const bellP = fileSrc("src/components/layout/NotificationBell.tsx");
const transition = bellP.slice(bellP.indexOf("const [seen, setSeen] = useState({ accountId, open });"), bellP.indexOf("const discussChannelsRef"));
const nudgeSets = [...bellP.matchAll(/\bsetNudge\(/g)].length;
check("the offer is taken as the panel opens and fixed for that open — never set from an effect",
  /useState<Nudge>\(\(\) => \(defaultOpen \? peekPushNudge\(accountId\) : null\)\)/.test(bellP)
  && /if \(opened \|\| accountChanged\) setNudge\(open \? peekPushNudge\(accountId\) : null\);/.test(transition)
  && /onClose=\{\(\) => setNudge\(null\)\}/.test(bellP) && nudgeSets === 2, `setNudge calls: ${nudgeSets}`);
check("the Gate works it out ahead, through import() only",
  /import\("@\/lib\/push-nudge"\)\.then\(\(m\) => m\.preparePushNudge\(getCurrentAccountIdSync\(\)\)\)/.test(gateSrc));
const turnOn = nudgeCard.slice(nudgeCard.indexOf("async function turnOn"), nudgeCard.indexOf("function dismiss"));
check("the browser asks only after a press of Turn on",
  !/requestPermission\(|subscribeToPush\(|pushManager\.subscribe\(/.test(nudgeLib)
  && [...nudgeCard.matchAll(/subscribeToPush\(/g)].length === 1 && /subscribeToPush\(/.test(turnOn)
  && [...nudgeCard.matchAll(/\bturnOn\(/g)].length === 2 /* its definition + the one press */ && /onClick=\{\(\) => void turnOn\(\)\}/.test(nudgeCard)
  && !/useEffect/.test(nudgeCard));
const decideBody = nudgeLib.slice(nudgeLib.indexOf("async function decide"));
check("never during view-as, in the desktop app, once push is on here, or when the browser blocks it",
  /if \(!scope\.endsWith\(":self"\)\) return null;/.test(decideBody) && /if \(isDesktopApp\(\)\) return null;/.test(decideBody)
  && /permission === "denied"[^\n]*return null;/.test(decideBody) && /getSubscription\(\)\) return null;/.test(decideBody)
  && /if \(!isPushConfigured\(\)\) return null;/.test(decideBody));
check("✕ closes it for good for this person on this device; turning push on does not",
  /closePushNudge\(accountId, true\)/.test(nudgeCard.slice(nudgeCard.indexOf("function dismiss")))
  && /closePushNudge\(accountId, false\)/.test(turnOn) && /localStorage\.getItem\(KEY \+ accountId\)/.test(decideBody));
const uiWords = fileSrc("src/lib/translations/notif-ui.ts");
const nudgeKeys = [...new Set([...nudgeCard.matchAll(/tUi\("(push\.[a-zA-Z]+)"\)/g)].map((m) => m[1]))];
const missingWords = nudgeKeys.filter((k) => !new RegExp(`"${k.replace(".", "\\.")}":\\s*\\{\\s*en: "[^"]+",\\s*zh: "[^"]+",\\s*ar: "[^"]+"`).test(uiWords));
check(`its words read in English, Chinese and Arabic (${nudgeKeys.length} keys)`, nudgeKeys.length >= 8 && missingWords.length === 0, missingWords.join(", "));

/* ── Q: the desktop app pops a system notification when it isn't in front ── */
console.log("\nQ. the desktop app pops a system notification when it isn't in front");
/* 26/09/2026: the desktop app has no push. While it was open behind another
   program a new approval only chimed — and before the bell was first opened,
   not even that. Now the bell mounts early there and each new notification
   also shows as a Windows / Mac notification, under the chime's own rules. */
const toastLib = fileSrc("src/lib/desktop-toast.ts");
const bellQ = fileSrc("src/components/layout/NotificationBell.tsx");
const gateQ = fileSrc("src/components/layout/NotificationBellGate.tsx");
check("only in the desktop app, only while its window isn't in front, and silent (the chime already sounds)",
  /if \(!isDesktopApp\(\) \|\| typeof Notification === "undefined" \|\| Notification\.permission !== "granted"\) return;/.test(toastLib)
  && [...toastLib.matchAll(/if \(!outOfView\(\)\) return;/g)].length === 2 && /silent: true/.test(toastLib)
  && /koleex\?\.isDesktop/.test(fileSrc("src/lib/desktop-app.ts")));
check("a burst shows as one", /batch\.length > 2 \? \[many\(batch\.length\)\] : batch/.test(toastLib));
const allowedAt = bellQ.indexOf("if (activityAllowed(notifPrefsRef.current, activity) && !inQuietHours(qh)) {");
const allowedBlock = allowedAt < 0 ? "" : bellQ.slice(allowedAt, bellQ.indexOf("setInboxUnread((n) => n + 1);", allowedAt));
check("a work notification pops under the chime's own switches and quiet hours",
  /playAppSound\("notification", activity\)/.test(allowedBlock) && /desktopToast\(\{ key: `inbox:\$\{msg\.id\}`/.test(allowedBlock)
  && [...bellQ.matchAll(/\bdesktopToast\(/g)].length === 2);
const discussAt = bellQ.indexOf("onMessageInsert: (msg) => {");
const discussBlock = discussAt < 0 ? "" : bellQ.slice(discussAt, bellQ.indexOf("onChannelChange:", discussAt));
const guardAt = discussBlock.indexOf("if (!heard || !c || quietFor(c)) return;");
check("a Discuss message pops only when it would chime, by the conversation's own setting (read again on the fresh list)",
  /if \(heard\) playAppSound\("message"\);/.test(discussBlock) && guardAt > 0 && guardAt < discussBlock.indexOf("desktopToast("));
check("clicking it brings the Hub forward and opens that notification or conversation",
  /n\.onclick = \(ev\) => \{[\s\S]{0,200}window\.focus\(\)[\s\S]{0,120}t\.open\(\)/.test(toastLib)
  && /openRow: \(m\) => void handleInboxRowClick\(m\)/.test(bellQ) && /openChannel: \(id\) => handleDiscussRowClick\(id\)/.test(bellQ));
const warmQ = gateQ.slice(gateQ.indexOf("const warm = () => {"), gateQ.indexOf("const t = window.setTimeout(", gateQ.indexOf("const warm = () => {")));
check("the real bell mounts early, closed, once the list is stored — on every device",
  /await prewarmBellFeed\(getCurrentAccountIdSync\(\)\);\s*const mod = await import\("\.\/NotificationBell"\);\s*if \(cancelled\) return;\s*setOpenOnMount\(false\);\s*setBell\(/.test(warmQ)
  && /<Bell dk=\{dk\} defaultOpen=\{openOnMount\} \/>/.test(gateQ) && !/isDesktopApp/.test(gateQ));
check("a burst's words read in English, Chinese and Arabic",
  /"toast\.many":\s*\{\s*en: "[^"]*\{n\}[^"]*",\s*zh: "[^"]*\{n\}[^"]*",\s*ar: "[^"]*\{n\}[^"]*"/.test(fileSrc("src/lib/translations/notif-ui.ts")));

/* ── R: "Mentions only" means mentions only — in the Hub too ─────────── */
console.log("\nR. \"Mentions only\" means mentions only — in the Hub too");
/* 26/09/2026: push honoured a "Mentions only" conversation, but the ping the
   bell hears carried ids only — so the Hub chimed on every message there,
   and the desktop app never popped a real mention up. The ping now says
   whether the message mentions YOU (no content). */
const rtb = fileSrc("src/lib/server/realtime-broadcast.ts");
const pingFn = rtb.slice(rtb.indexOf("export async function pingChannelActivity"), rtb.indexOf("\n}\n", rtb.indexOf("export async function pingChannelActivity")));
const mutateSrc = fileSrc("src/app/api/discuss/mutate/route.ts");
check("the server marks only the mentioned members' pings",
  /mentionedAccountIds\?\.has\(id\) \? \{ \.\.\.accountPayload, mentionsYou: true \} : accountPayload/.test(pingFn)
  && /await pingChannelActivity\(channelId, memberIds, me, mentioned\);/.test(mutateSrc)
  && /const mentioned = new Set\(\s*\(\(metadata\.mentions \?\? \[\]\)/.test(mutateSrc));
const discussLib = fileSrc("src/lib/discuss.ts");
check("the bell's message carries it",
  /metadata: payload\?\.mentionsYou \? \{ mentions_you: true \} : \{\}/.test(discussLib) && /mentionsYou\?: boolean/.test(discussLib));
check("the chime and the desktop pop-up both keep quiet in \"Mentions only\" unless you are mentioned — and in a muted or \"Nothing\" conversation",
  /const quietFor = \(c: DiscussChannelWithState\) =>\s*c\.muted \|\| c\.notification_pref === "none" \|\| \(c\.notification_pref === "mentions" && !mentionsYou\);/.test(discussBlock)
  && /const silenced = !!ch && quietFor\(ch\);/.test(discussBlock)
  && /const mentionsYou = !!\(msg\.metadata as \{ mentions_you\?: boolean \} \| null\)\?\.mentions_you;/.test(discussBlock));

/* ── T: pop-up cards while the Hub is in front ──────────────────────── */
console.log("\nT. pop-up cards while the Hub is in front");
/* Owner, 26/09: a card for each new notification that appears for a while,
   then goes — and if it wasn't opened, it is still in the bell. Mockup
   approved; "take care we have two styles aurora and core". */
const cardsSrc = fileSrc("src/components/layout/NotificationCards.tsx");
const bellT = fileSrc("src/components/layout/NotificationBell.tsx");
const cardFn = bellT.slice(bellT.indexOf("card: (c) => {"), bellT.indexOf("});", bellT.indexOf("card: (c) => {")));
check("a card shows only while the window is in front, with cards switched on, and the panel shut",
  /if \(open \|\| outOfView\(\) \|\| notifPrefs\?\.popup_cards === false\) return;/.test(cardFn));
const inboxCardAt = bellT.indexOf("if (activityAllowed(notifPrefsRef.current, activity)) {");
const inboxCard = inboxCardAt < 0 ? "" : bellT.slice(inboxCardAt, bellT.indexOf("\n      }\n", inboxCardAt));
check("a work notification's card follows its per-activity switch — quiet hours only silence the chime",
  /toastRef\.current\?\.card\(\{ key: `inbox:\$\{msg\.id\}`, kind: "inbox", row, action: inTab\(row, "action"\) \}\)/.test(inboxCard) && !/inQuietHours/.test(inboxCard));
const dBlock = bellT.slice(bellT.indexOf("onMessageInsert: (msg) => {"), bellT.indexOf("onChannelChange:", bellT.indexOf("onMessageInsert: (msg) => {")));
const dGuard = dBlock.indexOf("if (!c || !r || quietFor(c)) return;");
check("a Discuss card follows the conversation's setting, and never shows on Discuss itself",
  dGuard > 0 && dGuard < dBlock.indexOf("r.card(") && /if \(!onDiscuss\) r\.card\(\{ key: `discuss:\$\{c\.id\}`/.test(dBlock));
check("at most three cards; the rest fold into \"+N more\", which opens the bell",
  /export const CARD_MAX = 3;/.test(cardsSrc) && /cards: next\.slice\(0, CARD_MAX\), more: s\.more \+ Math\.max\(0, next\.length - CARD_MAX\)/.test(cardFn)
  && /onMore=\{\(\) => \{ setCardStack\(NO_CARDS\); setOpen\(true\); \}\}/.test(bellT));
/* Design D (owner, 26/09): act on the card, on the page you are on — a
   reply, a decision — so a message never pulls you off unsaved work. */
check("acting happens on the card: a Discuss reply, the bell's own decision, and Open as the only way out",
  /<DecisionBar look="card" meta=\{meta\} tUi=\{tUi\} onModeChange=\{ctl\.setBusy\}/.test(cardsSrc)
  && /onSend=\{\(text\) => onReply\(c, text\)\}/.test(cardsSrc) && /onOpenChat=\{\(\) => onOpenChat\(c\.channelId\)\}/.test(cardsSrc)
  && /onOpen=\{\(c\) => void handleInboxRowClick\(c\.row\)\}/.test(bellT) && /onDecided=\{\(c, v\) => listActions\.onDecided\?\.\(c\.row, v\)\}/.test(bellT)
  && !/role="button"/.test(cardsSrc));
const panelSrc = fileSrc("src/components/layout/FloatingPanel.tsx");
const replyFn = bellT.slice(bellT.indexOf("async function replyInPlace"), bellT.indexOf("\n  }\n", bellT.indexOf("async function replyInPlace")));
check("a Discuss card answers in place: the reply is sent from it, and \"Open chat\" opens the floating panel over the page",
  /await sendDiscussMessage\(\{ channelId: c\.channelId, authorId: aid, body: text/.test(replyFn)
  && replyFn.indexOf("if (!saved) return false;") > 0 && replyFn.indexOf("if (!saved) return false;") < replyFn.indexOf("markChannelRead(")
  && /window\.dispatchEvent\(new CustomEvent\("koleex:discuss-open", \{ detail \}\)\);\s*if \(!detail\.handled\) handleDiscussRowClick\(channelId\);/.test(bellT)
  && /addEventListener\("koleex:discuss-open"/.test(panelSrc) && /d\.handled = true;\s*setTab\("discuss"\);\s*setOpen\(true\);/.test(panelSrc));
check("✕, Escape or time running out send it home into the bell, still unread; replied or decided, it slides away",
  /onClick=\{toBell\}/.test(cardsSrc) && /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); toBell\(\); \}/.test(cardsSrc)
  && /window\.setTimeout\(\(\) => toBellRef\.current\(\), left\.current\)/.test(cardsSrc)
  && /const finish = \(\) => \{ cb\.current\.onGone\(\); cb\.current\.onReturned\(\); \};/.test(cardsSrc)
  && /onGone=\{\(key\) => setCardStack\(\(s\) => \(\{ \.\.\.s, cards: s\.cards\.filter\(\(x\) => x\.key !== key\) \}\)\)\}/.test(bellT)
  && /done: \(word\) => \{ setDoneWord\(word\); window\.setTimeout\(slideAway, 1100\); \}/.test(cardsSrc));
check("the card keeps its own time and holds while pointed at, focused, or mid reply or decision",
  !/onAnimationEnd/.test(cardsSrc) && /const running = !held && !busy && doneWord === null;/.test(cardsSrc)
  && /onPointerEnter=\{\(\) => setHeld\(true\)\}/.test(cardsSrc) && /onFocus=\{\(\) => setHeld\(true\)\}/.test(cardsSrc)
  && /ctl\.setBusy\(e\.target\.value\.trim\(\)\.length > 0\)/.test(cardsSrc)
  && /CARD_MS = \{ action: 12_000, other: 6_000/.test(cardsSrc));
const globalsT = fs.readFileSync(R("src/app/globals.css"), "utf8");
const animCalls = [...cardsSrc.matchAll(/\.animate\(/g)].length;
check("motion — out of the bell, the stack gliding, the flight home — and none of it under reduced motion",
  /@keyframes kx-ncard-in/.test(globalsT) && /\.kx-ncard-in, \.kx-ncard-part, \.kx-ncard-pop \{ animation: none !important; \}/.test(globalsT)
  && /document\.documentElement\.classList\.contains\("kx-reduce-motion"\)/.test(cardsSrc) && /prefers-reduced-motion: reduce/.test(cardsSrc)
  && animCalls === 3 && /if \(!lessMotion\(\)\) \{\s*for \(const \[k, top\] of next\)/.test(cardsSrc)
  && /if \(!el \|\| !bell \|\| lessMotion\(\)\) \{ finish\(\); return; \}/.test(cardsSrc) && /if \(!el \|\| lessMotion\(\)\) \{ cb\.current\.onGone\(\); return; \}/.test(cardsSrc)
  && /function nudgeBell\(\) \{\s*if \(lessMotion\(\)\) return;/.test(bellT), `${animCalls} animate() calls`);
const blueLines = cardsSrc.split("\n").filter((l) => /#567FB2/.test(l));
check("both skins: the bell panel's own material, portalled; Hub Blue only under Aurora — Core stays black and white",
  /className="kx-app kx-glass-pop kx-pop-panel kx-pop-clear kx-ncard-in /.test(cardsSrc) && /createPortal\(/.test(cardsSrc) && /document\.body,/.test(cardsSrc)
  && blueLines.length >= 3 && blueLines.every((l) => /aurora \?/.test(l)), blueLines.filter((l) => !/aurora \?/.test(l)).map((l) => l.trim().slice(0, 60)).join(" | "));
check("the app line names the app with its own icon",
  /app=\{\{ name: app \? tHub\(app\.tKey, app\.name\) : tHub\("notif\.title"\), icon: appId \? <AppIcon appId=\{appId\} \/>/.test(cardsSrc)
  && /<span className="truncate font-medium text-\[var\(--text-muted\)\]">\{app\.name\}<\/span>/.test(cardsSrc));
check("opening the panel, or another account, clears them",
  /if \(opened \|\| accountChanged\) setCardStack\(NO_CARDS\);/.test(bellT));
const tabSrc = fileSrc("src/components/settings/tabs/NotificationsTab.tsx");
const acSrc = fileSrc("src/lib/access-control.ts");
const setWords = fileSrc("src/lib/translations/settings.ts");
const missingCardWords = ["card.more", "card.moreSub", "card.close", "card.replyPh", "card.send", "card.sent", "card.sendFailed", "card.openChat"].filter((k) => !new RegExp(`"${k.replace(".", "\\.")}":\\s*\\{\\s*en: "[^"]+",\\s*zh: "[^"]+",\\s*ar: "[^"]+"`).test(fileSrc("src/lib/translations/notif-ui.ts")))
  .concat(["notif.cards", "notif.cards.sub", "notif.cards.enable", "notif.cards.enable.hint"].filter((k) => !new RegExp(`"${k.replace(/\./g, "\\.")}":\\s*\\{\\s*en: "[^"]+",\\s*zh: "[^"]+",\\s*ar: "[^"]+"`).test(setWords)));
check("a switch in Settings → Notifications, on by default, in English, Chinese and Arabic",
  /checked=\{n\.popup_cards !== false\}/.test(tabSrc) && /patch\(\{ popup_cards: v \}\)/.test(tabSrc)
  && /popup_cards: true,/.test(acSrc) && /popup_cards\?: boolean;/.test(acSrc) && missingCardWords.length === 0, missingCardWords.join(", "));

/* ── S: a notification that failed to write leaves a trace ──────────── */
console.log("\nS. a notification that failed to write leaves a trace");
/* notify-lite (inventory, low stock, quotations, invoices) never read the
   insert's result: a failed write vanished without a log line. */
const lite = fileSrc("src/lib/server/notify-lite.ts");
const liteFn = lite.slice(lite.indexOf("export async function notifyLite"), lite.indexOf("\n}\n", lite.indexOf("export async function notifyLite")));
const throwAt = liteFn.indexOf("if (insertError) throw new Error(");
check("a failed insert is logged, and no ping or push goes out for it",
  /const \{ error: insertError \} = await supabaseServer\.from\("inbox_messages"\)\.insert\(/.test(liteFn)
  && throwAt > 0 && throwAt < liteFn.indexOf("await emitPings(") && throwAt < liteFn.indexOf("await sendPushToAccounts(")
  && /console\.error\("\[notify-lite\]"/.test(liteFn));

console.log(`\n${failed === 0 ? "✓" : "✗"} notification-types: ${passed} passed, ${failed} failed (${entries.size} types registered)`);
process.exit(failed === 0 ? 0 : 1);
