import "server-only";

/* GET /api/cron/notes-trash-purge  (daily)
   Keeps the Notes app's promise: "Recently Deleted" notes can be restored
   for 30 days, then they are gone. Permanently deletes every note whose
   deleted_at is older than 30 days, together with its shares and its
   private images (notes-media bucket). Protected by the same CRON_SECRET
   bearer Vercel attaches to cron invocations (skipped when unset so it can
   be run by hand in dev). The answer carries counts only. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { purgeNotes } from "@/lib/notes-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 30;
const BATCH = 500;
const MAX_BATCHES = 10;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await supabaseServer
      .from("notes")
      .select("id, tenant_id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff)
      .limit(BATCH);
    if (error) {
      console.error("[cron/notes-trash-purge]", error.message);
      return NextResponse.json({ ok: false, purged }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
    const rows = (data ?? []) as Array<{ id: string; tenant_id: string }>;
    if (rows.length === 0) break;
    const res = await purgeNotes(rows);
    if (!res.ok) {
      return NextResponse.json({ ok: false, purged }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
    purged += rows.length;
    if (rows.length < BATCH) break;
  }
  return NextResponse.json({ ok: true, purged }, { headers: { "Cache-Control": "no-store" } });
}
