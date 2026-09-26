/* ==========================================================================
   validate:notes-collab — the Notes realtime "body changed" ping contract.

   A single-editor save that lands in a note's Yjs state is announced by the
   SERVER (pingNoteBodyChanged → Realtime REST broadcast) and consumed by
   the BROWSER (useNoteCollab → NoteEditor pulls + merges the stored state).
   The two never run together in a test, so a drift in the topic, the event
   name or the payload shape would fail silently in production (peers just
   stop pulling). This script proves they match, without a network:

     1. Static (TypeScript AST): the emitter and the listener both build the
        topic, the event and the payload from src/lib/note-collab-protocol,
        and neither hard-codes its own.
     2. Runtime: the protocol module's server payload, parsed by the
        listener's parser, is a body ping; the tab's own echo is ignored; a
        non-literal `body` is not a body ping.
     3. Wiring: the REST emitter forwards topic/event/payload verbatim; the
        note channel is public (REST broadcasts default to public topics);
        the editor pulls on `body`; every server path that merges a body
        into a Yjs state pings.
     4. Rescue (edit wins over delete): both ends rescue, collapse racing
        duplicates and carry the caret; a small Yjs run proves a rescue
        is origin-marked, never inserted twice, and a join is grafted.

   Pure file reads + one module import — no env, no database.
   ========================================================================== */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import ts from "typescript";
import * as Y from "yjs";
import {
  NOTE_PING_EVENT,
  SERVER_PING_BY,
  buildNotePing,
  buildServerBodyPing,
  noteTopic,
  parseNotePing,
} from "../src/lib/note-collab-protocol";
import { RESTORED_ATTR, applyRescues, collapseRestored, findRescues, otherSideOf } from "../src/lib/notes-yjs-rescue";

const ROOT = path.resolve(__dirname, "..");
const PROTOCOL = "@/lib/note-collab-protocol";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

function source(rel: string): { text: string; sf: ts.SourceFile } {
  const text = readFileSync(path.join(ROOT, rel), "utf8");
  return { text, sf: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS) };
}

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node);
  node.forEachChild((c) => walk(c, visit));
}

/** Names imported from `mod`. */
function importsFrom(sf: ts.SourceFile, mod: string): Set<string> {
  const out = new Set<string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || st.moduleSpecifier.text !== mod) continue;
    const nb = st.importClause?.namedBindings;
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) out.add(el.name.text);
  }
  return out;
}

function calls(root: ts.Node, name: string): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  walk(root, (n) => {
    if (!ts.isCallExpression(n)) return;
    const e = n.expression;
    const callee = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : "";
    if (callee === name) out.push(n);
  });
  return out;
}

function prop(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | null {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name) return p.initializer;
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === name) return p.name;
  }
  return null;
}

function isCallOf(e: ts.Expression | null, name: string): boolean {
  return !!e && ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === name;
}

function isIdent(e: ts.Expression | null, name: string): boolean {
  return !!e && ts.isIdentifier(e) && e.text === name;
}

/** `{ ...buildX(...) }` or `buildX(...)` */
function isBuiltBy(e: ts.Expression | null, name: string): boolean {
  if (!e) return false;
  if (isCallOf(e, name)) return true;
  return ts.isObjectLiteralExpression(e) && e.properties.length === 1 &&
    ts.isSpreadAssignment(e.properties[0]) && isCallOf(e.properties[0].expression, name);
}

/** Every string/template literal inside `root` (to catch hard-coded names). */
function literals(root: ts.Node): string[] {
  const out: string[] = [];
  walk(root, (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) out.push(n.head.text + n.templateSpans.map((s) => "${}" + s.literal.text).join(""));
  });
  return out;
}

function fnNamed(sf: ts.SourceFile, name: string): ts.FunctionDeclaration | null {
  for (const st of sf.statements) if (ts.isFunctionDeclaration(st) && st.name?.text === name) return st;
  return null;
}

