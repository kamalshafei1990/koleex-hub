"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
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
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import SmartphoneIcon from "@/components/icons/ui/SmartphoneIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import MapPinnedIcon from "@/components/icons/ui/MapPinnedIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import ZoomInIcon from "@/components/icons/ui/ZoomInIcon";
import ZoomOutIcon from "@/components/icons/ui/ZoomOutIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import {
  fetchCatalogs, createCatalog, updateCatalog, deleteCatalog,
  uploadCatalogFile, uploadCatalogCover, replaceCatalogFile,
  fetchCatalogContacts, syncCatalogToContact, removeCatalogFromContact,
  trackCatalog,
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
  "cat.stat.views":       { en: "views", zh: "查看", ar: "مشاهدات" },
  "cat.stat.downloads":   { en: "downloads", zh: "下载", ar: "تنزيلات" },
  "cat.insights":         { en: "Insights", zh: "洞察", ar: "تحليلات" },
  "cat.insights.engagement": { en: "Engagement", zh: "互动", ar: "التفاعل" },
  "cat.insights.recent":  { en: "Added last 30 days", zh: "近30天新增", ar: "أُضيف آخر 30 يوم" },
  "cat.insights.byDivision": { en: "By division", zh: "按部门", ar: "حسب القسم" },
  "cat.insights.mostViewed": { en: "Most viewed", zh: "最常查看", ar: "الأكثر مشاهدة" },
  "cat.insights.mostDownloaded": { en: "Most downloaded", zh: "最常下载", ar: "الأكثر تنزيلاً" },
  "cat.insights.noData":  { en: "No activity yet", zh: "暂无活动", ar: "لا يوجد نشاط بعد" },
  "cat.insights.noDivision": { en: "Unassigned", zh: "未分配", ar: "غير محدد" },
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
  "modal.titleEn":        { en: "Title (English)", zh: "标题（英文）", ar: "العنوان (بالإنجليزية)" },
  "modal.titleCn":        { en: "Title (Chinese)", zh: "标题（中文）", ar: "العنوان (بالصينية)" },
  "modal.titleCnPlaceholder": { en: "Catalog title in Chinese", zh: "中文目录标题", ar: "عنوان الكتالوج بالصينية" },
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
  "modal.year":           { en: "Year", zh: "年份", ar: "السنة" },
  "modal.selectYear":     { en: "Select year", zh: "选择年份", ar: "اختر السنة" },
  "modal.tags":           { en: "Tags", zh: "标签", ar: "الوسوم" },
  "modal.tagsPlaceholder":{ en: "comma, separated, tags", zh: "用逗号分隔的标签", ar: "وسوم مفصولة بفواصل" },
  "modal.replaceCover":   { en: "Set cover", zh: "设置封面", ar: "تعيين الغلاف" },
  "modal.multiHint":      { en: "drag or select multiple", zh: "可拖拽或多选", ar: "اسحب أو اختر عدة ملفات" },
  "modal.batchCount":     { en: "{n} files selected", zh: "已选择 {n} 个文件", ar: "تم تحديد {n} ملف" },
  "modal.addMore":        { en: "Add more", zh: "添加更多", ar: "إضافة المزيد" },
  "modal.batchTitleNote": { en: "Each file becomes a catalog (title = filename). The fields below apply to all of them.", zh: "每个文件将创建一个目录（标题为文件名）。以下字段将应用于全部。", ar: "كل ملف يصبح كتالوجًا (العنوان = اسم الملف). تنطبق الحقول أدناه على الجميع." },
  "modal.uploadBatch":    { en: "Upload {n}", zh: "上传 {n} 个", ar: "رفع {n}" },
  "modal.uploadingN":     { en: "Uploading {i}/{n}…", zh: "上传中 {i}/{n}…", ar: "جارٍ الرفع {i}/{n}…" },
  "modal.dupWarn":        { en: "A catalog with this file name already exists — you can still upload it.", zh: "已存在同名文件的目录——仍可上传。", ar: "يوجد كتالوج بنفس اسم الملف — لا يزال بإمكانك رفعه." },
  "modal.dupWarnN":       { en: "{n} of these files already exist — they'll be added as duplicates.", zh: "其中 {n} 个文件已存在——将作为副本添加。", ar: "{n} من هذه الملفات موجودة بالفعل — ستُضاف كنسخ مكررة." },
  "cat.allYears":         { en: "All Years", zh: "所有年份", ar: "كل السنوات" },
  "cat.allTags":          { en: "All Tags", zh: "所有标签", ar: "كل الوسوم" },
  "cat.sortNewest":       { en: "Newest", zh: "最新", ar: "الأحدث" },
  "cat.sortName":         { en: "Name", zh: "名称", ar: "الاسم" },
  "cat.sortSize":         { en: "Size", zh: "大小", ar: "الحجم" },
  "cat.sortYear":         { en: "Year", zh: "年份", ar: "السنة" },
  "cat.selected":         { en: "selected", zh: "已选", ar: "محدد" },
  "cat.deleteSelected":   { en: "Delete", zh: "删除", ar: "حذف" },
  "cat.downloadSelected": { en: "Download", zh: "下载", ar: "تنزيل" },
  "cat.clearSel":         { en: "Clear", zh: "清除", ar: "مسح" },
  "cat.selectAll":        { en: "Select all", zh: "全选", ar: "تحديد الكل" },
  "preview.none":         { en: "Preview not available for this file type.", zh: "此文件类型无法预览。", ar: "المعاينة غير متاحة لهذا النوع من الملفات." },
  "cat.loadMore":         { en: "Load more ({n})", zh: "加载更多（{n}）", ar: "تحميل المزيد ({n})" },
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
  "quick.qr":             { en: "QR", zh: "二维码", ar: "رمز" },
  "quick.creating":       { en: "Creating...", zh: "创建中…", ar: "جارٍ الإنشاء…" },
  "quick.create":         { en: "Create", zh: "创建", ar: "إنشاء" },
  "err.nameEnRequired":   { en: "Company name (English) is required.", zh: "公司名称（英文）为必填项。", ar: "اسم الشركة (بالإنجليزية) مطلوب." },
  "err.createFailed":     { en: "Failed to create.", zh: "创建失败。", ar: "فشل الإنشاء." },

  "del.title":            { en: "Delete Catalog", zh: "删除目录", ar: "حذف الكتالوج" },
  "del.confirm":          { en: "Delete “{title}”? The file will be permanently removed.", zh: "删除“{title}”？文件将被永久删除。", ar: "حذف “{title}”؟ سيتم حذف الملف نهائيًا." },
  "del.delete":           { en: "Delete", zh: "删除", ar: "حذف" },
  "del.deleting":         { en: "Deleting...", zh: "删除中…", ar: "جارٍ الحذف…" },

  "common.cancel":        { en: "Cancel", zh: "取消", ar: "إلغاء" },
  "common.close":         { en: "Close", zh: "关闭", ar: "إغلاق" },
  "cat.uploadedBy":       { en: "Uploaded by", zh: "上传者", ar: "رفع بواسطة" },
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

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
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
interface QuickPerson {
  name: string; position: string; department: string;
  phoneCode: string; phone: string; mobileCode: string; mobile: string;
  email: string; wechat: string; whatsapp: string;
}
const QA_SUPPLIER_TYPES = ["Manufacturer", "Distributor", "Wholesaler", "Agent", "Trading Company", "Service Provider", "OEM", "ODM", "Other"];
const QA_SOURCES = ["Alibaba", "Made-in-China", "Global Sources", "Exhibition / Trade Show", "Referral", "Website", "LinkedIn", "Partner", "Agent", "Other"];

