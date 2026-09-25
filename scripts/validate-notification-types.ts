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

console.log(`\n${failed === 0 ? "✓" : "✗"} notification-types: ${passed} passed, ${failed} failed (${entries.size} types registered)`);
process.exit(failed === 0 ? 0 : 1);
