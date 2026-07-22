"use client";

/* ---------------------------------------------------------------------------
   DatabaseHome — front door of the Database app.

   The Database is the Hub's centralized data layer: a CONTAINER for many data
   systems. The Visual Library is just one of those systems (it happens to
   store icons + visual assets). This page presents the systems — it is NOT a
   visual-library / icons screen. More datasets (reference data, taxonomies,
   shared tables) will live here over time.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import MegaphoneIcon from "@/components/icons/ui/MegaphoneIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "db.home.introTitle":   { en: "Centralized data systems", zh: "集中式数据系统", ar: "أنظمة بيانات مركزية" },
  "db.home.introBody":    {
    en: "The Database is the Hub’s shared data layer. Each system below is an independent dataset with its own structure and governance. The Visual Library is the first — more reference data and taxonomies will live here.",
    zh: "数据库是 Hub 的共享数据层。下方每个系统都是拥有独立结构与治理的独立数据集。视觉库是第一个 — 更多参考数据与分类体系将陆续加入。",
    ar: "قاعدة البيانات هي طبقة البيانات المشتركة في المنصة. كل نظام أدناه هو مجموعة بيانات مستقلة ببنيتها وضوابطها الخاصة. مكتبة الصور هي الأولى — وستُضاف هنا المزيد من البيانات المرجعية والتصنيفات.",
  },
  "db.home.dataSystems":  { en: "Data systems", zh: "数据系统", ar: "أنظمة البيانات" },
  "db.home.visualLibrary": { en: "Visual Library", zh: "视觉库", ar: "مكتبة الصور" },
  "db.home.vlDesc":       {
    en: "Icons & visual assets — one approved source of truth, with collections, classification and review.",
    zh: "图标与视觉素材 — 唯一批准的可信来源，包含合集、分类与审核。",
    ar: "الأيقونات والأصول المرئية — مصدر حقيقة معتمد واحد، مع المجموعات والتصنيف والمراجعة.",
  },
  "db.home.openSystem":   { en: "Open system →", zh: "打开系统 →", ar: "فتح النظام ←" },
  "db.home.issueReports": { en: "Issue Reports", zh: "问题报告", ar: "بلاغات المشاكل" },
  "db.home.issuesDesc":   {
    en: "Bugs, UI issues and suggestions reported from across the Hub — triage, track and resolve.",
    zh: "来自整个 Hub 的错误、界面问题与建议 — 分诊、跟踪并解决。",
    ar: "الأخطاء ومشاكل الواجهة والاقتراحات المبلّغ عنها من مختلف أنحاء المنصة — فرز ومتابعة وحل.",
  },
  "db.home.moreSystems":  { en: "More systems coming", zh: "更多系统即将上线", ar: "أنظمة إضافية قريبًا" },
  "db.home.moreSystemsDesc": {
    en: "Reference data, taxonomies and shared datasets will live here.",
    zh: "参考数据、分类体系与共享数据集将在此呈现。",
    ar: "ستتوفر هنا البيانات المرجعية والتصنيفات ومجموعات البيانات المشتركة.",
  },
};

interface Stats { total: number }

export default function DatabaseHome() {
  const { t } = useTranslation(T);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/visual-library/stats", { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((s: Stats | null) => { if (alive && s) setCount(s.total); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><BoxesIcon size={20} /></span>
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("db.home.introTitle", "Centralized data systems")}</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              {t("db.home.introBody", "The Database is the Hub’s shared data layer. Each system below is an independent dataset with its own structure and governance. The Visual Library is the first — more reference data and taxonomies will live here.")}
            </p>
          </div>
        </div>
      </div>

      {/* Systems grid */}
      <div>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("db.home.dataSystems", "Data systems")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/database/visual-library"
            className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><PaletteIcon size={20} /></span>
              {count !== null && <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">{count.toLocaleString()}</span>}
            </div>
            <div className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">{t("db.home.visualLibrary", "Visual Library")}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{t("db.home.vlDesc", "Icons & visual assets — one approved source of truth, with collections, classification and review.")}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]">{t("db.home.openSystem", "Open system →")}</span>
          </Link>

          <Link href="/database/issues"
            className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]"><MegaphoneIcon size={20} /></span>
            <div className="mt-3.5 text-[15px] font-semibold text-[var(--text-primary)]">{t("db.home.issueReports", "Issue Reports")}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{t("db.home.issuesDesc", "Bugs, UI issues and suggestions reported from across the Hub — triage, track and resolve.")}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-dim)] transition-colors group-hover:text-[var(--text-primary)]">{t("db.home.openSystem", "Open system →")}</span>
          </Link>

          <div className="flex flex-col items-start justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-5 text-[var(--text-dim)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)]"><LayersIcon size={20} /></span>
            <div className="mt-3.5 text-[13.5px] font-medium text-[var(--text-muted)]">{t("db.home.moreSystems", "More systems coming")}</div>
            <p className="mt-1 text-[12px] leading-relaxed">{t("db.home.moreSystemsDesc", "Reference data, taxonomies and shared datasets will live here.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
