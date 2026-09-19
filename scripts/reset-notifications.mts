#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   reset-notifications — the one-time clean slate for the notification system.

   Owner, 2026-08-27: "the notifications system … is not work and have a lot
   of problems … the data in notification bell and in to-do app is not so
   important, if you want to delete to fix this matter in a clean way you can
   do it." This is that deletion, done once, with the causes fixed in code in
   the same commit so the pile cannot re-form:

     1. inbox_messages — ALL rows deleted. Every unread in that table is
        either noise (per-login alerts, now no longer emitted), stale (its
        task finished or vanished), or old enough that nobody will act on it.
     2. Superseded untouched recurring-task periods — deleted with the same
        predicate the spawner now applies daily: spawned (never the
        template), still 'todo', not completed, no approval, no notes, and
        not the newest period of the series.

   DRY RUN BY DEFAULT; --apply to write. Reports exact counts either way.
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const env = readFileSync(".env.local", "utf8");
const envGet = (k: string) =>
  env.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") ?? "";
const sb = createClient(envGet("NEXT_PUBLIC_SUPABASE_URL"), envGet("SUPABASE_SERVICE_ROLE_KEY"));

/* ── 1. the inbox ── */
const { count: inboxTotal } = await sb.from("inbox_messages").select("*", { count: "exact", head: true });
console.log(`inbox_messages: ${inboxTotal} rows → delete ALL`);

/* ── 2. dead recurring periods ── */
const { data: spawned } = await sb
  .from("koleex_todos")
  .select("id, recurrence_parent_id, recurrence_spawned_for, status, completed, approval_state, created_at")
  .not("recurrence_parent_id", "is", null);

const newestPerSeries = new Map<string, string>();
const periodOf = (r: Record<string, unknown>) =>
  (r.recurrence_spawned_for as string | null) ?? ((r.created_at as string | null) ?? "").slice(0, 10);
for (const r of spawned ?? []) {
  const key = (r as Record<string, unknown>).recurrence_parent_id as string;
  const p = periodOf(r as Record<string, unknown>);
  if (p > (newestPerSeries.get(key) ?? "")) newestPerSeries.set(key, p);
}

const candidates = (spawned ?? []).filter((r) => {
  const row = r as Record<string, unknown>;
  if (row.status !== "todo" || row.completed === true || row.approval_state !== null) return false;
  return periodOf(row) !== newestPerSeries.get(row.recurrence_parent_id as string);
});

const candidateIds = candidates.map((r) => (r as { id: string }).id);
let keepNoted = new Set<string>();
if (candidateIds.length) {
  const { data: noted } = await sb.from("koleex_todo_notes").select("todo_id").in("todo_id", candidateIds);
  keepNoted = new Set((noted ?? []).map((n) => (n as { todo_id: string }).todo_id));
}
const purgeIds = candidateIds.filter((id) => !keepNoted.has(id));
console.log(`spawned periods: ${spawned?.length} · superseded-untouched → delete ${purgeIds.length} (kept: ${keepNoted.size} with notes)`);

if (!APPLY) {
  console.log("\nDRY RUN — pass --apply to write.");
  process.exit(0);
}

const del1 = await sb.from("inbox_messages").delete().gte("created_at", "1970-01-01");
if (del1.error) throw new Error("inbox wipe: " + del1.error.message);
if (purgeIds.length) {
  /* batches: PostgREST caps the URL length on big IN lists */
  for (let i = 0; i < purgeIds.length; i += 100) {
    const { error } = await sb.from("koleex_todos").delete().in("id", purgeIds.slice(i, i + 100));
    if (error) throw new Error("todo purge: " + error.message);
  }
}

/* verify by re-reading */
const { count: inboxAfter } = await sb.from("inbox_messages").select("*", { count: "exact", head: true });
const { count: todosAfter } = await sb.from("koleex_todos").select("*", { count: "exact", head: true });
const { count: orphanAssignees } = await sb
  .from("koleex_todo_assignees").select("*", { count: "exact", head: true });
console.log(`\nApplied. inbox_messages=${inboxAfter} · koleex_todos=${todosAfter} · assignee rows=${orphanAssignees}`);
