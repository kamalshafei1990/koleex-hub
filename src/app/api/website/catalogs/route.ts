/* GET  /api/website/catalogs — Koleex's catalogs for the website (Website view).
   POST /api/website/catalogs { title, description, year, path, coverUrl } —
        a new one, once its PDF is uploaded (Website create). Suppliers'
        catalogs never live here (lib/server/website/catalogs). */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { createCatalog, listCatalogs } from "@/lib/server/website/catalogs";
import { isError } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardWebsite("view");
  if (auth instanceof NextResponse) return auth;
  try {
    return builderJson({ catalogs: await listCatalogs() });
  } catch (e) {
    console.error(`[website/catalogs] ${(e as Error).message}`);
    return builderJson({ error: "The catalogs could not be loaded." }, 500);
  }
}

export async function POST(req: Request) {
  const auth = await guardWebsite("create");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return builderJson({ error: "Nothing to save." }, 400);
  try {
    const r = await createCatalog({ title: body.title, description: body.description, year: body.year, path: body.path, coverUrl: body.coverUrl }, auth.account_id);
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r, 201);
  } catch (e) {
    console.error(`[website/catalogs] ${(e as Error).message}`);
    return builderJson({ error: "The catalog could not be saved." }, 500);
  }
}
