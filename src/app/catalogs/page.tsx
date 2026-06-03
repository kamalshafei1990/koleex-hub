"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import FileIcon from "@/components/icons/ui/FileIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import PenToolIcon from "@/components/icons/ui/PenToolIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import {
  fetchCatalogs, createCatalog, updateCatalog, deleteCatalog,
  uploadCatalogFile, uploadCatalogCover, replaceCatalogFile,
  fetchCatalogContacts, syncCatalogToContact, removeCatalogFromContact,
} from "@/lib/catalogs-admin";
import { createContact } from "@/lib/contacts-admin";
import CatalogsIcon from "@/components/icons/CatalogsIcon";
import { getDivisionIcon } from "@/components/icons/divisions";
import type { CatalogEntry } from "@/lib/catalogs-admin";
import {
  fetchDivisions, fetchCategories,
  fetchDivisionLogos, fetchCategoryLogos,
} from "@/lib/products-admin";
import type { DivisionRow, CategoryRow } from "@/types/supabase";
import { useTranslation, type Translations } from "@/lib/i18n";

/* ── i18n — full catalog app translation (en / zh / ar) ── */
const T: Translations = {
  "cat.title":            { en: "Catalogs", zh: "产品目录", ar: "الكتالوجات" },
  "cat.subtitle":         { en: "Manage supplier and company catalogs", zh: "管理供应商和公司目录", ar: "إدارة كتالوجات الموردين والشركات" },
  "cat.stat.catalogs":    { en: "catalogs", zh: "目录", ar: "كتالوج" },
  "cat.stat.suppliers":   { en: "suppliers", zh: "供应商", ar: "موردون" },
  "cat.stat.total":       { en: "total", zh: "总计", ar: "الإجمالي" },
  "cat.search":           { en: "Search catalogs…", zh: "搜索目录…", ar: "ابحث في الكتالوجات…" },
  "cat.allSuppliers":     { en: "All Suppliers", zh: "所有供应商", ar: "كل الموردين" },
  "cat.allDivisions":     { en: "All Divisions", zh: "所有部门", ar: "كل الأقسام" },
  "cat.allTypes":         { en: "All Types", zh: "所有类型", ar: "كل الأنواع" },
  "cat.upload":           { en: "Upload Catalog", zh: "上传目录", ar: "رفع كتالوج" },
  "cat.emptyTitle":       { en: "No catalogs yet", zh: "暂无目录", ar: "لا توجد كتالوجات بعد" },
  "cat.emptyDesc":        { en: "Upload your first supplier catalog to get started.", zh: "上传您的第一个供应商目录以开始。", ar: "ارفع أول كتالوج مورد للبدء." },
  "cat.noMatch":          { en: "No catalogs match your filters.", zh: "没有符合筛选条件的目录。", ar: "لا توجد كتالوجات تطابق عوامل التصفية." },
  "nav.products":         { en: "Products", zh: "产品", ar: "المنتجات" },
  "nav.suppliers":        { en: "Suppliers", zh: "供应商", ar: "الموردون" },
  "nav.contacts":         { en: "Contacts", zh: "联系人", ar: "جهات الاتصال" },

  "modal.editTitle":      { en: "Edit Catalog", zh: "编辑目录", ar: "تعديل الكتالوج" },
  "modal.uploadTitle":    { en: "Upload Catalog", zh: "上传目录", ar: "رفع كتالوج" },
  "modal.file":           { en: "Catalog File", zh: "目录文件", ar: "ملف الكتالوج" },
  "modal.fileDrop":       { en: "Click to upload or drag file here", zh: "点击上传或将文件拖到此处", ar: "انقر للرفع أو اسحب الملف هنا" },
  "modal.replace":        { en: "Replace", zh: "替换", ar: "استبدال" },
  "modal.genCover":       { en: "Generating cover preview...", zh: "正在生成封面预览…", ar: "جارٍ إنشاء معاينة الغلاف…" },
  "modal.titleField":     { en: "Title", zh: "标题", ar: "العنوان" },
  "modal.titlePlaceholder": { en: "Catalog title", zh: "目录标题", ar: "عنوان الكتالوج" },
  "modal.supplierCompany":{ en: "Supplier / Company", zh: "供应商 / 公司", ar: "المورد / الشركة" },
  "modal.searchContacts": { en: "Search suppliers or companies…", zh: "搜索供应商或公司…", ar: "ابحث عن موردين أو شركات…" },
  "modal.noContacts":     { en: "No suppliers or companies found.", zh: "未找到供应商或公司。", ar: "لم يتم العثور على موردين أو شركات." },
  "modal.noMatchFound":   { en: "No match found.", zh: "未找到匹配项。", ar: "لا توجد نتائج مطابقة." },
  "modal.addNew":         { en: "Add new supplier / company", zh: "添加新供应商 / 公司", ar: "إضافة مورد / شركة جديدة" },
  "modal.division":       { en: "Division", zh: "部门", ar: "القسم" },
  "modal.selectDivision": { en: "Select division", zh: "选择部门", ar: "اختر القسم" },
  "modal.category":       { en: "Category", zh: "类别", ar: "الفئة" },
  "modal.selectCategory": { en: "Select category", zh: "选择类别", ar: "اختر الفئة" },
  "modal.description":    { en: "Description", zh: "描述", ar: "الوصف" },
  "modal.optional":       { en: "(optional)", zh: "（可选）", ar: "(اختياري)" },
  "modal.descPlaceholder":{ en: "Optional notes about this catalog", zh: "关于此目录的可选备注", ar: "ملاحظات اختيارية حول هذا الكتالوج" },
  "modal.saveChanges":    { en: "Save Changes", zh: "保存更改", ar: "حفظ التغييرات" },
  "modal.uploadBtn":      { en: "Upload", zh: "上传", ar: "رفع" },
  "modal.uploading":      { en: "Uploading...", zh: "上传中…", ar: "جارٍ الرفع…" },
  "modal.uploadingFile":  { en: "Uploading file...", zh: "正在上传文件…", ar: "جارٍ رفع الملف…" },
  "modal.uploadingPct":   { en: "Uploading... {n}%", zh: "上传中… {n}%", ar: "جارٍ الرفع… {n}٪" },
  "modal.saving":         { en: "Saving...", zh: "保存中…", ar: "جارٍ الحفظ…" },

  "err.selectFile":       { en: "Please select a file to upload.", zh: "请选择要上传的文件。", ar: "يرجى اختيار ملف للرفع." },
  "err.titleRequired":    { en: "Title is required.", zh: "标题为必填项。", ar: "العنوان مطلوب." },
  "err.uploadFailed":     { en: "Failed to upload file.", zh: "文件上传失败。", ar: "فشل رفع الملف." },
  "err.somethingWrong":   { en: "Something went wrong.", zh: "出现错误。", ar: "حدث خطأ ما." },
  "err.unsupported":      { en: "Unsupported file type. Use PDF, JPG, PNG, PSD, or CDR.", zh: "不支持的文件类型。请使用 PDF、JPG、PNG、PSD 或 CDR。", ar: "نوع ملف غير مدعوم. استخدم PDF أو JPG أو PNG أو PSD أو CDR." },
  "err.tooLarge":         { en: "File is too large ({mb} MB). Maximum is 500 MB per file.", zh: "文件过大（{mb} MB）。每个文件最大 500 MB。", ar: "الملف كبير جدًا ({mb} ميجابايت). الحد الأقصى 500 ميجابايت لكل ملف." },

  "quick.title":          { en: "Add New Supplier / Company", zh: "添加新供应商 / 公司", ar: "إضافة مورد / شركة جديدة" },
  "quick.type":           { en: "Type", zh: "类型", ar: "النوع" },
  "quick.supplier":       { en: "Supplier", zh: "供应商", ar: "مورد" },
  "quick.company":        { en: "Company", zh: "公司", ar: "شركة" },
  "quick.companyProfile": { en: "Company Profile", zh: "公司资料", ar: "ملف الشركة" },
  "quick.nameEn":         { en: "Company Name (English)", zh: "公司名称（英文）", ar: "اسم الشركة (بالإنجليزية)" },
  "quick.nameCn":         { en: "Company Name (Chinese)", zh: "公司名称（中文）", ar: "اسم الشركة (بالصينية)" },
  "quick.selectType":     { en: "Select type…", zh: "选择类型…", ar: "اختر النوع…" },
  "quick.source":         { en: "Source", zh: "来源", ar: "المصدر" },
  "quick.selectSource":   { en: "Select source…", zh: "选择来源…", ar: "اختر المصدر…" },
  "quick.industry":       { en: "Industry", zh: "行业", ar: "الصناعة" },
  "quick.contactDetails": { en: "Contact Details", zh: "联系方式", ar: "تفاصيل الاتصال" },
  "quick.telephone":      { en: "Telephone", zh: "电话", ar: "الهاتف" },
  "quick.mobile":         { en: "Mobile", zh: "手机", ar: "الجوال" },
  "quick.email":          { en: "Email", zh: "邮箱", ar: "البريد الإلكتروني" },
  "quick.website":        { en: "Website", zh: "网站", ar: "الموقع الإلكتروني" },
  "quick.country":        { en: "Country", zh: "国家", ar: "الدولة" },
  "quick.address":        { en: "Address", zh: "地址", ar: "العنوان" },
  "quick.contactPerson":  { en: "Contact Person", zh: "联系人", ar: "الشخص المسؤول" },
  "quick.addPerson":      { en: "Add Person", zh: "添加联系人", ar: "إضافة شخص" },
  "quick.noPerson":       { en: "No contact person added yet", zh: "尚未添加联系人", ar: "لم تتم إضافة شخص مسؤول بعد" },
  "quick.person":         { en: "Person", zh: "联系人", ar: "شخص" },
  "quick.name":           { en: "Name", zh: "姓名", ar: "الاسم" },
  "quick.fullName":       { en: "Full name", zh: "全名", ar: "الاسم الكامل" },
  "quick.position":       { en: "Position", zh: "职位", ar: "المنصب" },
  "quick.department":     { en: "Department", zh: "部门", ar: "القسم" },
  "quick.messaging":      { en: "Messaging IDs", zh: "即时通讯账号", ar: "معرّفات المراسلة" },
  "quick.wechat":         { en: "WeChat ID", zh: "微信号", ar: "معرف WeChat" },
  "quick.wechatOfficial": { en: "WeChat Official", zh: "微信公众号", ar: "حساب WeChat الرسمي" },
  "quick.whatsapp":       { en: "WhatsApp", zh: "WhatsApp", ar: "واتساب" },
  "quick.telegram":       { en: "Telegram", zh: "Telegram", ar: "تيليجرام" },
  "quick.line":           { en: "Line ID", zh: "Line 账号", ar: "معرف Line" },
  "quick.qq":             { en: "QQ", zh: "QQ", ar: "QQ" },
  "quick.creating":       { en: "Creating...", zh: "创建中…", ar: "جارٍ الإنشاء…" },
  "quick.create":         { en: "Create", zh: "创建", ar: "إنشاء" },
  "err.nameEnRequired":   { en: "Company name (English) is required.", zh: "公司名称（英文）为必填项。", ar: "اسم الشركة (بالإنجليزية) مطلوب." },
  "err.createFailed":     { en: "Failed to create.", zh: "创建失败。", ar: "فشل الإنشاء." },

  "del.title":            { en: "Delete Catalog", zh: "删除目录", ar: "حذف الكتالوج" },
  "del.confirm":          { en: "Delete “{title}”? The file will be permanently removed.", zh: "删除“{title}”？文件将被永久删除。", ar: "حذف “{title}”؟ سيتم حذف الملف نهائيًا." },
  "del.delete":           { en: "Delete", zh: "删除", ar: "حذف" },
  "del.deleting":         { en: "Deleting...", zh: "删除中…", ar: "جارٍ الحذف…" },

  "common.cancel":        { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "card.preview":         { en: "Preview", zh: "预览", ar: "معاينة" },
  "card.download":        { en: "Download", zh: "下载", ar: "تنزيل" },
  "card.edit":            { en: "Edit", zh: "编辑", ar: "تعديل" },
  "card.delete":          { en: "Delete", zh: "删除", ar: "حذف" },
};

/* ── Helpers ── */
function getFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg"].includes(ext)) return "jpg";
  return ext;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isImageFile(type: string): boolean {
  return ["jpg", "jpeg", "png"].includes(type);
}

const FILE_TYPE_CONFIG: Record<string, { label: string; color: string; bgFrom: string; bgTo: string; icon: typeof DocumentIcon }> = {
  pdf: { label: "PDF", color: "text-red-400", bgFrom: "from-red-950", bgTo: "to-red-900/60", icon: DocumentIcon },
  jpg: { label: "JPG", color: "text-emerald-400", bgFrom: "from-emerald-950", bgTo: "to-emerald-900/60", icon: PictureIcon },
  jpeg: { label: "JPG", color: "text-emerald-400", bgFrom: "from-emerald-950", bgTo: "to-emerald-900/60", icon: PictureIcon },
  png: { label: "PNG", color: "text-blue-400", bgFrom: "from-blue-950", bgTo: "to-blue-900/60", icon: PictureIcon },
  psd: { label: "PSD", color: "text-indigo-400", bgFrom: "from-indigo-950", bgTo: "to-indigo-900/60", icon: LayersIcon },
  cdr: { label: "CDR", color: "text-orange-400", bgFrom: "from-orange-950", bgTo: "to-orange-900/60", icon: PenToolIcon },
};
const DEFAULT_FT = { label: "FILE", color: "text-zinc-400", bgFrom: "from-zinc-950", bgTo: "to-zinc-900/60", icon: FileIcon };

type ContactOption = {
  id: string;
  display_name: string;
  company_name_en: string | null;
  company_name_cn: string | null;
  contact_type: string;
  division: string | null;
  category: string | null;
  photo_url: string | null;
};

/* ── PDF first-page thumbnail generator ── */
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

let pdfjsLoaded = false;
function ensurePdfJs(): Promise<void> {
  if (pdfjsLoaded && (window as any).pdfjsLib) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = (window as any).pdfjsLib;
    if (existing) { pdfjsLoaded = true; resolve(); return; }
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error("pdfjsLib not on window")); return; }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      pdfjsLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load pdf.js from CDN"));
    document.head.appendChild(script);
  });
}

