"use client";

/* Brand Center item — the top of its page: what it looks like and how to
   get one. The template drawn (or the approved design's picture), then the
   actions: make yours in the template, download the approved files, copy
   the supplier brief. What the reader came for comes first; the rules
   follow below. */

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { fileDownloadHref, type BcDesign, type BcType } from "@/lib/brand-center/client";
import { RULE_TEMPLATES, hasRules, type ItemRules } from "@/lib/brand-center/rules";
import { supplierBrief } from "@/lib/brand-center/brief";
import RrIcon from "@/components/ui/RrIcon";
import { CARD } from "@/components/travel/fields";

type T = (k: string) => string;

const ItemPreview = dynamic(() => import("./ItemPreview"), {
  ssr: false,
  loading: () => <div className="mx-auto aspect-[16/10] w-full max-w-[520px] animate-pulse rounded-xl bg-[var(--bg-surface)]" />,
});

/** Templates that draw the item (a print proof is a tool, not the item). */
const DRAWS = (id: string) => id !== "print-proof";
const size = (b: number | null) => (b === null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function ItemHero({ t, name, status, rules, types, designs }: {
  t: T; name: string; status: "draft" | "approved" | "retired"; rules: ItemRules | null; types: BcType[]; designs: BcDesign[];
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const templates = rules?.templates ?? [];
  const drawn = templates.find(DRAWS);
  /* The approved design: the default one in use, else the first in use. */
  const live = designs.filter((d) => d.status === "active");
  const design = live.find((d) => d.is_default) ?? live[0] ?? null;
  const files = design?.files ?? [];
  const picture = !drawn ? files.find((f) => f.mime?.startsWith("image/")) : undefined;
  const visual = !!drawn || !!picture;
  const withRules = hasRules(rules);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(supplierBrief(name, rules ?? {}, types));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2400);
  };

  const lead = [
    status === "draft" ? t("hero.draft") : null,
    design && files.length ? t("hero.fileReady") : t("hero.noFile"),
    templates.length ? t("hero.useTemplate") : withRules ? t("hero.useRules") : t("item.rulesSoon"),
  ].filter(Boolean) as string[];

  return (
    <section data-kx-pane aria-label={t("hero.title")} className={`${CARD} mt-4 grid grid-cols-1 [&>*]:min-w-0 gap-5 px-4 py-4 md:px-5 md:py-5 ${visual ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center" : ""}`}>
      {visual ? (
        <div className="rounded-xl bg-[var(--bg-surface-subtle)] px-4 py-6 md:px-6 md:py-8">
          {drawn ? <ItemPreview templateId={drawn} label={name} />
            /* eslint-disable-next-line @next/next/no-img-element -- a private file behind a short-lived signed link */
            : picture ? <img src={fileDownloadHref(picture.id)} alt={name} className="mx-auto block max-h-[320px] w-auto max-w-full rounded-lg object-contain" /> : null}
        </div>
      ) : null}

      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("hero.title")}</h2>
        <ul className="mt-2 grid [&>*]:min-w-0 gap-1.5">
          {lead.map((line, i) => (
            <li key={i} className={`text-[13px] leading-5 ${i === 0 && status === "draft" ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{line}</li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {templates.map((id, i) => (
            <Link key={id} href={`/brand-center/templates/${id}`}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold ${i === 0 ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"}`}>
              <RrIcon name="pencil" size={13} />
              {i === 0 ? t("hero.make") : t(RULE_TEMPLATES[id] ?? id)}
            </Link>
          ))}
          {files.map((f) => (
            <a key={f.id} href={fileDownloadHref(f.id)} dir="auto"
              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]">
              <RrIcon name="download" size={13} />
              <span className="truncate">{f.file_name}</span>
              <span className="shrink-0 text-[11px] font-normal text-[var(--text-dim)] tabular-nums">{size(f.size_bytes)}</span>
            </a>
          ))}
          {withRules ? (
            <button type="button" onClick={() => void copy()}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]">
              <RrIcon name={copied === "done" ? "check" : "clipboard"} size={13} />
              {copied === "done" ? t("hero.copied") : t("hero.copyBrief")}
            </button>
          ) : null}
        </div>
        {templates.length ? <p className="mt-2 text-[11.5px] text-[var(--text-dim)]">{t("hero.makeHint")}</p> : null}
        {withRules ? <p aria-live="polite" className="mt-1 text-[11.5px] text-[var(--text-dim)]">{copied === "failed" ? <span className="text-red-500">{t("hero.copyFailed")}</span> : t("hero.briefHint")}</p> : null}
      </div>
    </section>
  );
}
