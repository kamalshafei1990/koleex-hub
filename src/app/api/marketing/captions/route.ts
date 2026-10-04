import "server-only";

/* POST /api/marketing/captions — Koleex AI writes a caption per platform:
   { space, brief?, productId?, platforms: ["facebook","instagram"], lang:
   "en"|"ar"|"zh" }. Internal accounts only (like every Koleex AI door), with
   "create" on the space. The product must be ACTIVE. Suggestions only —
   nothing is saved or published here; { fallback, reason } when the AI is
   not available or its answer could not be read. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { productFacts, writeCaptions, type CaptionLang, type CaptionPlatform } from "@/lib/server/marketing/captions";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PLATFORMS: readonly CaptionPlatform[] = ["facebook", "instagram"];
const LANGS: readonly CaptionLang[] = ["en", "ar", "zh"];

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const notInternal = requireInternalUser(auth);
  if (notInternal) return notInternal;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const space = asSpace(typeof body.space === "string" ? body.space : null);
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "create");
  if (denied) return denied;

  const platforms = (Array.isArray(body.platforms) ? body.platforms : []).filter((p): p is CaptionPlatform => PLATFORMS.includes(p as CaptionPlatform));
  const lang = LANGS.includes(body.lang as CaptionLang) ? (body.lang as CaptionLang) : "en";
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 1000) : "";
  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!platforms.length) return NextResponse.json({ error: "Choose Facebook or Instagram." }, { status: 400 });
  if (!brief.trim() && !productId) return NextResponse.json({ error: "Write what the post is about, or pick a product." }, { status: 400 });
  try {
    const product = productId ? await productFacts(productId) : null;
    if (productId && !product) return NextResponse.json({ error: "That product is not active." }, { status: 404 });
    return NextResponse.json(await writeCaptions({ brief, product, platforms: [...new Set(platforms)], lang }));
  } catch (e) {
    console.error("[api/marketing/captions]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not write the caption." }, { status: 500 });
  }
}
