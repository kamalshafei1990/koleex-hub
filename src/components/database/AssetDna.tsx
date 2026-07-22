"use client";

/* ---------------------------------------------------------------------------
   AssetDna — the "DNA" tab of the Asset Workspace. Lazy-loads the KOLEEX
   Design DNA analysis (computed server-side, cached) and renders: a hero
   compatibility gauge + match status + personality, brand-language bars,
   the visual fingerprint, KOLEEX rule violations, visual-language DNA matches,
   and DNA pattern-match percentages. KOLEEX dark / minimal.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type { DnaAnalysis } from "@/lib/visual-library/types";
import { dnaMatchStatus } from "@/lib/visual-library/design-dna";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.dna.loadFailed":       { en: "Couldn’t load DNA profile.", zh: "无法加载 DNA 档案。", ar: "تعذّر تحميل ملف الـ DNA." },
  "vl.dna.recompute":        { en: "Recompute", zh: "重新计算", ar: "إعادة الحساب" },
  "vl.dna.compatibility":    { en: "KOLEEX DNA compatibility", zh: "KOLEEX DNA 兼容性", ar: "توافق DNA مع KOLEEX" },
  "vl.dna.minimal":          { en: "Minimal", zh: "极简", ar: "بساطة" },
  "vl.dna.symmetry":         { en: "Symmetry", zh: "对称", ar: "تناظر" },
  "vl.dna.industrial":       { en: "Industrial", zh: "工业感", ar: "صناعي" },
  "vl.dna.futuristic":       { en: "Futuristic", zh: "未来感", ar: "مستقبلي" },
  "vl.dna.luxury":           { en: "Luxury", zh: "奢华感", ar: "فخامة" },
  "vl.dna.readable":         { en: "Readable", zh: "可读性", ar: "وضوح" },
  "vl.dna.brandAnalysis":    { en: "Brand language analysis", zh: "品牌语言分析", ar: "تحليل لغة العلامة" },
  "vl.dna.strokeConsistency": { en: "Stroke consistency", zh: "笔画一致性", ar: "اتساق الخطوط" },
  "vl.dna.cornerLanguage":   { en: "Corner language", zh: "圆角语言", ar: "لغة الزوايا" },
  "vl.dna.geometryConsistency": { en: "Geometry consistency", zh: "几何一致性", ar: "الاتساق الهندسي" },
  "vl.dna.opticalBalance":   { en: "Optical balance", zh: "视觉平衡", ar: "التوازن البصري" },
  "vl.dna.negativeSpace":    { en: "Negative space", zh: "负空间", ar: "المساحة السلبية" },
  "vl.dna.simplicity":       { en: "Simplicity", zh: "简洁度", ar: "البساطة" },
  "vl.dna.collectionConsistency": { en: "Collection consistency", zh: "合集一致性", ar: "اتساق المجموعة" },
  "vl.dna.fingerprint":      { en: "Visual fingerprint", zh: "视觉指纹", ar: "البصمة البصرية" },
  "vl.dna.shape":            { en: "Shape", zh: "形状", ar: "الشكل" },
  "vl.dna.weight":           { en: "Weight", zh: "粗细", ar: "الوزن" },
  "vl.dna.density":          { en: "Density", zh: "密度", ar: "الكثافة" },
  "vl.dna.temp":             { en: "Temp", zh: "色温", ar: "الحرارة" },
  "vl.dna.patternMatch":     { en: "DNA pattern match", zh: "DNA 模式匹配", ar: "مطابقة أنماط الـ DNA" },
  "vl.dna.matches":          { en: "DNA matches", zh: "DNA 匹配", ar: "مطابقات الـ DNA" },
  "vl.dna.matchesHint":      { en: "Same visual language (stroke · geometry · density) — not semantic.", zh: "相同的视觉语言（笔画 · 几何 · 密度）— 非语义匹配。", ar: "نفس اللغة البصرية (الخط · الهندسة · الكثافة) — وليست دلالية." },
  "vl.dna.noMatches":        { en: "No close visual-language matches.", zh: "暂无相近的视觉语言匹配。", ar: "لا توجد مطابقات قريبة في اللغة البصرية." },
};

interface Similar { id: string; title: string; public_url: string | null }
interface Violation { kind: string; message: string }
interface Resp { dna: DnaAnalysis; violations?: Violation[]; similar: Similar[]; cached?: boolean }

const toneText = (t: "positive" | "warning" | "rose") => t === "positive" ? "text-emerald-400" : t === "warning" ? "text-amber-400" : "text-rose-400";
const toneStroke = (t: "positive" | "warning" | "rose") => t === "positive" ? "#34d399" : t === "warning" ? "#fbbf24" : "#fb7185";

export default function AssetDna({
  asset, onOpenAsset,
}: { asset: { id: string; title: string }; onOpenAsset?: (id: string) => void }) {
  const { t } = useTranslation(T);
  const [data, setData] = useState<Resp | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const load = async (recompute = false) => {
    recompute ? setRecomputing(true) : setLoading(true);
    try {
      const res = await fetch(`/api/visual-library/${asset.id}/dna${recompute ? "?recompute=1" : ""}`, { credentials: "include", cache: "no-store" });
      const j: Resp = res.ok ? await res.json() : null as never;
      if (j) { setData(j); if (j.violations) setViolations(j.violations); }
    } finally { setLoading(false); setRecomputing(false); }
  };
  useEffect(() => { load(); }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-10 text-[var(--text-dim)]"><SpinnerIcon size={18} className="animate-spin" /></div>;
  if (!data) return <p className="py-8 text-center text-[12.5px] text-[var(--text-dim)]">{t("vl.dna.loadFailed", "Couldn’t load DNA profile.")}</p>;

  const d = data.dna;
  const m = dnaMatchStatus(d.overall_score);
  const fingerprint = Array.from(new Set([
    d.corner_family, d.geometry_family, d.stroke_family, d.visual_temperature === "cool" ? "monochrome" : null,
    d.icon_personality, d.complexity_level === "minimal" ? "minimal" : null, d.visual_weight,
  ].filter(Boolean) as string[]));

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-4">
          <Gauge value={d.overall_score} tone={m.tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[13px] font-semibold ${toneText(m.tone)}`}>{m.label}</span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{d.icon_personality}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("vl.dna.compatibility", "KOLEEX DNA compatibility")}</p>
            <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
              <Mini label={t("vl.dna.minimal", "Minimal")} value={d.minimalism_score} />
              <Mini label={t("vl.dna.symmetry", "Symmetry")} value={d.symmetry_score} />
              <Mini label={t("vl.dna.industrial", "Industrial")} value={d.industrial_score} />
              <Mini label={t("vl.dna.futuristic", "Futuristic")} value={d.futuristic_score} />
              <Mini label={t("vl.dna.luxury", "Luxury")} value={d.luxury_score} />
              <Mini label={t("vl.dna.readable", "Readable")} value={d.readability_score} />
            </div>
          </div>
          <button type="button" onClick={() => load(true)} disabled={recomputing} title={t("vl.dna.recompute", "Recompute")}
            className="self-start rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <RefreshCwIcon size={13} className={recomputing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="space-y-1.5">
          {violations.map((v, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-300">
              <span className="mt-px">⚠</span><span>{v.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Brand language analysis */}
      <Section title={t("vl.dna.brandAnalysis", "Brand language analysis")}>
        <Bar label={t("vl.dna.strokeConsistency", "Stroke consistency")} value={d.stroke_score} />
        <Bar label={t("vl.dna.cornerLanguage", "Corner language")} value={d.corner_score} />
        <Bar label={t("vl.dna.geometryConsistency", "Geometry consistency")} value={d.geometry_score} />
        <Bar label={t("vl.dna.opticalBalance", "Optical balance")} value={d.balance_score} />
        <Bar label={t("vl.dna.negativeSpace", "Negative space")} value={Math.round((d.negative_space_ratio ?? 0) * 100)} />
        <Bar label={t("vl.dna.simplicity", "Simplicity")} value={d.minimalism_score} />
        <Bar label={t("vl.dna.collectionConsistency", "Collection consistency")} value={d.consistency_score} />
      </Section>

      {/* Visual fingerprint */}
      <Section title={t("vl.dna.fingerprint", "Visual fingerprint")}>
        <div className="flex flex-wrap gap-1.5">
          {fingerprint.map((f) => (
            <span key={f} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] capitalize text-[var(--text-muted)]">{String(f).replace(/_/g, " ")}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] text-[var(--text-dim)]">
          <span>{t("vl.dna.shape", "Shape")} · <span className="text-[var(--text-muted)]">{d.shape_language}</span></span>
          <span>{t("vl.dna.weight", "Weight")} · <span className="text-[var(--text-muted)]">{d.visual_weight}</span></span>
          <span>{t("vl.dna.density", "Density")} · <span className="text-[var(--text-muted)] tabular-nums">{d.visual_density}</span></span>
          <span>{t("vl.dna.temp", "Temp")} · <span className="text-[var(--text-muted)]">{d.visual_temperature}</span></span>
        </div>
      </Section>

      {/* DNA pattern match */}
      <Section title={t("vl.dna.patternMatch", "DNA pattern match")}>
        <div className="space-y-1.5">
          {(d.pattern_matches ?? []).slice(0, 6).map((p) => (
            <div key={p.pattern_name}>
              <div className="mb-0.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text-muted)]">{p.pattern_name}</span><span className="tabular-nums text-[var(--text-dim)]">{p.score}%</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className={`h-full rounded-full ${p.score >= 70 ? "bg-emerald-400" : p.score >= 45 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${p.score}%` }} /></div>
            </div>
          ))}
        </div>
      </Section>

      {/* DNA matches (visual-language similarity) */}
      <Section title={`${t("vl.dna.matches", "DNA matches")}${data.similar.length ? ` · ${data.similar.length}` : ""}`}>
        <p className="mb-2 text-[10.5px] text-[var(--text-dim)]">{t("vl.dna.matchesHint", "Same visual language (stroke · geometry · density) — not semantic.")}</p>
        {data.similar.length === 0 ? (
          <p className="text-[11.5px] text-[var(--text-dim)]">{t("vl.dna.noMatches", "No close visual-language matches.")}</p>
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
function Mini({ label, value }: { label: string; value: number }) {
  const cls = value >= 70 ? "text-emerald-400" : value >= 50 ? "text-amber-400" : "text-rose-400";
  return <div className="flex items-center justify-between gap-1"><span className="truncate text-[var(--text-dim)]">{label}</span><span className={`font-semibold tabular-nums ${cls}`}>{value}</span></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h4>{children}</div>;
}
function Bar({ label, value }: { label: string; value: number }) {
  const cls = value >= 70 ? "bg-emerald-400" : value >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div {...kxInspectAttrs({ component: "AssetDNATab", module: "Database", section: "DNA" })} className="mb-1.5">
      <div className="mb-0.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text-muted)]">{label}</span><span className="tabular-nums text-[var(--text-dim)]">{value}</span></div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className={`h-full rounded-full ${cls}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}
