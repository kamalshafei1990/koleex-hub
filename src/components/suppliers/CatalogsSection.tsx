"use client";

/* Catalogs linked to this supplier (via the Catalogs app's contact link).
   Read-only: lists the supplier's catalogs with cover + quick open. */

import { useEffect, useState } from "react";

interface Cat {
  id: string;
  title: string;
  title_cn?: string | null;
  cover_url?: string | null;
  file_url?: string | null;
  year?: number | null;
  page_count?: number | null;
  category_name?: string | null;
}

export default function CatalogsSection({ supplierId }: { supplierId: string }) {
  const [cats, setCats] = useState<Cat[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/suppliers/${supplierId}/catalogs`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { catalogs: [] }))
      .then((j) => { if (alive) setCats(Array.isArray(j.catalogs) ? j.catalogs : []); })
      .catch(() => { if (alive) setCats([]); });
    return () => { alive = false; };
  }, [supplierId]);

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-[15px] font-bold text-[var(--text-primary)]">Catalogs</span>
        {cats && cats.length > 0 && (
          <span className="text-[12px] font-medium text-[var(--text-tertiary)]">{cats.length}</span>
        )}
      </div>

      {cats === null ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">Loading catalogs…</div>
      ) : cats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">
          No catalogs linked to this supplier yet. Link one in the Catalogs app by choosing this supplier.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cats.map((c) => (
            <a
              key={c.id}
              href={c.file_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--bg-secondary)]">
                {c.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{c.title || "Untitled"}</div>
                <div className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">
                  {[c.category_name, c.year ? String(c.year) : null].filter(Boolean).join(" · ")}
                  {c.page_count ? ` · ${c.page_count}p` : ""}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
