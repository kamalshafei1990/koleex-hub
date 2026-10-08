#!/usr/bin/env node
/* validate:position-history — the org chart's paper trail is written and
 * read the way the table is (owner's pick, 26 Sep 2026).
 *
 *   §1 the row — only the table's columns (it has no change_type and no
 *      effective_date; changed_by_account_id was added); a transfer is ONE
 *      row from → to; the client's body never names the author.
 *   §2 every writer builds its row from lib/management/position-history and
 *      a failed insert is loud.
 *   §3 reading — the Management app's own right, never just "signed in"; a
 *      position's history finds the moves that left it or arrived at it.
 *
 * Source rules are checked both ways: the real file passes, a mutated copy
 * that breaks the rule must fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";
import { HISTORY_COLUMNS, historyFromClient, historyRow } from "../src/lib/management/position-history";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const eq = (got: unknown, want: unknown, m: string) => expect(JSON.stringify(got) === JSON.stringify(want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src: string) => stripComments(src);
function rule(name: string, file: string, check: (c: string) => string[], mutate: (src: string) => string) {
  const src = read(file);
  const real = check(code(src));
  expect(real.length === 0, `${name} (${file})`, real.join("; "));
  const mutated = mutate(src);
  if (mutated === src) { fail(`${name}: the mutation did not apply — update the guard`); return; }
  expect(check(code(mutated)).length > 0, `${name}: a copy that breaks it fails`);
}

const P1 = "11111111-1111-4111-8111-111111111111", P2 = "22222222-2222-4222-8222-222222222222";
const PERSON = "33333333-3333-4333-8333-333333333333", ME = "44444444-4444-4444-8444-444444444444", DEPT = "55555555-5555-4555-8555-555555555555";

console.log("\n§1 the row");
const tr = historyRow({ action: "transferred", personId: PERSON, departmentId: DEPT, fromPositionId: P1, toPositionId: P2, changedBy: ME });
eq(tr, { position_id: P2, person_id: PERSON, department_id: DEPT, action: "transferred", from_position_id: P1, to_position_id: P2, notes: null, changed_by_account_id: ME },
  "a transfer is ONE row, filed under the new position, from the old one");
expect([tr, historyRow({ action: "assigned", personId: PERSON, departmentId: null, toPositionId: P1, changedBy: ME, at: "2026-09-26T00:00:00Z" })]
  .every((r) => Object.keys(r).every((k) => (HISTORY_COLUMNS as readonly string[]).includes(k))), "every row names only the table's own columns");
expect(!(HISTORY_COLUMNS as readonly string[]).some((c) => ["change_type", "effective_date"].includes(c)), "…which have no change_type and no effective_date (the inserts that named them never landed)");
eq(historyRow({ action: "removed", personId: PERSON, departmentId: null, fromPositionId: P1, changedBy: ME }).position_id, P1, "someone leaving is filed under the position they left");
const fromClient = historyFromClient({ position_id: P1, person_id: PERSON, department_id: DEPT, action: "assigned", changed_by_account_id: P2, change_type: "x", id: P1 }, ME);
expect(!("error" in fromClient) && fromClient.changed_by_account_id === ME && !("change_type" in fromClient) && !("id" in fromClient),
  "a row the browser sends keeps only the table's fields — its author is the session's account, whatever the body says");
expect(["bogus", undefined].every((a) => "error" in historyFromClient({ position_id: P1, person_id: PERSON, action: a }, ME)) && "error" in historyFromClient({ action: "assigned", position_id: P1 }, ME),
  "an unknown action, or no person, is refused");

console.log("\n§2 the writers");
rule("a transfer writes one row the table accepts, and says loudly when it cannot", "src/app/api/management/assignments/route.ts",
  (c) => (c.includes('from("koleex_position_history").insert(historyRow({') && !/change_type|transfer_out|transfer_in/.test(c) && c.includes('if (histErr) console.error("[api/management/assignments transfer history]", histErr.message);') ? [] : ["the transfer's history insert names columns the table does not have"]),
  (src) => src.replace('    action: "transferred",\n', '    action: "transferred",\n    change_type: "transfer_in",\n'));
rule("the employee form's history rows are the table's, and a failure is logged", "src/app/api/employees/full/route.ts",
  (c) => ((c.match(/from\(HISTORY\)\.insert\(historyRow\(\{/g) ?? []).length === 2 && !/effective_date/.test(c) && c.includes('if (histErr) console.error("[api/employees/full PATCH history]", histErr.message);') ? [] : ["a history insert names effective_date, or fails silently"]),
  (src) => src.replace('notes: "Updated via employee form", changedBy: auth.account_id ?? null,', 'notes: "Updated via employee form", changedBy: auth.account_id ?? null, effective_date: "2026-01-01",'));
const ACT = "src/app/api/management/activity/route.ts";
rule("the activity POST keeps only the table's fields", ACT,
  (c) => (c.includes("const row = historyFromClient(body, auth.account_id);") && !/insert\(\{ \.\.\.body/.test(c) ? [] : ["the body is inserted as it came"]),
  (src) => src.replace('const { error } = await supabaseServer.from("koleex_position_history").insert(row);', 'const { error } = await supabaseServer.from("koleex_position_history").insert({ ...body, changed_by_account_id: auth.account_id });'));

console.log("\n§3 reading");
rule("reading the history needs the Management app, not just a sign-in", ACT,
  (c) => { const g = c.indexOf("export async function GET"); const p = c.indexOf("export async function POST"); const body = c.slice(g, p); return body.includes('const deny = await requireModuleAccess(auth, "Management");') && body.includes("if (deny) return deny;") ? [] : ["any signed-in account reads who moved where"]; },
  (src) => src.replace('  const deny = await requireModuleAccess(auth, "Management");\n  if (deny) return deny;\n', ""));
rule("a position's history finds the moves that left it or arrived at it", ACT,
  (c) => (c.includes("q.or(`position_id.eq.${positionId},from_position_id.eq.${positionId},to_position_id.eq.${positionId}`)") && c.includes("if (positionId !== null && !UUID.test(positionId))") ? [] : ["the old position's history loses the transfer"]),
  (src) => src.replace("q.or(`position_id.eq.${positionId},from_position_id.eq.${positionId},to_position_id.eq.${positionId}`)", 'q.eq("position_id", positionId)'));
const mig = stripComments(read("supabase/migrations/20260926_position_history_changed_by.sql"), { lang: "sql" });
expect(/ALTER TABLE public\.koleex_position_history\s+ADD COLUMN IF NOT EXISTS changed_by_account_id uuid REFERENCES public\.accounts\(id\) ON DELETE SET NULL;/.test(mig), "the migration adds who made the change — one nullable column, nothing removed");
const page = code(read("src/app/management/page.tsx"));
expect(page.includes("historyAction(h.action, t)") && page.includes("historyDay(h.created_at)") && !page.includes("new Date(h.created_at).toLocaleDateString()"), "the Management page words the change in the screen's language and dates it day first");

console.log(failed ? `\nvalidate:position-history FAILED (${failed})` : "\nvalidate:position-history passed");
process.exit(failed ? 1 : 0);
