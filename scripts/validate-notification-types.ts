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
     E  the open lifecycle gaps are counted, so their closing is visible

   The registry is READ AS TEXT, not imported, so the mutation harness can
   hand this guard an edited copy without touching the real file (the tree is
   shared). Comments are stripped with scripts/lib/strip-comments.ts. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";
import { classifyBySubstring } from "../src/lib/notification-activity";

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
const ENTRY = /^\s+([a-z][a-z0-9_]*):\s*\{\s*app:\s*"([a-z-]+)",\s*activity:\s*(null|"([a-z_]+)")(?:,\s*activityNote:\s*(SA_CRITICAL|"[^"]+"))?,\s*severity:\s*"(info|action|warning|critical)",\s*lifecycle:\s*(todoClear|\{[^{}]*\})\s*\},?\s*$/;
type Entry = { app: string; activity: string | null; note: string | null; lifecycle: string };
const entries = new Map<string, Entry>();
const unparsed: string[] = [];
for (const line of block.split("\n")) {
  if (!ENTRY_START.test(line)) continue;
  const m = ENTRY.exec(line);
  if (!m) { unparsed.push(line.trim().slice(0, 60)); continue; }
  entries.set(m[1], { app: m[2], activity: m[4] ?? null, note: m[5] ?? null, lifecycle: m[7] });
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

/* ── E: the open gaps ───────────────────────────────────────────────── */
const gaps = [...entries].filter(([, e]) => /kind:\s*"gap"/.test(e.lifecycle)).map(([t]) => t);
console.log(`\nE. open lifecycle gaps: ${gaps.length} of ${entries.size} types`);
for (const g of gaps) console.log(`  · ${g}`);

console.log(`\n${failed === 0 ? "✓" : "✗"} notification-types: ${passed} passed, ${failed} failed (${entries.size} types registered)`);
process.exit(failed === 0 ? 0 : 1);
