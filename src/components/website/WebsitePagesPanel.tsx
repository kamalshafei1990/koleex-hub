"use client";

/* ---------------------------------------------------------------------------
   WebsitePagesPanel — the Page Builder tab until the builder is rebuilt in
   the Hub (Phase 3 step 3): the site's pages, each with how many sections it
   holds and a Preview that opens it in Live Preview. It replaces the frame on
   the site's old /admin, removed on 30/09/2026 (it wrote to the Hub's product
   tables from the browser), which left this tab on a 404.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { websiteT } from "@/lib/translations/website";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import LayoutIcon from "@/components/icons/ui/LayoutIcon";
import type { WebsitePageRow } from "@/lib/website-pages";

/* D/M/Y, the Hub's standing date format. */
function dmy(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function WebsitePagesPanel({ onPreview }: { onPreview: (path: string) => void }) {
  const { t } = useTranslation(websiteT);
  const [pages, setPages] = useState<WebsitePageRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/website/pages", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setPages(((await res.json()) as { pages: WebsitePageRow[] }).pages);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 flex flex-col gap-6">
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 flex gap-4">
        <div className="w-9 h-9 shrink-0 rounded-lg bg-[var(--bg-surface-hover)] flex items-center justify-center">
          <LayoutIcon size={18} />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t("builder.moving", "The page builder is moving into the Hub")}</h2>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {t("builder.next", "Next: sections in the Koleex style that you fill in English, Chinese and Arabic, saved as a draft and published when ready. Until then each page shows its built-in content.")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">{t("builder.pages", "Pages")}</h3>
        {failed ? (
          <div className="rounded-xl border border-[var(--border-color)] p-5 flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--text-secondary)]">{t("builder.loadFailed", "The pages could not be loaded.")}</p>
            <button onClick={() => void load()} className="text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] hover:border-[var(--border-strong)]">
              {t("builder.retry", "Try again")}
            </button>
          </div>
        ) : pages === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />)}
          </div>
        ) : pages.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-6">{t("builder.empty", "No pages yet.")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pages.map((p) => (
              <li key={p.slug} className="rounded-xl border border-[var(--border-color)] px-4 py-3 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    /{p.slug === "home" ? "" : p.slug}
                    {" · "}
                    {p.sections > 0 ? `${p.sections} ${t("builder.sections", "sections")}` : t("builder.builtIn", "Built-in content")}
                    {" · "}
                    {t("builder.updated", "Updated")} {dmy(p.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={() => onPreview(p.slug === "home" ? "/" : `/${p.slug}`)}
                  className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] hover:border-[var(--border-strong)]"
                >
                  <EyeIcon size={13} />
                  {t("preview", "Preview")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
