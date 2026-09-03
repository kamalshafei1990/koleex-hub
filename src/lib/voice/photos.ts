/* ---------------------------------------------------------------------------
   voice/photos — the product photos a lookup returned, for a screen to show.

   WHY. The written lanes already show a product: the tool result carries
   main_photo_url or photo_url, the prompt tells the model to embed it, and
   the bubble renders it. A call had the same tool results flowing through
   the same browser and showed nothing — the caller heard "the KX-180 is a
   1.8-metre spreader" and saw an orb. This reads the photos out of the tool
   result the browser is already relaying, so the call screen can show them
   and the saved transcript can keep them.

   WHAT IT TRUSTS. Nothing. The result came from OUR server, but it is still
   data: only https URLs are kept, a name is a string or it is dropped, and
   the list is capped so a catalogue search cannot paper the screen. The
   markdown emitted for the saved message uses the URL exactly as returned —
   the same rule the written lane's PRODUCT_PHOTO_RULE gives the model.
   --------------------------------------------------------------------------- */

export type ProductPhoto = { url: string; label: string };

/** More than this on a call screen is a catalogue, not an answer. */
export const MAX_PHOTOS_PER_RESULT = 4;

const NAME_KEYS = ["product_name", "primary_model", "model_name", "name", "code", "primary_code"] as const;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function httpsOnly(v: unknown): string | null {
  const s = str(v);
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
}

function labelOf(o: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const s = str(o[k]);
    if (s) return s.slice(0, 80);
  }
  return "";
}

/**
 * Walk a tool result and collect the photos it names, in order, deduplicated
 * by URL. Looks at `photo_url`, `main_photo_url`, and the FIRST of
 * `photo_urls` on any object, at any depth — a search returns rows, a details
 * lookup returns one record with a gallery, and both shapes should show.
 */
export function extractProductPhotos(output: unknown): ProductPhoto[] {
  const found: ProductPhoto[] = [];
  const seen = new Set<string>();
  const add = (url: string | null, label: string) => {
    if (!url || seen.has(url) || found.length >= MAX_PHOTOS_PER_RESULT) return;
    seen.add(url);
    found.push({ url, label });
  };
  const walk = (v: unknown, depth: number) => {
    if (found.length >= MAX_PHOTOS_PER_RESULT || depth > 6 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1);
      return;
    }
    const o = v as Record<string, unknown>;
    const label = labelOf(o);
    add(httpsOnly(o.main_photo_url), label);
    add(httpsOnly(o.photo_url), label);
    if (Array.isArray(o.photo_urls)) add(httpsOnly(o.photo_urls[0]), label);
    /* A web search's pictures: `{ url, description }` entries. The caption
       is the label, so the strip says what the picture is. */
    if (Array.isArray(o.images)) {
      for (const img of o.images) {
        if (!img || typeof img !== "object") continue;
        const i = img as Record<string, unknown>;
        add(httpsOnly(i.url), str(i.description).slice(0, 80));
      }
    }
    for (const [k, child] of Object.entries(o)) {
      if (k === "photo_urls" || k === "images") continue;
      walk(child, depth + 1);
    }
  };
  walk(output, 0);
  return found;
}

/** The photos as markdown, one per line, for the saved assistant message.
 *  Alt text is the product name, so the thread reads even where images do
 *  not load. Empty string for no photos — the caller appends nothing. */
export function photosMarkdown(photos: readonly ProductPhoto[]): string {
  if (photos.length === 0) return "";
  return photos.map((p) => `![${(p.label || "Koleex product").replace(/[\[\]]/g, "")}](${p.url})`).join("\n");
}