/* International dialing codes (most-used first for a China-sourcing workflow). */
const DIAL_CODES: { c: string; f: string; n: string }[] = [
  { c: "+86", f: "🇨🇳", n: "China" }, { c: "+852", f: "🇭🇰", n: "Hong Kong" },
  { c: "+886", f: "🇹🇼", n: "Taiwan" }, { c: "+1", f: "🇺🇸", n: "USA / Canada" },
  { c: "+44", f: "🇬🇧", n: "United Kingdom" }, { c: "+971", f: "🇦🇪", n: "UAE" },
  { c: "+966", f: "🇸🇦", n: "Saudi Arabia" }, { c: "+20", f: "🇪🇬", n: "Egypt" },
  { c: "+90", f: "🇹🇷", n: "Turkey" }, { c: "+49", f: "🇩🇪", n: "Germany" },
  { c: "+33", f: "🇫🇷", n: "France" }, { c: "+39", f: "🇮🇹", n: "Italy" },
  { c: "+34", f: "🇪🇸", n: "Spain" }, { c: "+31", f: "🇳🇱", n: "Netherlands" },
  { c: "+7", f: "🇷🇺", n: "Russia" }, { c: "+91", f: "🇮🇳", n: "India" },
  { c: "+92", f: "🇵🇰", n: "Pakistan" }, { c: "+880", f: "🇧🇩", n: "Bangladesh" },
  { c: "+84", f: "🇻🇳", n: "Vietnam" }, { c: "+66", f: "🇹🇭", n: "Thailand" },
  { c: "+62", f: "🇮🇩", n: "Indonesia" }, { c: "+60", f: "🇲🇾", n: "Malaysia" },
  { c: "+63", f: "🇵🇭", n: "Philippines" }, { c: "+81", f: "🇯🇵", n: "Japan" },
  { c: "+82", f: "🇰🇷", n: "South Korea" }, { c: "+61", f: "🇦🇺", n: "Australia" },
  { c: "+55", f: "🇧🇷", n: "Brazil" }, { c: "+27", f: "🇿🇦", n: "South Africa" },
  { c: "+234", f: "🇳🇬", n: "Nigeria" }, { c: "+98", f: "🇮🇷", n: "Iran" },
  { c: "+964", f: "🇮🇶", n: "Iraq" }, { c: "+962", f: "🇯🇴", n: "Jordan" },
];

/* Strip anything that isn't a phone-number character. */
const phoneClean = (v: string) => v.replace(/[^\d\s()\-]/g, "");
/* Join a dial code with a number (empty number → empty string). */
const joinPhone = (code: string, num: string) => (num.trim() ? `${code} ${num.trim()}` : "");

/* Compress an image to a small base64 JPEG data URL — same approach the
   Contacts app uses for QR codes (no storage round-trip needed). */
async function compressImage(file: File, maxWidth = 600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas context")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Downscale an image File to a small JPEG cover Blob so card grids load
   fast (image catalogs otherwise use the full-resolution original). */
async function imageToCoverBlob(file: File, maxWidth = 1200, quality = 0.82): Promise<Blob | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
      };
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/* Text input with a leading icon. */
function IconInput({ icon, value, onChange, placeholder, type = "text" }: {
  icon: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 flex text-[var(--text-dim)] pointer-events-none">{icon}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
    </div>
  );
}

/* Phone input = country-code dropdown + number field that only accepts digits. */
function PhoneField({ code, number, onCode, onNumber, placeholder }: {
  code: string; number: string; onCode: (v: string) => void; onNumber: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="flex gap-1.5">
      <select value={code} onChange={(e) => onCode(e.target.value)}
        className="h-10 w-[78px] shrink-0 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] px-1.5 outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
        {DIAL_CODES.map((d) => <option key={d.c} value={d.c} title={d.n}>{d.f} {d.c}</option>)}
      </select>
      <input type="tel" inputMode="tel" value={number} onChange={(e) => onNumber(phoneClean(e.target.value))} placeholder={placeholder}
        className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all" />
    </div>
  );
}

