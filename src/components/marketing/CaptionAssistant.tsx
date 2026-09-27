"use client";

/* CaptionAssistant — Koleex AI writes the caption, one per platform, from
   what the post is about and/or an ACTIVE product. The suggestions stay on
   screen: "Use this text" puts one in the post's text, "Use for <account>"
   gives an account its own text. Nothing is written without a click. */

import { useEffect, useRef, useState } from "react";
import Button from "@/components/kds/Button";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import type { MarketingAccountView, MarketingSpace } from "@/lib/marketing/spaces";

type Tr = (key: string) => string;
type Lang = "en" | "ar" | "zh";

const fieldCls =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)] focus:outline-none";

export default function CaptionAssistant({ space, platforms, accounts, t, onUse, onUseFor, onClose }: {
  space: MarketingSpace;
  platforms: Array<"facebook" | "instagram">;
  accounts: MarketingAccountView[];
  t: Tr;
  onUse: (text: string) => void;
  onUseFor: (accountId: string, text: string) => void;
  onClose: () => void;
}) {
  const [brief, setBrief] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string }> | null>(null);
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string> | null>(null);
  const seq = useRef(0);

  /* Product search, debounced; an older answer never replaces a newer one. */
  useEffect(() => {
    const term = q.trim();
    if (!term || product) { setResults(null); return; }
    const mine = ++seq.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/marketing/products?space=${space}&q=${encodeURIComponent(term)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: Array<{ id: string; name: string }> };
        if (mine === seq.current) setResults(body.results);
      } catch {
        if (mine === seq.current) setResults([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q, product, space]);

  const write = async () => {
    if (!brief.trim() && !product) { setError(t("ai.needInput")); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space, brief, productId: product?.id ?? null, platforms, lang }),
      });
      const body = (await res.json().catch(() => ({}))) as { captions?: Record<string, string>; fallback?: boolean; reason?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? String(res.status));
      if (body.fallback || !body.captions) { setError(body.reason === "no_provider" ? t("ai.unavailable") : t("ai.failed")); return; }
      setCaptions(body.captions);
    } catch {
      setError(t("ai.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("ai.title")}</h3>
        <button type="button" onClick={onClose} className="text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("ai.close")}</button>
      </div>

      <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
        {t("ai.brief")}
        <textarea dir="auto" rows={2} maxLength={1000} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t("ai.briefPlaceholder")} className={`${fieldCls} resize-y py-2 leading-5`} />
      </label>

      <div className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
        {t("ai.product")}
        {product ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
            <span className="min-w-0 truncate text-[13px] text-[var(--text-primary)]">{product.name}</span>
            <button type="button" onClick={() => { setProduct(null); setQ(""); }} className="shrink-0 text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("ai.clearProduct")}</button>
          </div>
        ) : (
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ai.productSearch")} className={`${fieldCls} h-10`} />
            {results && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {results.length === 0 ? (
                  <li className="px-3 py-2 text-[12px] text-[var(--text-dim)]">{t("ai.noProducts")}</li>
                ) : results.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => { setProduct(r); setResults(null); }} className="w-full px-3 py-2 text-start text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]">{r.name}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("ai.lang")} className="flex gap-1 rounded-xl border border-[var(--border-subtle)] p-1">
          {(["en", "ar", "zh"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
              className={`h-8 rounded-lg px-3 text-[12px] font-semibold ${lang === l ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void write()} className="kx-ai-glow">
          {busy ? <><SpinnerIcon size={14} className="motion-safe:animate-spin" />{t("ai.writing")}</> : t("ai.write")}
        </Button>
      </div>
      {error && <p role="alert" className="text-[12px] text-[#FF3333]">{error}</p>}

      {captions && (
        <div className="flex flex-col gap-3">
          {platforms.filter((p) => captions[p]).map((p) => (
            <div key={p} className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]"><BrandGlyph name={p} size={14} />{t(`pname.${p}`)}</div>
              <p dir="auto" className="whitespace-pre-wrap break-words text-[13px] leading-5 text-[var(--text-primary)]">{captions[p]}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => onUse(captions[p])}>{t("ai.useAll")}</Button>
                {accounts.filter((a) => a.platform === p && a.connection === "api").map((a) => (
                  <Button key={a.id} type="button" variant="ghost" onClick={() => onUseFor(a.id, captions[p])}>{t("ai.useFor").replace("{name}", a.name)}</Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
