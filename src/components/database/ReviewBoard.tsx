"use client";

/* ---------------------------------------------------------------------------
   ReviewBoard — the Database → Review Board section. Turns the Visual Library
   into an operational review surface:

   • Dashboard cards (Reviewed · Pending · Approved · Needs revision · Rejected ·
     Production-ready · High risk · Deprecated)
   • Distribution bars (Quality / DNA bands + duplicate-risk count)
   • A filterable + sortable review queue (status · priority · risk · production)

   Clicking a queue row opens the full Asset Workspace drawer (Review tab),
   so a reviewer never leaves the board. KOLEEX dark / minimal.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import type { VisualAsset, ReviewStatus, RiskLevel } from "@/lib/visual-library/types";
import { REVIEW_STATUS_LABEL } from "@/lib/visual-library/types";
import { RISK_TONE, reviewStatusTone } from "@/lib/visual-library/review";
import VisualAssetDetailDrawer from "@/components/database/VisualAssetDetailDrawer";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.board.reviewed":       { en: "Reviewed",         zh: "已审核",   ar: "تمت مراجعتها" },
  "vl.board.pending":        { en: "Pending",          zh: "待审核",   ar: "قيد الانتظار" },
  "vl.board.approved":       { en: "Approved",         zh: "已批准",   ar: "معتمدة" },
  "vl.board.needsRevision":  { en: "Needs revision",   zh: "需修改",   ar: "تحتاج تعديلًا" },
  "vl.board.rejected":       { en: "Rejected",         zh: "已拒绝",   ar: "مرفوضة" },
  "vl.board.prodReady":      { en: "Production-ready", zh: "可投产",   ar: "جاهزة للإنتاج" },
  "vl.board.highRisk":       { en: "High risk",        zh: "高风险",   ar: "مخاطر مرتفعة" },
  "vl.board.deprecated":     { en: "Deprecated",       zh: "已弃用",   ar: "موقوفة" },
  "vl.board.qualityBands":   { en: "Quality bands",    zh: "质量分布", ar: "نطاقات الجودة" },
  "vl.board.dnaBands":       { en: "Brand DNA bands",  zh: "品牌 DNA 分布", ar: "نطاقات الهوية البصرية" },
  "vl.board.bandHigh":       { en: "High (80+)",       zh: "高（80+）",  ar: "مرتفع (80+)" },
  "vl.board.bandMid":        { en: "Mid (55–79)",      zh: "中（55–79）", ar: "متوسط (55–79)" },
  "vl.board.bandLow":        { en: "Low (<55)",        zh: "低（<55）",  ar: "منخفض (<55)" },
  "vl.board.dupExposure":    { en: "Duplicate exposure", zh: "重复风险敞口", ar: "التعرّض للتكرار" },
  "vl.board.dupHighAssets":  { en: "assets with high duplicate risk", zh: "个素材存在高重复风险", ar: "أصول ذات خطر تكرار مرتفع" },
  "vl.board.dupHint":        { en: "Candidates for consolidation or replacement before they reach production.", zh: "建议在投产前进行合并或替换。", ar: "مرشّحة للدمج أو الاستبدال قبل وصولها إلى الإنتاج." },
  "vl.board.reviewQueue":    { en: "Review queue",     zh: "审核队列", ar: "قائمة المراجعة" },
  "vl.board.items":          { en: "items",            zh: "项",       ar: "عنصرًا" },
  "vl.board.filter.all":     { en: "All",              zh: "全部",     ar: "الكل" },
  "vl.board.filter.replace": { en: "Replace",          zh: "替换",     ar: "استبدال" },
  "vl.board.approvedNotes":  { en: "Approved (notes)", zh: "已批准（附注）", ar: "معتمدة (بملاحظات)" },
  "vl.board.replaceRecommended": { en: "Replace recommended", zh: "建议替换", ar: "يُنصح بالاستبدال" },
  "vl.board.anyRisk":        { en: "Any risk",         zh: "任意风险", ar: "أي مستوى مخاطر" },
  "vl.board.riskX":          { en: "Risk: {x}",        zh: "风险：{x}", ar: "المخاطر: {x}" },
  "vl.board.risk.low":       { en: "low",              zh: "低",       ar: "منخفض" },
  "vl.board.risk.medium":    { en: "medium",           zh: "中",       ar: "متوسط" },
  "vl.board.risk.high":      { en: "high",             zh: "高",       ar: "مرتفع" },
  "vl.board.risk.critical":  { en: "critical",         zh: "严重",     ar: "حرج" },
  "vl.board.anyProduction":  { en: "Any production",   zh: "任意生产状态", ar: "أي حالة إنتاج" },
  "vl.board.notReady":       { en: "Not ready",        zh: "未就绪",   ar: "غير جاهزة" },
  "vl.board.sortRisk":       { en: "Highest risk",     zh: "风险最高", ar: "الأعلى مخاطرة" },
  "vl.board.sortLowest":     { en: "Lowest score",     zh: "分数最低", ar: "الأدنى نتيجة" },
  "vl.board.sortNewest":     { en: "Newest",           zh: "最新",     ar: "الأحدث" },
  "vl.board.sortOldest":     { en: "Oldest",           zh: "最早",     ar: "الأقدم" },
  "vl.board.emptyTitle":     { en: "No reviews match these filters yet.", zh: "暂无符合这些筛选的审核。", ar: "لا توجد مراجعات مطابقة لهذه المرشحات بعد." },
  "vl.board.emptyHint":      { en: "Open any asset’s Review tab to record a decision — it appears here instantly.", zh: "打开任意素材的“审核”标签记录裁定——会立即显示在这里。", ar: "افتح تبويب المراجعة لأي أصل لتسجيل قرار — وسيظهر هنا فورًا." },
  "vl.board.colAsset":       { en: "Asset",            zh: "素材",     ar: "الأصل" },
  "vl.board.colStatus":      { en: "Status",           zh: "状态",     ar: "الحالة" },
  "vl.board.colRisk":        { en: "Risk",             zh: "风险",     ar: "المخاطر" },
  "vl.board.colScore":       { en: "Score",            zh: "分数",     ar: "النتيجة" },
  "vl.board.colProduction":  { en: "Production",       zh: "生产",     ar: "الإنتاج" },
  "vl.board.colReco":        { en: "Recommendation",   zh: "建议",     ar: "التوصية" },
  "vl.board.ready":          { en: "Ready",            zh: "就绪",     ar: "جاهز" },
};

interface Cards {
  total_assets: number; reviewed: number; pending: number; approved: number;
  needs_revision: number; rejected: number; deprecated: number; replace_recommended: number;
  production_ready: number; high_risk: number;
}
interface Bands { high: number; mid: number; low: number }
interface Dashboard { cards: Cards; distributions: { quality: Bands; dna: Bands; duplicate_risk_high: number } }
interface QueueItem {
  id: string; asset_id: string; review_status: ReviewStatus; review_priority: string;
  risk_level: RiskLevel; production_ready: boolean; approval_score: number;
  recommendation: string | null; reviewed_at: string | null;
  asset: { id: string; title: string; visual_asset_code: string; category: string | null; public_url: string | null } | null;
}

const toneText = (t: "positive" | "warning" | "rose" | "neutral") =>
  t === "positive" ? "text-emerald-400" : t === "warning" ? "text-amber-400" : t === "rose" ? "text-rose-400" : "text-[var(--text-muted)]";

const STATUS_FILTERS: { key: string; label: string; i18nKey: string }[] = [
  { key: "", label: "All", i18nKey: "vl.board.filter.all" }, { key: "pending", label: "Pending", i18nKey: "vl.board.pending" }, { key: "approved", label: "Approved", i18nKey: "vl.board.approved" },
  { key: "approved_with_notes", label: "Approved (notes)", i18nKey: "vl.board.approvedNotes" }, { key: "needs_revision", label: "Needs revision", i18nKey: "vl.board.needsRevision" },
  { key: "replace_recommended", label: "Replace", i18nKey: "vl.board.filter.replace" }, { key: "deprecated", label: "Deprecated", i18nKey: "vl.board.deprecated" }, { key: "rejected", label: "Rejected", i18nKey: "vl.board.rejected" },
];
const RISK_FILTERS = ["", "low", "medium", "high", "critical"];
const SORTS: { key: string; label: string; i18nKey: string }[] = [
  { key: "risk", label: "Highest risk", i18nKey: "vl.board.sortRisk" }, { key: "lowest_quality", label: "Lowest score", i18nKey: "vl.board.sortLowest" },
  { key: "newest", label: "Newest", i18nKey: "vl.board.sortNewest" }, { key: "oldest", label: "Oldest", i18nKey: "vl.board.sortOldest" },
];
/* Queue-row status → its vl.board.* translation key. */
const STATUS_I18N: Record<ReviewStatus, string> = {
  pending: "vl.board.pending", approved: "vl.board.approved", approved_with_notes: "vl.board.approvedNotes",
  needs_revision: "vl.board.needsRevision", replace_recommended: "vl.board.replaceRecommended",
  deprecated: "vl.board.deprecated", rejected: "vl.board.rejected",
};

