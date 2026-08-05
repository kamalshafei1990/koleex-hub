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
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { useTranslation } from "@/lib/i18n";

const T: Record<string, { en: string; zh: string; ar: string }> = {
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

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setAllowed(!!j?.is_super_admin))
      .catch(() => setAllowed(false));
  }, []);

  const loadSources = useCallback(async () => {
    const j = await fetch("/api/ai/knowledge/sources", { credentials: "include" }).then((r) => r.json()).catch(() => null);
    if (j?.sources) { setSources(j.sources); setCounts(j.counts || {}); }
  }, []);
  useEffect(() => { if (allowed) loadSources(); }, [allowed, loadSources]);

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

  const removeSource = useCallback(async () => {
    if (!sel) return;
    if (!window.confirm(t("kq.confirmDel", "Delete this source and ALL its units?"))) return;
    await fetch(`/api/ai/knowledge/sources/${sel}`, { method: "DELETE", credentials: "include" });
    setSel(null); setUnits([]);
    loadSources();
  }, [sel, loadSources, t]);

  if (allowed === false) {
    /* Owner rule: this bench must not even LOOK like a page to anyone
       but the super admin — silent redirect, no denial screen. */
    if (typeof window !== "undefined") window.location.replace("/ai");
    return null;
  }

  const drafts = units.filter((u) => u.status === "draft").length;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="w-full px-4 md:px-8 py-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/ai" aria-label={t("kq.back", "Back to Koleex AI")}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0">
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
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("kq.titleF", "Title")}
                className="h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]" />
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
                className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]">
                {["catalog", "manual", "policy", "document", "note"].map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder={t("kq.domain", "Domain")}
                className="h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]" />
              <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}
                className="h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)]">
                <option value="en">English</option><option value="zh">中文</option><option value="ar">العربية</option>
              </select>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="h-10 px-4 rounded-lg border border-dashed border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] inline-flex items-center cursor-pointer transition-colors">
                <input ref={fileRef} type="file" accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain" className="hidden" />
                {t("kq.upload", "Upload PDF / Markdown")}
              </label>
              <span className="text-[11px] text-[var(--text-ghost)]">{t("kq.orPaste", "or paste text")}</span>
              <span className="text-[11px] text-[var(--text-ghost)]">·</span>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder={t("kq.url", "or a web page URL (https://…)")}
                dir="ltr"
                className="flex-1 min-w-[220px] h-10 px-3.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] font-mono outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder={t("kq.text", "Text")} rows={4}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)] resize-y" />
            {err && <p className="text-[12px] text-rose-400">{err}</p>}
            <button type="button" disabled={busy} onClick={ingest}
              className="kx-ai-glow h-10 px-5 rounded-lg text-[13px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/40 hover:bg-[var(--accent,#0066FF)]/10 disabled:opacity-50 transition-all">
              {busy ? t("kq.ingesting", "Ingesting…") : t("kq.ingest", "Ingest")}
            </button>
          </div>
        )}

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
                  className={`w-full text-start rounded-xl border p-3 transition-colors ${active ? "border-[var(--border-focus)] bg-[var(--bg-secondary)]" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 hover:border-[var(--border-focus)]"}`}>
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
