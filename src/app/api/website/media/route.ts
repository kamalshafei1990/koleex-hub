/* POST /api/website/media — a photo for a page (multipart "file"): JPEG, PNG,
   WebP or AVIF, checked by its first bytes, 4 MB at most, into the public
   bucket website-media. Website edit. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { isError, MEDIA_BYTES_MAX, uploadPhoto } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await guardWebsite("edit");
  if (auth instanceof NextResponse) return auth;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MEDIA_BYTES_MAX + 64 * 1024) return builderJson({ error: "Photos may be 4 MB at most.", code: "too_big" }, 413);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return builderJson({ error: "Choose a photo." }, 400);
  try {
    const r = await uploadPhoto(new Uint8Array(await file.arrayBuffer()), file.type);
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r);
  } catch (e) {
    console.error(`[website/media] ${(e as Error).message}`);
    return builderJson({ error: "The photo could not be kept." }, 500);
  }
}
