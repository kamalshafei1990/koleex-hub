/* measure:notifications — how the notification system is doing on real data.

   READ-ONLY. It selects from the live database and prints a report; it never
   inserts, updates or deletes. Needs NEXT_PUBLIC_SUPABASE_URL and
   SUPABASE_SERVICE_ROLE_KEY (the project's .env.local).

     npx tsx scripts/measure-notifications.ts               last 7 days
     npx tsx scripts/measure-notifications.ts 30            last 30 days
     npx tsx scripts/measure-notifications.ts 2026-09-26    since a date

   Written for the check a week after the notification programme (A–F,
   26/09/2026) went live, against the audit taken before it:
     · 204 notifications in 30 days, 96% security alerts
     · 116 of 138 "new device" alerts came from localhost (dev machines)
     · 5 unread copies of one quotation; 30 delete alerts unread > a week
     · dates in three formats, raw routes in the text, test data in alerts */
import { createClient } from "@supabase/supabase-js";
import { NOTIFICATION_TYPES } from "../src/lib/notification-types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (source .env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const now = Date.now();
const arg = process.argv[2] ?? "7";
const since = /^\d{4}-\d{2}-\d{2}/.test(arg)
  ? new Date(arg).toISOString()
  : new Date(now - Math.max(1, Number(arg) || 7) * 86400_000).toISOString();
const DAYS = Math.max(1, (now - Date.parse(since)) / 86400_000);
const weekAgo = new Date(now - 7 * 86400_000).toISOString();

type Row = {
  id: string; recipient_account_id: string; subject: string | null; body: string | null;
  metadata: Record<string, unknown> | null; read_at: string | null; archived_at: string | null; created_at: string;
};
const typeOf = (r: Row) => String(r.metadata?.type ?? r.metadata?.kind ?? "(none)");
const registry = NOTIFICATION_TYPES as Record<string, { app: string; lifecycle: { kind: string } }>;
const isSecurity = (r: Row) => registry[typeOf(r)]?.app === "activity-monitor";
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const line = (s = "") => console.log(s);

async function all(q: (from: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return out;
  }
}
const COLS = "id, recipient_account_id, subject, body, metadata, read_at, archived_at, created_at";

(async () => {
  const rows = await all((f) => db.from("inbox_messages").select(COLS).gte("created_at", since).order("created_at").range(f, f + 999));
  const open = await all((f) => db.from("inbox_messages").select(COLS).is("read_at", null).is("archived_at", null).order("created_at").range(f, f + 999));

  line(`NOTIFICATIONS — ${DAYS.toFixed(1)} days (${since.slice(0, 10)} → ${new Date(now).toISOString().slice(0, 10)})`);
  line();

  /* 1. Volume and signal */
  const sec = rows.filter(isSecurity).length;
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(typeOf(r), (byType.get(typeOf(r)) ?? 0) + 1);
  line(`1. Volume: ${rows.length} notifications · ${(rows.length / DAYS).toFixed(1)} a day · security ${sec} (${pct(sec, rows.length)}) · work ${rows.length - sec}`);
  line(`   top types: ${[...byType].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, n]) => `${t} ${n}`).join(" · ") || "none"}`);
  const newDev = rows.filter((r) => typeOf(r) === "new_device");
  const local = newDev.filter((r) => /localhost|127\.0\.0\.1|::1/i.test(JSON.stringify(r.metadata ?? {}) + (r.body ?? "")));
  line(`   new-device alerts: ${newDev.length} (from localhost: ${local.length})`);

  /* 2. Registry and language */
  const unreg = [...byType.keys()].filter((t) => !registry[t]);
  line(`2. Types outside the registry: ${unreg.length ? unreg.join(", ") : "none"}`);
  const templated = rows.filter((r) => r.metadata?.tpl).length;
  const noTplTypes = [...new Set(rows.filter((r) => !r.metadata?.tpl).map(typeOf))];
  line(`   written with a translatable template: ${templated}/${rows.length} (${pct(templated, rows.length)})${noTplTypes.length ? ` — without: ${noTplTypes.join(", ")}` : ""}`);

  /* 3. Lifecycle: nothing waits that should have gone */
  const KEYS = ["quotation_id", "order_id", "contract_id", "expense_id", "purchase_order_id", "activity_id", "todo_id", "transfer_id",
    "issue_id", "report_id", "leave_request_id", "event_id", "task_id", "note_id", "inventory_item_id", "reminder_id", "support_request_id", "entity_id"];
  const groups = new Map<string, number>();
  for (const r of open) {
    const k = KEYS.find((x) => r.metadata?.[x]);
    if (!k) continue;
    const g = `${typeOf(r)}|${r.recipient_account_id}|${String(r.metadata![k])}`;
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  const dups = [...groups].filter(([, n]) => n > 1);
  const dupByType = new Map<string, number>();
  for (const [g, n] of dups) dupByType.set(g.split("|")[0], (dupByType.get(g.split("|")[0]) ?? 0) + n - 1);
  line(`3. Unread now: ${open.length} · security ${open.filter(isSecurity).length} · older than a week ${open.filter((r) => r.created_at < weekAgo).length}`);
  line(`   unread duplicates (same person, type, record): ${dups.length ? [...dupByType].map(([t, n]) => `${t} +${n}`).join(" · ") : "none"}`);
  const oldByType = new Map<string, number>();
  for (const r of open.filter((x) => x.created_at < weekAgo)) oldByType.set(typeOf(r), (oldByType.get(typeOf(r)) ?? 0) + 1);
  line(`   unread > a week, by type: ${[...oldByType].map(([t, n]) => `${t} ${n}`).join(" · ") || "none"}`);
  const { count: srOpen } = await db.from("support_requests").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
  line(`   sign-in help requests still open: ${srOpen ?? "?"}`);

  /* 4. The words */
  const text = (r: Row) => `${r.subject ?? ""} ${r.body ?? ""}`;
  const iso = rows.filter((r) => /\b\d{4}-\d{2}-\d{2}\b/.test(text(r))).length;
  const us = rows.filter((r) => { const m = text(r).match(/\b(\d{1,2})\/(\d{1,2})\/\d{4}\b/); return !!m && Number(m[1]) <= 12 && Number(m[2]) > 12; }).length;
  const paths = rows.filter((r) => /\(\/[a-z]/.test(text(r))).length;
  const test = rows.filter((r) => /\[P\d+-TEST\]/i.test(text(r))).length;
  line(`4. Stored text: ISO dates ${iso} · month-first dates ${us} · raw routes ${paths} · test data ${test}`);

  /* 5. Push and the bell's weight */
  const { count: subs } = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("is_active", true);
  line(`5. Devices registered for push (active): ${subs ?? "?"}`);
  const per = new Map<string, number>();
  for (const r of open) per.set(r.recipient_account_id, (per.get(r.recipient_account_id) ?? 0) + 1);
  const busiest = [...per].sort((a, b) => b[1] - a[1])[0];
  if (busiest) {
    const { data } = await db.from("inbox_messages")
      .select("id, sender_account_id, category, subject, body, link, read_at, archived_at, created_at, metadata")
      .eq("recipient_account_id", busiest[0]).is("archived_at", null).order("created_at", { ascending: false }).limit(300);
    const bytes = Buffer.byteLength(JSON.stringify(data ?? []));
    line(`   busiest bell (${busiest[1]} unread): ${(data ?? []).length} rows, ${Math.round(bytes / 1024)} KB before the feed's trim`);
  }
})().catch((e) => { console.error("measure failed:", e instanceof Error ? e.message : e); process.exit(1); });