async function generatePdfThumbnail(file: File): Promise<Blob | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000));
  const generate = async (): Promise<Blob | null> => {
    try {
      await ensurePdfJs();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const pdfjsLib = (window as any).pdfjsLib;
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.75 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      const renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
      });
    } catch (err) {
      console.error("[PDF Thumbnail] Error:", err);
      return null;
    }
  };
  return Promise.race([generate(), timeout]);
}

/* ═══════════════════════════════════════
   ── Quick Add Supplier / Company Modal ──
   ═══════════════════════════════════════ */
interface QuickPerson { name: string; position: string; department: string; phone: string; mobile: string; email: string }
const QA_SUPPLIER_TYPES = ["Manufacturer", "Distributor", "Wholesaler", "Agent", "Trading Company", "Service Provider", "OEM", "ODM", "Other"];
const QA_SOURCES = ["Alibaba", "Made-in-China", "Global Sources", "Exhibition / Trade Show", "Referral", "Website", "LinkedIn", "Partner", "Agent", "Other"];

function QuickAddContactModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (contact: ContactOption) => void;
}) {
  const [contactType, setContactType] = useState<"supplier" | "company">("supplier");
  // Company profile
  const [nameEn, setNameEn] = useState("");
  const [nameCn, setNameCn] = useState("");
  const [supplierType, setSupplierType] = useState("");
  const [industry, setIndustry] = useState("");
  const [source, setSource] = useState("");
  // Contact details
  const [tel, setTel] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  // Contact persons
  const [persons, setPersons] = useState<QuickPerson[]>([]);
  // Messaging IDs
  const [wechatId, setWechatId] = useState("");
  const [wechatOfficial, setWechatOfficial] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [lineId, setLineId] = useState("");
  const [qqId, setQqId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation(T);

  useEffect(() => {
    if (open) {
      setContactType("supplier");
      setNameEn(""); setNameCn(""); setSupplierType(""); setIndustry(""); setSource("");
      setTel(""); setMobile(""); setEmail(""); setWebsite(""); setCountry(""); setAddress("");
      setPersons([]);
      setWechatId(""); setWechatOfficial(""); setWhatsapp(""); setTelegram(""); setLineId(""); setQqId("");
      setError("");
    }
  }, [open]);

  const addPerson = () => setPersons(p => [...p, { name: "", position: "", department: "", phone: "", mobile: "", email: "" }]);
  const updatePerson = (i: number, k: keyof QuickPerson, v: string) => setPersons(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const removePerson = (i: number) => setPersons(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!nameEn.trim()) { setError(t("err.nameEnRequired")); return; }
    setSaving(true);
    setError("");

    const obj: Record<string, unknown> = {
      contact_type: contactType,
      entity_type: "company",
      // Company profile
      company_name_en: nameEn.trim(),
      company_name_cn: nameCn.trim() || null,
      display_name: nameEn.trim(),
      full_name: nameEn.trim(),
      company: nameEn.trim(),
      supplier_type: supplierType || null,
      industry: industry.trim() || null,
      source: source || null,
      // Contact details
      supplier_tel: tel.trim() || null,
      supplier_mobile: mobile.trim() || null,
      supplier_email: email.trim() || null,
      supplier_website: website.trim() || null,
      supplier_address: address.trim() || null,
      country: country.trim() || null,
      // Contact persons (same shape as the Suppliers app)
      contact_persons: persons.filter(p => p.name.trim()),
      // Messaging IDs
      wechat_id: wechatId.trim() || null,
      wechat_official_account: wechatOfficial.trim() || null,
      whatsapp_business: whatsapp.trim() || null,
      telegram_id: telegram.trim() || null,
      line_id: lineId.trim() || null,
      qq_id: qqId.trim() || null,
      is_active: true,
      // Required array defaults
      tags: [], phones: [], emails: email.trim() ? [{ label: "Work", email: email.trim() }] : [],
      addresses: [], websites: website.trim() ? [{ label: "Website", url: website.trim() }] : [],
      social_profiles: [], family_members: [], related_names: [], custom_fields: [],
      shipping_addresses: [], attachments: [], product_categories: [], brand_names: [],
      certifications: [], catalogues: [], documents: [], bank_accounts: [],
      additional_company_names: [], resume_lines: [], emergency_contacts: [], visa_documents: [],
      rating: 0,
    };

    const { data, error: err } = await createContact(obj);
    setSaving(false);

    if (err || !data) {
      setError(err || t("err.createFailed"));
      return;
    }

    onCreated({
      id: data.id,
      display_name: nameEn.trim(),
      company_name_en: nameEn.trim(),
      company_name_cn: nameCn.trim() || null,
      contact_type: contactType,
      division: null,
      category: null,
      photo_url: null,
    });
    onClose();
  };

  if (!open) return null;

  const inp = "w-full h-10 px-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none";
  const lbl = "block text-[11px] font-medium text-[var(--text-dim)] mb-1.5";
  const sectionTitle = "text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] shadow-2xl">
        {/* Header (fixed) */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Building2Icon className="h-4 w-4 text-[var(--text-dim)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("quick.title")}</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <div className="mb-5 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">{error}</div>}

          {/* Type toggle */}
          <div className="mb-6">
            <label className={lbl}>{t("quick.type")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setContactType("supplier")}
                className={`h-10 rounded-lg text-[12px] font-semibold border transition-all ${contactType === "supplier" ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
                {t("quick.supplier")}
              </button>
              <button onClick={() => setContactType("company")}
                className={`h-10 rounded-lg text-[12px] font-semibold border transition-all ${contactType === "company" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
                {t("quick.company")}
              </button>
            </div>
          </div>

          {/* ── Company profile ── */}
          <p className={sectionTitle + " mb-3"}>{t("quick.companyProfile")}</p>
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={lbl}>{t("quick.nameEn")} <span className="text-red-400">*</span></label>
                <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Delta Engineering Ltd" className={inp} autoFocus />
              </div>
              <div>
                <label className={lbl}>{t("quick.nameCn")}</label>
                <input type="text" value={nameCn} onChange={(e) => setNameCn(e.target.value)} placeholder="达美工程有限公司" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={lbl}>{t("quick.type")}</label>
                <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)} className={inp}>
                  <option value="">{t("quick.selectType")}</option>
                  {QA_SUPPLIER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>{t("quick.source")}</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className={inp}>
                  <option value="">{t("quick.selectSource")}</option>
                  {QA_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>{t("quick.industry")}</label>
              <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Industrial Sewing Machines" className={inp} />
            </div>
          </div>

          <div className="mb-6 border-t border-[var(--border-subtle)]" />

          {/* ── Contact details ── */}
          <p className={sectionTitle + " mb-3"}>{t("quick.contactDetails")}</p>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className={lbl}>{t("quick.telephone")}</label><input type="text" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+86 755 …" className={inp} /></div>
            <div><label className={lbl}>{t("quick.mobile")}</label><input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+86 138 …" className={inp} /></div>
            <div><label className={lbl}>{t("quick.email")}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@company.com" className={inp} /></div>
            <div><label className={lbl}>{t("quick.website")}</label><input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={inp} /></div>
            <div><label className={lbl}>{t("quick.country")}</label><input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. China" className={inp} /></div>
            <div><label className={lbl}>{t("quick.address")}</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" className={inp} /></div>
          </div>

          <div className="mb-6 border-t border-[var(--border-subtle)]" />

          {/* ── Contact persons ── */}
          <div className="mb-2 flex items-center justify-between">
            <p className={sectionTitle}>{t("quick.contactPerson")}</p>
            <button type="button" onClick={addPerson} className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
              <PlusIcon className="h-3 w-3" /> {t("quick.addPerson")}
            </button>
          </div>
          <div className="mb-6">
            {persons.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border-subtle)] py-3 text-center text-[12px] text-[var(--text-dim)]">{t("quick.noPerson")}</p>
            ) : (
              <div className="space-y-3">
                {persons.map((p, i) => (
                  <div key={i} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--text-dim)]">{t("quick.person")} {i + 1}</span>
                      <button type="button" onClick={() => removePerson(i)} className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-dim)] hover:text-red-400 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div><label className={lbl}>{t("quick.name")}</label><input value={p.name} onChange={(e) => updatePerson(i, "name", e.target.value)} placeholder={t("quick.fullName")} className={inp} /></div>
                      <div><label className={lbl}>{t("quick.position")}</label><input value={p.position} onChange={(e) => updatePerson(i, "position", e.target.value)} placeholder="e.g. Sales Manager" className={inp} /></div>
                      <div><label className={lbl}>{t("quick.department")}</label><input value={p.department} onChange={(e) => updatePerson(i, "department", e.target.value)} placeholder="e.g. Sales" className={inp} /></div>
                      <div><label className={lbl}>{t("quick.telephone")}</label><input value={p.phone} onChange={(e) => updatePerson(i, "phone", e.target.value)} placeholder={t("quick.telephone")} className={inp} /></div>
                      <div><label className={lbl}>{t("quick.mobile")}</label><input value={p.mobile} onChange={(e) => updatePerson(i, "mobile", e.target.value)} placeholder={t("quick.mobile")} className={inp} /></div>
                      <div><label className={lbl}>{t("quick.email")}</label><input value={p.email} onChange={(e) => updatePerson(i, "email", e.target.value)} placeholder={t("quick.email")} className={inp} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6 border-t border-[var(--border-subtle)]" />

          {/* ── Messaging IDs ── */}
          <p className={sectionTitle + " mb-3"}>{t("quick.messaging")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className={lbl}>{t("quick.wechat")}</label><input type="text" value={wechatId} onChange={(e) => setWechatId(e.target.value)} placeholder="wxid_…" className={inp} /></div>
            <div><label className={lbl}>{t("quick.wechatOfficial")}</label><input type="text" value={wechatOfficial} onChange={(e) => setWechatOfficial(e.target.value)} placeholder="Official account" className={inp} /></div>
            <div><label className={lbl}>{t("quick.whatsapp")}</label><input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+86 …" className={inp} /></div>
            <div><label className={lbl}>{t("quick.telegram")}</label><input type="text" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@handle" className={inp} /></div>
            <div><label className={lbl}>{t("quick.line")}</label><input type="text" value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="line id" className={inp} /></div>
            <div><label className={lbl}>{t("quick.qq")}</label><input type="text" value={qqId} onChange={(e) => setQqId(e.target.value)} placeholder="QQ number" className={inp} /></div>
          </div>
        </div>

        {/* Footer (fixed) */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-6 py-4">
          <button onClick={onClose} className="h-10 px-5 rounded-lg text-[13px] font-medium text-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors">{t("common.cancel")}</button>
          <button onClick={handleSave} disabled={saving || !nameEn.trim()}
            className="flex h-10 items-center gap-2 rounded-lg bg-[var(--bg-inverted)] px-6 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 transition-all disabled:opacity-40">
            {saving && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            {saving ? t("quick.creating") : t("quick.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   ── Upload / Edit Modal ──
   ═══════════════════════════════ */
function CatalogModal({
  open, onClose, editEntry, contacts, divisions, categories, divLogos, catLogos, onSave,
}: {
  open: boolean;
  onClose: () => void;
  editEntry: CatalogEntry | null;
  contacts: ContactOption[];
  divisions: DivisionRow[];
  categories: CategoryRow[];
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  onSave: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [divisionSlug, setDivisionSlug] = useState<string>("");
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [localContacts, setLocalContacts] = useState<ContactOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation(T);

  // Populate form
  useEffect(() => {
    if (open) {
      if (editEntry) {
        setTitle(editEntry.title);
        setDescription(editEntry.description || "");
        setContactId(editEntry.contact_id || "");
        setDivisionSlug(editEntry.division_slug || "");
        setCategorySlug(editEntry.category_slug || "");
        setThumbPreview(editEntry.cover_url || (isImageFile(editEntry.file_type) ? editEntry.file_url : null));
      } else {
        setTitle("");
        setDescription("");
        setContactId("");
        setDivisionSlug("");
        setCategorySlug("");
        setThumbPreview(null);
      }
      setFile(null);
      setThumbnailBlob(null);
      setGeneratingThumb(false);
      setError("");
      setProgress("");
      setUploadPct(0);
      setContactSearch("");
      setShowContactDropdown(false);
      setShowQuickAdd(false);
      setLocalContacts(contacts);
    }
  }, [open, editEntry, contacts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false);
      }
    }
    if (showContactDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showContactDropdown]);

  const selectedContact = useMemo(() => localContacts.find(c => c.id === contactId), [localContacts, contactId]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return localContacts;
    const q = contactSearch.toLowerCase();
    return localContacts.filter(c =>
      c.display_name.toLowerCase().includes(q) ||
      c.company_name_en?.toLowerCase().includes(q) ||
      c.company_name_cn?.includes(q)
    );
  }, [localContacts, contactSearch]);

  const filteredCategories = useMemo(() => {
    if (!divisionSlug) return [];
    const div = divisions.find(d => d.slug === divisionSlug);
    if (!div) return [];
    return categories.filter(c => c.division_id === div.id);
  }, [divisionSlug, divisions, categories]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    const allowed = ["pdf", "jpg", "jpeg", "png", "psd", "cdr"];
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!allowed.includes(ext)) {
      setError(t("err.unsupported"));
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setError(t("err.tooLarge").replace("{mb}", String(Math.ceil(f.size / 1024 / 1024))));
      return;
    }
    setFile(f);
    setError("");
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));

    // Auto-generate cover
    if (isImageFile(ext)) {
      setThumbPreview(URL.createObjectURL(f));
      setThumbnailBlob(null); // image files use themselves as cover
    } else if (ext === "pdf") {
      setGeneratingThumb(true);
      setThumbPreview(null);
      setThumbnailBlob(null);
      const blob = await generatePdfThumbnail(f);
      if (blob) {
        setThumbnailBlob(blob);
        setThumbPreview(URL.createObjectURL(blob));
      } else {
        console.warn("[Catalogs] PDF thumbnail generation failed for:", f.name, f.size);
      }
      setGeneratingThumb(false);
    } else {
      setThumbPreview(null);
      setThumbnailBlob(null);
    }
  };

  const handleContactSelect = (c: ContactOption) => {
    setContactId(c.id);
    setContactSearch("");
    setShowContactDropdown(false);
    if (c.division && !divisionSlug) {
      const div = divisions.find(d => d.slug === c.division || d.name === c.division);
      if (div) setDivisionSlug(div.slug);
    }
    if (c.category && !categorySlug) {
      const cat = categories.find(ct => ct.slug === c.category || ct.name === c.category);
      if (cat) setCategorySlug(cat.slug);
    }
  };

  const handleSave = async () => {
    if (!editEntry && !file) { setError(t("err.selectFile")); return; }
    if (!title.trim()) { setError(t("err.titleRequired")); return; }

    setSaving(true);
    setError("");
    setProgress(t("modal.uploadingFile"));

    try {
      // Resolve from localContacts so a just-created supplier/company connects
      // (it may not yet exist in the parent `contacts` prop).
      const contact = localContacts.find(c => c.id === contactId);
      const div = divisions.find(d => d.slug === divisionSlug);
      const cat = categories.find(c => c.slug === categorySlug);

      if (editEntry) {
        let fileUrl = editEntry.file_url;
        let filePath = editEntry.file_path;
        let fileName = editEntry.file_name;
        let fileType = editEntry.file_type;
        let fileSize = editEntry.file_size;

        if (file) {
          const result = await replaceCatalogFile(editEntry.file_path, file, (pct) => { setUploadPct(pct); setProgress(t("modal.uploadingPct").replace("{n}", String(pct))); });
          if (!result) { setError(t("err.uploadFailed")); setSaving(false); setProgress(""); return; }
          fileUrl = result.url;
          filePath = result.path;
          fileName = file.name;
          fileType = getFileType(file.name);
          fileSize = file.size;
        }

        // Auto cover + save + sync all in parallel
        setProgress(t("modal.saving"));
        let coverUrl = editEntry.cover_url;
        let coverPath = editEntry.cover_path;

        const coverPromise = (file && thumbnailBlob)
          ? uploadCatalogCover(editEntry.id, new window.File([thumbnailBlob], "cover.jpg", { type: "image/jpeg" }))
          : Promise.resolve(null);

        if (file && !thumbnailBlob && isImageFile(fileType)) {
          coverUrl = fileUrl;
          coverPath = null;
        }

        const coverResult = await coverPromise;
        if (coverResult) { coverUrl = coverResult.url; coverPath = coverResult.path; }

        // Save metadata + sync to contact in parallel
        const savePromises: Promise<unknown>[] = [
          updateCatalog(editEntry.id, {
            title: title.trim(),
            description: description.trim() || null,
            contact_id: contactId || null,
            contact_name: contact?.display_name || null,
            company_name_en: contact?.company_name_en || null,
            company_name_cn: contact?.company_name_cn || null,
            contact_type: contact?.contact_type || null,
            division_slug: divisionSlug || null,
            division_name: div?.name || null,
            category_slug: categorySlug || null,
            category_name: cat?.name || null,
            file_name: fileName,
            file_path: filePath,
            file_url: fileUrl,
            file_type: fileType,
            file_size: fileSize,
            cover_url: coverUrl,
            cover_path: coverPath,
          }),
        ];
        if (contactId) {
          savePromises.push(syncCatalogToContact(contactId, { name: fileName, url: fileUrl, type: fileType }));
        }
        if (editEntry.contact_id && editEntry.contact_id !== contactId) {
          savePromises.push(removeCatalogFromContact(editEntry.contact_id, editEntry.file_url));
        }
        await Promise.all(savePromises);
      } else {
        const uploaded = await uploadCatalogFile(file!, (pct) => { setUploadPct(pct); setProgress(t("modal.uploadingPct").replace("{n}", String(pct))); });
        if (!uploaded) {
          setError(t("err.uploadFailed"));
          setSaving(false); setProgress(""); return;
        }

        const ft = getFileType(file!.name);
        setProgress(t("modal.saving"));

        // Upload cover first (if generated), then create catalog with cover URL included
        let coverUrl: string | null = isImageFile(ft) ? uploaded.url : null;
        let coverPath: string | null = null;

        if (thumbnailBlob) {
          const coverResult = await uploadCatalogCover(uploaded.id, new window.File([thumbnailBlob], "cover.jpg", { type: "image/jpeg" }));
          if (coverResult) {
            coverUrl = coverResult.url;
            coverPath = coverResult.path;
          }
        }

        // Save metadata + sync in parallel
        const savePromises: Promise<unknown>[] = [
          createCatalog({
            title: title.trim(),
            description: description.trim() || null,
            contact_id: contactId || null,
            contact_name: contact?.display_name || null,
            company_name_en: contact?.company_name_en || null,
            company_name_cn: contact?.company_name_cn || null,
            contact_type: contact?.contact_type || null,
            division_slug: divisionSlug || null,
            division_name: div?.name || null,
            category_slug: categorySlug || null,
            category_name: cat?.name || null,
            file_name: file!.name,
            file_path: uploaded.path,
            file_url: uploaded.url,
            file_type: ft,
            file_size: file!.size,
            cover_url: coverUrl,
            cover_path: coverPath,
            tags: [],
          }),
        ];
        if (contactId) {
          savePromises.push(syncCatalogToContact(contactId, { name: file!.name, url: uploaded.url, type: ft }));
        }
        await Promise.all(savePromises);
      }

      setProgress("");
      setSaving(false);
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      setError(t("err.somethingWrong"));
      setSaving(false);
    }
  };

  if (!open) return null;

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <CatalogsIcon size={16} className="text-[var(--text-dim)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {editEntry ? t("modal.editTitle") : t("modal.uploadTitle")}
            </h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* File upload + auto thumbnail preview */}
          <div>
            <label className={lbl}>{t("modal.file")} *</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.psd,.cdr" className="hidden"
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ""; }} />
            {file || editEntry ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                {/* Thumbnail preview */}
                <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-bright)] flex items-center justify-center">
                  {thumbPreview ? (
                    <img src={thumbPreview} alt="" className="w-full h-full object-contain bg-white" />
                  ) : generatingThumb ? (
                    <SpinnerIcon className="h-4 w-4 animate-spin text-[var(--text-dim)]" />
                  ) : (
                    (() => { const Icon = (FILE_TYPE_CONFIG[getFileType(file?.name || editEntry?.file_name || "")]?.icon) || FileIcon; return <Icon className={`h-5 w-5 ${FILE_TYPE_CONFIG[getFileType(file?.name || editEntry?.file_name || "")]?.color || "text-zinc-400"}`} />; })()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {file?.name || editEntry?.file_name}
                  </p>
                  <p className="text-[10px] text-[var(--text-dim)]">
                    {formatFileSize(file?.size || editEntry?.file_size || 0)} &middot; {(FILE_TYPE_CONFIG[getFileType(file?.name || editEntry?.file_name || "")]?.label) || "FILE"}
                  </p>
                  {generatingThumb && <p className="text-[10px] text-blue-400/70 mt-0.5">{t("modal.genCover")}</p>}
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
                  {t("modal.replace")}
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-8 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-blue-500/40 bg-[var(--bg-surface)] flex flex-col items-center gap-2 transition-all cursor-pointer group">
                <UploadIcon className="h-6 w-6 text-[var(--text-dim)] group-hover:text-blue-400 transition-colors" />
                <span className="text-[12px] text-[var(--text-dim)] group-hover:text-[var(--text-secondary)]">
                  {t("modal.fileDrop")}
                </span>
                <span className="text-[10px] text-[var(--text-dim)]">PDF, JPG, PNG, PSD, CDR</span>
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label className={lbl}>{t("modal.titleField")} *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("modal.titlePlaceholder")} className={inp} />
          </div>

          {/* Supplier / Company */}
          <div ref={dropdownRef} className="relative">
            <label className={lbl}>{t("modal.supplierCompany")}</label>
            {selectedContact ? (
              <div className="flex items-center gap-3 h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                {selectedContact.photo_url ? (
                  <div className="shrink-0 w-6 h-6 rounded overflow-hidden bg-[var(--bg-surface-bright)]">
                    <img src={selectedContact.photo_url} alt="" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <Building2Icon className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-[var(--text-primary)] truncate block">
                    {selectedContact.company_name_en || selectedContact.display_name}
                  </span>
                  {selectedContact.company_name_cn && (
                    <span className="text-[10px] text-[var(--text-dim)] block truncate">{selectedContact.company_name_cn}</span>
                  )}
                </div>
                <span className="text-[9px] uppercase font-bold text-[var(--text-dim)] px-1.5 py-0.5 rounded bg-[var(--bg-surface-bright)]">
                  {selectedContact.contact_type}
                </span>
                <button onClick={() => setContactId("")} className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
                  <CrossIcon className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" />
                <input type="text" value={contactSearch}
                  onChange={(e) => { setContactSearch(e.target.value); setShowContactDropdown(true); }}
                  onFocus={() => setShowContactDropdown(true)}
                  placeholder={t("modal.searchContacts")}
                  className={inp + " pl-9"} />
              </div>
            )}
            {showContactDropdown && !selectedContact && (
              <div className="absolute z-[60] left-0 right-0 top-full mt-1 max-h-[260px] overflow-y-auto rounded-xl bg-[#1a1a1a] border border-[#333] shadow-2xl shadow-black/50">
                {filteredContacts.length === 0 && !contactSearch ? (
                  <div className="px-4 py-6 text-center text-[11px] text-zinc-500">{t("modal.noContacts")}</div>
                ) : (
                  <>
                    {filteredContacts.map(c => (
                      <button key={c.id} onClick={() => handleContactSelect(c)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors text-left border-b border-[#2a2a2a] last:border-0">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-[#252525] border border-[#333] flex items-center justify-center overflow-hidden">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Building2Icon className="h-3.5 w-3.5 text-zinc-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-zinc-200 truncate">
                            {c.company_name_en || c.display_name}
                          </p>
                          {c.company_name_cn && (
                            <p className="text-[10px] text-zinc-500 truncate">{c.company_name_cn}</p>
                          )}
                        </div>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${c.contact_type === "supplier" ? "text-blue-400 bg-blue-500/15" : "text-emerald-400 bg-emerald-500/15"}`}>
                          {c.contact_type}
                        </span>
                      </button>
                    ))}
                    {contactSearch && filteredContacts.length === 0 && (
                      <div className="px-4 py-4 text-center text-[11px] text-zinc-500">{t("modal.noMatchFound")}</div>
                    )}
                  </>
                )}
                {/* Add new supplier button */}
                <button onClick={() => { setShowContactDropdown(false); setShowQuickAdd(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors text-left border-t border-[#333]">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <PlusIcon className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="text-[12px] font-medium text-blue-400">{t("modal.addNew")}</span>
                </button>
              </div>
            )}
          </div>

          {/* Division & Category with icons */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t("modal.division")}</label>
              <div className="relative">
                <select value={divisionSlug} onChange={(e) => { setDivisionSlug(e.target.value); setCategorySlug(""); }}
                  className={inp + " appearance-none pr-9 cursor-pointer"}>
                  <option value="">{t("modal.selectDivision")}</option>
                  {divisions.map(d => <option key={d.id} value={d.slug}>{d.name}</option>)}
                </select>
                <AngleDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)] pointer-events-none" />
              </div>
              {divisionSlug && (() => {
                const DivIcon = getDivisionIcon(divisionSlug);
                const logo = divLogos[divisionSlug];
                if (!DivIcon && !logo) return null;
                return (
                  <div className="flex items-center gap-2 mt-1.5 px-1">
                    {DivIcon ? <DivIcon className="w-4 h-4 text-[var(--text-dim)]" /> : <img src={logo} alt="" className="w-4 h-4 object-contain" />}
                    <span className="text-[10px] text-[var(--text-dim)]">{divisions.find(d => d.slug === divisionSlug)?.name}</span>
                  </div>
                );
              })()}
            </div>
            <div>
              <label className={lbl}>{t("modal.category")}</label>
              <div className="relative">
                <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}
                  className={inp + " appearance-none pr-9 cursor-pointer"} disabled={!divisionSlug}>
                  <option value="">{t("modal.selectCategory")}</option>
                  {filteredCategories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
                <AngleDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)] pointer-events-none" />
              </div>
              {categorySlug && catLogos[categorySlug] && (
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <img src={catLogos[categorySlug]} alt="" className="w-4 h-4 object-contain" />
                  <span className="text-[10px] text-[var(--text-dim)]">{categories.find(c => c.slug === categorySlug)?.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>{t("modal.description")} <span className="font-normal normal-case">{t("modal.optional")}</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t("modal.descPlaceholder")}
              rows={2} className={inp + " h-auto py-3 resize-none"} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)]">
          {saving && uploadPct > 0 && uploadPct < 100 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[var(--text-dim)]">{progress}</span>
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">{uploadPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
              {t("common.cancel")}
            </button>
            <button onClick={handleSave} disabled={saving || (!file && !editEntry) || !title.trim()}
              className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
              {saving && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {saving ? (progress || t("modal.uploading")) : editEntry ? t("modal.saveChanges") : t("modal.uploadBtn")}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Supplier / Company */}
      <QuickAddContactModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onCreated={(newContact) => {
          setLocalContacts(prev => [newContact, ...prev]);
          setContactId(newContact.id);
          setContactSearch("");
        }}
      />
    </div>
  );
}

/* ═══════════════════════════
   ── Delete Confirm Modal ──
   ═══════════════════════════ */
function DeleteModal({ open, onClose, catalog, onConfirm, deleting }: {
  open: boolean;
  onClose: () => void;
  catalog: CatalogEntry | null;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation(T);
  if (!open || !catalog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="px-6 py-5">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">{t("del.title")}</h2>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            {t("del.confirm").replace("{title}", catalog.title)}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose}
            className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            {t("common.cancel")}
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold hover:bg-red-500/30 transition-all disabled:opacity-40 relative overflow-hidden whitespace-nowrap">
            <span className={`inline-flex items-center gap-2 transition-opacity duration-150 ${deleting ? "opacity-0" : "opacity-100"}`}>
              <TrashIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{t("del.delete")}</span>
            </span>
            <span className={`absolute inset-0 inline-flex items-center justify-center gap-2 transition-opacity duration-150 ${deleting ? "opacity-100" : "opacity-0"}`}>
              <SpinnerIcon className="h-4 w-4 animate-spin shrink-0" />
              <span>{t("del.deleting")}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════
   ── Catalog Card ──
   ═══════════════════════════ */
function CatalogCard({ catalog, divLogos, catLogos, onPreview, onEdit, onDelete }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const coverUrl = catalog.cover_url || (isImageFile(catalog.file_type) ? catalog.file_url : null);
  const { t } = useTranslation(T);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = catalog.file_url;
    a.download = catalog.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="group relative flex flex-col rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden hover:border-[var(--text-dim)] transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
      {/* Cover area */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={catalog.title}
            className="w-full h-full object-contain bg-white transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${ft.bgFrom} ${ft.bgTo} flex flex-col items-center justify-center gap-3 p-4`}>
            <Icon className={`h-12 w-12 ${ft.color} opacity-60`} />
            <span className={`text-[24px] font-black ${ft.color} opacity-40 tracking-wider`}>{ft.label}</span>
            <p className="text-[11px] text-white/30 text-center truncate max-w-full px-2">{catalog.file_name}</p>
          </div>
        )}

        {/* File type badge */}
        <div className={`absolute top-2.5 right-2.5 h-6 px-2 rounded-md ${ft.color} bg-black/60 backdrop-blur-md text-[10px] font-bold flex items-center gap-1`}>
          <Icon className="h-3 w-3" />{ft.label}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={onPreview} title={t("card.preview")}
            className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
            <EyeIcon className="h-4.5 w-4.5" />
          </button>
          <button onClick={handleDownload} title={t("card.download")}
            className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
            <DownloadIcon className="h-4.5 w-4.5" />
          </button>
          <button onClick={onEdit} title={t("card.edit")}
            className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
            <PencilIcon className="h-4 w-4" />
          </button>
          <button onClick={onDelete} title={t("card.delete")}
            className="h-10 w-10 rounded-xl bg-red-500/30 backdrop-blur-md border border-red-500/30 text-red-300 flex items-center justify-center hover:bg-red-500/40 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-2">
          {catalog.title}
        </h3>
        {(catalog.company_name_en || catalog.contact_name) && (
          <div className="flex flex-col">
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {catalog.company_name_en || catalog.contact_name}
            </p>
            {catalog.company_name_cn && (
              <p className="text-[11px] text-[var(--text-dim)] truncate">{catalog.company_name_cn}</p>
            )}
          </div>
        )}

        {/* Division / Category with icons */}
        {(catalog.division_name || catalog.category_name) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {catalog.division_name && catalog.division_slug && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-[var(--bg-surface-bright)] text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wide">
                {(() => {
                  const DivIcon = getDivisionIcon(catalog.division_slug);
                  if (DivIcon) return <DivIcon className="w-3 h-3" />;
                  if (divLogos[catalog.division_slug]) return <img src={divLogos[catalog.division_slug]} alt="" className="w-3 h-3 object-contain" />;
                  return null;
                })()}
                {catalog.division_name}
              </span>
            )}
            {catalog.category_name && catalog.category_slug && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-blue-500/10 text-[9px] font-semibold text-blue-400/70 tracking-wide">
                {catLogos[catalog.category_slug] && (
                  <img src={catLogos[catalog.category_slug]} alt="" className="w-3 h-3 object-contain" />
                )}
                {catalog.category_name}
              </span>
            )}
          </div>
        )}

        <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{formatFileSize(catalog.file_size)}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════
   ── List Row ──
   ═══════════════════════════ */
function CatalogRow({ catalog, divLogos, catLogos, onPreview, onEdit, onDelete }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const coverUrl = catalog.cover_url || (isImageFile(catalog.file_type) ? catalog.file_url : null);
  const { t } = useTranslation(T);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = catalog.file_url;
    a.download = catalog.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--text-dim)] transition-all">
      <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-contain bg-white" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${ft.bgFrom} ${ft.bgTo} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${ft.color} opacity-60`} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{catalog.title}</h3>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {(catalog.company_name_en || catalog.contact_name) && (
            <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-[200px]">
              {catalog.company_name_en || catalog.contact_name}
              {catalog.company_name_cn && <span className="text-[var(--text-dim)]"> ({catalog.company_name_cn})</span>}
            </span>
          )}
          {catalog.division_name && catalog.division_slug && (
            <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded bg-[var(--bg-surface-bright)] text-[9px] font-semibold text-[var(--text-dim)]">
              {(() => {
                const DivIcon = getDivisionIcon(catalog.division_slug);
                if (DivIcon) return <DivIcon className="w-2.5 h-2.5" />;
                if (divLogos[catalog.division_slug]) return <img src={divLogos[catalog.division_slug]} alt="" className="w-2.5 h-2.5 object-contain" />;
                return null;
              })()}
              {catalog.division_name}
            </span>
          )}
          {catalog.category_name && catalog.category_slug && (
            <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded bg-blue-500/10 text-[9px] font-semibold text-blue-400/70">
              {catLogos[catalog.category_slug] && <img src={catLogos[catalog.category_slug]} alt="" className="w-2.5 h-2.5 object-contain" />}
              {catalog.category_name}
            </span>
          )}
        </div>
        <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{ft.label} &middot; {formatFileSize(catalog.file_size)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onPreview} title={t("card.preview")} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><EyeIcon className="h-3.5 w-3.5" /></button>
        <button onClick={handleDownload} title={t("card.download")} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><DownloadIcon className="h-3.5 w-3.5" /></button>
        <button onClick={onEdit} title={t("card.edit")} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><PencilIcon className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} title={t("card.delete")} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   ── MAIN PAGE ──
   ═══════════════════════════════ */
