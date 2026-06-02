import "server-only";

/* Review boards — GET list (with per-board review counts) + POST create. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { BOARD_TYPES } from "@/lib/visual-library/types";

const BTYPES = new Set<string>(BOARD_TYPES);

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const { data: boards, error } = await supabaseServer.from("visual_review_boards")
    .select("*").eq("tenant_id", tid).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Per-board review counts (lightweight head-counts).
  const withCounts = await Promise.all((boards ?? []).map(async (b) => {
    const { count } = await supabaseServer.from("visual_asset_reviews")
      .select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("board_id", b.id as string);
    return { ...b, review_count: count ?? 0 };
  }));
  return NextResponse.json({ boards: withCounts });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const board_type = typeof body.board_type === "string" && BTYPES.has(body.board_type) ? body.board_type : "production";

  const { data, error } = await supabaseServer.from("visual_review_boards").insert({
    tenant_id: tid, name, board_type,
    description: typeof body.description === "string" ? body.description.trim() || null : null,
    created_by: auth.account_id ?? null,
  }).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ board: data });
}