export default function ReviewBoard() {
  const { t } = useTranslation(T);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(true);

  // filters
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [prodReady, setProdReady] = useState<"" | "true" | "false">("");
  const [sort, setSort] = useState("risk");

  // drawer
  const [openAsset, setOpenAsset] = useState<VisualAsset | null>(null);

  const loadDash = useCallback(() => {
    fetch(`/api/visual-library/review/dashboard`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : null).then((j) => { if (j) setDash(j); }).catch(() => {});
  }, []);

  const loadQueue = useCallback(() => {
    setLoadingQueue(true);
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (risk) p.set("risk_level", risk);
    if (prodReady) p.set("production_ready", prodReady);
    p.set("sort", sort); p.set("pageSize", "60");
    fetch(`/api/visual-library/review/queue?${p.toString()}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { items: [], total: 0 })
      .then((j) => { setItems(j.items ?? []); setTotal(j.total ?? 0); })
      .catch(() => {}).finally(() => setLoadingQueue(false));
  }, [status, risk, prodReady, sort]);

  useEffect(() => { loadDash(); }, [loadDash]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  const openRow = async (assetId: string) => {
    const j = await fetch(`/api/visual-library/${assetId}`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null);
    if (j?.asset) setOpenAsset(j.asset as VisualAsset);
  };
  const refresh = () => { loadDash(); loadQueue(); };

  const c = dash?.cards;
  return (
    <div className="space-y-6">
      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Card label={t("vl.board.reviewed", "Reviewed")} value={c ? `${c.reviewed}/${c.total_assets}` : "—"} />
        <Card label={t("vl.board.pending", "Pending")} value={c?.pending ?? "—"} tone="text-[var(--text-muted)]" />
        <Card label={t("vl.board.approved", "Approved")} value={c?.approved ?? "—"} tone="text-emerald-400" />
        <Card label={t("vl.board.needsRevision", "Needs revision")} value={c?.needs_revision ?? "—"} tone="text-amber-400" />
        <Card label={t("vl.board.rejected", "Rejected")} value={c?.rejected ?? "—"} tone="text-rose-400" />
        <Card label={t("vl.board.prodReady", "Production-ready")} value={c?.production_ready ?? "—"} tone="text-emerald-400" />
        <Card label={t("vl.board.highRisk", "High risk")} value={c?.high_risk ?? "—"} tone="text-rose-400" />
        <Card label={t("vl.board.deprecated", "Deprecated")} value={c?.deprecated ?? "—"} tone="text-rose-400" />
      </div>

      {/* Distributions */}
      {dash && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <DistCard title={t("vl.board.qualityBands", "Quality bands")} bands={dash.distributions.quality} />
          <DistCard title={t("vl.board.dnaBands", "Brand DNA bands")} bands={dash.distributions.dna} />
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("vl.board.dupExposure", "Duplicate exposure")}</h4>
            <div className="flex items-end gap-2">
              <span className="text-[28px] font-bold tabular-nums text-amber-400">{dash.distributions.duplicate_risk_high}</span>
              <span className="mb-1 text-[11.5px] text-[var(--text-dim)]">{t("vl.board.dupHighAssets", "assets with high duplicate risk")}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-dim)]">{t("vl.board.dupHint", "Candidates for consolidation or replacement before they reach production.")}</p>
          </div>
        </div>
      )}

      {/* Queue */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{t("vl.board.reviewQueue", "Review queue")}</span>
          <span className="text-[11px] text-[var(--text-dim)] tabular-nums">{total} {t("vl.board.items", "items")}</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Select value={status} onChange={setStatus} options={STATUS_FILTERS.map((f) => ({ key: f.key, label: t(f.i18nKey, f.label) }))} />
            <Select value={risk} onChange={setRisk} options={RISK_FILTERS.map((r) => ({ key: r, label: r ? t("vl.board.riskX", "Risk: {x}").replace("{x}", t(`vl.board.risk.${r}`, r)) : t("vl.board.anyRisk", "Any risk") }))} />
            <Select value={prodReady} onChange={(v) => setProdReady(v as "" | "true" | "false")} options={[{ key: "", label: t("vl.board.anyProduction", "Any production") }, { key: "true", label: t("vl.board.prodReady", "Production-ready") }, { key: "false", label: t("vl.board.notReady", "Not ready") }]} />
            <Select value={sort} onChange={setSort} options={SORTS.map((s) => ({ key: s.key, label: t(s.i18nKey, s.label) }))} />
          </div>
        </div>

        {loadingQueue ? (
          <div className="flex justify-center py-16 text-[var(--text-dim)]"><SpinnerIcon size={18} className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-12 text-center">
            <p className="text-[12.5px] text-[var(--text-muted)]">{t("vl.board.emptyTitle", "No reviews match these filters yet.")}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{t("vl.board.emptyHint", "Open any asset’s Review tab to record a decision — it appears here instantly.")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">
                  <th className="px-3 py-2 font-medium">{t("vl.board.colAsset", "Asset")}</th>
                  <th className="px-3 py-2 font-medium">{t("vl.board.colStatus", "Status")}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{t("vl.board.colRisk", "Risk")}</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">{t("vl.board.colScore", "Score")}</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">{t("vl.board.colProduction", "Production")}</th>
                  <th className="hidden px-3 py-2 font-medium xl:table-cell">{t("vl.board.colReco", "Recommendation")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const sTone = reviewStatusTone(it.review_status);
                  const rTone = RISK_TONE[it.risk_level];
                  return (
                    <tr key={it.id} onClick={() => openRow(it.asset_id)}
                      {...kxInspectAttrs({ component: "ReviewBoardRow", module: "Database", section: "Review", recordId: it.asset_id })}
                      className="cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-surface)]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-neutral-900">
                            {it.asset?.public_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.asset.public_url} alt="" className="h-5 w-5 object-contain" />
                            ) : null}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] text-[var(--text-primary)]">{it.asset?.title ?? "—"}</div>
                            <div className="font-mono text-[10px] text-[var(--text-dim)]">{it.asset?.visual_asset_code ?? ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className={`text-[11.5px] font-medium ${toneText(sTone)}`}>{t(STATUS_I18N[it.review_status], REVIEW_STATUS_LABEL[it.review_status])}</span></td>
                      <td className="hidden px-3 py-2 sm:table-cell"><span className={`text-[11.5px] font-medium capitalize ${toneText(rTone)}`}>{t(`vl.board.risk.${it.risk_level}`, it.risk_level)}</span></td>
                      <td className="hidden px-3 py-2 md:table-cell"><span className="text-[12px] tabular-nums text-[var(--text-primary)]">{it.approval_score}</span></td>
                      <td className="hidden px-3 py-2 lg:table-cell">
                        <span className={`text-[11px] font-medium ${it.production_ready ? "text-emerald-400" : "text-[var(--text-dim)]"}`}>{it.production_ready ? t("vl.board.ready", "Ready") : "—"}</span>
                      </td>
                      <td className="hidden px-3 py-2 xl:table-cell"><span className="line-clamp-1 text-[11px] text-[var(--text-dim)]">{it.recommendation ?? "—"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openAsset && (
        <VisualAssetDetailDrawer asset={openAsset} onClose={() => setOpenAsset(null)} onChanged={refresh}
          onOpenAsset={(rid) => openRow(rid)} />
      )}
    </div>
  );
}

function Card({ label, value, tone = "text-[var(--text-primary)]" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{label}</div>
      <div className={`mt-1 text-[22px] font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
function DistCard({ title, bands }: { title: string; bands: Bands }) {
  const { t } = useTranslation(T);
  const total = bands.high + bands.mid + bands.low || 1;
  const rows = [
    { label: t("vl.board.bandHigh", "High (80+)"), value: bands.high, cls: "bg-emerald-400" },
    { label: t("vl.board.bandMid", "Mid (55–79)"), value: bands.mid, cls: "bg-amber-400" },
    { label: t("vl.board.bandLow", "Low (<55)"), value: bands.low, cls: "bg-rose-400" },
  ];
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h4>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text-muted)]">{r.label}</span><span className="tabular-nums text-[var(--text-dim)]">{r.value}</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]"><div className={`h-full rounded-full ${r.cls}`} style={{ width: `${(r.value / total) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { key: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[11.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}