/* ── 1. Server emitter ─────────────────────────────────────────────────── */
console.log("\n[1] server emitter — src/lib/notes-yjs-server.ts");
{
  const { sf } = source("src/lib/notes-yjs-server.ts");
  const imp = importsFrom(sf, PROTOCOL);
  ok("imports noteTopic / NOTE_PING_EVENT / buildServerBodyPing from the protocol",
    imp.has("noteTopic") && imp.has("NOTE_PING_EVENT") && imp.has("buildServerBodyPing"), [...imp].join(", "));
  const fn = fnNamed(sf, "pingNoteBodyChanged");
  ok("pingNoteBodyChanged exists", !!fn);
  if (fn) {
    const emits = calls(fn, "emitPings");
    ok("pingNoteBodyChanged calls emitPings once", emits.length === 1, String(emits.length));
    const arr = emits[0]?.arguments[0];
    const msg = arr && ts.isArrayLiteralExpression(arr) && arr.elements.length === 1 && ts.isObjectLiteralExpression(arr.elements[0])
      ? arr.elements[0] : null;
    ok("emits exactly one message object", !!msg);
    if (msg) {
      ok("topic = noteTopic(noteId)", isCallOf(prop(msg, "topic"), "noteTopic"));
      ok("event = NOTE_PING_EVENT", isIdent(prop(msg, "event"), "NOTE_PING_EVENT"));
      ok("payload = buildServerBodyPing()", isBuiltBy(prop(msg, "payload"), "buildServerBodyPing"));
    }
    const lits = literals(fn);
    ok("no hard-coded topic / event / payload literals", !lits.some((l) => l.startsWith("note:") || l === "ping" || l === "server"), lits.join(" | "));
  }
}

