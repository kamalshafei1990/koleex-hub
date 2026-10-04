/* ---------------------------------------------------------------------------
   ai/image-url — the src a Koleex AI screen gives an <img>.

   A picture on an AI screen comes from one of three places, and each has a
   different right answer:

     · our own storage (a catalogue photo): the first-party optimizer,
       through cdnImage, exactly as every other screen in the hub does it;
     · the open web (a photo a search returned, a URL a model wrote): the
       AI picture proxy (api/ai/image), which fetches it server-side under
       the SSRF rules and returns it at the width the slot needs — never the
       original, which on a phone decoded to tens of megabytes per tile and
       got the page killed under a live call (2026-09-07);
     · this browser (a blob: of a file the user attached, a data: preview):
       untouched — there is nothing to fetch.

   Pure: a string in, a string out. The proxy path is the same for every
   caller so the browser's cache sees one URL per picture per width.
   --------------------------------------------------------------------------- */

import { cdnImage } from "@/lib/cdn";

export const AI_IMAGE_PROXY_PATH = "/api/ai/image";
/** Mirrors AI_IMAGE_WIDTHS in the route: tile, bubble, full view. */
export type AiImageWidth = 384 | 768 | 1200;

const SUPABASE_STORAGE = "/storage/v1/";

export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes(SUPABASE_STORAGE);
}

export function aiImage(url: string | null | undefined, width: AiImageWidth): string {
  if (!url) return "";
  if (isSupabaseStorageUrl(url)) return cdnImage(url, { width, quality: 75, resize: "contain" });
  if (!/^https:\/\//i.test(url)) return url;
  return `${AI_IMAGE_PROXY_PATH}?u=${encodeURIComponent(url)}&w=${width}`;
}
