"use client";

/* ---------------------------------------------------------------------------
   BrandsManager — product/visual brands manager.

   Brands belong to the KOLEEX visual identity, so this now lives INSIDE the
   Database app's Visual Library (route /database/brands), rendered `embedded`
   under the shared DatabaseHeader. The standalone /brands route redirects here.

   When `embedded`, the component drops its own page chrome (full-screen wrapper,
   back-to-home header, bottom nav links) since the Database layout provides the
   header + title.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import RefreshIcon from "@/components/icons/ui/RefreshIcon";
import BrandIcon from "@/components/icons/BrandIcon";
import {
  fetchBrandsWithDetails, renameBrand, deleteBrand,
  uploadBrandLogo, deleteBrandLogo,
} from "@/lib/products-admin";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.brands.nameRequired":  { en: "Brand name is required",                zh: "品牌名称为必填项",     ar: "اسم العلامة التجارية مطلوب" },
  "vl.brands.nameExists":    { en: "A brand with this name already exists", zh: "已存在同名品牌",       ar: "توجد علامة تجارية بهذا الاسم بالفعل" },
  "vl.brands.renameFail":    { en: "Failed to rename brand",                zh: "重命名品牌失败",       ar: "تعذّرت إعادة تسمية العلامة التجارية" },
  "vl.brands.genericError":  { en: "Something went wrong",                  zh: "出现问题",             ar: "حدث خطأ ما" },
  "vl.brands.editBrand":     { en: "Edit Brand",                            zh: "编辑品牌",             ar: "تعديل العلامة التجارية" },
  "vl.brands.newBrand":      { en: "New Brand",                             zh: "新建品牌",             ar: "علامة تجارية جديدة" },
  "vl.brands.logo":          { en: "Logo",                                  zh: "标志",                 ar: "الشعار" },
  "vl.brands.upload":        { en: "Upload",                                zh: "上传",                 ar: "رفع" },
  "vl.brands.nameLabel":     { en: "Brand Name *",                          zh: "品牌名称 *",           ar: "اسم العلامة التجارية *" },
  "vl.brands.namePh":        { en: "e.g. Koleex, FANUC, ABB",               zh: "例如 Koleex、FANUC、ABB", ar: "مثال: Koleex، FANUC، ABB" },
  "vl.brands.renameHint":    { en: "Renaming will update all products using this brand.", zh: "重命名将更新所有使用该品牌的产品。", ar: "ستؤدي إعادة التسمية إلى تحديث جميع المنتجات التي تستخدم هذه العلامة." },
  "vl.brands.createHint":    { en: "Brand will appear in dropdowns once assigned to a product.", zh: "品牌在分配给产品后将出现在下拉列表中。", ar: "ستظهر العلامة التجارية في القوائم المنسدلة بعد إسنادها إلى منتج." },
  "vl.brands.usedByOne":     { en: "Used by 1 product",                     zh: "被 1 个产品使用",      ar: "مستخدمة في منتج واحد" },
  "vl.brands.usedByMany":    { en: "Used by {n} products",                  zh: "被 {n} 个产品使用",    ar: "مستخدمة في {n} من المنتجات" },
  "vl.brands.cancel":        { en: "Cancel",                                zh: "取消",                 ar: "إلغاء" },
  "vl.brands.saving":        { en: "Saving...",                             zh: "保存中...",            ar: "جارٍ الحفظ..." },
  "vl.brands.saveChanges":   { en: "Save Changes",                          zh: "保存更改",             ar: "حفظ التغييرات" },
  "vl.brands.createBrand":   { en: "Create Brand",                          zh: "创建品牌",             ar: "إنشاء العلامة التجارية" },
  "vl.brands.deleteBrand":   { en: "Delete Brand",                          zh: "删除品牌",             ar: "حذف العلامة التجارية" },
  "vl.brands.deleteConfirm": { en: "Are you sure you want to delete {name}?", zh: "确定要删除 {name} 吗？", ar: "هل أنت متأكد من حذف {name}؟" },
  "vl.brands.deleteWarnOne": { en: "This brand is used by 1 product. The brand field will be cleared on that product.", zh: "该品牌被 1 个产品使用。相应产品的品牌字段将被清空。", ar: "هذه العلامة مستخدمة في منتج واحد. سيتم مسح حقل العلامة التجارية في ذلك المنتج." },
  "vl.brands.deleteWarnMany":{ en: "This brand is used by {n} products. The brand field will be cleared on those products.", zh: "该品牌被 {n} 个产品使用。相应产品的品牌字段将被清空。", ar: "هذه العلامة مستخدمة في {n} من المنتجات. سيتم مسح حقل العلامة التجارية في تلك المنتجات." },
  "vl.brands.logoRemoved":   { en: "The brand logo will also be removed.",  zh: "品牌标志也将被删除。", ar: "سيُحذف شعار العلامة التجارية أيضًا." },
  "vl.brands.deleting":      { en: "Deleting...",                           zh: "删除中...",            ar: "جارٍ الحذف..." },
  "vl.brands.backHome":      { en: "Back to home",                          zh: "返回首页",             ar: "العودة إلى الرئيسية" },
  "vl.brands.title":         { en: "Brands",                                zh: "品牌",                 ar: "العلامات التجارية" },
  "vl.brands.subtitle":      { en: "Manage product brands and their logos. Brands are shared across products.", zh: "管理产品品牌及其标志。品牌在各产品间共享。", ar: "إدارة العلامات التجارية للمنتجات وشعاراتها. العلامات مشتركة بين المنتجات." },
  "vl.brands.statBrands":    { en: "Brands",                                zh: "品牌",                 ar: "علامات تجارية" },
  "vl.brands.statProducts":  { en: "Products",                              zh: "产品",                 ar: "منتجات" },
  "vl.brands.searchPh":      { en: "Search brands…",                        zh: "搜索品牌…",            ar: "ابحث في العلامات التجارية…" },
  "vl.brands.emptySearch":   { en: "No brands match your search.",          zh: "没有匹配的品牌。",     ar: "لا توجد علامات تجارية مطابقة لبحثك." },
  "vl.brands.emptyNone":     { en: "No brands yet. Create your first brand or add one from the product form.", zh: "暂无品牌。创建第一个品牌，或在产品表单中添加。", ar: "لا توجد علامات تجارية بعد. أنشئ أول علامة تجارية أو أضِف واحدة من نموذج المنتج." },
};

interface BrandItem {
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}

/* ── Edit/Create Modal ── */
function BrandModal({
  open, onClose, brand, existingNames, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  brand: BrandItem | null; // null = create new
  existingNames: string[];
  onSaved: () => void;
}) {
  const { t } = useTranslation(T);
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(brand?.name || "");
      setLogoFile(null);
      setLogoPreview(brand?.logoUrl || null);
      setRemoveLogo(false);
      setError("");
    }
  }, [open, brand]);

  const handleLogoSelect = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError(t("vl.brands.nameRequired", "Brand name is required")); return; }

    const isDuplicate = existingNames.some(
      n => n.toLowerCase() === trimmed.toLowerCase() && n !== brand?.name
    );
    if (isDuplicate) { setError(t("vl.brands.nameExists", "A brand with this name already exists")); return; }

    setSaving(true);
    setError("");

    try {
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      if (brand) {
        if (trimmed !== brand.name) {
          const ok = await renameBrand(brand.name, trimmed);
          if (!ok) { setError(t("vl.brands.renameFail", "Failed to rename brand")); setSaving(false); return; }
        }
        if (removeLogo && brand.logoUrl) {
          await deleteBrandLogo(brand.slug);
        }
        if (logoFile) {
          await uploadBrandLogo(slug, logoFile);
        }
      } else {
        if (logoFile) {
          await uploadBrandLogo(slug, logoFile);
        }
      }

      setSaving(false);
      onSaved();
      onClose();
    } catch {
      setError(t("vl.brands.genericError", "Something went wrong"));
      setSaving(false);
    }
  };

  if (!open) return null;

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {brand ? t("vl.brands.editBrand", "Edit Brand") : t("vl.brands.newBrand", "New Brand")}
          </h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-5 items-start">
            <div className="shrink-0">
              <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{t("vl.brands.logo", "Logo")}</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files)}
              />
              {logoPreview && !removeLogo ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <img src={logoPreview} alt="" className="w-full h-full object-contain p-2" />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                  >
                    <CrossIcon className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent)]/30 bg-[var(--bg-surface)] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
                >
                  <PictureIcon className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--text-dim)] transition-colors" />
                  <span className="text-[9px] text-[var(--text-muted)] group-hover:text-[var(--text-dim)]">{t("vl.brands.upload", "Upload")}</span>
                </button>
              )}
            </div>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{t("vl.brands.nameLabel", "Brand Name *")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
                placeholder={t("vl.brands.namePh", "e.g. Koleex, FANUC, ABB")}
                className={inp}
                autoFocus
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                {brand
                  ? t("vl.brands.renameHint", "Renaming will update all products using this brand.")
                  : t("vl.brands.createHint", "Brand will appear in dropdowns once assigned to a product.")}
              </p>
            </div>
          </div>

          {brand && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <PackageIcon className="h-3 w-3" />
              <span>{brand.productCount === 1 ? t("vl.brands.usedByOne", "Used by 1 product") : t("vl.brands.usedByMany", "Used by {n} products").replace("{n}", String(brand.productCount))}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            {t("vl.brands.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="h-10 px-6 rounded-xl bg-[var(--accent)] text-white text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
          >
            {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
            {saving ? t("vl.brands.saving", "Saving...") : brand ? t("vl.brands.saveChanges", "Save Changes") : t("vl.brands.createBrand", "Create Brand")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirmation Modal ── */
function DeleteModal({
  open, brand, onClose, onConfirm, deleting,
}: {
  open: boolean;
  brand: BrandItem | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation(T);
  if (!open || !brand) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-2xl">
        <div className="px-6 py-5">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">{t("vl.brands.deleteBrand", "Delete Brand")}</h2>
          <p className="text-[13px] text-[var(--text-dim)] leading-relaxed">
            {(() => {
              const s = t("vl.brands.deleteConfirm", "Are you sure you want to delete {name}?");
              const i = s.indexOf("{name}");
              if (i < 0) return s;
              return (
                <>
                  {s.slice(0, i)}
                  <span className="text-[var(--text-primary)] font-medium">{brand.name}</span>
                  {s.slice(i + "{name}".length)}
                </>
              );
            })()}
          </p>
          {brand.productCount > 0 && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400">
              {brand.productCount === 1
                ? t("vl.brands.deleteWarnOne", "This brand is used by 1 product. The brand field will be cleared on that product.")
                : t("vl.brands.deleteWarnMany", "This brand is used by {n} products. The brand field will be cleared on those products.").replace("{n}", String(brand.productCount))}
            </div>
          )}
          <p className="text-[12px] text-[var(--text-muted)] mt-3">{t("vl.brands.logoRemoved", "The brand logo will also be removed.")}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            {t("vl.brands.cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500/30 transition-all disabled:opacity-40"
          >
            {deleting ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-3.5 w-3.5" />}
            {deleting ? t("vl.brands.deleting", "Deleting...") : t("vl.brands.deleteBrand", "Delete Brand")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main manager ── */
export default function BrandsManager({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation(T);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editBrand, setEditBrand] = useState<BrandItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteBrandItem, setDeleteBrandItem] = useState<BrandItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBrandsWithDetails();
    setBrands(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : brands;

  const handleEdit = (brand: BrandItem) => { setEditBrand(brand); setShowEditModal(true); };
  const handleCreate = () => { setEditBrand(null); setShowEditModal(true); };
  const handleDeleteClick = (brand: BrandItem) => { setDeleteBrandItem(brand); setShowDeleteModal(true); };
  const handleDeleteConfirm = async () => {
    if (!deleteBrandItem) return;
    setDeleting(true);
    await deleteBrand(deleteBrandItem.name);
    setDeleting(false);
    setShowDeleteModal(false);
    setDeleteBrandItem(null);
    load();
  };

  const totalProducts = brands.reduce((sum, b) => sum + b.productCount, 0);

  const body = (
    <>
      {/* Standalone-only header (the Database layout provides one when embedded). */}
      {!embedded && (
        <>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors" aria-label={t("vl.brands.backHome", "Back to home")}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <BrandIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight">{t("vl.brands.title", "Brands")}</h1>
          </div>
          <p className="text-[13px] text-[var(--text-dim)] mb-6 ml-0 md:ml-11">
            {t("vl.brands.subtitle", "Manage product brands and their logos. Brands are shared across products.")}
          </p>
        </>
      )}

      {/* Stats row */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <span className="text-[18px] font-bold text-[var(--text-primary)]">{brands.length}</span>
          <span className="text-[11px] text-[var(--text-dim)]">{t("vl.brands.statBrands", "Brands")}</span>
        </div>
        <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <PackageIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span className="text-[18px] font-bold text-[var(--text-primary)]">{totalProducts}</span>
          <span className="text-[11px] text-[var(--text-dim)]">{t("vl.brands.statProducts", "Products")}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("vl.brands.searchPh", "Search brands…")}
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <RefreshIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleCreate}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" /> {t("vl.brands.newBrand", "New Brand")}
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[var(--border-subtle)] rounded-xl">
          <p className="text-[13px] text-[var(--text-muted)]">
            {search ? t("vl.brands.emptySearch", "No brands match your search.") : t("vl.brands.emptyNone", "No brands yet. Create your first brand or add one from the product form.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((brand) => (
            <div
              key={brand.name}
              className="group relative flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition-all"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-1.5" />
                ) : (
                  <span className="text-[16px] font-bold text-[var(--text-muted)]">
                    {brand.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{brand.name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">{brand.slug}</span>
                  <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                    <PackageIcon className="h-3 w-3" /> {brand.productCount}
                  </span>
                </div>
              </div>

              {/* Actions — visible on touch, hover-reveal on desktop. */}
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(brand)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteClick(brand)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-400/70 hover:bg-red-400/[0.06] transition-colors"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BrandModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        brand={editBrand}
        existingNames={brands.map(b => b.name)}
        onSaved={load}
      />
      <DeleteModal
        open={showDeleteModal}
        brand={deleteBrandItem}
        onClose={() => { setShowDeleteModal(false); setDeleteBrandItem(null); }}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-6 py-8">{body}</div>
    </div>
  );
}
