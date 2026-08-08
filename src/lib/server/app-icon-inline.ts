import "server-only";

/* ---------------------------------------------------------------------------
   app-icon-inline — carry the APP-tile icons inside the registry payload
   instead of making the browser fetch each one.

   THE PROBLEM (owner, 2026-08-09: "some app icons in the home page take time
   to load and not all load at the same time — I think only the new icons have
   this"). He read it exactly right. Measured on the Home grid: 14 tiles draw
   from an inline SVG in the bundle and appear with the page, while 20 draw
   through the Semantic Icon Registry, whose binding is a URL to a file in
   Supabase Storage. Every one of those is its OWN request, so they trickle in
   one at a time — and the "new" apps are precisely the ones bound through the
   registry.

   THE FIX is the standing rule: the cheapest request is the one not made.
   Measured, the 28 app icons total ~21 KB of SVG — under a kilobyte each. So
   the route inlines them as data: URIs and they arrive inside /api/shell,
   which every screen already fetches. 28 round trips become 0.

   ONLY the `app` domain. classification alone is 440 bindings; inlining that
   would put hundreds of kilobytes on a payload every screen pays for, to fix
   a problem those icons don't have.

   URL-encoded, not base64: base64 adds a third to the size, and an encoded
   SVG is text, so brotli takes it down much further.
   --------------------------------------------------------------------------- */

interface Memo { at: number; map: Record<string, string> }
/* globalThis so the several copies a server bundle can hold share one memo
   (SYS-4), and so a warm instance re-serves without re-reading Storage. */
const g = globalThis as typeof globalThis & { __kxAppIconInline?: Memo | null };
/* Icons change only when someone edits the Visual Library, and that write
   calls invalidate() below — so this TTL is just the cross-instance backstop. */
const TTL_MS = 10 * 60_000;
/* A file that isn't a small icon has no business being inlined into a payload
   every screen loads. Anything bigger keeps its URL and behaves as before. */
const MAX_BYTES = 16 * 1024;

export function invalidateAppIconInline(): void {
  g.__kxAppIconInline = null;
}

/**
 * Given the app-domain bindings (semantic_key → storage URL), return
 * semantic_key → data: URI for the ones that could be read. Keys that fail
 * are simply absent, and the caller keeps their original URL — a Storage
 * hiccup must degrade to "the icon loads a bit later", never to "no icon".
 */
export async function inlineAppIcons(
  appBindings: Record<string, string>,
): Promise<Record<string, string>> {
  const memo = g.__kxAppIconInline;
  if (memo && Date.now() - memo.at < TTL_MS) return memo.map;

  const entries = Object.entries(appBindings);
  const results = await Promise.all(
    entries.map(async ([key, url]) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) return null;
        const svg = await res.text();
        if (svg.length > MAX_BYTES || !svg.includes("<svg")) return null;
        return [key, `data:image/svg+xml,${encodeURIComponent(svg)}`] as const;
      } catch {
        return null;
      }
    }),
  );

  const map: Record<string, string> = {};
  for (const r of results) if (r) map[r[0]] = r[1];

  const missing = entries.length - Object.keys(map).length;
  if (missing > 0) console.warn(`[app-icon-inline] ${missing}/${entries.length} icons could not be inlined`);

  g.__kxAppIconInline = { at: Date.now(), map };
  return map;
}
