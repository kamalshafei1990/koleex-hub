import "server-only";

/* ---------------------------------------------------------------------------
   ai/library — every picture that appeared in the caller's own chats.

   Roadmap C3. Pictures reach a conversation three ways — a product lookup's
   photo, a web lookup's picture, a picture Koleex AI made — and all three
   land in the saved message as a markdown image, `![label](https://…)`,
   which the chat renders. That is the whole index: no table of pictures, no
   upload store to reconcile. This module is the pure half: read the images
   out of a page of the caller's newest messages, one entry per URL, newest
   first, with the chat it came from so the gallery can open it.

   OWNER-SCOPED IN THE ROUTE the same way the search is: messages are read
   inside the caller's own conversation ids. https only, as everywhere a
   URL is read out of text here. Labels are text the model wrote — data for
   a caption, never an instruction.
   --------------------------------------------------------------------------- */

/** How many messages with a picture the route reads, newest first. */
export const LIBRARY_SCAN_ROWS = 400;
/** How many pictures the gallery shows. A gallery, not an archive dump. */
export const LIBRARY_MAX_ITEMS = 120;
/** A caption longer than this is a paragraph, not a label. */
export const LIBRARY_LABEL_CHARS = 80;

export type LibraryRow = {
  id: string;
  conversation_id: string;
  content: string | null;
  created_at: string;
};

export type LibraryItem = {
  url: string;
  label: string;
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  created_at: string;
};

const IMAGE_MARKDOWN = /!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g;

/** The pictures in one message, in the order written. https only. */
export function imagesIn(content: string | null | undefined): Array<{ url: string; label: string }> {
  const out: Array<{ url: string; label: string }> = [];
  for (const m of String(content ?? "").matchAll(IMAGE_MARKDOWN)) {
    const label = m[1].replace(/\s+/g, " ").trim().slice(0, LIBRARY_LABEL_CHARS);
    out.push({ url: m[2], label });
  }
  return out;
}

/** Rows (newest first) to gallery items: one per URL, the first sighting
 *  wins (the newest message), capped; the chat's title attached from the
 *  owner's own list, null when the chat has none. */
export function collectLibrary(
  rowsNewestFirst: readonly LibraryRow[],
  titles: ReadonlyMap<string, string | null>,
  max: number = LIBRARY_MAX_ITEMS,
): LibraryItem[] {
  const out: LibraryItem[] = [];
  const seen = new Set<string>();
  for (const row of rowsNewestFirst) {
    if (out.length >= max) break;
    for (const img of imagesIn(row.content)) {
      if (out.length >= max) break;
      if (seen.has(img.url)) continue;
      seen.add(img.url);
      out.push({
        url: img.url,
        label: img.label,
        message_id: row.id,
        conversation_id: row.conversation_id,
        conversation_title: titles.get(row.conversation_id) ?? null,
        created_at: row.created_at,
      });
    }
  }
  return out;
}
