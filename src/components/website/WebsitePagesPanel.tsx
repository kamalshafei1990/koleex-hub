"use client";

/* ---------------------------------------------------------------------------
   WebsitePagesPanel — the Page Builder's home: the public site's pages, each
   with where it stands (live as version N, changes not yet published, or
   not published — the site then shows the old editor's sections or its
   built-in page), Edit, Preview on the live site, and "New page".
   It replaced the frame on the site's old /admin (removed 30/09/2026: it
   wrote to the Hub's product tables from the browser).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { websiteT } from "@/lib/translations/website";
import { websiteBuilderT } from "@/lib/translations/website-builder";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import type { WebsitePageRow } from "@/lib/website-pages";
import { fieldCls, smallBtn } from "@/components/website/builder/fields";

/* D/M/Y, the Hub's standing date format. */
function dmy(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function WebsitePagesPanel({ onPreview, onOpen }: { onPreview: (path: string) => void; onOpen: (slug: string) => void }) {
  const { t } = useTranslation(websiteT);
  const { t: b } = useTranslation(websiteBuilderT);
  const [pages, setPages] = useState<WebsitePageRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const autoSlug = (n: string) => n.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  const create = async () => {
    setBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/website/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug }) });
      const j = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
      if (!res.ok || !j.slug) { setCreateError(j.error ?? "—"); return; }
      setCreating(false);
      onOpen(j.slug);
    } finally {
      setBusy(false);
    }
  };

  const status = (p: WebsitePageRow) => {
    if (p.version > 0) return p.changed ? `${b("live", "Live · v{n}").replace("{n}", String(p.version))} · ${b("changes", "Changes not published")}` : b("live", "Live · v{n}").replace("{n}", String(p.version));
    const base = p.sections > 0 ? `${p.sections} ${t("builder.sections", "sections")}` : t("builder.builtIn", "Built-in content");
    return p.changed ? `${base} · ${b("changes", "Changes not published")}` : base;
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{t("builder.pages", "Pages")}</h2>
        <button className={smallBtn} onClick={() => { setCreating((c) => !c); setName(""); setSlug(""); setSlugTouched(false); setCreateError(null); }} aria-expanded={creating}>
          <PlusIcon size={12} />{b("newPage", "New page")}
        </button>
      </div>

      {creating ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-4">
          <p className="text-[13px] font-semibold">{b("newPageTitle", "A new page")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[var(--text-muted)]">{b("name", "Name")}</span>
              <input value={name} maxLength={80} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(autoSlug(e.target.value)); }} className={fieldCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[var(--text-muted)]">{b("address", "Address")}</span>
              <input dir="ltr" value={slug} maxLength={60} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} className={fieldCls} />
              <span className="text-[11px] text-[var(--text-dim)]">{b("addressHint", "Small letters, digits and dashes — the page opens at /address.")}</span>
            </label>
          </div>
          {createError ? <p className="text-[12px] text-[#FF3333]">{createError}</p> : null}
          <div className="flex gap-2">
            <button className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40" disabled={busy || !name.trim() || !slug} onClick={() => void create()}>{b("create", "Create")}</button>
            <button className={smallBtn} onClick={() => setCreating(false)}>{b("cancel", "Cancel")}</button>
          </div>
        </div>
      ) : null}

      {failed ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-color)] p-5">
          <p className="text-sm text-[var(--text-secondary)]">{t("builder.loadFailed", "The pages could not be loaded.")}</p>
          <button onClick={() => void load()} className={smallBtn}>{t("builder.retry", "Try again")}</button>
        </div>
      ) : pages === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--bg-secondary)]" />)}
        </div>
      ) : pages.length === 0 ? (
        <p className="py-6 text-sm text-[var(--text-secondary)]">{t("builder.empty", "No pages yet.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pages.map((p) => (
            <li key={p.slug} className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] px-4 py-3">
              <button className="min-w-0 flex-1 text-start" onClick={() => onOpen(p.slug)}>
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  /{p.slug === "home" ? "" : p.slug} · {status(p)} · {t("builder.updated", "Updated")} {dmy(p.updatedAt)}
                </p>
              </button>
              <button onClick={() => onOpen(p.slug)} className={smallBtn}><PencilIcon size={12} />{b("open", "Edit")}</button>
              <button onClick={() => onPreview(p.slug === "home" ? "/" : `/${p.slug}`)} className={smallBtn}><EyeIcon size={12} />{t("preview", "Preview")}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
