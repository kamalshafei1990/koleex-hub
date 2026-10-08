/* POST /api/website/catalogs/upload-link { size } — a signed link the browser
   uploads a catalog PDF to, straight into the website-files bucket (our own
   request bodies are capped at 4.5 MB by the platform). Website create. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { catalogUploadLink } from "@/lib/server/website/catalogs";
import { isError } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await guardWebsite("create");
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as { size?: unknown } | null;
  try {
    const r = await catalogUploadLink(body?.size);
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r);
  } catch (e) {
    console.error(`[website/catalogs] ${(e as Error).message}`);
    return builderJson({ error: "The upload could not be prepared." }, 500);
  }
}