/* ── 2. Browser listener ───────────────────────────────────────────────── */
console.log("\n[2] browser listener — src/lib/note-collab.ts");
{
  const { sf, text } = source("src/lib/note-collab.ts");
  const imp = importsFrom(sf, PROTOCOL);
  ok("imports noteTopic / NOTE_PING_EVENT / parseNotePing / buildNotePing from the protocol",
    ["noteTopic", "NOTE_PING_EVENT", "parseNotePing", "buildNotePing"].every((n) => imp.has(n)), [...imp].join(", "));
  const chans = calls(sf, "channel");
  ok("subscribes with channel(noteTopic(noteId), …)", chans.length === 1 && isCallOf(chans[0].arguments[0] ?? null, "noteTopic"));
  const cfg = chans[0]?.arguments[1];
  const priv = cfg && ts.isObjectLiteralExpression(cfg) ? prop(cfg, "config") : null;
  const isPrivate = !!priv && ts.isObjectLiteralExpression(priv) && prop(priv, "private")?.kind === ts.SyntaxKind.TrueKeyword;
  ok("note channel is public (the REST broadcast targets public topics)", !isPrivate);

  // .on("broadcast", { event: NOTE_PING_EVENT }, handler) → handler parses with parseNotePing
  const ons = calls(sf, "on").filter((c) => {
    const [kind, filter] = c.arguments;
    return kind && ts.isStringLiteral(kind) && kind.text === "broadcast" && filter && ts.isObjectLiteralExpression(filter);
  });
  const pingOn = ons.filter((c) => isIdent(prop(c.arguments[1] as ts.ObjectLiteralExpression, "event"), "NOTE_PING_EVENT"));
  ok("listens for broadcast event NOTE_PING_EVENT exactly once", pingOn.length === 1, String(pingOn.length));
  const handler = pingOn[0]?.arguments[2];
  ok("the ping handler parses with parseNotePing(payload, tabId)", !!handler && calls(handler, "parseNotePing").length === 1);
  ok("the parsed ping is forwarded to onRemoteUpdate", !!handler && /onRemoteRef\.current\(u\)/.test(handler.getText(sf)));
  const lits = ons.flatMap((c) => literals(c.arguments[1]));
  ok("no hard-coded broadcast event names in listeners", lits.length === 0, lits.join(" | "));

  const sends = calls(sf, "send");
  const pingSend = sends.filter((c) => {
    const a = c.arguments[0];
    return a && ts.isObjectLiteralExpression(a) && isIdent(prop(a, "event"), "NOTE_PING_EVENT");
  });
  ok("tab pings are sent with event NOTE_PING_EVENT + buildNotePing()", pingSend.length === 1 &&
    isBuiltBy(prop(pingSend[0].arguments[0] as ts.ObjectLiteralExpression, "payload"), "buildNotePing"));
  ok("no `note:` topic literal left in the listener code", !/[`"']note:\$\{/.test(text));
}

/* ── 3. Runtime: the payload the server builds is what the client parses ── */
console.log("\n[3] protocol round-trip");
{
  const id = randomUUID();
  const tab = randomUUID();
  ok("noteTopic(id) = note:<id>", noteTopic(id) === `note:${id}`);
  ok("event name is 'ping'", NOTE_PING_EVENT === "ping");
  const server = JSON.parse(JSON.stringify(buildServerBodyPing())); // over the wire
  ok("server payload keys are {by, at, body}", JSON.stringify(Object.keys(server).sort()) === JSON.stringify(["at", "body", "by"]));
  const got = parseNotePing(server, tab);
  ok("a tab parses the server ping as a BODY ping", !!got && got.body === true && got.by === SERVER_PING_BY);
  ok("server `by` can never equal a tab id (tab ids are UUIDs)", !/^[0-9a-f-]{36}$/i.test(SERVER_PING_BY));
  ok("a tab ignores its own echo", parseNotePing(buildNotePing(tab), tab) === null);
  const meta = parseNotePing(buildNotePing(randomUUID()), tab);
  ok("a peer's meta ping is not a body ping", !!meta && meta.body === undefined);
  ok("a non-literal body flag is not a body ping", parseNotePing({ by: "x", at: "t", body: "true" }, tab)?.body === undefined);
  ok("garbage payloads are dropped", parseNotePing(null, tab) === null && parseNotePing("ping", tab) === null);
}

/* ── 4. Wiring around the contract ─────────────────────────────────────── */
console.log("\n[4] wiring");
{
  const rb = source("src/lib/server/realtime-broadcast.ts").text;
  ok("emitPings forwards topic / event / payload verbatim to /realtime/v1/api/broadcast",
    /\/realtime\/v1\/api\/broadcast/.test(rb) && /topic:\s*p\.topic/.test(rb) && /event:\s*p\.event/.test(rb) && /payload:\s*p\.payload/.test(rb));

  const ed = source("src/components/notes/NoteEditor.tsx").text;
  ok("the editor pulls + merges the stored state on a body ping", /if \(u\.body && sessionRef\.current\) void pullServerState\(\)/.test(ed));
  ok("the editor hands onRemoteUpdate to useNoteCollab", /useNoteCollab\(\{[\s\S]*?onRemoteUpdate[\s\S]*?\}\)/.test(ed));

  const { sf: rsf } = source("src/app/api/notes/[id]/route.ts");
  for (const name of ["singleEditorBodyPatch", "rebasePatch", "collabPatch"]) {
    const fn = fnNamed(rsf, name);
    ok(`${name} pings after merging a body into a Yjs state`, !!fn && calls(fn, "pingNoteBodyChanged").length === 1);
  }

  // Edit wins over delete on both ends of a Yjs merge (notes-yjs-rescue).
  const merge = source("src/lib/notes-yjs-merge.ts");
  const mergeFn = fnNamed(merge.sf, "mergeState");
  ok("mergeState keeps blocks deleted under concurrent typing (findRescues + applyRescues)",
    !!mergeFn && calls(mergeFn, "findRescues").length === 1 && calls(mergeFn, "applyRescues").length === 1);
  const yjsClient = source("src/lib/notes-yjs.ts").text;
  ok("the browser's applyServerState rescues its own typing before merging a pulled state",
    /applyServerState\([^)]*\)[^{]*\{[\s\S]*?findRescues\([\s\S]*?this\.doc\.clientID\)[\s\S]*?applyRescues\(/.test(yjsClient));
  ok("the editor persists + reports rescued blocks after a pull", /rescuedRef\.current\(s\.applyServerState\(j\.state\)\)/.test(ed));
  ok("mergeState collapses racing duplicate copies (collapseRestored)", !!mergeFn && calls(mergeFn, "collapseRestored").length === 1);
  ok("applyServerState locates the caret, collapses duplicates and writes the caret back",
    /applyServerState\([^)]*\)[^{]*\{[\s\S]*?locateCursor\([\s\S]*?collapseRestored\([\s\S]*?this\.caret\?\.write\(/.test(yjsClient));
  ok("the editor provides the caret bridge to the session", /s\.caret = bridge/.test(ed) && /absolutePositionToRelativePosition\(/.test(ed) && /relativePositionToAbsolutePosition\(/.test(ed));
  ok("saved bodies drop unset marker attributes (no raw getJSON in a save)", !/queueChange\(\{[^}]*getJSON\(\)/.test(ed) && /stripMarkerDefaults\(/.test(ed));
  ok("Markdown export passes the localized conflict label", /noteToMarkdown\(\{[\s\S]*?conflictLabel:\s*t\("conflict\.copyLabel"\)/.test(ed));
}

/* ── 5. Runtime: rescue is origin-marked, deduped, and joins are grafted ── */
console.log("\n[5] rescue runtime");
{
  const F = "default";
  const para = (text: string) => { const el = new Y.XmlElement("paragraph"); const t = new Y.XmlText(); t.insert(0, text); el.insert(0, [t]); return el; };
  const seed = new Y.Doc();
  seed.getXmlFragment(F).insert(0, [para("intro"), para("doomed"), para("outro")]);
  const base = Y.encodeStateAsUpdate(seed);
  const typist = new Y.Doc(); Y.applyUpdate(typist, base);
  const deleter = new Y.Doc(); Y.applyUpdate(deleter, base);
  ((typist.getXmlFragment(F).get(1) as Y.XmlElement).get(0) as Y.XmlText).insert(6, " + typed");
  deleter.getXmlFragment(F).delete(1, 1);
  // Two rescuers that do not see each other: both mark the same origin.
  const r1 = new Y.Doc(); Y.applyUpdate(r1, Y.encodeStateAsUpdate(deleter));
  const res1 = findRescues(typist, F, otherSideOf(r1), null);
  Y.applyUpdate(r1, Y.encodeStateAsUpdate(typist));
  applyRescues(r1, F, res1);
  const r2 = new Y.Doc(); Y.applyUpdate(r2, Y.encodeStateAsUpdate(deleter));
  const res2 = findRescues(typist, F, otherSideOf(r2), null);
  Y.applyUpdate(r2, Y.encodeStateAsUpdate(typist));
  applyRescues(r2, F, res2);
  const o1 = (r1.getXmlFragment(F).get(1) as Y.XmlElement).getAttribute(RESTORED_ATTR);
  ok("a restored block carries a deterministic origin marker", typeof o1 === "string" && o1 === (r2.getXmlFragment(F).get(1) as Y.XmlElement).getAttribute(RESTORED_ATTR));
  ok("a second rescue of the same origin is not inserted again", applyRescues(r1, F, findRescues(typist, F, otherSideOf(deleter), null)) === 0 && r1.getXmlFragment(F).length === 3);
  Y.applyUpdate(r1, Y.encodeStateAsUpdate(r2));
  Y.applyUpdate(r2, Y.encodeStateAsUpdate(r1));
  const c1 = collapseRestored(r1, F);
  const c2 = collapseRestored(r2, F);
  Y.applyUpdate(r1, Y.encodeStateAsUpdate(r2));
  const texts = r1.getXmlFragment(F).toArray().map((e) => ((e as Y.XmlElement).get(0) as Y.XmlText).toString());
  ok("racing copies collapse to ONE on every replica", c1 === 1 && c2 === 1 && JSON.stringify(texts) === JSON.stringify(["intro", "doomed + typed", "outro"]), JSON.stringify(texts));
  // Join: the deleter appended the block to its neighbour (Backspace).
  const joiner = new Y.Doc(); Y.applyUpdate(joiner, base);
  const typist2 = new Y.Doc(); Y.applyUpdate(typist2, base);
  joiner.transact(() => {
    ((joiner.getXmlFragment(F).get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(5, "doomed");
    joiner.getXmlFragment(F).delete(1, 1);
  });
  ((typist2.getXmlFragment(F).get(1) as Y.XmlElement).get(0) as Y.XmlText).insert(6, "!");
  const merged = new Y.Doc(); Y.applyUpdate(merged, Y.encodeStateAsUpdate(joiner));
  const jr = findRescues(typist2, F, otherSideOf(merged), null);
  Y.applyUpdate(merged, Y.encodeStateAsUpdate(typist2));
  applyRescues(merged, F, jr);
  const jt = merged.getXmlFragment(F).toArray().map((e) => ((e as Y.XmlElement).get(0) as Y.XmlText).toString());
  ok("a joined block is not restored: only the new characters are grafted", jr[0]?.kind === "graft" && JSON.stringify(jt) === JSON.stringify(["introdoomed!", "outro"]), JSON.stringify(jt));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
