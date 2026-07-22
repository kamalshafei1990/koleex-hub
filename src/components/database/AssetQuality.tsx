"use client";

/* ---------------------------------------------------------------------------
   AssetQuality — the "Quality" tab of the Asset Workspace. Lazy-loads the
   visual-quality profile (computed server-side on first read) and renders an
   elegant visual-QA interface: hero gauge, consistency bars, readability/
   scaling previews, duplicate detection, collection compatibility, warning
   cards, and manual review. KOLEEX dark / minimal.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type { QualityProfile, QualityWarning, QualityStatus } from "@/lib/visual-library/types";
import { QUALITY_STATUSES } from "@/lib/visual-library/types";
import { statusTone } from "@/lib/visual-library/quality";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.quality.loadFail":          { en: "Couldn’t load quality profile.", zh: "无法加载质量档案。", ar: "تعذّر تحميل ملف الجودة." },
  "vl.quality.status.excellent":  { en: "excellent",  zh: "优秀",   ar: "ممتاز" },
  "vl.quality.status.good":       { en: "good",       zh: "良好",   ar: "جيد" },
  "vl.quality.status.acceptable": { en: "acceptable", zh: "合格",   ar: "مقبول" },
  "vl.quality.status.poor":       { en: "poor",       zh: "较差",   ar: "ضعيف" },
  "vl.quality.status.rejected":   { en: "rejected",   zh: "已拒绝", ar: "مرفوض" },
  "vl.quality.recompute":         { en: "Recompute",  zh: "重新计算", ar: "إعادة الحساب" },
  "vl.quality.overall":           { en: "Overall visual quality", zh: "整体视觉质量", ar: "الجودة البصرية الإجمالية" },
  "vl.quality.collectionMatch":   { en: "Collection match", zh: "合集匹配", ar: "تطابق المجموعة" },
  "vl.quality.dupRisk":           { en: "Duplicate risk",   zh: "重复风险", ar: "خطر التكرار" },
  "vl.quality.darkMode":          { en: "Dark mode",        zh: "深色模式", ar: "الوضع الداكن" },
  "vl.quality.uniqueness":        { en: "Uniqueness",       zh: "独特性",   ar: "التفرّد" },
  "vl.quality.consistency":       { en: "Visual consistency", zh: "视觉一致性", ar: "الاتساق البصري" },
  "vl.quality.strokeConsistency": { en: "Stroke consistency", zh: "笔画一致性", ar: "اتساق الخطوط" },
  "vl.quality.styleConsistency":  { en: "Style consistency",  zh: "风格一致性", ar: "اتساق الأسلوب" },
  "vl.quality.spacing":           { en: "Spacing / padding",  zh: "间距 / 留白", ar: "التباعد / الهوامش" },
  "vl.quality.opticalBalance":    { en: "Optical balance",    zh: "视觉平衡",   ar: "التوازن البصري" },
  "vl.quality.symmetry":          { en: "Symmetry",           zh: "对称性",     ar: "التماثل" },
  "vl.quality.simplicity":        { en: "Simplicity",         zh: "简洁度",     ar: "البساطة" },
  "vl.quality.corners":           { en: "{x} corners",        zh: "{x}边角",    ar: "زوايا {x}" },
  "vl.quality.readability":       { en: "Readability & scaling", zh: "可读性与缩放", ar: "سهولة القراءة والتحجيم" },
  "vl.quality.dark":              { en: "dark",               zh: "深色",       ar: "داكن" },
  "vl.quality.smallRead":         { en: "Small-size readability (16px)", zh: "小尺寸可读性（16px）", ar: "سهولة القراءة بالحجم الصغير (16px)" },
  "vl.quality.scalability":       { en: "Scalability",        zh: "可缩放性",   ar: "قابلية التحجيم" },
  "vl.quality.darkBg":            { en: "Dark background",    zh: "深色背景",   ar: "خلفية داكنة" },
  "vl.quality.monochrome":        { en: "Monochrome",         zh: "单色",       ar: "أحادي اللون" },
  "vl.quality.dupDetection":      { en: "Duplicate detection", zh: "重复检测",  ar: "كشف التكرار" },
  "vl.quality.noSimilar":         { en: "No visually-similar assets detected.", zh: "未检测到视觉相似的素材。", ar: "لم يتم رصد أصول متشابهة بصريًا." },
  "vl.quality.collectionCompat":  { en: "Collection compatibility", zh: "合集兼容性", ar: "التوافق مع المجموعات" },
  "vl.quality.notInCollection":   { en: "Not in any collection.", zh: "不属于任何合集。", ar: "ليست ضمن أي مجموعة." },
  "vl.quality.conflict":          { en: "conflict",           zh: "冲突",       ar: "تعارض" },
  "vl.quality.compatible":        { en: "compatible",         zh: "兼容",       ar: "متوافق" },
  "vl.quality.manualReview":      { en: "Manual review",      zh: "人工审核",   ar: "المراجعة اليدوية" },
  "vl.quality.notesPh":           { en: "Reviewer notes…",    zh: "审核备注…",  ar: "ملاحظات المراجع…" },
  "vl.quality.saveNotes":         { en: "Save notes",         zh: "保存备注",   ar: "حفظ الملاحظات" },
  "vl.quality.lastReviewed":      { en: "Last reviewed {date}", zh: "上次审核于 {date}", ar: "آخر مراجعة {date}" },
};

interface Similar { id: string; title: string; public_url: string | null; score: number }
interface Resp { quality: QualityProfile; warnings?: QualityWarning[]; similar: Similar[]; collections: { name: string; preferred_style: string | null }[]; cached?: boolean }

const toneText = (t: "positive" | "warning" | "rose") => t === "positive" ? "text-emerald-400" : t === "warning" ? "text-amber-400" : "text-rose-400";
const toneStroke = (t: "positive" | "warning" | "rose") => t === "positive" ? "#34d399" : t === "warning" ? "#fbbf24" : "#fb7185";

export default function AssetQuality({
  asset, onOpenAsset,
}: { asset: { id: string; title: string; public_url?: string | null }; onOpenAsset?: (id: string) => void }) {
  const { t } = useTranslation(T);
  const [data, setData] = useState<Resp | null>(null);
  const [warnings, setWarnings] = useState<QualityWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [notes, setNotes] = useState("");

  const load = async (recompute = false) => {
    recompute ? setRecomputing(true) : setLoading(true);
    try {
      const res = await fetch(`/api/visual-library/${asset.id}/quality${recompute ? "?recompute=1" : ""}`, { credentials: "include", cache: "no-store" });
      const j: Resp = res.ok ? await res.json() : null as never;
      if (j) { setData(j); setWarnings(j.warnings ?? []); setNotes(j.quality.manual_notes ?? ""); }
    } finally { setLoading(false); setRecomputing(false); }
  };
  useEffect(() => { load(); }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (overall_status?: QualityStatus) => {
    setSavingReview(true);
    await fetch(`/api/visual-library/${asset.id}/quality`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overall_status, manual_notes: notes }),
    });
    setSavingReview(false); load();
  };

  if (loading) return <div className="flex justify-center py-10 text-[var(--text-dim)]"><SpinnerIcon size={18} className="animate-spin" /></div>;
  if (!data) return <p className="py-8 text-center text-[12.5px] text-[var(--text-dim)]">{t("vl.quality.loadFail", "Couldn’t load quality profile.")}</p>;

  const q = data.quality;
  const tone = statusTone(q.overall_status);

  return (
    <div className="space-y-5">
      {/* 1 · Hero */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-4">
          <Gauge value={q.quality_score} tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[13px] font-semibold capitalize ${toneText(tone)}`}>{t(`vl.quality.status.${q.overall_status}`, q.overall_status)}</span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{q.complexity_level ?? "—"}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("vl.quality.overall", "Overall visual quality")}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <Mini label={t("vl.quality.collectionMatch", "Collection match")} value={q.collection_match_score} />
              <Mini label={t("vl.quality.dupRisk", "Duplicate risk")} value={q.duplicate_risk_score} invert />
              <Mini label={t("vl.quality.darkMode", "Dark mode")} value={q.dark_mode_score} />
              <Mini label={t("vl.quality.uniqueness", "Uniqueness")} value={q.uniqueness_score} />
            </div>
          </div>
          <button type="button" onClick={() => load(true)} disabled={recomputing} title={t("vl.quality.recompute", "Recompute")}
            className="self-start rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <RefreshCwIcon size={13} className={recomputing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 6 · Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] ${w.severity === "error" ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
              <span className="mt-px">⚠</span><span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 2 · Visual consistency */}
      <Section title={t("vl.quality.consistency", "Visual consistency")}>
        <Bar label={t("vl.quality.strokeConsistency", "Stroke consistency")} value={q.stroke_consistency_score} />
        <Bar label={t("vl.quality.styleConsistency", "Style consistency")} value={q.style_consistency_score} />
        <Bar label={t("vl.quality.spacing", "Spacing / padding")} value={q.spacing_score} />
        <Bar label={t("vl.quality.opticalBalance", "Optical balance")} value={q.optical_balance_score ?? 0} />
        <Bar label={t("vl.quality.symmetry", "Symmetry")} value={q.symmetry_score ?? 0} />
        <Bar label={t("vl.quality.simplicity", "Simplicity")} value={q.simplicity_score} />
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px]">
          {q.stroke_style && <Chip>{q.stroke_style}</Chip>}
          {q.corner_style && <Chip>{t("vl.quality.corners", "{x} corners").replace("{x}", q.corner_style)}</Chip>}
          {q.shape_language && <Chip>{q.shape_language}</Chip>}
        </div>
      </Section>

      {/* 3 · Readability & scaling */}
      <Section title={t("vl.quality.readability", "Readability & scaling")}>
        <div className="mb-3 flex items-end gap-4">
          {[16, 24, 48].map((px) => (
            <div key={px} className="flex flex-col items-center gap-1">
              <span className="flex items-center justify-center rounded-md bg-white p-1 text-neutral-900" style={{ width: px + 8, height: px + 8 }}>
                {asset.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.public_url} alt="" style={{ width: px, height: px }} className="object-contain" />
                ) : <ImageRawIcon size={px} className="text-neutral-300" />}
              </span>
              <span className="text-[9.5px] text-[var(--text-dim)]">{px}px</span>
            </div>
          ))}
          {/* dark-bg sample */}
          <div className="flex flex-col items-center gap-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
              {asset.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.public_url} alt="" className="h-5 w-5 object-contain" style={{ filter: "invert(1)" }} />
              ) : null}
            </span>
            <span className="text-[9.5px] text-[var(--text-dim)]">{t("vl.quality.dark", "dark")}</span>
          </div>
        </div>
        <Bar label={t("vl.quality.smallRead", "Small-size readability (16px)")} value={q.small_size_readability ?? q.readability_score} />
        <Bar label={t("vl.quality.scalability", "Scalability")} value={q.scalability_score} />
        <Bar label={t("vl.quality.darkBg", "Dark background")} value={q.dark_background_compatibility ?? q.dark_mode_score} />
        <Bar label={t("vl.quality.monochrome", "Monochrome")} value={q.monochrome_compatibility ?? 0} />
      </Section>

      {/* 4 · Duplicate detection */}
      <Section title={`${t("vl.quality.dupDetection", "Duplicate detection")}${data.similar.length ? ` · ${data.similar.length}` : ""}`}>
        {data.similar.length === 0 ? (
          <p className="text-[11.5px] text-[var(--text-dim)]">{t("vl.quality.noSimilar", "No visually-similar assets detected.")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.similar.map((s) => (
              <button key={s.id} type="button" onClick={() => onOpenAsset?.(s.id)}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1 pl-1 pr-2.5 text-[11.5px] text-[var(--text-primary)] hover:border-[var(--border-color)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-neutral-900">
                  {s.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.public_url} alt="" className="h-4 w-4 object-contain" />
                  ) : null}
                </span>
                {s.title}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* 5 · Collection compatibility */}
      <Section title={t("vl.quality.collectionCompat", "Collection compatibility")}>
        {data.collections.length === 0 ? (
          <p className="text-[11.5px] text-[var(--text-dim)]">{t("vl.quality.notInCollection", "Not in any collection.")}</p>
        ) : (
          <div className="space-y-1.5">
            {data.collections.map((c, i) => {
              const conflict = c.preferred_style && q.shape_language && c.preferred_style !== q.shape_language;
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-[var(--text-muted)]">{c.name}</span>
                  <span className={conflict ? "text-amber-400" : "text-emerald-400"}>{conflict ? `${t("vl.quality.conflict", "conflict")} · ${c.preferred_style}` : t("vl.quality.compatible", "compatible")}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 7 · Manual review */}
      <Section title={t("vl.quality.manualReview", "Manual review")}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t("vl.quality.notesPh", "Reviewer notes…")}
          className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(QUALITY_STATUSES).map((s) => (
            <button key={s} type="button" disabled={savingReview} onClick={() => review(s)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors disabled:opacity-50 ${q.overall_status === s ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
              {t(`vl.quality.status.${s}`, s)}
            </button>
          ))}
          <button type="button" disabled={savingReview} onClick={() => review()}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
            {savingReview ? <SpinnerIcon size={12} className="animate-spin" /> : null} {t("vl.quality.saveNotes", "Save notes")}
          </button>
        </div>
        {q.reviewed_at && <p className="mt-1.5 text-[10.5px] text-[var(--text-dim)]">{t("vl.quality.lastReviewed", "Last reviewed {date}").replace("{date}", new Date(q.reviewed_at).toLocaleString())}</p>}
      </Section>
    </div>
  );
}

function Gauge({ value, tone }: { value: number; tone: "positive" | "warning" | "rose" }) {
  const r = 26, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border-color)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={toneStroke(tone)} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[17px] font-bold tabular-nums ${toneText(tone)}`}>{value}</span>
    </div>
  );
}
function Mini({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const good = invert ? value <= 30 : value >= 70;
  const mid = invert ? value <= 60 : value >= 50;
  const cls = good ? "text-emerald-400" : mid ? "text-amber-400" : "text-rose-400";
  return <div className="flex items-center justify-between gap-1"><span className="truncate text-[var(--text-dim)]">{label}</span><span className={`font-semibold tabular-nums ${cls}`}>{value}</span></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h4>
      {children}
    </div>
  );
}
function Bar({ label, value }: { label: string; value: number }) {
  const cls = value >= 70 ? "bg-emerald-400" : value >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div {...kxInspectAttrs({ component: "AssetQualityTab", module: "Database", section: "Quality" })} className="mb-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text-muted)]">{label}</span><span className="tabular-nums text-[var(--text-dim)]">{value}</span></div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className={`h-full rounded-full ${cls}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[var(--text-muted)]">{children}</span>;
}