export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<CatalogEntry[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [divLogos, setDivLogos] = useState<Record<string, string>>({});
  const [catLogos, setCatLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterDivision, setFilterDivision] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [uploadModal, setUploadModal] = useState<{ open: boolean; editEntry: CatalogEntry | null }>({ open: false, editEntry: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; catalog: CatalogEntry | null }>({ open: false, catalog: null });
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation(T);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cats, conts, divs, catgs, dLogos, cLogos] = await Promise.all([
      fetchCatalogs(),
      fetchCatalogContacts(),
      fetchDivisions(),
      fetchCategories(),
      fetchDivisionLogos(),
      fetchCategoryLogos(),
    ]);
    setCatalogs(cats);
    setContacts(conts);
    setDivisions(divs);
    setCategories(catgs);
    setDivLogos(dLogos);
    setCatLogos(cLogos);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    let result = [...catalogs];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.company_name_en?.toLowerCase().includes(q) ||
        c.company_name_cn?.includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.file_name.toLowerCase().includes(q)
      );
    }
    if (filterSupplier !== "all") result = result.filter(c => c.contact_id === filterSupplier);
    if (filterDivision !== "all") result = result.filter(c => c.division_slug === filterDivision);
    if (filterType !== "all") result = result.filter(c => c.file_type === filterType);
    return result;
  }, [catalogs, search, filterSupplier, filterDivision, filterType]);

  const catalogSuppliers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    catalogs.forEach(c => {
      if (c.contact_id && c.contact_name) map.set(c.contact_id, { id: c.contact_id, name: c.company_name_en || c.contact_name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogs]);

  const catalogTypes = useMemo(() => [...new Set(catalogs.map(c => c.file_type))].sort(), [catalogs]);

  const catalogDivisions = useMemo(() => {
    const map = new Map<string, string>();
    catalogs.forEach(c => { if (c.division_slug && c.division_name) map.set(c.division_slug, c.division_name); });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogs]);

  const totalSize = useMemo(() => catalogs.reduce((s, c) => s + c.file_size, 0), [catalogs]);

  const handlePreview = (catalog: CatalogEntry) => {
    window.open(catalog.file_url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async () => {
    if (!deleteModal.catalog) return;
    setDeleting(true);
    const cat = deleteModal.catalog;
    await deleteCatalog(cat.id);
    // Remove from supplier/company contact
    if (cat.contact_id) {
      removeCatalogFromContact(cat.contact_id, cat.file_url);
    }
    setDeleting(false);
    setDeleteModal({ open: false, catalog: null });
    loadAll();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors" aria-label="Back to home">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <CatalogsIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight">{t("cat.title")}</h1>
          </div>
        </div>
        <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mb-6 md:mb-8 ml-11">{t("cat.subtitle")}</p>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <CatalogsIcon size={12} className="text-[var(--text-dim)]" />
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{catalogs.length}</span>
            <span className="text-[11px] text-[var(--text-dim)]">{t("cat.stat.catalogs")}</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <Building2Icon className="h-3 w-3 text-[var(--text-dim)]" />
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{catalogSuppliers.length}</span>
            <span className="text-[11px] text-[var(--text-dim)]">{t("cat.stat.suppliers")}</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{formatFileSize(totalSize)}</span>
            <span className="text-[11px] text-[var(--text-dim)]">{t("cat.stat.total")}</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("cat.search")}
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 transition-colors" />
          </div>

          {catalogSuppliers.length > 0 && (
            <div className="relative">
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">{t("cat.allSuppliers")}</option>
                {catalogSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          {catalogDivisions.length > 0 && (
            <div className="relative">
              <select value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">{t("cat.allDivisions")}</option>
                {catalogDivisions.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          {catalogTypes.length > 1 && (
            <div className="relative">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">{t("cat.allTypes")}</option>
                {catalogTypes.map(t => <option key={t} value={t}>{(FILE_TYPE_CONFIG[t]?.label || t).toUpperCase()}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          <div className="flex items-center h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={`h-full px-2.5 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
              <LayoutGridIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode("list")} className={`h-full px-2.5 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={() => setUploadModal({ open: true, editEntry: null })}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors shrink-0 ml-auto">
            <PlusIcon className="h-3.5 w-3.5" /> {t("cat.upload")}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" /></div>
        ) : catalogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-4">
              <CatalogsIcon size={28} className="text-[var(--text-dim)]" />
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--text-secondary)] mb-1">{t("cat.emptyTitle")}</h3>
            <p className="text-[12px] text-[var(--text-dim)] mb-5">{t("cat.emptyDesc")}</p>
            <button onClick={() => setUploadModal({ open: true, editEntry: null })}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-colors">
              <UploadIcon className="h-4 w-4" /> {t("cat.upload")}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[var(--border-subtle)] rounded-xl">
            <p className="text-[13px] text-[var(--text-dim)]">{t("cat.noMatch")}</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {filtered.map(catalog => (
              <CatalogCard key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                onPreview={() => handlePreview(catalog)}
                onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                onDelete={() => setDeleteModal({ open: true, catalog })} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(catalog => (
              <CatalogRow key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                onPreview={() => handlePreview(catalog)}
                onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                onDelete={() => setDeleteModal({ open: true, catalog })} />
            ))}
          </div>
        )}

        {/* Bottom nav */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/products" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">{t("nav.products")}</Link>
          <Link href="/suppliers" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">{t("nav.suppliers")}</Link>
          <Link href="/contacts" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">{t("nav.contacts")}</Link>
        </div>
      </div>

      {/* Modals */}
      <CatalogModal
        open={uploadModal.open}
        onClose={() => setUploadModal({ open: false, editEntry: null })}
        editEntry={uploadModal.editEntry}
        contacts={contacts}
        divisions={divisions}
        categories={categories}
        divLogos={divLogos}
        catLogos={catLogos}
        onSave={loadAll}
      />

      <DeleteModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, catalog: null })}
        catalog={deleteModal.catalog}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
