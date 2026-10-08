/* PATCH  /api/website/catalogs/[id] — title, description, year, cover, order,
          shown on the site (Website edit).
   DELETE /api/website/catalogs/[id] — the catalog and its PDF (Website delete). */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { deleteCatalog, updateCatalog } from "@/lib/server/website/catalogs";
import { isError } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardWebsite("edit");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return builderJson({ error: "Nothing to save." }, 400);
  try {
    const r = await updateCatalog((await params).id, body);
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r);
  } catch (e) {
    console.error(`[website/catalog] ${(e as Error).message}`);
    return builderJson({ error: "The catalog could not be saved." }, 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardWebsite("delete");
  if (auth instanceof NextResponse) return auth;
  try {
    const r = await deleteCatalog((await params).id);
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r);
  } catch (e) {
    console.error(`[website/catalog] ${(e as Error).message}`);
    return builderJson({ error: "The catalog could not be deleted." }, 500);
  }
}
