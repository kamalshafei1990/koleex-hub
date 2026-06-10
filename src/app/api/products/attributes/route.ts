import "server-only";

/* ---------------------------------------------------------------------------
   /api/products/attributes — P0-A.
   The attribute master lists (tags, plug types, colors, voltage, watt,
   levels) live as JSON in the public "media" bucket at
   config/product-attributes.json (legacy location, unchanged).

   GET — return the raw config JSON (any authenticated user; the file is in
         a public bucket anyway — this route exists so P0-B can stop using
         the anon storage path and to give writes a gate).
   PUT — overwrite the config. Product Data / SA only. Server-side upload,
         no anon storage write.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

const BUCKET = "media";
const CONFIG_PATH = "config/product-attributes.json";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await supabaseServer.storage.from(BUCKET).download(CONFIG_PATH);
  if (error || !data) {
    // Missing file is a valid empty state — the client merges defaults.
    return NextResponse.json({ config: null });
  }
  try {
    const json = JSON.parse(await data.text()) as Record<string, unknown>;
    return NextResponse.json({ config: json });
  } catch {
    return NextResponse.json({ config: null });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit attributes." },
      { status: 403 },
    );
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid config body" }, { status: 400 });
  }
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const { error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(CONFIG_PATH, blob, { upsert: true, cacheControl: "0", contentType: "application/json" });
  if (error) {
    console.error("[api/products attributes PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
