import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import {
  normalizeProjectColor,
  normalizeProjectIcon,
  normalizeProjectName,
} from "@/lib/ai-projects";

/* GET  /api/ai/projects — the caller's project folders
   POST /api/ai/projects — create one

   Same scoping rule as the conversation routes: every query is filtered by
   tenant_id AND account_id, because `ai_projects` is service-role-only at the
   RLS layer and this route is the only door. */

const COLUMNS = "id, name, icon, color, sort_order, created_at, updated_at";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const { data, error } = await supabaseServer
    .from("ai_projects")
    .select(COLUMNS)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    icon?: unknown;
    color?: unknown;
  };

  /* New folders land at the end of the list. Reading the current max costs one
     cheap query and keeps sort_order stable for everyone already placed. */
  const { data: last } = await supabaseServer
    .from("ai_projects")
    .select("sort_order")
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabaseServer
    .from("ai_projects")
    .insert({
      tenant_id: auth.tenant_id,
      account_id: auth.account_id,
      name: normalizeProjectName(body.name),
      icon: normalizeProjectIcon(body.icon),
      color: normalizeProjectColor(body.color),
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select(COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
