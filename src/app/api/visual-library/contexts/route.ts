import "server-only";

/* /api/visual-library/contexts — usage-context registry. GET (list), POST (create). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const TYPES = new Set(["ui", "product", "erp", "marketing", "other"]);
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("visual_usage_contexts")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("status", "active")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contexts: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const context_type = typeof body.context_type === "string" && TYPES.has(body.context_type) ? body.context_type : "other";
  let slug = typeof body.slug === "string" && body.slug ? slugify(body.slug) : slugify(name);
  const { data: ex } = await supabaseServer.from("visual_usage_contexts").select("slug").eq("tenant_id", auth.tenant_id).like("slug", `${slug}%`);
  const taken = new Set((ex ?? []).map((r) => r.slug as string));
  if (taken.has(slug)) { let n = 2; while (taken.has(`${slug}-${n}`)) n++; slug = `${slug}-${n}`; }

  const { data, error } = await supabaseServer.from("visual_usage_contexts").insert({
    tenant_id: auth.tenant_id, slug, name, context_type,
    code: typeof body.code === "string" ? body.code : `CTX-${slug.toUpperCase().replace(/-/g, "").slice(0, 12)}`,
    description: typeof body.description === "string" ? body.description : null,
  }).select("id, slug").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id, slug: data?.slug });
}
