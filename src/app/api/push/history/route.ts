import "server-only";

/* GET /api/push/history — the Super Admin's recent notification deliveries. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const accountId = auth.real_account_id ?? auth.account_id;
  const { data } = await supabaseServer
    .from("notification_logs")
    .select("id, kind, title, body, channel, status, created_at")
    .eq("recipient_account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(25);
  return NextResponse.json({ history: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
