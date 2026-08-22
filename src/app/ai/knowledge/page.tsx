"use client";

/* ---------------------------------------------------------------------------
   /ai/knowledge — Knowledge plane Phase 1: the owner's approval bench.

   Left: sources (upload a PDF/Markdown catalog or paste text) with unit
   counts. Right: the selected source's Knowledge Units — draft by
   default, each with its page/section lineage — approve or retire one
   by one, or approve the whole queue after skimming.

   Deliberately minimal (Phase 1 scope): no search, no retrieval — that
   is Phase 2. Super-admin only, matching the API gateway.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useConfirm } from "@/components/kds/useConfirm";
import { useSkin } from "@/lib/appearance";

/* Aurora ground — the AI family's canvas, mounted only under the skin. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { useTranslation } from "@/lib/i18n";

const T: Record<string, { en: string; zh: string; ar: string }> = {
  "kq.step1": { en: "1 · Give the source: upload a PDF/Markdown file, paste a web URL, or paste raw text.", zh: "1 · 提供来源：上传 PDF/Markdown、粘贴网页链接或直接粘贴文本。", ar: "١ · قدّم المصدر: ارفع PDF/Markdown، أو ألصق رابط صفحة ويب، أو ألصق نصاً." },
  "kq.step2": { en: "2 · The Refinery splits it into knowledge units, each cited to its page/section.", zh: "2 · 精炼器将其切分为知识单元，每个单元都注明页码/章节来源。", ar: "٢ · المصفاة تقطّعه وحدات معرفة، كل وحدة موثقة بصفحتها/قسمها." },
  "kq.step3": { en: "3 · You approve units one by one (or all) — only APPROVED units ever reach Koleex AI.", zh: "3 · 你逐条（或批量）批准——只有已批准的单元才会进入 Koleex AI。", ar: "٣ · تعتمد الوحدات واحدة واحدة (أو دفعة) — المعتمَد فقط يصل إلى كوليكس AI." },
  "kq.titlePh": { en: "e.g. YILI Catalog 2025", zh: "例如：YILI 目录 2025", ar: "مثال: كتالوج YILI 2025" },
  "kq.titleHint": { en: "Empty = taken from the file / page automatically.", zh: "留空＝自动取自文件/网页。", ar: "فارغ = يُؤخذ من الملف/الصفحة تلقائياً." },
  "kq.kindHint": { en: "What kind of source this is — shown on its card.", zh: "来源类型——显示在其卡片上。", ar: "نوع المصدر — يظهر على بطاقته." },
  "kq.kind.catalog": { en: "Catalog (machines & specs)", zh: "目录（机器与规格）", ar: "كتالوج (ماكينات ومواصفات)" },
  "kq.kind.manual": { en: "Manual / guide", zh: "手册 / 指南", ar: "دليل / كتيب" },
  "kq.kind.policy": { en: "Policy / rules", zh: "政策 / 规则", ar: "سياسة / قواعد" },
  "kq.kind.document": { en: "General document", zh: "一般文档", ar: "مستند عام" },
  "kq.kind.webpage": { en: "Web page", zh: "网页", ar: "صفحة ويب" },
  "kq.kind.note": { en: "Note / snippet", zh: "笔记 / 片段", ar: "ملاحظة / مقتطف" },
  "kq.domainHint": { en: "Topic bucket, e.g. garment-machinery, china-logistics, koleex-policy.", zh: "主题分类，如 garment-machinery、china-logistics、koleex-policy。", ar: "تصنيف الموضوع، مثل garment-machinery أو china-logistics أو koleex-policy." },
  "kq.langHint": { en: "The source's main language (tags every unit).", zh: "来源的主要语言（标注每个单元）。", ar: "اللغة الأساسية للمصدر (توسم كل وحدة)." },
  "kq.pickOne": { en: "Content — pick ONE of the three", zh: "内容——三选一", ar: "المحتوى — اختر واحداً من ثلاثة" },
  "kq.or": { en: "or", zh: "或", ar: "أو" },
  "kq.textPh": { en: "…or paste raw text / markdown here (meeting notes, a policy, translated pages)", zh: "……或在此粘贴纯文本/Markdown（会议纪要、政策、翻译页）", ar: "…أو ألصق نصاً/ماركداون هنا (محاضر، سياسة، صفحات مترجمة)" },
  "kq.limit1": { en: "Text-based PDFs are read page by page (units keep their page numbers).", zh: "文本型 PDF 按页读取（单元保留页码）。", ar: "ملفات PDF النصية تُقرأ صفحةً صفحة (الوحدات تحفظ أرقام صفحاتها)." },
  "kq.limit2": { en: "IMAGE-ONLY catalogs (designed pages with no text layer) need OCR first — ask Claude to ingest them, like the YILI catalog was.", zh: "纯图片目录（无文本层的设计页）需先 OCR——可让 Claude 代为导入，如 YILI 目录。", ar: "الكتالوجات المصوّرة (صفحات مصممة بلا طبقة نص) تحتاج OCR أولاً — اطلب من Claude إدخالها كما جرى مع كتالوج YILI." },
  "kq.limit3": { en: "Web pages: one page per ingest, up to 2 MB; JS-rendered pages are not supported yet.", zh: "网页：每次导入一页，上限 2 MB；暂不支持 JS 渲染页面。", ar: "صفحات الويب: صفحة واحدة لكل إدخال بحد 2MB؛ الصفحات المولّدة بجافاسكربت غير مدعومة بعد." },
  "kq.limit4": { en: "Nothing reaches Koleex AI until YOU approve the units below — drafts are invisible to it.", zh: "在你批准之前，任何内容都不会进入 Koleex AI——草稿对它不可见。", ar: "لا شيء يصل كوليكس AI قبل اعتمادك للوحدات — المسودات غير مرئية له." },
  "kq.afterIngest": { en: "After ingest: review the units on the right, then Approve — approved units become Koleex AI's knowledge in the retrieval phase.", zh: "导入后：在右侧审阅单元并批准——已批准的单元将在检索阶段成为 Koleex AI 的知识。", ar: "بعد الإدخال: راجع الوحدات يميناً ثم اعتمد — المعتمَد يصبح معرفة كوليكس AI في مرحلة الاسترجاع." },
  "kq.qaTitle": { en: "Taught Q&A", zh: "问答教学", ar: "أسئلة وأجوبة معلَّمة" },
  "kq.qaSub": { en: "Teach a question once — the AI recognizes it in ANY wording or language, keeps your facts exactly, and composes the reply naturally in its own words (your variants teach it the tone).", zh: "教一次问题——AI 能识别任何措辞或语言的同义提问，事实完全保留，但会用自己的话自然作答（你的多个版本教它语气）。", ar: "علّم السؤال مرة — الذكاء يتعرّف عليه بأي صياغة أو لغة، يحفظ حقائقك حرفياً، ويصوغ الرد طبيعياً بأسلوبه (صيغك تعلّمه النبرة)." },
  "kq.qaQuestionPh": { en: "The question, e.g. What is Koleex's warranty on machines?", zh: "问题，例如：Koleex 机器的保修政策是什么？", ar: "السؤال، مثال: ما ضمان كوليكس على الماكينات؟" },
  "kq.qaAnswerPh": { en: "A reply the AI may use…", zh: "AI 可使用的回复……", ar: "ردّ يمكن للذكاء استخدامه…" },
  "kq.qaAddVariant": { en: "Add another reply variant", zh: "添加另一版本回复", ar: "أضف صيغة رد أخرى" },
  "kq.qaTeach": { en: "Teach it", zh: "开始教学", ar: "علِّمه" },
  "kq.qaVariants": { en: "replies", zh: "个回复", ar: "ردود" },
  "kq.title":      { en: "AI Knowledge", zh: "AI 知识库", ar: "معرفة الذكاء" },
  "kq.subtitle":   { en: "Feed Koleex AI — every unit is cited to its page and approved by you before the AI can ever use it.", zh: "为 Koleex AI 供给知识——每个知识单元都注明页码来源，且须经你批准后 AI 方可使用。", ar: "غذِّ كوليكس AI — كل وحدة معرفة موثقة بصفحتها ولا يستخدمها الذكاء قبل اعتمادك." },
  "kq.back":       { en: "Back to Koleex AI", zh: "返回 Koleex AI", ar: "عودة إلى كوليكس AI" },
  "kq.sources":    { en: "Sources", zh: "知识来源", ar: "المصادر" },
  "kq.add":        { en: "Add source", zh: "添加来源", ar: "إضافة مصدر" },
  "kq.upload":     { en: "Upload PDF / Markdown", zh: "上传 PDF / Markdown", ar: "ارفع PDF / Markdown" },
  "kq.url":        { en: "or a web page URL (https://…)", zh: "\u6216\u7f51\u9875\u94fe\u63a5 (https://\u2026)", ar: "\u0623\u0648 \u0631\u0627\u0628\u0637 \u0635\u0641\u062d\u0629 \u0648\u064a\u0628 (https://\u2026)" },
  "kq.orPaste":    { en: "or paste text", zh: "或粘贴文本", ar: "أو الصق نصاً" },
  "kq.titleF":     { en: "Title", zh: "标题", ar: "العنوان" },
  "kq.kind":       { en: "Kind", zh: "类型", ar: "النوع" },
  "kq.domain":     { en: "Domain", zh: "领域", ar: "المجال" },
  "kq.lang":       { en: "Language", zh: "语言", ar: "اللغة" },
  "kq.text":       { en: "Text", zh: "文本", ar: "النص" },
  "kq.ingest":     { en: "Ingest", zh: "导入", ar: "استيراد" },
  "kq.ingesting":  { en: "Ingesting…", zh: "导入中…", ar: "جارٍ الاستيراد…" },
  "kq.drafts":     { en: "drafts", zh: "草稿", ar: "مسودات" },
  "kq.approved":   { en: "approved", zh: "已批准", ar: "معتمدة" },
  "kq.pages":      { en: "pages", zh: "页", ar: "صفحات" },
  "kq.empty":      { en: "No sources yet — upload your first catalog and Koleex AI starts learning your machines.", zh: "还没有来源——上传第一本目录，Koleex AI 就开始学习你的机器。", ar: "لا مصادر بعد — ارفع أول كتالوج ليبدأ كوليكس AI بتعلّم ماكيناتك." },
  "kq.units":      { en: "Knowledge units", zh: "知识单元", ar: "وحدات المعرفة" },
  "kq.approveAll": { en: "Approve all drafts", zh: "批准全部草稿", ar: "اعتماد كل المسودات" },
  "kq.retireAll":  { en: "Retire all drafts", zh: "废弃全部草稿", ar: "إخراج كل المسودات" },
  "kq.approve":    { en: "Approve", zh: "批准", ar: "اعتماد" },
  "kq.retire":     { en: "Retire", zh: "废弃", ar: "إخراج" },
  "kq.page":       { en: "p.", zh: "第", ar: "ص" },
  "kq.deleteSrc":  { en: "Delete source", zh: "删除来源", ar: "حذف المصدر" },
  "kq.confirmDel": { en: "Delete this source and ALL its units?", zh: "删除该来源及其全部知识单元？", ar: "حذف هذا المصدر وكل وحداته؟" },
  "kq.pickSource": { en: "Pick a source to review its units.", zh: "选择一个来源以审阅其知识单元。", ar: "اختر مصدراً لمراجعة وحداته." },
  "kq.denied":     { en: "Super admin only.", zh: "仅限超级管理员。", ar: "للمشرف الأعلى فقط." },
};

interface SourceRow { id: string; title: string; kind: string; origin: string | null; domain: string | null; lang: string | null; status: string; error: string | null; created_at: string }
interface UnitRow { id: string; seq: number; kind: string; title: string | null; body: string; locator: { page?: number; section?: string }; tags: string[]; trust_score: number; tokens: number | null; status: string }

const chip = "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold";

export default function AiKnowledgePage() {
  const { t, lang } = useTranslation(T);
  const aurora = useSkin() === "aurora";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { draft: number; approved: number; retired: number }>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [srcMeta, setSrcMeta] = useState<Record<string, unknown> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({ title: "", kind: "catalog", domain: "garment-machinery", lang: "en", text: "", url: "" });
  const [fileName, setFileName] = useState("");
  /* Taught Q&A — canonical questions with reply variants. */
  interface QaRow { id: string; question: string; answers: string[]; status: string }
  const [qa, setQa] = useState<QaRow[]>([]);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswers, setQaAnswers] = useState<string[]>([""]);
  const [qaBusy, setQaBusy] = useState(false);
  const loadQa = useCallback(async () => {
    const j = await fetch("/api/ai/knowledge/qa", { credentials: "include" }).then((r) => r.json()).catch(() => null);
    if (j?.qa) setQa(j.qa);
  }, []);
  const saveQa = useCallback(async () => {
    const answers = qaAnswers.map((a) => a.trim()).filter(Boolean);
    if (!qaQuestion.trim() || answers.length === 0) return;
    setQaBusy(true);
    const r = await fetch("/api/ai/knowledge/qa", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: qaQuestion.trim(), answers }),
    });
    setQaBusy(false);
    if (r.ok) { setQaQuestion(""); setQaAnswers([""]); loadQa(); }
  }, [qaQuestion, qaAnswers, loadQa]);
  const retireQa = useCallback(async (id: string) => {
    setQa((x) => x.filter((r) => r.id !== id));
    await fetch(`/api/ai/knowledge/qa?id=${id}`, { method: "DELETE", credentials: "include" });
  }, []);

  /* SUPER ADMIN, OR AN ACCOUNT HE HAS GRANTED. This used to be a bare
     is_super_admin check, which made the bench his-or-nobody's — there was no
     third state to express. "AI Knowledge" is a governable module now, so the
     question becomes the same one every other app asks, and he can hand it to
     named accounts from Roles & Permissions without changing code.
     Deny-by-default still holds: no grant, no entry. */
  useEffect(() => {
    fetch("/api/me/permitted-modules", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setAllowed(
        !!j?.is_super_admin ||
        (Array.isArray(j?.modules) && j.modules.some(
          (m: string) => String(m).toLowerCase() === "ai knowledge",
        )),
      ))
      .catch(() => setAllowed(false));
  }, []);

  const loadSources = useCallback(async () => {
    const j = await fetch("/api/ai/knowledge/sources", { credentials: "include" }).then((r) => r.json()).catch(() => null);
    if (j?.sources) { setSources(j.sources); setCounts(j.counts || {}); }
  }, []);
  useEffect(() => { if (allowed) { loadSources(); loadQa(); } }, [allowed, loadSources, loadQa]);

  const loadUnits = useCallback(async (id: string) => {
    setSel(id); setUnits([]);
    const j = await fetch(`/api/ai/knowledge/sources/${id}`, { credentials: "include" }).then((r) => r.json()).catch(() => null);
    if (j?.units) { setUnits(j.units); setSrcMeta(j.source?.meta ?? null); }
  }, []);

  const ingest = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const file = fileRef.current?.files?.[0];
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("title", form.title || file.name.replace(/\.[^.]+$/, ""));
        fd.set("kind", form.kind); fd.set("domain", form.domain); fd.set("lang", form.lang);
        res = await fetch("/api/ai/knowledge/sources", { method: "POST", body: fd, credentials: "include" });
      } else {
        const payload: Record<string, unknown> = { ...form };
        if (!form.url.trim()) delete payload.url;
        res = await fetch("/api/ai/knowledge/sources", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setShowAdd(false);
      setForm((f) => ({ ...f, title: "", text: "" }));
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
      await loadSources();
      if (j.id) await loadUnits(j.id);
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
    setBusy(false);
  }, [form, loadSources, loadUnits]);

  const setUnitStatus = useCallback(async (id: string, status: "approved" | "retired" | "draft") => {
    setUnits((u) => u.map((x) => (x.id === id ? { ...x, status } : x)));
    await fetch(`/api/ai/knowledge/units/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadSources();
  }, [loadSources]);

  const bulk = useCallback(async (action: "approve_all" | "retire_all") => {
    if (!sel) return;
    await fetch(`/api/ai/knowledge/sources/${sel}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await Promise.all([loadUnits(sel), loadSources()]);
  }, [sel, loadUnits, loadSources]);

  const { askConfirm, confirmDialog } = useConfirm();
  const removeSource = useCallback(() => {
    if (!sel) return;
    askConfirm(t("kq.confirmDel", "Delete this source and ALL its units?"), async () => {
      await fetch(`/api/ai/knowledge/sources/${sel}`, { method: "DELETE", credentials: "include" });
      setSel(null); setUnits([]);
      loadSources();
    }, { confirmLabel: "Delete" });
  }, [askConfirm, sel, loadSources, t]);

  if (allowed === false) {
    /* Owner rule: this bench must not even LOOK like a page to anyone
       without access — silent redirect, no denial screen. */
    if (typeof window !== "undefined") window.location.replace("/ai");
    return null;
  }

  const drafts = units.filter((u) => u.status === "draft").length;

  return (
    /* kx-ai-root = the AI family's Aurora scope: transparent ground + the
       control-tint variable overrides, shared with the chat app. NOT
       kx-app-fullbleed — this page flows and scrolls normally. */
    <div className="kx-ai-root kx-ai-form min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]" dir={lang === "ar" ? "rtl" : "ltr"}>
      {confirmDialog}
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground />
        </div>
      )}
      <div className="relative z-[1] w-full px-4 md:px-8 py-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/ai" aria-label={t("kq.back", "Back to Koleex AI")}
            className="kx-hover-glow h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0">
            <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
          <BookOpenIcon className="h-5 w-5 text-[var(--text-muted)]" />
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold">{t("kq.title", "AI Knowledge")}</h1>
            <p className="text-[11px] text-[var(--text-ghost)]">{t("kq.subtitle", "")}</p>
          </div>
          <span className="flex-1" />
          <button type="button" onClick={() => setShowAdd((v) => !v)}
            className="kx-ai-glow h-9 px-4 rounded-lg text-[12px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 inline-flex items-center gap-1.5 transition-all">
            <PlusIcon className="h-3.5 w-3.5" /> {t("kq.add", "Add source")}
          </button>
        </div>

        {showAdd && (
          <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-4">
            {/* How it works — three steps, so the bench explains itself. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)]/60 bg-[var(--bg-surface-subtle)]/30 px-3 py-2.5">
                  <span className="shrink-0 h-5 w-5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold flex items-center justify-center">{n}</span>
                  <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">{t(`kq.step${n}`, "")}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("kq.titleF", "Title")}</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t("kq.titlePh", "e.g. YILI Catalog 2025")}
                  className="w-full h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]" />
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("kq.titleHint", "Empty = taken from the file / page automatically.")}</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("kq.kind", "Kind")}</label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]">
                  {(["catalog", "manual", "policy", "document", "webpage", "note"] as const).map((k) => (
                    <option key={k} value={k}>{t(`kq.kind.${k}`, k)}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("kq.kindHint", "What kind of source this is — shown on its card.")}</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("kq.domain", "Domain")}</label>
                <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="garment-machinery"
                  className="w-full h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] font-mono outline-none focus:border-[var(--border-focus)]" />
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("kq.domainHint", "Topic bucket, e.g. garment-machinery, china-logistics, koleex-policy.")}</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1">{t("kq.lang", "Language")}</label>
                <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]">
                  <option value="en">English</option><option value="zh">中文</option><option value="ar">العربية</option>
                </select>
                <p className="text-[10px] text-[var(--text-ghost)] mt-1">{t("kq.langHint", "The source's main language (tags every unit).")}</p>
              </div>
            </div>

            {/* Pick ONE input: file, URL, or pasted text. */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1.5">{t("kq.pickOne", "Content — pick ONE of the three")}</label>
              <div className="flex items-center gap-3 flex-wrap">
                <label className={`h-10 px-4 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors ${fileName ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"}`}>
                  <input ref={fileRef} type="file" accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain" className="hidden"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
                  {fileName ? `✓ ${fileName}` : t("kq.upload", "Upload PDF / Markdown")}
                </label>
                <span className="text-[11px] text-[var(--text-ghost)]">{t("kq.or", "or")}</span>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder={t("kq.url", "a web page URL (https://…)")}
                  dir="ltr"
                  className="flex-1 min-w-[220px] h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] font-mono outline-none focus:border-[var(--border-focus)]"
                />
              </div>
              <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder={t("kq.textPh", "…or paste raw text / markdown here (meeting notes, a policy, translated pages)")} rows={4}
                className="mt-2 w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)] resize-y" />
              <ul className="mt-2 space-y-0.5 text-[10.5px] leading-relaxed text-[var(--text-ghost)] list-disc ms-4">
                <li>{t("kq.limit1", "Text-based PDFs are read page by page (units keep their page numbers).")}</li>
                <li>{t("kq.limit2", "IMAGE-ONLY catalogs (designed pages with no text layer) need OCR first — ask Claude to ingest them, like the YILI catalog was.")}</li>
                <li>{t("kq.limit3", "Web pages: one page per ingest, up to 2 MB; JS-rendered pages are not supported yet.")}</li>
                <li>{t("kq.limit4", "Nothing reaches Koleex AI until YOU approve the units below — drafts are invisible to it.")}</li>
              </ul>
            </div>

            {err && <p className="text-[12px] text-rose-400">{err}</p>}
            <div className="flex items-center gap-3">
              <button type="button" disabled={busy} onClick={ingest}
                className="kx-ai-glow h-10 px-5 rounded-lg text-[13px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-50 transition-all">
                {busy ? t("kq.ingesting", "Ingesting…") : t("kq.ingest", "Ingest")}
              </button>
              <p className="text-[11px] text-[var(--text-ghost)]">{t("kq.afterIngest", "After ingest: review the units on the right, then Approve — approved units become Koleex AI's knowledge in the retrieval phase.")}</p>
            </div>
          </div>
        )}

        {/* ── Taught Q&A ── the owner's canonical answers. The AI matches
            the MEANING of a user's question (any wording, any language)
            and replies with one of the taught variants. */}
        <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold">{t("kq.qaTitle", "Taught Q&A")}</h2>
            <span className="text-[11px] text-[var(--text-ghost)]">{t("kq.qaSub", "Teach a question once — the AI recognizes it in ANY wording or language and replies with your taught answer (rotating between your variants).")}</span>
          </div>
          <input
            value={qaQuestion}
            onChange={(e) => setQaQuestion(e.target.value)}
            placeholder={t("kq.qaQuestionPh", "The question, e.g. What is Koleex's warranty on machines?")}
            className="w-full h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]"
          />
          {qaAnswers.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 shrink-0 text-[10px] font-bold text-[var(--text-ghost)]">A{i + 1}</span>
              <textarea
                value={a}
                onChange={(e) => setQaAnswers((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={t("kq.qaAnswerPh", "A reply the AI may use…")}
                rows={2}
                className="flex-1 px-3.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)] resize-y"
              />
              {qaAnswers.length > 1 && (
                <button type="button" onClick={() => setQaAnswers((arr) => arr.filter((_, j) => j !== i))}
                  className="mt-1 h-8 w-8 rounded-lg inline-flex items-center justify-center text-[var(--text-ghost)] hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
                  <CrossIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setQaAnswers((arr) => [...arr, ""])}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors inline-flex items-center gap-1">
              <PlusIcon className="h-3 w-3" /> {t("kq.qaAddVariant", "Add another reply variant")}
            </button>
            <span className="flex-1" />
            <button type="button" disabled={qaBusy || !qaQuestion.trim() || !qaAnswers.some((a) => a.trim())} onClick={saveQa}
              className="kx-ai-glow h-9 px-4 rounded-lg text-[12px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-40 transition-all">
              {t("kq.qaTeach", "Teach it")}
            </button>
          </div>
          {qa.length > 0 && (
            <div className="space-y-2 pt-1">
              {qa.map((r) => (
                <div key={r.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">{r.question}</span>
                    <span className="text-[10px] text-[var(--text-ghost)]">{r.answers.length} {t("kq.qaVariants", "replies")}</span>
                    <span className="flex-1" />
                    <button type="button" onClick={() => retireQa(r.id)} aria-label={t("kq.retire", "Retire")}
                      className="h-7 w-7 rounded-md inline-flex items-center justify-center text-[var(--text-ghost)] hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {r.answers.map((a, i) => (
                      <p key={i} className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        <span className="text-[10px] font-bold text-[var(--text-ghost)] me-1.5">A{i + 1}</span>{a}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* Sources rail */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("kq.sources", "Sources")}</div>
            {sources.length === 0 && (
              <p className="text-[12px] text-[var(--text-ghost)] leading-relaxed rounded-xl border border-dashed border-[var(--border-subtle)] p-4">
                {t("kq.empty", "")}
              </p>
            )}
            {sources.map((s) => {
              const c = counts[s.id] || { draft: 0, approved: 0, retired: 0 };
              const active = sel === s.id;
              return (
                <button key={s.id} type="button" onClick={() => loadUnits(s.id)}
                  className={`w-full text-start rounded-xl border p-3 transition-colors ${active ? "kx-glass border-[var(--border-focus)] bg-[var(--bg-secondary)]" : "kx-glass border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 hover:border-[var(--border-focus)]"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold truncate">{s.title}</span>
                    <span className={`${chip} border border-[var(--border-subtle)] text-[var(--text-ghost)] uppercase`}>{s.kind}</span>
                    {s.status === "failed" && <span className={`${chip} bg-rose-500/15 text-rose-300`}>failed</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10.5px] text-[var(--text-dim)]">
                    {c.draft > 0 && <span className={`${chip} bg-amber-500/15 text-amber-300`}>{c.draft} {t("kq.drafts", "drafts")}</span>}
                    {c.approved > 0 && <span className={`${chip} bg-emerald-500/15 text-emerald-300`}>{c.approved} {t("kq.approved", "approved")}</span>}
                    <span className="truncate">{s.domain || ""}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Units queue */}
          <div className="min-w-0">
            {!sel ? (
              <p className="text-[12px] text-[var(--text-ghost)] rounded-xl border border-dashed border-[var(--border-subtle)] p-6">
                {t("kq.pickSource", "Pick a source to review its units.")}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">
                    {t("kq.units", "Knowledge units")} · {units.length}
                    {srcMeta && (srcMeta as { pages?: number }).pages ? ` · ${(srcMeta as { pages?: number }).pages} ${t("kq.pages", "pages")}` : ""}
                  </span>
                  <span className="flex-1" />
                  {drafts > 0 && (
                    <>
                      <button type="button" onClick={() => bulk("approve_all")}
                        className="h-8 px-3 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors inline-flex items-center gap-1">
                        <CheckIcon className="h-3 w-3" /> {t("kq.approveAll", "Approve all drafts")} ({drafts})
                      </button>
                      <button type="button" onClick={() => bulk("retire_all")}
                        className="h-8 px-3 rounded-lg text-[11px] font-bold text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-rose-300 hover:border-rose-500/40 transition-colors">
                        {t("kq.retireAll", "Retire all drafts")}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={removeSource} title={t("kq.deleteSrc", "Delete source")}
                    className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-[var(--text-ghost)] hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {units.map((u) => (
                    <div key={u.id} className={`rounded-xl border p-3 ${u.status === "approved" ? "border-emerald-500/25 bg-emerald-500/[0.04]" : u.status === "retired" ? "border-[var(--border-subtle)] opacity-50" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60"}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-[var(--text-ghost)]">#{u.seq + 1}</span>
                        {u.locator?.page ? <span className={`${chip} border border-[var(--border-subtle)] text-[var(--text-dim)]`}>{t("kq.page", "p.")}{u.locator.page}</span> : null}
                        {u.title && <span className="text-[11px] font-semibold text-[var(--text-muted)] truncate">{u.title}</span>}
                        {u.tags.includes("spec-table") && <span className={`${chip} bg-[#567FB2]/15 text-[#9dbede]`}>spec</span>}
                        <span className="flex-1" />
                        {u.status === "draft" ? (
                          <>
                            <button type="button" onClick={() => setUnitStatus(u.id, "approved")}
                              className="h-7 px-2.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors inline-flex items-center gap-1">
                              <CheckIcon className="h-3 w-3" /> {t("kq.approve", "Approve")}
                            </button>
                            <button type="button" onClick={() => setUnitStatus(u.id, "retired")}
                              className="h-7 w-7 rounded-md inline-flex items-center justify-center text-[var(--text-ghost)] hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                              aria-label={t("kq.retire", "Retire")}>
                              <CrossIcon className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <span className={`${chip} ${u.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : "text-[var(--text-ghost)] border border-[var(--border-subtle)]"}`}>{u.status}</span>
                        )}
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words line-clamp-6">{u.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
