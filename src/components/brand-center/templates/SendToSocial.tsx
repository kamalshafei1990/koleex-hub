"use client";

/* ---------------------------------------------------------------------------
   Brand Center → Social Marketing (plan step C17). A post designed in the
   studio becomes a DRAFT there: the page saved as the picture the composer
   takes (JPEG, uploaded the composer's own way), a caption suggested from
   the post (ch. 80), the accounts picked — then the composer opens on it to
   edit, schedule and send for approval. Nothing is published here, and the
   approval rules stay Social Marketing's.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateDef, TemplateValues } from "@/lib/brand-center/templates/types";
import { uploadPostMedia } from "@/lib/marketing/media-prep";
import { IG_RATIO_MAX, IG_RATIO_MIN } from "@/lib/marketing/post-rules";
import { SPACE_POSTS, accountLabel, type MarketingAccountView } from "@/lib/marketing/spaces";
import type { PostMedia } from "@/lib/marketing/post-types";
import { SELECTED_CHIP } from "@/components/travel/fields";
import { FIELD } from "../ui";
import { rasterize } from "./raster";

type T = (k: string) => string;
type Setup =
  | { state: "loading" }
  | { state: "error" | "denied" }
  | { state: "ready"; accounts: MarketingAccountView[]; prefix: string };

export default function SendToSocial({ t, def, values, size, sheets, onBlocked, fileBase }: {
  t: T; def: TemplateDef; values: TemplateValues; size: { w: number; h: number };
  /** The pages as they are saved (no guides). */
  sheets: () => SVGSVGElement[];
  onBlocked: (key: string | null) => void;
  fileBase: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setSetup({ state: "loading" });
    try {
      const res = await fetch("/api/marketing/posts/setup?space=company", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) { setSetup({ state: "denied" }); return; }
      if (!res.ok) { setSetup({ state: "error" }); return; }
      const b = (await res.json()) as { accounts?: MarketingAccountView[]; uploadPrefix?: string; canCreate?: boolean };
      if (!b.canCreate || !b.uploadPrefix) { setSetup({ state: "denied" }); return; }
      const accounts = (b.accounts ?? []).filter((a) => a.status === "connected");
      setSetup({ state: "ready", accounts, prefix: b.uploadPrefix });
      setPicked(accounts.map((a) => a.id));
    } catch {
      setSetup({ state: "error" });
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setError(null);
    if (next) {
      setCaption(def.caption ? def.caption(values) : "");
      if (!setup || setup.state === "error") void load();
    }
  };

  /* Instagram takes pictures between 4:5 and 1.91:1 (a story size is not one). */
  const ratio = size.w / size.h;
  const igOff = ratio < IG_RATIO_MIN - 0.001 || ratio > IG_RATIO_MAX + 0.001;
  const ready = setup?.state === "ready" ? setup : null;
  const igPicked = !!ready && ready.accounts.some((a) => a.platform === "instagram" && picked.includes(a.id));

  const send = async () => {
    if (!ready) return;
    const missing = def.check ? def.check(values) : null;
    if (missing) { onBlocked(missing); return; }
    if (!picked.length) { setError("studio.social.pickOne"); return; }
    setBusy(true);
    setError(null);
    onBlocked(null);
    try {
      const media: PostMedia[] = [];
      for (const [i, svg] of sheets().entries()) {
        const blob = await rasterize(svg, size.w, size.h, "image/jpeg");
        if (!blob) throw new Error("picture");
        const file = new File([blob], `${fileBase}-${size.w}x${size.h}${i ? `-${i + 1}` : ""}.jpg`, { type: "image/jpeg" });
        media.push(await uploadPostMedia(file, ready.prefix));
      }
      if (!media.length) throw new Error("picture");
      const res = await fetch("/api/marketing/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space: "company", body: caption, media, targets: picked.map((account_id) => ({ account_id, body_override: null })), scheduled_at: null }),
      });
      const b = (await res.json().catch(() => ({}))) as { id?: string };
      if (!res.ok || !b.id) throw new Error(String(res.status));
      router.push(`${SPACE_POSTS.company}/${b.id}`);
    } catch (e) {
      console.error("[brand-center] the post could not go to Social Marketing", e instanceof Error ? e.message : e);
      setError("studio.social.failed");
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button type="button" aria-expanded={open} onClick={toggle}
        className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)]">
        {t("studio.social.send")}
      </button>
      {open ? (
        <div className="mt-3 rounded-xl border border-[var(--border-subtle)] px-3 py-3">
          <p className="max-w-2xl text-[11.5px] leading-5 text-[var(--text-dim)]">{t("studio.social.hint")}</p>
          {!setup || setup.state === "loading" ? (
            <p className="mt-2 text-[12px] text-[var(--text-dim)]">{t("studio.social.loading")}</p>
          ) : setup.state === "denied" ? (
            <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{t("studio.social.denied")}</p>
          ) : setup.state === "error" ? (
            <p role="alert" className="mt-2 text-[12px] text-red-500">{t("studio.social.loadFailed")}</p>
          ) : !ready ? null : !ready.accounts.length ? (
            <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
              {t("studio.social.noAccounts")}{" "}
              <a href="/social-marketing" className="font-semibold text-[var(--text-primary)] underline">{t("studio.social.open")}</a>
            </p>
          ) : (
            <>
              <p className="mt-3 text-[11.5px] text-[var(--text-dim)]">{t("studio.social.accounts")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={t("studio.social.accounts")}>
                {ready.accounts.map((a) => {
                  const on = picked.includes(a.id);
                  return (
                    <button key={a.id} type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                      className={`rounded-lg border px-2.5 py-1 text-[12px] ${on ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>
                      {/* no span inside: a selected chip tints the spans in it */}
                      {`${a.platform[0].toUpperCase()}${a.platform.slice(1)} · ${accountLabel(a)}`}
                    </button>
                  );
                })}
              </div>
              {igPicked && igOff ? <p className="mt-1.5 text-[11.5px] text-amber-500">{t("studio.social.igRatio")}</p> : null}
              <label htmlFor="bc-social-caption" className="mt-3 block text-[11.5px] text-[var(--text-dim)]">{t("studio.social.caption")}</label>
              <textarea id="bc-social-caption" dir="auto" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} className={`${FIELD} mt-1`} />
              <p className="mt-1 text-[11px] text-[var(--text-dim)]">{t("studio.social.captionHint")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy} onClick={() => void send()}
                  className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
                  {t(busy ? "studio.social.sending" : "studio.social.create")}
                </button>
                {error ? <span role="alert" className="text-[12px] text-red-500">{t(error)}</span> : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