/* QR-code uploader — compresses the chosen image to a base64 thumbnail. */
function QrUpload({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint: string }) {
  const ref = useRef<HTMLInputElement>(null);
  if (value) {
    return (
      <div className="relative h-[72px] w-[72px] shrink-0">
        <img src={value} alt="QR" className="h-full w-full rounded-lg border border-[var(--border-subtle)] object-cover bg-white" />
        <button type="button" onClick={() => onChange("")} aria-label="Remove QR"
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center shadow">
          <CrossIcon className="h-3 w-3" />
        </button>
      </div>
    );
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await compressImage(f, 600, 0.85)); e.target.value = ""; }} />
      <button type="button" onClick={() => ref.current?.click()} title={hint}
        className="h-[72px] w-[72px] shrink-0 rounded-lg border border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center gap-1 text-[var(--text-dim)] hover:border-blue-500/40 hover:text-blue-400 transition-colors">
        <ScanLineIcon className="h-4 w-4" />
        <span className="text-[9px] leading-none">{hint}</span>
      </button>
    </>
  );
}

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
  const [telCode, setTelCode] = useState("+86");
  const [tel, setTel] = useState("");
  const [mobileCode, setMobileCode] = useState("+86");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  // Contact persons
  const [persons, setPersons] = useState<QuickPerson[]>([]);
  // Messaging IDs
  const [wechatId, setWechatId] = useState("");
  const [wechatQr, setWechatQr] = useState("");
  const [wechatOfficial, setWechatOfficial] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappQr, setWhatsappQr] = useState("");
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
      setTelCode("+86"); setTel(""); setMobileCode("+86"); setMobile("");
      setEmail(""); setWebsite(""); setCountry(""); setAddress("");
      setPersons([]);
      setWechatId(""); setWechatQr(""); setWechatOfficial(""); setWhatsapp(""); setWhatsappQr(""); setTelegram(""); setLineId(""); setQqId("");
      setError("");
    }
  }, [open]);

  const addPerson = () => setPersons(p => [...p, { name: "", position: "", department: "", phoneCode: "+86", phone: "", mobileCode: "+86", mobile: "", email: "", wechat: "", whatsapp: "" }]);
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
      supplier_tel: joinPhone(telCode, tel) || null,
      supplier_mobile: joinPhone(mobileCode, mobile) || null,
      supplier_email: email.trim() || null,
      supplier_website: website.trim() || null,
      supplier_address: address.trim() || null,
      country: country.trim() || null,
      // Contact persons (same shape as the Suppliers app)
      contact_persons: persons.filter(p => p.name.trim()).map(p => ({
        name: p.name.trim(),
        position: p.position.trim(),
        department: p.department.trim(),
        phone: joinPhone(p.phoneCode, p.phone),
        mobile: joinPhone(p.mobileCode, p.mobile),
        email: p.email.trim(),
        wechat_id: p.wechat.trim(),
        whatsapp: p.whatsapp.trim(),
      })),
      // Messaging IDs
      wechat_id: wechatId.trim() || null,
      wechat_qr: wechatQr || null,
      wechat_official_account: wechatOfficial.trim() || null,
      whatsapp_business: whatsapp.trim() || null,
      whatsapp_qr: whatsappQr || null,
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
          <div className="mb-3 flex items-center gap-2"><Building2Icon className="h-3.5 w-3.5 text-[var(--text-dim)]" /><p className={sectionTitle}>{t("quick.companyProfile")}</p></div>
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
                <div className="relative">
                  <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)} className={inp + " pr-9 cursor-pointer"}>
                    <option value="">{t("quick.selectType")}</option>
                    {QA_SUPPLIER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <AngleDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={lbl}>{t("quick.source")}</label>
                <div className="relative">
                  <select value={source} onChange={(e) => setSource(e.target.value)} className={inp + " pr-9 cursor-pointer"}>
                    <option value="">{t("quick.selectSource")}</option>
                    {QA_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <AngleDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)] pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
              <label className={lbl}>{t("quick.industry")}</label>
              <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Industrial Sewing Machines" className={inp} />
            </div>
          </div>

          <div className="mb-6 border-t border-[var(--border-subtle)]" />

          {/* ── Contact details ── */}
          <div className="mb-3 flex items-center gap-2"><PhoneIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" /><p className={sectionTitle}>{t("quick.contactDetails")}</p></div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className={lbl}>{t("quick.telephone")}</label><PhoneField code={telCode} number={tel} onCode={setTelCode} onNumber={setTel} placeholder="755 0000 0000" /></div>
            <div><label className={lbl}>{t("quick.mobile")}</label><PhoneField code={mobileCode} number={mobile} onCode={setMobileCode} onNumber={setMobile} placeholder="138 0000 0000" /></div>
            <div><label className={lbl}>{t("quick.email")}</label><IconInput icon={<AtSignIcon className="h-3.5 w-3.5" />} type="email" value={email} onChange={setEmail} placeholder="sales@company.com" /></div>
            <div><label className={lbl}>{t("quick.website")}</label><IconInput icon={<GlobeIcon className="h-3.5 w-3.5" />} value={website} onChange={setWebsite} placeholder="https://…" /></div>
            <div><label className={lbl}>{t("quick.country")}</label><IconInput icon={<MapPinIcon className="h-3.5 w-3.5" />} value={country} onChange={setCountry} placeholder="e.g. China" /></div>
            <div><label className={lbl}>{t("quick.address")}</label><IconInput icon={<MapPinnedIcon className="h-3.5 w-3.5" />} value={address} onChange={setAddress} placeholder="Full address" /></div>
          </div>

          <div className="mb-6 border-t border-[var(--border-subtle)]" />

          {/* ── Contact persons ── */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2"><UsersIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" /><p className={sectionTitle}>{t("quick.contactPerson")}</p></div>
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
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-dim)]"><UserIcon className="h-3.5 w-3.5" /> {t("quick.person")} {i + 1}</span>
                      <button type="button" onClick={() => removePerson(i)} className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-dim)] hover:text-red-400 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div><label className={lbl}>{t("quick.name")}</label><IconInput icon={<UserIcon className="h-3.5 w-3.5" />} value={p.name} onChange={(v) => updatePerson(i, "name", v)} placeholder={t("quick.fullName")} /></div>
                      <div><label className={lbl}>{t("quick.position")}</label><IconInput icon={<BriefcaseIcon className="h-3.5 w-3.5" />} value={p.position} onChange={(v) => updatePerson(i, "position", v)} placeholder="e.g. Sales Manager" /></div>
                      <div><label className={lbl}>{t("quick.department")}</label><IconInput icon={<TagsIcon className="h-3.5 w-3.5" />} value={p.department} onChange={(v) => updatePerson(i, "department", v)} placeholder="e.g. Sales" /></div>
                      <div><label className={lbl}>{t("quick.email")}</label><IconInput icon={<AtSignIcon className="h-3.5 w-3.5" />} type="email" value={p.email} onChange={(v) => updatePerson(i, "email", v)} placeholder="name@company.com" /></div>
                      <div><label className={lbl}>{t("quick.telephone")}</label><PhoneField code={p.phoneCode} number={p.phone} onCode={(v) => updatePerson(i, "phoneCode", v)} onNumber={(v) => updatePerson(i, "phone", v)} placeholder="755 0000 0000" /></div>
                      <div><label className={lbl}>{t("quick.mobile")}</label><PhoneField code={p.mobileCode} number={p.mobile} onCode={(v) => updatePerson(i, "mobileCode", v)} onNumber={(v) => updatePerson(i, "mobile", v)} placeholder="138 0000 0000" /></div>
                      <div><label className={lbl}>{t("quick.wechat")}</label><IconInput icon={<BrandGlyph name="wechat" size={15} />} value={p.wechat} onChange={(v) => updatePerson(i, "wechat", v)} placeholder="wxid_…" /></div>
                      <div><label className={lbl}>{t("quick.whatsapp")}</label><IconInput icon={<BrandGlyph name="whatsapp" size={15} />} value={p.whatsapp} onChange={(v) => updatePerson(i, "whatsapp", v)} placeholder="+86 …" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6 border-t border-[var(--border-subtle)]" />

          {/* ── Messaging IDs ── */}
          <div className="mb-3 flex items-center gap-2"><MessageSquareIcon className="h-3.5 w-3.5 text-[var(--text-dim)]" /><p className={sectionTitle}>{t("quick.messaging")}</p></div>
          <div className="space-y-4">
            {/* WeChat — ID + QR */}
            <div>
              <label className={lbl}>{t("quick.wechat")}</label>
              <div className="flex items-start gap-3">
                <div className="flex-1"><IconInput icon={<BrandGlyph name="wechat" size={15} />} value={wechatId} onChange={setWechatId} placeholder="wxid_…" /></div>
                <QrUpload value={wechatQr} onChange={setWechatQr} hint={t("quick.qr")} />
              </div>
            </div>
            {/* WhatsApp — number + QR */}
            <div>
              <label className={lbl}>{t("quick.whatsapp")}</label>
              <div className="flex items-start gap-3">
                <div className="flex-1"><IconInput icon={<BrandGlyph name="whatsapp" size={15} />} value={whatsapp} onChange={setWhatsapp} placeholder="+86 …" /></div>
                <QrUpload value={whatsappQr} onChange={setWhatsappQr} hint={t("quick.qr")} />
              </div>
            </div>
            {/* Remaining IDs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={lbl}>{t("quick.wechatOfficial")}</label><IconInput icon={<BrandGlyph name="wechat" size={15} />} value={wechatOfficial} onChange={setWechatOfficial} placeholder="Official account" /></div>
              <div><label className={lbl}>{t("quick.telegram")}</label><IconInput icon={<BrandGlyph name="telegram" size={15} />} value={telegram} onChange={setTelegram} placeholder="@handle" /></div>
              <div><label className={lbl}>{t("quick.line")}</label><IconInput icon={<BrandGlyph name="line" size={15} />} value={lineId} onChange={setLineId} placeholder="line id" /></div>
              <div><label className={lbl}>{t("quick.qq")}</label><IconInput icon={<BrandGlyph name="qq" size={15} />} value={qqId} onChange={setQqId} placeholder="QQ number" /></div>
            </div>
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
   ── Icon dropdown (native <select> can't render logos) ──
   ═══════════════════════════════ */
type IconOption = { value: string; label: string; icon?: ReactNode };
function IconSelect({ value, onChange, placeholder, disabled, options }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  options: IconOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const trigger = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border text-[13px] text-left flex items-center gap-2 outline-none transition-all";

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className={`${trigger} ${open ? "border-blue-500/50 ring-1 ring-blue-500/20" : "border-[var(--border-subtle)]"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-[var(--text-dim)]"}`}>
        {selected?.icon && <span className="shrink-0 flex items-center justify-center w-4 h-4">{selected.icon}</span>}
        <span className={`flex-1 truncate ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>{selected?.label || placeholder}</span>
        <AngleDownIcon className={`h-3.5 w-3.5 text-[var(--text-dim)] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl shadow-black/30 py-1">
          <button type="button" onClick={() => { onChange(""); setOpen(false); }}
            className="w-full px-3.5 py-2 text-left text-[13px] text-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-2">
            {placeholder}
          </button>
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center gap-2 ${value === o.value ? "text-[var(--text-primary)] bg-[var(--bg-surface-hover)]" : "text-[var(--text-secondary)]"}`}>
              {o.icon ? <span className="shrink-0 flex items-center justify-center w-4 h-4">{o.icon}</span> : <span className="w-4 h-4 shrink-0" />}
              <span className="flex-1 truncate">{o.label}</span>
              {value === o.value && <CheckIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   ── Upload / Edit Modal ──
   ═══════════════════════════════ */
function CatalogModal({
  open, onClose, editEntry, contacts, divisions, categories, divLogos, catLogos, existing, onSave,
}: {
  open: boolean;
  onClose: () => void;
  editEntry: CatalogEntry | null;
  contacts: ContactOption[];
  divisions: DivisionRow[];
  categories: CategoryRow[];
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  existing: { id: string; file_name: string }[];
  onSave: () => void;
}) {
  const [title, setTitle] = useState("");
  const [titleCn, setTitleCn] = useState("");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [divisionSlug, setDivisionSlug] = useState<string>("");
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [year, setYear] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [dupWarn, setDupWarn] = useState("");
  const [dragOver, setDragOver] = useState(false);
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
  const coverRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation(T);

  // Populate form
  useEffect(() => {
    if (open) {
      if (editEntry) {
        setTitle(editEntry.title);
        setTitleCn(editEntry.title_cn || "");
        setDescription(editEntry.description || "");
        setContactId(editEntry.contact_id || "");
        setDivisionSlug(editEntry.division_slug || "");
        setCategorySlug(editEntry.category_slug || "");
        setYear(editEntry.year ? String(editEntry.year) : "");
        setTagsInput((editEntry.tags || []).join(", "));
        setThumbPreview(editEntry.cover_url || (isImageFile(editEntry.file_type) ? editEntry.file_url : null));
      } else {
        setTitle("");
        setTitleCn("");
        setDescription("");
        setContactId("");
        setDivisionSlug("");
        setCategorySlug("");
        setYear("");
        setTagsInput("");
        setThumbPreview(null);
      }
      setFile(null);
      setBatchFiles([]);
      setDupWarn("");
      setDragOver(false);
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

  // Dropdown options carrying each division/category's own logo.
  const divisionOptions = useMemo<IconOption[]>(() => divisions.map(d => {
    const DivIcon = getDivisionIcon(d.slug);
    const logo = divLogos[d.slug];
    return {
      value: d.slug,
      label: d.name,
      icon: DivIcon ? <DivIcon className="w-4 h-4 text-[var(--text-dim)]" />
        : logo ? <img src={logo} alt="" className="w-4 h-4 object-contain" /> : undefined,
    };
  }), [divisions, divLogos]);

  const categoryOptions = useMemo<IconOption[]>(() => filteredCategories.map(c => {
    const logo = catLogos[c.slug];
    return {
      value: c.slug,
      label: c.name,
      icon: logo ? <img src={logo} alt="" className="w-4 h-4 object-contain" /> : undefined,
    };
  }), [filteredCategories, catLogos]);

  // Year dropdown: next year down through the last 16 years.
  const yearOptions = useMemo<IconOption[]>(() => {
    const now = new Date().getFullYear();
    const list: IconOption[] = [];
    for (let y = now + 1; y >= now - 15; y--) list.push({ value: String(y), label: String(y) });
    return list;
  }, []);

  const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "psd", "cdr"];
  const validateFile = (f: File): string | null => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXT.includes(ext)) return t("err.unsupported");
    if (f.size > 500 * 1024 * 1024) return t("err.tooLarge").replace("{mb}", String(Math.ceil(f.size / 1024 / 1024)));
    return null;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files);

    const existingNames = new Set(existing.filter(e => e.id !== editEntry?.id).map(e => e.file_name));

    // Multiple files (only in add mode) → batch upload, one catalog per file.
    if (arr.length > 1 && !editEntry) {
      const valid = arr.filter(f => !validateFile(f));
      const rejected = arr.length - valid.length;
      if (!valid.length) { setError(t("err.unsupported")); return; }
      setFile(null); setThumbnailBlob(null); setThumbPreview(null);
      setBatchFiles(valid);
      setError(rejected > 0 ? t("err.unsupported") : "");
      const dupes = valid.filter(f => existingNames.has(f.name)).length;
      setDupWarn(dupes > 0 ? t("modal.dupWarnN").replace("{n}", String(dupes)) : "");
      return;
    }

    const f = arr[0];
    const v = validateFile(f);
    if (v) { setError(v); return; }
    setBatchFiles([]);
    setFile(f);
    setError("");
    setDupWarn(existingNames.has(f.name) ? t("modal.dupWarn") : "");
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    const ext = f.name.split(".").pop()?.toLowerCase() || "";

    // Auto-generate cover
    if (isImageFile(ext)) {
      setThumbPreview(URL.createObjectURL(f));
      // Downscale to a lightweight cover so the grid stays fast — falls back
      // to the original image only if downscaling fails.
      setGeneratingThumb(true);
      const coverBlob = await imageToCoverBlob(f, 1200);
      setThumbnailBlob(coverBlob);
      setGeneratingThumb(false);
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

  const handleCoverSelect = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError(t("err.unsupported")); return; }
    setThumbnailBlob(f);
    setThumbPreview(URL.createObjectURL(f));
    setError("");
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

  // Generate a cover Blob for a file (PDF first page or downscaled image).
  const coverBlobFor = async (f: File): Promise<Blob | null> => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (isImageFile(ext)) return imageToCoverBlob(f, 1200);
    if (ext === "pdf") return generatePdfThumbnail(f);
    return null;
  };

  const handleSave = async () => {
    const contact = localContacts.find(c => c.id === contactId);
    const div = divisions.find(d => d.slug === divisionSlug);
    const cat = categories.find(c => c.slug === categorySlug);
    const yearVal = year.trim() ? (parseInt(year.trim(), 10) || null) : null;
    const tagList = tagsInput.split(",").map(s => s.trim()).filter(Boolean);

    // ── Batch upload: one catalog per file, shared metadata ──
    if (!editEntry && batchFiles.length > 1) {
      setSaving(true); setError("");
      let done = 0; const failed: string[] = [];
      for (const f of batchFiles) {
        setProgress(t("modal.uploadingN").replace("{i}", String(done + 1)).replace("{n}", String(batchFiles.length)));
        setUploadPct(0);
        try {
          const cover = await coverBlobFor(f);
          const uploaded = await uploadCatalogFile(f, (pct) => setUploadPct(pct));
          if (!uploaded) { failed.push(f.name); continue; }
          const ft = getFileType(f.name);
          let coverUrl: string | null = isImageFile(ft) ? uploaded.url : null;
          let coverPath: string | null = null;
          if (cover) {
            const cr = await uploadCatalogCover(uploaded.id, new window.File([cover], "cover.jpg", { type: "image/jpeg" }));
            if (cr) { coverUrl = cr.url; coverPath = cr.path; }
          }
          await createCatalog({
            title: f.name.replace(/\.[^.]+$/, ""), title_cn: null,
            description: description.trim() || null,
            contact_id: contactId || null, contact_name: contact?.display_name || null,
            company_name_en: contact?.company_name_en || null, company_name_cn: contact?.company_name_cn || null,
            contact_type: contact?.contact_type || null,
            division_slug: divisionSlug || null, division_name: div?.name || null,
            category_slug: categorySlug || null, category_name: cat?.name || null,
            file_name: f.name, file_path: uploaded.path, file_url: uploaded.url,
            file_type: ft, file_size: f.size, cover_url: coverUrl, cover_path: coverPath,
            tags: tagList, year: yearVal,
          });
          if (contactId) await syncCatalogToContact(contactId, { name: f.name, url: uploaded.url, type: ft });
          done++;
        } catch (e) { console.error(e); failed.push(f.name); }
      }
      setProgress(""); setSaving(false);
      if (failed.length) { setError(t("err.uploadFailed") + ` (${failed.length})`); }
      onSave();
      if (!failed.length) onClose();
      return;
    }

    if (!editEntry && !file) { setError(t("err.selectFile")); return; }
    if (!title.trim()) { setError(t("err.titleRequired")); return; }

    setSaving(true);
    setError("");
    setProgress(t("modal.uploadingFile"));

    try {
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

        const coverPromise = thumbnailBlob
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
            title_cn: titleCn.trim() || null,
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
            year: yearVal,
            tags: tagList,
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
            title_cn: titleCn.trim() || null,
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
            tags: tagList,
            year: yearVal,
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
          {dupWarn && !error && (
            <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-500 flex items-center gap-2">
              <ExclamationIcon className="h-3.5 w-3.5 shrink-0" /> {dupWarn}
            </div>
          )}

          {/* File upload + auto thumbnail preview */}
          <div
            onDragOver={(e) => { if (!editEntry) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!editEntry) handleFileSelect(e.dataTransfer.files); }}>
            <label className={lbl}>{t("modal.file")} *</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.psd,.cdr" multiple={!editEntry} className="hidden"
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ""; }} />
            <input ref={coverRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { handleCoverSelect(e.target.files); e.target.value = ""; }} />
            {batchFiles.length > 0 ? (
              <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{t("modal.batchCount").replace("{n}", String(batchFiles.length))}</span>
                  <button onClick={() => fileRef.current?.click()} className="h-7 px-2.5 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] inline-flex items-center gap-1"><PlusIcon className="h-3 w-3" /> {t("modal.addMore")}</button>
                </div>
                <div className="max-h-[180px] overflow-y-auto space-y-1">
                  {batchFiles.map((bf, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface-hover)]">
                      {(() => { const Icon = (FILE_TYPE_CONFIG[getFileType(bf.name)]?.icon) || FileIcon; return <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" />; })()}
                      <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--text-primary)]">{bf.name}</span>
                      <span className="text-[10px] text-[var(--text-dim)] shrink-0">{formatFileSize(bf.size)}</span>
                      <button onClick={() => setBatchFiles(p => p.filter((_, idx) => idx !== i))} className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-red-400"><CrossIcon className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : file || editEntry ? (
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
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => fileRef.current?.click()}
                    className="h-8 px-3 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
                    {t("modal.replace")}
                  </button>
                  <button onClick={() => coverRef.current?.click()}
                    className="h-8 px-3 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5">
                    <PictureIcon className="h-3 w-3" /> {t("modal.replaceCover")}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className={`w-full py-8 rounded-xl border-2 border-dashed bg-[var(--bg-surface)] flex flex-col items-center gap-2 transition-all cursor-pointer group ${dragOver ? "border-blue-500 bg-blue-500/5" : "border-[var(--border-subtle)] hover:border-blue-500/40"}`}>
                <UploadIcon className={`h-6 w-6 transition-colors ${dragOver ? "text-blue-400" : "text-[var(--text-dim)] group-hover:text-blue-400"}`} />
                <span className="text-[12px] text-[var(--text-dim)] group-hover:text-[var(--text-secondary)]">
                  {t("modal.fileDrop")}
                </span>
                <span className="text-[10px] text-[var(--text-dim)]">PDF, JPG, PNG, PSD, CDR · {t("modal.multiHint")}</span>
              </button>
            )}
          </div>

          {/* Title — English + Chinese (single upload only; batch uses filenames) */}
          {batchFiles.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>{t("modal.titleEn")} *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("modal.titlePlaceholder")} className={inp} />
              </div>
              <div>
                <label className={lbl}>{t("modal.titleCn")}</label>
                <input type="text" value={titleCn} onChange={(e) => setTitleCn(e.target.value)} placeholder={t("modal.titleCnPlaceholder")} className={inp} />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--text-dim)] -mt-1">{t("modal.batchTitleNote")}</p>
          )}

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

          {/* Division & Category — logo dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t("modal.division")}</label>
              <IconSelect value={divisionSlug} placeholder={t("modal.selectDivision")}
                options={divisionOptions}
                onChange={(v) => { setDivisionSlug(v); setCategorySlug(""); }} />
            </div>
            <div>
              <label className={lbl}>{t("modal.category")}</label>
              <IconSelect value={categorySlug} placeholder={t("modal.selectCategory")}
                options={categoryOptions} disabled={!divisionSlug}
                onChange={setCategorySlug} />
            </div>
          </div>

          {/* Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t("modal.year")} <span className="font-normal normal-case">{t("modal.optional")}</span></label>
              <IconSelect value={year} placeholder={t("modal.selectYear")}
                options={yearOptions} onChange={setYear} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={lbl}>{t("modal.tags")} <span className="font-normal normal-case">{t("modal.optional")}</span></label>
            <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t("modal.tagsPlaceholder")} className={inp} />
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
            <button onClick={handleSave} disabled={saving || (batchFiles.length > 0 ? false : (!file && !editEntry) || !title.trim())}
              className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
              {saving && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {saving ? (progress || t("modal.uploading")) : editEntry ? t("modal.saveChanges") : batchFiles.length > 0 ? t("modal.uploadBatch").replace("{n}", String(batchFiles.length)) : t("modal.uploadBtn")}
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
function CatalogCard({ catalog, divLogos, catLogos, selected, onToggleSelect, onPreview, onEdit, onDelete, onDownload }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const coverUrl = catalog.cover_url || (isImageFile(catalog.file_type) ? catalog.file_url : null);
  const [coverErr, setCoverErr] = useState(false);
  const { t } = useTranslation(T);

  const handleDownload = () => {
    onDownload();
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
    <div className={`group relative flex flex-col rounded-2xl bg-[var(--bg-surface)] border overflow-hidden transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 ${selected ? "border-blue-500 ring-1 ring-blue-500/40" : "border-[var(--border-subtle)] hover:border-[var(--text-dim)]"}`}>
      {/* Selection checkbox */}
      <button onClick={onToggleSelect} aria-label="Select"
        className={`absolute top-2.5 left-2.5 z-10 h-6 w-6 rounded-md border flex items-center justify-center transition-all ${selected ? "bg-blue-500 border-blue-500 text-white opacity-100" : "bg-black/40 backdrop-blur-md border-white/40 text-transparent opacity-0 group-hover:opacity-100"}`}>
        <CheckIcon className="h-3.5 w-3.5" />
      </button>
      {/* Cover area */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {coverUrl && !coverErr ? (
          <img src={coverUrl} alt={catalog.title} loading="lazy" decoding="async" onError={() => setCoverErr(true)}
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
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-2" title={catalog.description || catalog.title}>
          {catalog.title}
        </h3>
        {catalog.title_cn && (
          <p className="text-[11px] text-[var(--text-dim)] leading-tight line-clamp-1 -mt-0.5">{catalog.title_cn}</p>
        )}
        {catalog.description && (
          <p className="text-[11px] text-[var(--text-secondary)] leading-snug line-clamp-2">{catalog.description}</p>
        )}
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

        {catalog.tags && catalog.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {catalog.tags.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center h-4 px-1.5 rounded bg-[var(--bg-surface-bright)] text-[9px] text-[var(--text-dim)]">{tag}</span>
            ))}
          </div>
        )}
        {catalog.created_by_name && (
          <p className="flex items-center gap-1 text-[10px] text-[var(--text-dim)] truncate mt-0.5">
            <UserIcon className="h-2.5 w-2.5 shrink-0" /> {t("cat.uploadedBy")} {catalog.created_by_name}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-0.5 text-[10px] text-[var(--text-dim)]">
          <span>{formatFileSize(catalog.file_size)}</span>
          <span className="truncate">{catalog.year ? `${catalog.year} · ` : ""}{fmtDate(catalog.created_at)}</span>
        </div>
        {((catalog.view_count ?? 0) > 0 || (catalog.download_count ?? 0) > 0) && (
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-dim)]">
            <span className="inline-flex items-center gap-1" title={t("cat.stat.views")}>
              <EyeIcon className="h-2.5 w-2.5" /> {catalog.view_count ?? 0}
            </span>
            <span className="inline-flex items-center gap-1" title={t("cat.stat.downloads")}>
              <DownloadIcon className="h-2.5 w-2.5" /> {catalog.download_count ?? 0}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════
   ── List Row ──
   ═══════════════════════════ */
function CatalogRow({ catalog, divLogos, catLogos, selected, onToggleSelect, onPreview, onEdit, onDelete, onDownload }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const coverUrl = catalog.cover_url || (isImageFile(catalog.file_type) ? catalog.file_url : null);
  const [coverErr, setCoverErr] = useState(false);
  const { t } = useTranslation(T);

  const handleDownload = () => {
    onDownload();
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
    <div className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border transition-all ${selected ? "border-blue-500 ring-1 ring-blue-500/40" : "border-[var(--border-subtle)] hover:border-[var(--text-dim)]"}`}>
      <button onClick={onToggleSelect} aria-label="Select"
        className={`shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${selected ? "bg-blue-500 border-blue-500 text-white" : "border-[var(--border-subtle)] text-transparent hover:border-[var(--text-dim)]"}`}>
        <CheckIcon className="h-3 w-3" />
      </button>
      <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
        {coverUrl && !coverErr ? (
          <img src={coverUrl} alt="" loading="lazy" decoding="async" onError={() => setCoverErr(true)} className="w-full h-full object-contain bg-white" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${ft.bgFrom} ${ft.bgTo} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${ft.color} opacity-60`} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
          {catalog.title}
          {catalog.title_cn && <span className="text-[var(--text-dim)] font-normal"> · {catalog.title_cn}</span>}
        </h3>
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
        <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{ft.label} &middot; {formatFileSize(catalog.file_size)}{catalog.year ? ` · ${catalog.year}` : ""} &middot; {fmtDate(catalog.created_at)}{catalog.created_by_name ? ` · ${t("cat.uploadedBy")} ${catalog.created_by_name}` : ""}{(catalog.view_count ?? 0) > 0 ? ` · ${catalog.view_count} ${t("cat.stat.views")}` : ""}{(catalog.download_count ?? 0) > 0 ? ` · ${catalog.download_count} ${t("cat.stat.downloads")}` : ""}</p>
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

/* ═══════════════════════════
   ── In-app Preview Viewer ──
   ═══════════════════════════ */
function PreviewModal({ catalog, onClose, onDownload }: { catalog: CatalogEntry | null; onClose: () => void; onDownload: (id: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const { t } = useTranslation(T);
  useEffect(() => { setZoom(1); }, [catalog?.id]);
  useEffect(() => {
    if (!catalog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [catalog, onClose]);
  if (!catalog) return null;

  const isPdf = catalog.file_type === "pdf";
  const isImg = isImageFile(catalog.file_type);
  const download = () => {
    onDownload(catalog.id);
    const a = document.createElement("a");
    a.href = catalog.file_url; a.download = catalog.file_name; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 text-white shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate">{catalog.title}</p>
          <p className="text-[11px] text-white/50 truncate">
            {catalog.title_cn ? `${catalog.title_cn} · ` : ""}
            {catalog.created_by_name ? `${t("cat.uploadedBy")} ${catalog.created_by_name}` : fmtDate(catalog.created_at)}
          </p>
          {catalog.description && <p className="text-[11px] text-white/40 truncate">{catalog.description}</p>}
        </div>
        {isImg && (
          <div className="flex items-center gap-1 mr-1">
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"><ZoomOutIcon className="h-4 w-4" /></button>
            <span className="text-[11px] tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"><ZoomInIcon className="h-4 w-4" /></button>
          </div>
        )}
        <button onClick={download} title={t("card.download")} className="h-9 w-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/20 transition-colors"><DownloadIcon className="h-4 w-4" /></button>
        <button onClick={onClose} aria-label="Close" title={t("common.cancel")} className="h-9 px-3 rounded-lg bg-white/15 border border-white/20 flex items-center gap-1.5 text-[12px] font-medium hover:bg-red-500/30 hover:border-red-500/40 transition-colors"><CrossIcon className="h-4 w-4" /> {t("common.close")}</button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-2 md:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {isPdf ? (
          <iframe src={catalog.file_url} title={catalog.title} className="w-full h-full rounded-lg bg-white" />
        ) : isImg ? (
          <img src={catalog.file_url} alt={catalog.title} style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-full object-contain transition-transform duration-150 origin-center" />
        ) : (
          <div className="flex flex-col items-center gap-4 text-white/70">
            {(() => { const Icon = (FILE_TYPE_CONFIG[catalog.file_type]?.icon) || FileIcon; return <Icon className="h-16 w-16 opacity-50" />; })()}
            <p className="text-[13px]">{t("preview.none")}</p>
            <button onClick={download} className="h-10 px-5 rounded-xl bg-white/15 border border-white/20 text-[13px] font-semibold flex items-center gap-2 hover:bg-white/25 transition-colors">
              <DownloadIcon className="h-4 w-4" /> {t("card.download")}
            </button>
          </div>
        )}
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
  const [filterYear, setFilterYear] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "size" | "year">("newest");
  const [visibleCount, setVisibleCount] = useState(24);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewCatalog, setPreviewCatalog] = useState<CatalogEntry | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const [uploadModal, setUploadModal] = useState<{ open: boolean; editEntry: CatalogEntry | null }>({ open: false, editEntry: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; catalog: CatalogEntry | null }>({ open: false, catalog: null });
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation(T);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

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

  // Reset how many cards are shown when the filter/sort context changes.
  useEffect(() => { setVisibleCount(24); }, [search, filterSupplier, filterDivision, filterType, filterYear, filterTag, sortBy]);

  const filtered = useMemo(() => {
    let result = [...catalogs];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.title_cn?.includes(q) ||
        c.company_name_en?.toLowerCase().includes(q) ||
        c.company_name_cn?.includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.file_name.toLowerCase().includes(q)
      );
    }
    if (filterSupplier !== "all") result = result.filter(c => c.contact_id === filterSupplier);
    if (filterDivision !== "all") result = result.filter(c => c.division_slug === filterDivision);
    if (filterType !== "all") result = result.filter(c => c.file_type === filterType);
    if (filterYear !== "all") result = result.filter(c => String(c.year ?? "") === filterYear);
    if (filterTag !== "all") result = result.filter(c => (c.tags || []).includes(filterTag));
    result.sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      if (sortBy === "size") return (b.file_size || 0) - (a.file_size || 0);
      if (sortBy === "year") return (b.year ?? 0) - (a.year ?? 0);
      return (b.created_at || "").localeCompare(a.created_at || ""); // newest
    });
    return result;
  }, [catalogs, search, filterSupplier, filterDivision, filterType, filterYear, filterTag, sortBy]);

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

  const catalogYears = useMemo(
    () => [...new Set(catalogs.map(c => c.year).filter((y): y is number => !!y))].sort((a, b) => b - a),
    [catalogs],
  );
  const catalogTags = useMemo(
    () => [...new Set(catalogs.flatMap(c => c.tags || []))].sort((a, b) => a.localeCompare(b)),
    [catalogs],
  );

  // Engagement insights, computed from the loaded catalogs + their counters.
  const insights = useMemo(() => {
    const totalViews = catalogs.reduce((s, c) => s + (c.view_count ?? 0), 0);
    const totalDownloads = catalogs.reduce((s, c) => s + (c.download_count ?? 0), 0);
    const cutoff = Date.now() - 30 * 864e5;
    const recent = catalogs.filter(c => new Date(c.created_at).getTime() >= cutoff).length;

    const divMap = new Map<string, number>();
    catalogs.forEach(c => {
      const key = c.division_name || t("cat.insights.noDivision");
      divMap.set(key, (divMap.get(key) ?? 0) + 1);
    });
    const byDivision = [...divMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    const mostViewed = [...catalogs].filter(c => (c.view_count ?? 0) > 0).sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 5);
    const mostDownloaded = [...catalogs].filter(c => (c.download_count ?? 0) > 0).sort((a, b) => (b.download_count ?? 0) - (a.download_count ?? 0)).slice(0, 5);
    return { totalViews, totalDownloads, recent, byDivision, mostViewed, mostDownloaded };
  }, [catalogs, t]);

  // Record a usage metric: optimistic local bump + fire-and-forget server write.
  const bumpMetric = useCallback((id: string, metric: "view" | "download") => {
    const field = metric === "view" ? "view_count" : "download_count";
    setCatalogs(prev => prev.map(c => c.id === id ? { ...c, [field]: (c[field] ?? 0) + 1 } : c));
    void trackCatalog(id, metric);
  }, []);

  const handlePreview = (catalog: CatalogEntry) => {
    setPreviewCatalog(catalog);
    bumpMetric(catalog.id, "view");
  };

  const handleBulkDownload = () => {
    filtered.filter(c => selected.has(c.id)).forEach((c, i) => {
      bumpMetric(c.id, "download");
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = c.file_url; a.download = c.file_name; a.target = "_blank"; a.rel = "noopener noreferrer";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }, i * 400);
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const targets = catalogs.filter(c => selected.has(c.id));
    await Promise.all(targets.map(async (c) => {
      await deleteCatalog(c.id);
      if (c.contact_id) await removeCatalogFromContact(c.contact_id, c.file_url);
    }));
    setBulkDeleting(false);
    clearSelection();
    loadAll();
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
          {(insights.totalViews > 0 || insights.totalDownloads > 0) && (
            <>
              <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <EyeIcon className="h-3 w-3 text-[var(--text-dim)]" />
                <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{insights.totalViews}</span>
                <span className="text-[11px] text-[var(--text-dim)]">{t("cat.stat.views")}</span>
              </div>
              <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <DownloadIcon className="h-3 w-3 text-[var(--text-dim)]" />
                <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{insights.totalDownloads}</span>
                <span className="text-[11px] text-[var(--text-dim)]">{t("cat.stat.downloads")}</span>
              </div>
            </>
          )}
          {catalogs.length > 0 && (
            <button onClick={() => setShowInsights(v => !v)}
              className={`flex items-center gap-2 h-9 px-4 rounded-lg border text-[12px] font-medium transition-colors ${showInsights ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
              <BarChart3Icon className="h-3.5 w-3.5" /> {t("cat.insights")}
              <AngleDownIcon className={`h-3 w-3 transition-transform ${showInsights ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {/* Insights panel */}
        {showInsights && catalogs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {/* Engagement */}
            <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-3">{t("cat.insights.engagement")}</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums leading-none">{insights.totalViews}</p>
                  <p className="text-[10px] text-[var(--text-dim)] mt-1">{t("cat.stat.views")}</p>
                </div>
                <div>
                  <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums leading-none">{insights.totalDownloads}</p>
                  <p className="text-[10px] text-[var(--text-dim)] mt-1">{t("cat.stat.downloads")}</p>
                </div>
                <div>
                  <p className="text-[20px] font-bold text-blue-500 tabular-nums leading-none">{insights.recent}</p>
                  <p className="text-[10px] text-[var(--text-dim)] mt-1">{t("cat.insights.recent")}</p>
                </div>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-2 mt-4">{t("cat.insights.byDivision")}</p>
              {insights.byDivision.length === 0 ? (
                <p className="text-[11px] text-[var(--text-dim)]">{t("cat.insights.noData")}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {insights.byDivision.map(d => {
                    const pct = Math.round((d.count / catalogs.length) * 100);
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--text-secondary)] truncate w-24 shrink-0">{d.name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface-bright)] overflow-hidden">
                          <div className="h-full bg-[var(--text-dim)] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-[var(--text-dim)] w-6 text-right shrink-0">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Most viewed */}
            <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-3 flex items-center gap-1.5"><EyeIcon className="h-3 w-3" /> {t("cat.insights.mostViewed")}</p>
              {insights.mostViewed.length === 0 ? (
                <p className="text-[11px] text-[var(--text-dim)]">{t("cat.insights.noData")}</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {insights.mostViewed.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="text-[11px] tabular-nums text-[var(--text-dim)] w-4 shrink-0">{i + 1}</span>
                      <button onClick={() => handlePreview(c)} className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate flex-1 text-left transition-colors">{c.title}</button>
                      <span className="text-[11px] font-semibold tabular-nums text-[var(--text-primary)] shrink-0">{c.view_count ?? 0}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Most downloaded */}
            <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-3 flex items-center gap-1.5"><DownloadIcon className="h-3 w-3" /> {t("cat.insights.mostDownloaded")}</p>
              {insights.mostDownloaded.length === 0 ? (
                <p className="text-[11px] text-[var(--text-dim)]">{t("cat.insights.noData")}</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {insights.mostDownloaded.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="text-[11px] tabular-nums text-[var(--text-dim)] w-4 shrink-0">{i + 1}</span>
                      <button onClick={() => handlePreview(c)} className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate flex-1 text-left transition-colors">{c.title}</button>
                      <span className="text-[11px] font-semibold tabular-nums text-[var(--text-primary)] shrink-0">{c.download_count ?? 0}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

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

          {catalogYears.length > 0 && (
            <div className="relative">
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">{t("cat.allYears")}</option>
                {catalogYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          {catalogTags.length > 0 && (
            <div className="relative">
              <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">{t("cat.allTags")}</option>
                {catalogTags.map(tg => <option key={tg} value={tg}>{tg}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
              <option value="newest">{t("cat.sortNewest")}</option>
              <option value="name">{t("cat.sortName")}</option>
              <option value="size">{t("cat.sortSize")}</option>
              <option value="year">{t("cat.sortYear")}</option>
            </select>
            <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
          </div>

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

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <span className="text-[12px] font-semibold text-blue-400">{selected.size} {t("cat.selected")}</span>
            <div className="flex-1" />
            <button onClick={() => setSelected(new Set(filtered.map(c => c.id)))}
              className="h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">{t("cat.selectAll")}</button>
            <button onClick={handleBulkDownload}
              className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors">
              <DownloadIcon className="h-3.5 w-3.5" /> {t("cat.downloadSelected")}
            </button>
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="h-8 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-red-500/25 transition-colors disabled:opacity-50">
              {bulkDeleting ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <TrashIcon className="h-3.5 w-3.5" />} {t("cat.deleteSelected")}
            </button>
            <button onClick={clearSelection}
              className="h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors inline-flex items-center gap-1.5">
              <CrossIcon className="h-3.5 w-3.5" /> {t("cat.clearSel")}
            </button>
          </div>
        )}

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
            {filtered.slice(0, visibleCount).map(catalog => (
              <CatalogCard key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                selected={selected.has(catalog.id)} onToggleSelect={() => toggleSelect(catalog.id)}
                onPreview={() => handlePreview(catalog)}
                onDownload={() => bumpMetric(catalog.id, "download")}
                onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                onDelete={() => setDeleteModal({ open: true, catalog })} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.slice(0, visibleCount).map(catalog => (
              <CatalogRow key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                selected={selected.has(catalog.id)} onToggleSelect={() => toggleSelect(catalog.id)}
                onPreview={() => handlePreview(catalog)}
                onDownload={() => bumpMetric(catalog.id, "download")}
                onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                onDelete={() => setDeleteModal({ open: true, catalog })} />
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && filtered.length > visibleCount && (
          <div className="mt-6 flex justify-center">
            <button onClick={() => setVisibleCount(c => c + 24)}
              className="h-10 px-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-dim)] transition-colors">
              {t("cat.loadMore").replace("{n}", String(filtered.length - visibleCount))}
            </button>
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
        existing={catalogs.map(c => ({ id: c.id, file_name: c.file_name }))}
        onSave={loadAll}
      />

      <DeleteModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, catalog: null })}
        catalog={deleteModal.catalog}
        onConfirm={handleDelete}
        deleting={deleting}
      />

      <PreviewModal catalog={previewCatalog} onClose={() => setPreviewCatalog(null)} onDownload={(id) => bumpMetric(id, "download")} />
    </div>
  );
}
