import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   /api/platform-settings — PLATFORM-wide flags (owner-approved KV table).

   GET   any signed-in user, READABLE keys only — every client needs the
         flags to decide what chrome to render (first consumer: whether the
         QA report-issue button exists at all). Also served inside the
         /api/shell batch, so screens normally pay ZERO extra requests.
   PATCH super admin only — the whole point is that the OWNER decides
         platform-wide, e.g. switching the QA collection period on/off.

   The table is RLS deny-all; only this service-role route touches it.
   --------------------------------------------------------------------------- */

const READABLE = ["qa_reporter_enabled"] as const;
type SettingKey = (typeof READABLE)[number];

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("platform_settings")
    .select("key, value")
    .in("key", READABLE as unknown as string[]);
  if (error) {
    console.error("[api/platform-settings GET]", error.message);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
  const settings: Record<string, unknown> = {};
  for (const row of data ?? []) settings[row.key] = row.value;
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super admin only" }, { status: 403 });
  }

  let body: { key?: string; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = body.key as SettingKey;
  if (!READABLE.includes(key) || typeof body.value !== "boolean") {
    return NextResponse.json({ error: "Unknown setting" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("platform_settings")
    .upsert({ key, value: body.value, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[api/platform-settings PATCH]", error.message);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, key, value: body.value });
}
