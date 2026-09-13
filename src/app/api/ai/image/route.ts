import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/image?u=<https url>&w=<384|768|1200> — a web picture, made
   phone-sized, for a Koleex AI screen.

   WHY THIS EXISTS (2026-09-07, 17:33 and 18:03). Twice in one evening a
   voice call ended with the page killed under it — no hang-up, no
   page-hidden beacon, a cold reload seconds later — and both times the last
   thing the call had done was show pictures: products from the catalogue,
   photos from a web search. Catalogue photos already travel through our own
   optimizer at the size of the slot. A web photo did not: the URL the
   search returned went straight into <img>, so an 88-pixel tile decoded a
   camera-sized file, several at a time, in the same page that holds a live
   audio graph. On a phone that is the memory that gets a page killed.

   So a web picture now comes through here, at the width the slot needs,
   re-encoded small. The browser talks only to our host (which is also the
   mainland rule: no third-party image host has to be reachable from China
   for the picture to show).

   THE SERVER IS FETCHING A URL A MODEL CHOSE, which makes this the SSRF
   shape, and it is treated as one:
     · signed-in internal account, and a budget per account
     · https only, and every hop of a redirect re-checked against the
       private / loopback / link-local ranges (lib/server/safe-url.ts)
     · a byte ceiling read from the stream, a time ceiling, a pixel ceiling
       for the decoder, and a content-type that must say image
     · the output is always a freshly encoded WebP — whatever the host sent,
       the browser never receives its bytes as-is
   Refusals are plain 4xx/5xx with no body worth reading: the tile that
   asked hides itself on error, which is the right picture of "no picture".
   The upstream URL is never logged in full; the host is enough to debug.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { assertSafeUrl } from "@/lib/server/safe-url";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** The widths a screen may ask for: a tile, a bubble, a full view. Anything
 *  else snaps up to the next one, so the cache sees three variants, not
 *  every number a client can type. */
export const AI_IMAGE_WIDTHS = [384, 768, 1200] as const;
export const AI_IMAGE_MAX_BYTES = 8_000_000;
export const AI_IMAGE_TIMEOUT_MS = 6_000;
export const AI_IMAGE_MAX_HOPS = 3;
/** 40 megapixels: a 8000×5000 poster decodes; a decompression bomb does not. */
export const AI_IMAGE_MAX_PIXELS = 40_000_000;
export const AI_IMAGE_QUALITY = 75;

export function snapAiImageWidth(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return AI_IMAGE_WIDTHS[0];
  return AI_IMAGE_WIDTHS.find((w) => w >= n) ?? AI_IMAGE_WIDTHS[AI_IMAGE_WIDTHS.length - 1];
}

const refuse = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(auth.account_id), BUDGETS.imageProxyPerAccount());
    if (!hit.allowed) {
      console.warn(`[ai.image] ratelimit account count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return new NextResponse(null, { status: 429, headers: { "Retry-After": String(hit.retryAfterSec), "Cache-Control": "no-store" } });
      }
    }
  }

  const params = new URL(req.url).searchParams;
  const width = snapAiImageWidth(params.get("w"));
  const raw = (params.get("u") ?? "").trim();
  if (!raw || raw.length > 2048) return refuse(400);

  let current: URL;
  try {
    current = await assertSafeUrl(raw, ["https:"]);
  } catch (e) {
    return refuse(e instanceof Error && e.message === "blocked_host" ? 403 : 400);
  }
  const host = current.hostname;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_IMAGE_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= AI_IMAGE_MAX_HOPS; hop++) {
      res = await fetch(current.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        cache: "no-store",
        headers: {
          "User-Agent": "KoleexHub-AI/1.0 (+https://hub.koleexgroup.com)",
          Accept: "image/avif,image/webp,image/*;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        /* A public host must not redirect us inward — every hop re-checked. */
        current = await assertSafeUrl(new URL(loc, current).toString(), ["https:"]);
        res = null;
        continue;
      }
      break;
    }
    if (!res) return refuse(502);
    if (!res.ok) return refuse(502);
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!type.startsWith("image/")) return refuse(415);
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > AI_IMAGE_MAX_BYTES) return refuse(413);

    const bytes = await readCapped(res, AI_IMAGE_MAX_BYTES);
    if (!bytes) return refuse(413);

    /* Decoded under a pixel ceiling, rotated as its metadata says, never
       enlarged, re-encoded as WebP. Metadata (location, camera) is dropped
       by the re-encode. */
    const out = await sharp(bytes, { limitInputPixels: AI_IMAGE_MAX_PIXELS, animated: false })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: AI_IMAGE_QUALITY })
      .toBuffer();

    console.log(`[ai.image] ok host=${host} w=${width} in=${bytes.byteLength} out=${out.byteLength} ms=${Date.now() - t0}`);
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(out.byteLength),
        /* Private: the answer depends on who asked. A day: the same photo is
           shown again when the conversation is reopened, from the browser's
           own cache. */
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "blocked_host") return refuse(403);
    if (msg === "bad_url") return refuse(400);
    const aborted = e instanceof Error && e.name === "AbortError";
    console.warn(`[ai.image] fail host=${host} w=${width} ${aborted ? "timed out" : "failed"} ms=${Date.now() - t0}`);
    return refuse(aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}

/** The body, or null once it passes the ceiling — a host that lies about
 *  its content-length does not get to fill the function's memory. */
async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > max ? null : buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
