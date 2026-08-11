import "server-only";

/* ---------------------------------------------------------------------------
   /api/visual-bindings — the SEMANTIC ICON REGISTRY gateway.

   Owner law (2026-08-07): one meaning = one icon AND one icon = one meaning,
   system-wide. Both directions are UNIQUE constraints on
   visual_icon_bindings; this route turns constraint violations into human
   answers ("that icon already means X") instead of raw 23505s.

   GET  → { bindings: { semantic_key: icon_url } }  (cached 60s like the
          classification hub — icon edits are rare).
   PUT  → { semantic_key, domain, icon_url, label_en? } upsert.
          Empty/absent icon_url = remove the binding (fall back to default).
   Writes are Database·edit gated — the Visual Library is the control room.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { inlineAppIcons, invalidateAppIconInline } from "@/lib/server/app-icon-inline";

const DOMAINS = ["classification", "field", "spec", "attribute", "app", "activity", "ui"];

/* THE WHOLE PAYLOAD IS MEMOISED, not just the inlined app icons.

   Measured on prod (2026-08-11): this is the slowest section of /api/shell —
   410ms against 207ms for the lightest real endpoint and 197ms for
   /api/version, which does no work at all. That ~200ms floor is the round
   trip; everything above it is this route reading ~700 rows and building a
   113 KB map on EVERY request, for an answer that is byte-identical for
   every user and changes only when someone edits the Visual Library.

   It cannot be cached at the CDN: `private` is deliberate because the route
   sits behind requireAuth, and making it public would serve the payload to
   unauthenticated callers straight from the edge. A memo inside the function
   keeps the auth check on every request and skips only the work.

   Invalidated by the same invalidateAppIconInline() the PUT already calls,
   so an icon edit is visible immediately — the TTL is just the backstop for
   other warm instances. Same globalThis pattern as app-icon-inline (SYS-4). */
interface BindingsMemo { at: number; bindings: Record<string, string> }
const gb = globalThis as typeof globalThis & { __kxVisualBindings?: BindingsMemo | null };
const BINDINGS_TTL_MS = 10 * 60_000;

export function invalidateVisualBindings(): void {
  gb.__kxVisualBindings = null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const memo = gb.__kxVisualBindings;
  if (memo && Date.now() - memo.at < BINDINGS_TTL_MS) {
    return NextResponse.json(
      { bindings: memo.bindings },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
    );
  }

  const { data, error } = await supabaseServer
    .from("visual_icon_bindings")
    .select("semantic_key, icon_url");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bindings: Record<string, string> = {};
  const appBindings: Record<string, string> = {};
  for (const r of data ?? []) {
    if (!r.semantic_key || !r.icon_url) continue;
    const key = r.semantic_key as string;
    const url = (r.icon_url as string).replace(/\s+/g, "");
    bindings[key] = url;
    if (key.startsWith("app.")) appBindings[key] = url;
  }

  /* App-tile icons ride INSIDE this payload as data: URIs instead of being 28
     separate downloads — see lib/server/app-icon-inline for the measurement
     (~21 KB total, and the owner could watch them arrive one by one). Any
     icon that could not be read keeps its URL and simply loads as before. */
  const inlined = await inlineAppIcons(appBindings);
  Object.assign(bindings, inlined);

  gb.__kxVisualBindings = { at: Date.now(), bindings };

  return NextResponse.json(
    { bindings },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Database", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as {
    semantic_key?: string; domain?: string; icon_url?: string | null; label_en?: string | null;
  };
  const key = String(body.semantic_key ?? "").trim().slice(0, 200);
  const domain = String(body.domain ?? key.split(".")[0] ?? "").trim();
  const iconUrl = (body.icon_url ?? "").toString().replace(/\s+/g, "");
  if (!key || !DOMAINS.includes(domain)) {
    return NextResponse.json({ error: "semantic_key and a valid domain are required" }, { status: 400 });
  }

  /* Remove = the meaning goes back to its built-in default. */
  if (!iconUrl) {
    const { error } = await supabaseServer.from("visual_icon_bindings").delete().eq("semantic_key", key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateAppIconInline();
    invalidateVisualBindings();
    return NextResponse.json({ ok: true, removed: true });
  }

  /* THE LAW, spelled out before the DB says 23505: is this icon already
     the face of another meaning? */
  const { data: taken } = await supabaseServer
    .from("visual_icon_bindings")
    .select("semantic_key, label_en")
    .eq("icon_url", iconUrl)
    .neq("semantic_key", key)
    .maybeSingle();
  if (taken) {
    return NextResponse.json(
      {
        error: `This icon already carries another meaning: ${taken.label_en || taken.semantic_key}. One icon = one meaning — pick a different icon, or free it there first.`,
        taken_by: taken.semantic_key,
      },
      { status: 409 },
    );
  }

  const { error } = await supabaseServer
    .from("visual_icon_bindings")
    .upsert(
      {
        semantic_key: key,
        domain,
        icon_url: iconUrl,
        label_en: body.label_en ?? null,
        source: "manual",
        updated_by: auth.account_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "semantic_key" },
    );
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This icon already carries another meaning. One icon = one meaning." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  /* An icon just changed — the inlined copies and the memoised payload must
     not outlive it. Every exit from this PUT has to drop both. */
  invalidateAppIconInline();
  invalidateVisualBindings();
  return NextResponse.json({ ok: true });
}
