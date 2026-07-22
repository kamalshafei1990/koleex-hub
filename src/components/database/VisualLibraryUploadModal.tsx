"use client";

/* ---------------------------------------------------------------------------
   VisualLibraryUploadModal — register a visual entity.

   Works two ways:
   · Upload a file now (drag/drop or pick) → normalized SVG → Storage → record.
   · Or register a "Missing" entity with NO file (leave the file empty) — the
     icon can be uploaded into the record later.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { uploadToStorage } from "@/lib/storage-client";
import { ASSET_TYPES } from "@/lib/visual-library/types";
import { GENERAL_ICON_CATEGORIES, CATEGORY_BY_KEY, fetchIconCategories, type FetchedIconCategory } from "@/lib/visual-library/taxonomy";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { VL_LABELS_T } from "@/lib/translations/visual-library-labels";

const T: Translations = {
  ...VL_LABELS_T,
  "vl.upload.title":            { en: "New visual entity", zh: "新建视觉条目", ar: "كيان مرئي جديد" },
  "vl.upload.close":            { en: "Close", zh: "关闭", ar: "إغلاق" },
  "vl.upload.icon-file":        { en: "Icon file", zh: "图标文件", ar: "ملف الأيقونة" },
  "vl.upload.optional-later":   { en: "— optional, can add later", zh: "— 可选，可稍后添加", ar: "— اختياري، يمكن إضافته لاحقًا" },
  "vl.upload.drop-hint":        { en: "Drag & drop, or click to choose (SVG/PNG/JPG)", zh: "拖放文件，或点击选择（SVG/PNG/JPG）", ar: "اسحب وأفلت، أو انقر للاختيار (SVG/PNG/JPG)" },
  "vl.upload.name":             { en: "Name", zh: "名称", ar: "الاسم" },
  "vl.upload.name-placeholder": { en: "e.g. Search", zh: "例如：搜索", ar: "مثال: بحث" },
  "vl.upload.type":             { en: "Type", zh: "类型", ar: "النوع" },
  "vl.upload.category":         { en: "Category", zh: "分类", ar: "الفئة" },
  "vl.upload.subcategory":      { en: "Subcategory", zh: "子分类", ar: "الفئة الفرعية" },
  "vl.upload.keywords":         { en: "Keywords", zh: "关键词", ar: "الكلمات المفتاحية" },
  "vl.upload.keywords-placeholder": { en: "find, lookup", zh: "查找、搜索", ar: "بحث، استعلام" },
  "vl.upload.enter-name":       { en: "Please enter a name.", zh: "请输入名称。", ar: "يرجى إدخال اسم." },
  "vl.upload.save-failed":      { en: "Save failed", zh: "保存失败", ar: "فشل الحفظ" },
  "vl.upload.failed":           { en: "Failed", zh: "操作失败", ar: "فشلت العملية" },
  "vl.upload.cancel":           { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "vl.upload.saving":           { en: "Saving…", zh: "保存中…", ar: "جارٍ الحفظ…" },
  "vl.upload.upload-create":    { en: "Upload & create", zh: "上传并创建", ar: "رفع وإنشاء" },
  "vl.upload.create-entity":    { en: "Create entity", zh: "创建条目", ar: "إنشاء كيان" },
};

function normalizeSvg(raw: string): string {
  let s = raw.replace(/<\?xml[^>]*\?>/i, "").trim();
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  if (!/<svg\b[^>]*\sfill=/i.test(s)) s = s.replace(/<svg\b/i, '<svg fill="currentColor"');
  return s;
}

const INPUT = "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1";

export default function VisualLibraryUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (assetId?: string) => void }) {
  const { t } = useTranslation(T);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState("icon");
  const [category, setCategory] = useState("misc");
  const [subcategory, setSubcategory] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcats = useMemo(() => CATEGORY_BY_KEY[category]?.subcategories ?? [], [category]);
  const [categories, setCategories] = useState<FetchedIconCategory[]>(
    GENERAL_ICON_CATEGORIES.map((c) => ({ key: c.key, label: c.label, code: c.code })),
  );
  useEffect(() => { fetchIconCategories().then(setCategories).catch(() => {}); }, []);

  const takeFile = (f: File | null) => {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim());
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => takeFile(e.target.files?.[0] ?? null);
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0] ?? null); };

  const submit = async () => {
    if (!title.trim()) { setError(t("vl.upload.enter-name", "Please enter a name.")); return; }
    setBusy(true); setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(), asset_type: assetType, category, subcategory: subcategory || null,
        keywords: keywords.split(",").map((t) => t.trim()).filter(Boolean),
        tags: keywords.split(",").map((t) => t.trim()).filter(Boolean),
        source: "upload", style: "outline",
      };

      if (file) {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
        const isSvg = ext === "svg" || file.type === "image/svg+xml";
        const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `visual-library/${category}/${slug}-${rand}.${ext}`;
        let blob: Blob = file; let viewbox: string | null = null;
        if (isSvg) {
          const raw = await file.text();
          viewbox = (raw.match(/viewBox="([^"]+)"/i) ?? [])[1] ?? null;
          blob = new Blob([normalizeSvg(raw)], { type: "image/svg+xml" });
        }
        const up = await uploadToStorage("media", path, blob, { upsert: true, contentType: isSvg ? "image/svg+xml" : file.type });
        if (!up.ok) { setError(up.error); setBusy(false); return; }
        Object.assign(payload, {
          source_name: file.name.replace(/\.[a-z0-9]+$/i, ""), file_type: ext, storage_bucket: "media",
          svg_path: up.data.path, viewbox, file_size: file.size, mime_type: isSvg ? "image/svg+xml" : file.type,
        });
      }

      const res = await fetch("/api/visual-library", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? t("vl.upload.save-failed", "Save failed")); setBusy(false); return;
      }
      onUploaded((j as { id?: string }).id ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("vl.upload.failed", "Failed")); setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("vl.upload.title", "New visual entity")}</h3>
          <button type="button" onClick={onClose} aria-label={t("vl.upload.close", "Close")} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <span className={LABEL}>{t("vl.upload.icon-file", "Icon file")} <span className="font-normal normal-case text-[var(--text-dim)]">{t("vl.upload.optional-later", "— optional, can add later")}</span></span>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-5 text-center text-[12.5px] transition-colors ${
                dragging ? "border-[var(--accent)] bg-[var(--bg-surface-hover)]" : "border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)]"
              }`}>
              <UploadIcon size={18} className="text-[var(--text-dim)]" />
              <span className="text-[var(--text-muted)]">{file ? file.name : t("vl.upload.drop-hint", "Drag & drop, or click to choose (SVG/PNG/JPG)")}</span>
              <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/*" className="hidden" onChange={onPick} />
            </label>
          </div>

          <div><span className={LABEL}>{t("vl.upload.name", "Name")}</span><input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("vl.upload.name-placeholder", "e.g. Search")} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><span className={LABEL}>{t("vl.upload.type", "Type")}</span>
              <select className={INPUT} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
                {ASSET_TYPES.map((v) => <option key={v} value={v}>{t(`vl.type.${v}`, v.replace(/_/g, " "))}</option>)}
              </select>
            </div>
            <div><span className={LABEL}>{t("vl.upload.category", "Category")}</span>
              <select className={INPUT} value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}>
                {categories.map((c) => <option key={c.key} value={c.key}>{t(`vl.cat.${c.key}`, c.label)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><span className={LABEL}>{t("vl.upload.subcategory", "Subcategory")}</span>
              <select className={INPUT} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                <option value="">—</option>
                {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><span className={LABEL}>{t("vl.upload.keywords", "Keywords")}</span><input className={INPUT} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("vl.upload.keywords-placeholder", "find, lookup")} /></div>
          </div>

          {error && <p className="text-[12px] text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("vl.upload.cancel", "Cancel")}</button>
          <button type="button" onClick={submit} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
            {busy && <SpinnerIcon size={14} className="animate-spin" />}
            {busy ? t("vl.upload.saving", "Saving…") : file ? t("vl.upload.upload-create", "Upload & create") : t("vl.upload.create-entity", "Create entity")}
          </button>
        </div>
      </div>
    </div>
  );
}
