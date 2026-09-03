"use client";

/* ---------------------------------------------------------------------------
   components/ai/LibraryPanel — every picture from the caller's chats.

   Roadmap C3. A grid of the pictures that appeared in the caller's own
   conversations — product photos a lookup returned, web pictures, pictures
   Koleex AI made — newest first, each opening full-size with the chat it
   came from one tap away. The list comes from GET /api/ai/library, which is
   owner-scoped on the server; this component draws what it is given and
   never reads a URL out of anything else.

   Tiles are square and lazy: a gallery of a hundred thumbnails must not
   fetch a hundred full images on open. Labels are the model's own alt text,
   shown as a caption, never interpreted.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import PhotoLightbox from "@/components/ai/PhotoLightbox";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export type LibraryEntry = {
  url: string;
  label: string;
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  created_at: string;
};

export const LIBRARY_PATH = "/api/ai/library";

type Copy = { library: string; libraryEmpty: string; openChat: string; back: string };

export default function LibraryPanel({
  copy,
  onOpenConversation,
  fetchFn = fetch,
}: {
  copy: Copy;
  onOpenConversation: (id: string) => void;
  /** Injected for the suite; the page uses window.fetch. */
  fetchFn?: typeof fetch;
}) {
  const [items, setItems] = useState<LibraryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<LibraryEntry | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetchFn(LIBRARY_PATH, { credentials: "include", signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { items?: LibraryEntry[] }) => {
        if (ctl.signal.aborted) return;
        setItems(Array.isArray(body.items) ? body.items : []);
      })
      .catch(() => {
        if (ctl.signal.aborted) return;
        setFailed(true);
        setItems([]);
      });
    return () => ctl.abort();
  }, [fetchFn]);

  return (
    <section aria-label={copy.library} className="max-w-[820px] mx-auto px-4 md:px-6 py-6">
      <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">{copy.library}</h2>
      {items === null ? (
        <div className="flex items-center justify-center py-20">
          <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-[var(--text-dim)]" data-library-empty>
          {copy.libraryEmpty}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2" data-library-grid>
          {items.map((it) => (
            <button
              key={it.url}
              type="button"
              onClick={() => setOpen(it)}
              title={it.label || it.conversation_title || ""}
              className="group relative aspect-square overflow-hidden rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote pictures from many hosts; next/image would need every host allow-listed */}
              <img
                src={it.url}
                alt={it.label}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
              {(it.label || it.conversation_title) && (
                <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] leading-tight text-white bg-gradient-to-t from-black/70 to-transparent truncate text-start">
                  {it.label || it.conversation_title}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {failed && items !== null && items.length === 0 && (
        <p className="sr-only">{copy.libraryEmpty}</p>
      )}
      <PhotoLightbox photo={open ? { url: open.url, label: open.label } : null} onClose={() => setOpen(null)} closeLabel={copy.back} />
      {open && (
        /* Above the lightbox (z-260), the one action a picture has here:
           go to the chat it came from. */
        <div className="fixed inset-x-0 bottom-6 z-[270] flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => { const id = open.conversation_id; setOpen(null); onOpenConversation(id); }}
            className="pointer-events-auto h-10 px-4 rounded-full bg-white text-[#0D0D0D] text-[13px] font-semibold shadow-lg active:scale-95 transition-transform"
          >
            {copy.openChat}{open.conversation_title ? ` · ${open.conversation_title}` : ""}
          </button>
        </div>
      )}
    </section>
  );
}
