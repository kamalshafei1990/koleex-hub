"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentScopeKey } from "@/lib/me-bootstrap";
import Link from "next/link";
import FileIcon from "@/components/icons/ui/FileIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";
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

const CatalogSkeleton = () => (
  <div className="flex flex-col gap-2 p-4 animate-pulse">
    <div className="h-40 bg-gray-200 rounded" />
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
  </div>
);

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
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import Maximize2Icon from "@/components/icons/ui/Maximize2Icon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import {
  fetchCatalogs, createCatalog, updateCatalog, deleteCatalog,
  uploadCatalogFile, uploadCatalogCover, replaceCatalogFile,
  fetchCatalogContacts, syncCatalogToContact, removeCatalogFromContact,
  trackCatalog,
} from "@/lib/catalogs-admin";
import { createContact } from "@/lib/contacts-admin";
import ImportSupplierFromCatalog from "@/components/contacts/ImportSupplierFromCatalog";
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
  "cat.search":           { en: "Search title, supplier, tag, year…", zh: "搜索标题、供应商、标签、年份…", ar: "ابحث بالعنوان أو المورّد أو الوسم أو السنة…" },
  "cat.sug.keywords":     { en: "Quick keywords", zh: "快捷关键词", ar: "كلمات مفتاحية سريعة" },
  "cat.sug.title":        { en: "Title", zh: "标题", ar: "العنوان" },
  "cat.sug.supplier":     { en: "Supplier", zh: "供应商", ar: "المورّد" },
  "cat.sug.division":     { en: "Division", zh: "部门", ar: "القسم" },
  "cat.sug.category":     { en: "Category", zh: "类别", ar: "الفئة" },
  "cat.sug.tag":          { en: "Tag", zh: "标签", ar: "وسم" },
  "cat.sug.year":         { en: "Year", zh: "年份", ar: "السنة" },
  "cat.sug.none":         { en: "No matches", zh: "无匹配", ar: "لا توجد نتائج" },
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
  "modal.moreCategories": { en: "More categories", zh: "更多类别", ar: "فئات إضافية" },
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
  "preview.pdfError":     { en: "Couldn't display this PDF here.", zh: "无法在此处显示此 PDF。", ar: "تعذّر عرض ملف PDF هنا." },
  "preview.openTab":      { en: "Open in new tab", zh: "在新标签页打开", ar: "فتح في علامة تبويب جديدة" },
  "common.loading":       { en: "Loading…", zh: "加载中…", ar: "جارٍ التحميل…" },
  "preview.prevPage":     { en: "Previous page", zh: "上一页", ar: "الصفحة السابقة" },
  "preview.nextPage":     { en: "Next page", zh: "下一页", ar: "الصفحة التالية" },
  "preview.page":         { en: "Page", zh: "页", ar: "صفحة" },
  "preview.fit":          { en: "Fit", zh: "适合", ar: "ملاءمة" },
  "preview.fitWidth":     { en: "Fit width", zh: "适合宽度", ar: "ملاءمة العرض" },
  "preview.actualSize":   { en: "Actual size", zh: "实际大小", ar: "الحجم الفعلي" },
  "preview.rotate":       { en: "Rotate", zh: "旋转", ar: "تدوير" },
  "preview.print":        { en: "Print", zh: "打印", ar: "طباعة" },
  "preview.fullscreen":   { en: "Fullscreen", zh: "全屏", ar: "ملء الشاشة" },
  "cat.loadMore":         { en: "Load more ({n})", zh: "加载更多（{n}）", ar: "تحميل المزيد ({n})" },
  "cat.loading":          { en: "Loading…", zh: "加载中…", ar: "جارٍ التحميل…" },
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
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes < 1099511627776) return `${(bytes / 1073741824).toFixed(2)} GB`;
  return `${(bytes / 1099511627776).toFixed(2)} TB`;
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

/* Lowercase + strip diacritics so "Café" matches "cafe" and Arabic harakat
   are ignored. Chinese/Latin/digits pass through unchanged. */
function normalizeText(s?: string | null): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u0652]/g, ""); // Latin + Arabic combining marks
}

/* Split normalized text into words for prefix matching. */
function searchWords(norm: string): string[] {
  return norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/* A token matches if the text \u2014 or any of its words \u2014 starts with it.
   Chinese/Japanese have no word spacing, so for CJK tokens we fall back to a
   substring match (every character is meaningful). This stops a stray single
   Latin letter from matching the middle of a word (e.g. "l" \u2192 "cataLog"). */
function tokenHits(norm: string, words: string[], tok: string): boolean {
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(tok)) return norm.includes(tok);
  return norm.startsWith(tok) || words.some(w => w.startsWith(tok));
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

/* ── On-demand PDF opening (range requests) ──
   Catalog PDFs average ~32MB (max 187MB); downloading them in full just to
   show the first pages is what made Preview feel dead slow. pdf.js CAN load
   on demand via HTTP Range, but its automatic detection reads the
   `Accept-Ranges` response header — which Supabase does NOT expose to
   cross-origin JS (no Access-Control-Expose-Headers), so detection always
   fails and pdf.js silently falls back to a full download.

   Workaround: skip detection. We already know the exact byte size from the
   DB (`catalogs.file_size`, verified identical to storage), and 206 response
   BODIES are readable cross-origin — only the headers are hidden. So we hand
   pdf.js a manual PDFDataRangeTransport: fetch the first chunk ourselves
   (also proves the host honours Range via the 206 status), then serve every
   further byte-range pdf.js asks for. Pages/thumbnails are already lazy, so
   a preview now costs ~1–2MB instead of the whole file.

   Safety: any failure (no 206, wrong size, network error) falls back to the
   plain full-file path — exactly the previous behaviour. */
const PDF_RANGE_CHUNK = 524288; // 512KB
const PDF_RANGE_MIN_SIZE = 4 * 1024 * 1024; // small files: plain load is fine

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openPdfDocument(url: string, fileSize?: number | null): Promise<any> {
  await ensurePdfJs();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lib = (window as any).pdfjsLib;

  if (fileSize && fileSize > PDF_RANGE_MIN_SIZE && typeof lib.PDFDataRangeTransport === "function") {
    try {
      const firstEnd = Math.min(PDF_RANGE_CHUNK, fileSize) - 1;
      const probe = await fetch(url, { headers: { Range: `bytes=0-${firstEnd}` } });
      if (probe.status === 206) {
        const initial = new Uint8Array(await probe.arrayBuffer());
        if (initial.byteLength === firstEnd + 1) {
          const transport = new lib.PDFDataRangeTransport(fileSize, initial);
          let aborted = false;
          transport.requestDataRange = (begin: number, end: number) => {
            const get = (attempt: number) => {
              fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` } })
                .then((r) => { if (r.status !== 206) throw new Error(`range ${r.status}`); return r.arrayBuffer(); })
                .then((buf) => { if (!aborted) transport.onDataRange(begin, new Uint8Array(buf)); })
                .catch((e) => {
                  if (aborted) return;
                  if (attempt < 2) get(attempt + 1);
                  else console.error("[pdf-range]", e);
                });
            };
            get(0);
          };
          const baseAbort = transport.abort.bind(transport);
          transport.abort = () => { aborted = true; baseAbort(); };
          return await lib.getDocument({
            range: transport,
            rangeChunkSize: PDF_RANGE_CHUNK,
            disableAutoFetch: true, // fetch only what's actually viewed
            disableStream: true,
          }).promise;
        }
      }
    } catch (e) {
      console.warn("[pdf-range] falling back to full fetch:", e);
    }
  }
  // Plain full-file load — identical to the original behaviour.
  return await lib.getDocument({ url }).promise;
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

/* Render the first page of a PDF *at a URL* to a JPEG blob — used to lazily
   backfill a cover for catalogs that were created without one (e.g. synced
   from a supplier before covers existed). pdf.js fetches the URL itself
   (Supabase public bucket allows CORS). */
async function pdfUrlFirstPageBlob(url: string, fileSize?: number | null): Promise<Blob | null> {
  try {
    /* Only page 1 is rendered — with the range transport this fetches ~the
       first chunks instead of downloading a ~32MB average catalog in full
       ON THE LIST PAGE for every card missing a cover. */
    const pdf = await openPdfDocument(url, fileSize);
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.75 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.85));
  } catch (e) {
    console.error("[pdf-url-cover]", e);
    return null;
  }
}
/* Cover backfill attempts are once-per-session per catalog id (avoid refetching
   a large PDF if a card remounts before the PATCH lands). */
const coverBackfillTried = new Set<string>();

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
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-xl shadow-black/40 py-1">
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
  // Additional categories beyond the primary — a catalog/supplier can span
  // several categories. The primary (categorySlug) stays for back-compat
  // (filters, search, card logo); these are extras.
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const [year, setYear] = useState("");
  // Tags as committed chips + the in-progress draft (comma/Enter commits it).
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
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

  /* Lock the background page scroll while the upload/edit modal is open, so
     scrolling inside the modal doesn't bleed into (and jump) the grid behind
     it. Restores the previous overflow on close. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

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
        setExtraCats((editEntry.category_slugs || []).filter((s) => s && s !== editEntry.category_slug));
        setYear(editEntry.year ? String(editEntry.year) : "");
        setTags(editEntry.tags || []);
        setTagDraft("");
        setThumbPreview(editEntry.cover_url || (isImageFile(editEntry.file_type) ? editEntry.file_url : null));
      } else {
        setTitle("");
        setTitleCn("");
        setDescription("");
        setContactId("");
        setDivisionSlug("");
        setCategorySlug("");
        setExtraCats([]);
        setYear("");
        setTags([]);
        setTagDraft("");
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
    // Tags = committed chips + any text still in the draft box (so a value the
    // user typed but didn't press comma on isn't silently dropped). Deduped.
    const tagList = Array.from(new Set([...tags, tagDraft.trim()].map(s => s.trim()).filter(Boolean)));
    // Multi-category: primary first, then the extras, deduped. Names mapped
    // from the category list (fallback to the slug).
    const catSlugList = Array.from(new Set([categorySlug, ...extraCats].filter(Boolean)));
    const catNameList = catSlugList.map(s => categories.find(c => c.slug === s)?.name || s);
    const catSlugsField = catSlugList.length ? catSlugList : null;
    const catNamesField = catNameList.length ? catNameList : null;

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
            contact_photo_url: contact?.photo_url || null,
            division_slug: divisionSlug || null, division_name: div?.name || null,
            category_slug: categorySlug || null, category_name: cat?.name || null,
            category_slugs: catSlugsField, category_names: catNamesField,
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
            contact_photo_url: contact?.photo_url || null,
            division_slug: divisionSlug || null,
            division_name: div?.name || null,
            category_slug: categorySlug || null,
            category_name: cat?.name || null,
            category_slugs: catSlugsField, category_names: catNamesField,
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
            contact_photo_url: contact?.photo_url || null,
            division_slug: divisionSlug || null,
            division_name: div?.name || null,
            category_slug: categorySlug || null,
            category_name: cat?.name || null,
            category_slugs: catSlugsField, category_names: catNamesField,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div {...kxInspectAttrs({ component: "CatalogUploadModal", module: "Catalogs", section: "Upload" })} className="relative flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
                onChange={(v) => { setDivisionSlug(v); setCategorySlug(""); setExtraCats([]); }} />
            </div>
            <div>
              <label className={lbl}>{t("modal.category")}</label>
              <IconSelect value={categorySlug} placeholder={t("modal.selectCategory")}
                options={categoryOptions} disabled={!divisionSlug}
                onChange={(v) => { setCategorySlug(v); setExtraCats((prev) => prev.filter((s) => s !== v)); }} />
            </div>
          </div>

          {/* Additional categories — a catalog/supplier can belong to several.
              The control above is the PRIMARY; toggle any extras here. */}
          {divisionSlug && categorySlug && categoryOptions.filter((o) => o.value !== categorySlug).length > 0 && (
            <div>
              <label className={lbl}>{t("modal.moreCategories")} <span className="font-normal normal-case">{t("modal.optional")}</span></label>
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.filter((o) => o.value !== categorySlug).map((o) => {
                  const on = extraCats.includes(o.value);
                  return (
                    <button key={o.value} type="button"
                      onClick={() => setExtraCats((prev) => on ? prev.filter((s) => s !== o.value) : [...prev, o.value])}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${on ? "border-transparent bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                      {o.icon && <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{o.icon}</span>}
                      <span>{o.label}</span>
                      {on && <span aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t("modal.year")} <span className="font-normal normal-case">{t("modal.optional")}</span></label>
              <IconSelect value={year} placeholder={t("modal.selectYear")}
                options={yearOptions} onChange={setYear} />
            </div>
          </div>

          {/* Tags — type then press comma (or Enter) to lock each as a chip */}
          <div>
            <label className={lbl}>{t("modal.tags")} <span className="font-normal normal-case">{t("modal.optional")}</span></label>
            <div
              className={`${inp} flex h-auto min-h-[42px] flex-wrap items-center gap-1.5 py-1.5 cursor-text`}
              onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
            >
              {tags.map((tg, i) => (
                <span key={`${tg}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface-active)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)]">
                  {tg}
                  <button type="button" aria-label="Remove tag"
                    onClick={(e) => { e.stopPropagation(); setTags((prev) => prev.filter((_, idx) => idx !== i)); }}
                    className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">×</button>
                </span>
              ))}
              <input type="text" value={tagDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.includes(",")) {
                    const parts = v.split(",");
                    const toAdd = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
                    if (toAdd.length) setTags((prev) => Array.from(new Set([...prev, ...toAdd])));
                    setTagDraft(parts[parts.length - 1]);
                  } else setTagDraft(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = tagDraft.trim();
                    if (v) { setTags((prev) => Array.from(new Set([...prev, v]))); setTagDraft(""); }
                  } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                    setTags((prev) => prev.slice(0, -1));
                  }
                }}
                placeholder={tags.length ? "" : t("modal.tagsPlaceholder")}
                className="min-w-[120px] flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-ghost)]" />
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
        <div className="shrink-0 px-6 py-4 border-t border-[var(--border-subtle)]">
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
   ── Merged Supplier Card ──
   One card for a supplier with 2+ catalogs (spans two columns):
   each catalog as its own column (cover + its info), then ONE full-width
   supplier info band at the bottom. Matches the requested layout.
   ═══════════════════════════ */
function MergedSupplierCard({ group, maxCols, divLogos, catLogos, selected, onToggleSelect, onPreview, onEdit, onDelete, onDownload }: {
  group: { key: string; name: string; nameCn: string | null; logo: string | null; contactId: string | null; items: CatalogEntry[] };
  maxCols: number;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onPreview: (c: CatalogEntry) => void;
  onEdit: (c: CatalogEntry) => void;
  onDelete: (c: CatalogEntry) => void;
  onDownload: (c: CatalogEntry) => void;
}) {
  const { t } = useTranslation(T);
  const items = group.items;
  // Grow WIDER, not taller: the card spans one grid column per catalog (capped
  // at 4 so it never eats the whole row), and the catalogs sit side-by-side.
  const n = Math.min(items.length, Math.max(1, maxCols));
  return (
    <div
      className="flex h-full flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 gap-3"
      style={{ gridColumn: `span ${n} / span ${n}` }}
    >
      {/* Each catalog = a full single-style card, supplier hidden */}
      <div className="grid gap-3 flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {items.map((c) => (
          <CatalogCard key={c.id} catalog={c} divLogos={divLogos} catLogos={catLogos} hideSupplier
            selected={selected.has(c.id)} onToggleSelect={() => onToggleSelect(c.id)}
            onPreview={() => onPreview(c)} onDownload={() => onDownload(c)}
            onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />
        ))}
      </div>
      {/* Single full-width supplier info band */}
      {group.contactId ? (
        <Link href={`/suppliers/${group.contactId}`} className="group/sup flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 hover:bg-[var(--bg-surface-hover)] transition-colors">
          {group.logo
            ? <img src={group.logo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
            : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"><Building2Icon className="h-4 w-4 text-[var(--text-dim)]" /></span>}
          <div className="flex min-w-0 flex-col">
            <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate group-hover/sup:underline">{group.name}</p>
            <p className="text-[10.5px] text-[var(--text-dim)] truncate">{group.nameCn ? `${group.nameCn} · ` : ""}{items.length} {t("cat.catalogsWord", "catalogs")}</p>
          </div>
        </Link>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"><Building2Icon className="h-4 w-4 text-[var(--text-dim)]" /></span>
          <div className="flex min-w-0 flex-col">
            <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{group.name}</p>
            <p className="text-[10.5px] text-[var(--text-dim)] truncate">{items.length} {t("cat.catalogsWord", "catalogs")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════
   ── Catalog Card ──
   ═══════════════════════════ */
function CatalogCard({ catalog, divLogos, catLogos, selected, onToggleSelect, onPreview, onEdit, onDelete, onDownload, hideSupplier = false }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
  hideSupplier?: boolean;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const [coverErr, setCoverErr] = useState(false);
  const [lazyCover, setLazyCover] = useState<string | null>(null);
  const { t } = useTranslation(T);

  /* If a PDF catalog has no cover yet (e.g. synced from a supplier before
     covers existed), render its first page on view and persist it so it sticks. */
  useEffect(() => {
    if (catalog.file_type !== "pdf" || catalog.cover_url || !catalog.file_url) return;
    if (coverBackfillTried.has(catalog.id)) return;
    coverBackfillTried.add(catalog.id);
    let alive = true;
    let objUrl: string | null = null;
    (async () => {
      try {
        const blob = await pdfUrlFirstPageBlob(catalog.file_url, catalog.file_size);
        if (!blob) { coverBackfillTried.delete(catalog.id); return; } // allow a later retry
        if (!alive) return;
        objUrl = URL.createObjectURL(blob);
        setLazyCover(objUrl);
        const fd = new FormData();
        fd.append("file", blob, `${catalog.id}.cover.jpg`);
        fd.append("bucket", "media");
        fd.append("path", `catalogs/covers/${catalog.id}.jpg`);
        fd.append("contentType", "image/jpeg");
        fd.append("upsert", "true");
        const up = await fetch("/api/storage/upload", { method: "POST", body: fd });
        if (!up.ok) throw new Error(`upload ${up.status}`);
        const j = await up.json();
        if (j.publicUrl) {
          await fetch(`/api/catalogs/${catalog.id}`, {
            method: "PATCH", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cover_url: j.publicUrl, cover_path: j.path }),
          });
        }
      } catch {
        coverBackfillTried.delete(catalog.id); // transient failure — allow retry on a later mount
      }
    })();
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [catalog.id, catalog.file_type, catalog.cover_url, catalog.file_url]);

  const coverUrl = catalog.cover_url || lazyCover || (isImageFile(catalog.file_type) ? catalog.file_url : null);

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
    <div
      {...kxInspectAttrs({ component: "CatalogCard", module: "Catalogs", section: "Main List", recordId: catalog.id })}
      className={`group relative flex h-full flex-col rounded-2xl bg-[var(--bg-surface)] border overflow-hidden transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 ${selected ? "border-blue-500 ring-1 ring-blue-500/40" : "border-[var(--border-subtle)] hover:border-[var(--text-dim)]"}`}
    >
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
      <div className="p-3.5 flex flex-1 flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-2" title={catalog.description || catalog.title}>
          {catalog.title}
        </h3>
        {catalog.title_cn && (
          <p className="text-[11px] text-[var(--text-dim)] leading-tight line-clamp-1 -mt-0.5">{catalog.title_cn}</p>
        )}
        {catalog.description && (
          <p className="text-[11px] text-[var(--text-secondary)] leading-snug line-clamp-2">{catalog.description}</p>
        )}
        {!hideSupplier && (catalog.company_name_en || catalog.contact_name) && (
          catalog.contact_id ? (
            <Link
              href={`/suppliers/${catalog.contact_id}`}
              onClick={(e) => e.stopPropagation()}
              title={`Open ${catalog.company_name_en || catalog.contact_name}`}
              className="group/sup flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              {catalog.contact_photo_url
                ? <img src={catalog.contact_photo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"><Building2Icon className="h-4 w-4 text-[var(--text-dim)]" /></span>}
              <div className="flex min-w-0 flex-col">
                <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate group-hover/sup:underline">
                  {catalog.company_name_en || catalog.contact_name}
                </p>
                {catalog.company_name_cn && (
                  <p className="text-[10.5px] text-[var(--text-dim)] truncate">{catalog.company_name_cn}</p>
                )}
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
              {catalog.contact_photo_url
                ? <img src={catalog.contact_photo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"><Building2Icon className="h-4 w-4 text-[var(--text-dim)]" /></span>}
              <div className="flex min-w-0 flex-col">
                <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {catalog.company_name_en || catalog.contact_name}
                </p>
                {catalog.company_name_cn && (
                  <p className="text-[10.5px] text-[var(--text-dim)] truncate">{catalog.company_name_cn}</p>
                )}
              </div>
            </div>
          )
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
            {catalog.tags.slice(0, 4).map(tag => (
              <span key={tag} className="inline-flex items-center h-4 px-1.5 rounded-full border border-[var(--border-color)] bg-transparent text-[9px] font-medium text-[var(--text-secondary)]">
                <span className="opacity-50">#</span>{tag}
              </span>
            ))}
            {catalog.tags.length > 4 && (
              <span className="text-[9px] text-[var(--text-dim)]">+{catalog.tags.length - 4}</span>
            )}
          </div>
        )}
        {catalog.created_by_name && (
          <p className="flex items-center gap-1 text-[10px] text-[var(--text-dim)] truncate mt-0.5">
            <UserIcon className="h-2.5 w-2.5 shrink-0" /> {t("cat.uploadedBy")} {catalog.created_by_name}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1 text-[10px] text-[var(--text-dim)]">
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
function CatalogRow({ catalog, divLogos, catLogos, selected, onToggleSelect, onPreview, onEdit, onDelete, onDownload, hideSupplier = false }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
  hideSupplier?: boolean;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const [coverErr, setCoverErr] = useState(false);
  const [lazyCover, setLazyCover] = useState<string | null>(null);
  const { t } = useTranslation(T);

  /* If a PDF catalog has no cover yet (e.g. synced from a supplier before
     covers existed), render its first page on view and persist it so it sticks. */
  useEffect(() => {
    if (catalog.file_type !== "pdf" || catalog.cover_url || !catalog.file_url) return;
    if (coverBackfillTried.has(catalog.id)) return;
    coverBackfillTried.add(catalog.id);
    let alive = true;
    let objUrl: string | null = null;
    (async () => {
      try {
        const blob = await pdfUrlFirstPageBlob(catalog.file_url, catalog.file_size);
        if (!blob) { coverBackfillTried.delete(catalog.id); return; } // allow a later retry
        if (!alive) return;
        objUrl = URL.createObjectURL(blob);
        setLazyCover(objUrl);
        const fd = new FormData();
        fd.append("file", blob, `${catalog.id}.cover.jpg`);
        fd.append("bucket", "media");
        fd.append("path", `catalogs/covers/${catalog.id}.jpg`);
        fd.append("contentType", "image/jpeg");
        fd.append("upsert", "true");
        const up = await fetch("/api/storage/upload", { method: "POST", body: fd });
        if (!up.ok) throw new Error(`upload ${up.status}`);
        const j = await up.json();
        if (j.publicUrl) {
          await fetch(`/api/catalogs/${catalog.id}`, {
            method: "PATCH", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cover_url: j.publicUrl, cover_path: j.path }),
          });
        }
      } catch {
        coverBackfillTried.delete(catalog.id); // transient failure — allow retry on a later mount
      }
    })();
    return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [catalog.id, catalog.file_type, catalog.cover_url, catalog.file_url]);

  const coverUrl = catalog.cover_url || lazyCover || (isImageFile(catalog.file_type) ? catalog.file_url : null);

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
    <div {...kxInspectAttrs({ component: "CatalogRow", module: "Catalogs", section: "Main List", recordId: catalog.id })} className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border transition-all ${selected ? "border-blue-500 ring-1 ring-blue-500/40" : "border-[var(--border-subtle)] hover:border-[var(--text-dim)]"}`}>
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
          {!hideSupplier && (catalog.company_name_en || catalog.contact_name) && (
            catalog.contact_id ? (
              <Link
                href={`/suppliers/${catalog.contact_id}`}
                onClick={(e) => e.stopPropagation()}
                title={`Open ${catalog.company_name_en || catalog.contact_name}`}
                className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate max-w-[240px] hover:text-[var(--text-primary)] hover:underline"
              >
                {catalog.contact_photo_url && (
                  <img src={catalog.contact_photo_url} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
                )}
                <span className="truncate">
                  {catalog.company_name_en || catalog.contact_name}
                  {catalog.company_name_cn && <span className="text-[var(--text-dim)]"> ({catalog.company_name_cn})</span>}
                </span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate max-w-[240px]">
                {catalog.contact_photo_url && (
                  <img src={catalog.contact_photo_url} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
                )}
                <span className="truncate">
                  {catalog.company_name_en || catalog.contact_name}
                  {catalog.company_name_cn && <span className="text-[var(--text-dim)]"> ({catalog.company_name_cn})</span>}
                </span>
              </span>
            )
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
/* In-app PDF viewer (pdf.js) — consistent in every browser (vs the native
   <iframe> plugin that looked different per browser and went blank on
   unreachable files). Page-thumbnail sidebar + continuous scroll + zoom. Pages
   render lazily as they enter view (HTTP range requests keep big PDFs light),
   each render is cancellable, and the doc is destroyed on close. Falls back to
   Open/Download if the file can't be loaded. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;

const PdfPageCanvas = React.memo(function PdfPageCanvas({ pdf, pageNumber, quality, rotation, onActive }: {
  pdf: PdfDoc; pageNumber: number; quality: number; rotation: number; onActive: (n: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskRef = useRef<any>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  /* `visible` latches once (the canvas stays mounted with its last bitmap);
     `inView` tracks the CURRENT intersection. Rasterization only runs while
     in view — otherwise a zoom-settle quality bump would re-render every page
     ever scrolled past (dozens of huge canvases in a big catalog), which is
     exactly what made zooming feel slow. Off-screen pages keep their old
     bitmap and re-render at the latest quality when they come back. */
  const [inView, setInView] = useState(pageNumber <= 2);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setVisible(true);
        if (e.isIntersecting && e.intersectionRatio >= 0.5) onActive(pageNumber);
      }
    }, { rootMargin: "600px 0px", threshold: [0.01, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onActive]);

  /* The page is rasterized at `quality` (a render scale that the parent bumps,
     debounced, only after the user settles on a zoom). Its CSS size is FIXED at
     the page's natural points — the parent applies the live zoom via a single
     GPU transform, so this component does NOT re-render while zooming. */
  useEffect(() => {
    if (!visible || !inView || !pdf) return;
    let alive = true;
    (async () => {
      try { taskRef.current?.cancel?.(); } catch { /* noop */ }
      try {
        const page = await pdf.getPage(pageNumber);
        if (!alive) return;
        const b1 = page.getViewport({ scale: 1, rotation });
        setBase({ w: b1.width, h: b1.height });
        const vp = page.getViewport({ scale: quality, rotation });
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        canvas.width = vp.width; canvas.height = vp.height;
        const task = page.render({ canvasContext: ctx, viewport: vp });
        taskRef.current = task;
        await task.promise;
      } catch (e) { const n = (e as { name?: string } | null)?.name; if (n !== "RenderingCancelledException") console.error("[PdfPage]", e); }
    })();
    return () => { alive = false; };
  }, [visible, inView, pdf, pageNumber, rotation, quality]);

  useEffect(() => () => { try { taskRef.current?.cancel?.(); } catch { /* noop */ } }, []);

  return (
    <div ref={wrapRef} data-page={pageNumber} style={{ minHeight: base ? base.h : 420 }} className="flex justify-center">
      <canvas ref={canvasRef} style={base ? { width: base.w, height: base.h } : undefined} className="block bg-white rounded shadow-2xl" />
    </div>
  );
});

function PdfThumb({ pdf, pageNumber, active, onClick }: { pdf: PdfDoc; pageNumber: number; active: boolean; onClick: () => void }) {
  const wrapRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 6);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) setVisible(true); }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !pdf) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let task: any = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 0.22 });
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        canvas.width = viewport.width; canvas.height = viewport.height;
        task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
      } catch (e) { const n = (e as { name?: string } | null)?.name; if (n !== "RenderingCancelledException") console.error("[PdfThumb]", e); }
    })();
    return () => { cancelled = true; try { task?.cancel?.(); } catch { /* noop */ } };
  }, [visible, pdf, pageNumber]);
  return (
    <button ref={wrapRef} onClick={onClick} title={`Page ${pageNumber}`}
      className={`relative block w-full rounded-md overflow-hidden border transition-colors ${active ? "border-blue-500 ring-1 ring-blue-500/50" : "border-white/15 hover:border-white/40"}`}>
      <canvas ref={canvasRef} className="block w-full bg-white" style={{ minHeight: 60 }} />
      <span className="absolute bottom-0.5 end-0.5 text-[9px] px-1 rounded bg-black/60 text-white tabular-nums">{pageNumber}</span>
    </button>
  );
}

function PdfViewer({ url, fileSize, onDownload }: { url: string; fileSize?: number | null; onDownload: () => void }) {
  const { t } = useTranslation(T);
  const [pdf, setPdf] = useState<PdfDoc>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activePage, setActivePage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [fullscreen, setFullscreen] = useState(false);
  const [quality, setQuality] = useState(1.3);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseWidthRef = useRef(0);
  const pendingZoomRef = useRef<{ cxNatural: number; cyNatural: number; vx: number; vy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    let alive = true;
    let doc: PdfDoc = null;
    setStatus("loading"); setPdf(null); setNumPages(0); setActivePage(1); setRotation(0);
    (async () => {
      try {
        /* On-demand loading via the manual range transport (see
           openPdfDocument): first pages appear after ~1–2MB instead of the
           whole 32–187MB file; further pages fetch their chunks as you
           scroll/navigate. Falls back to the original full-file load. */
        doc = await openPdfDocument(url, fileSize);
        if (!alive) { try { doc.destroy?.(); } catch { /* noop */ } return; }
        try { const p1 = await doc.getPage(1); baseWidthRef.current = p1.getViewport({ scale: 1 }).width; } catch { /* noop */ }
        setPdf(doc); setNumPages(doc.numPages); setStatus("ready");
      } catch (e) { console.error("[PdfViewer load]", e); if (alive) setStatus("error"); }
    })();
    return () => { alive = false; try { doc?.destroy?.(); } catch { /* noop */ } };
  }, [url, fileSize]);

  useEffect(() => { setPageInput(String(activePage)); }, [activePage]);
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Track the pages' natural (unscaled) size so the scroll area reserves the
  // correct space for the GPU-scaled stage at any zoom.
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const measure = () => setStageSize({ w: el.scrollWidth, h: el.scrollHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el); measure();
    return () => ro.disconnect();
  }, [pdf, numPages, rotation, status]);

  // Re-rasterize pages sharper a beat after the user settles on a zoom (so the
  // live zoom stays fluid — it's just a CSS transform — yet ends up crisp).
  // Capped at 3× render scale: 4× meant ~8-megapixel canvases per page whose
  // rasterization froze the viewer after each zoom, for sharpness beyond what
  // the screen can show at typical zoom levels.
  useEffect(() => {
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const target = Math.min(3, +(scale * dpr).toFixed(2));
    const id = setTimeout(() => setQuality(q => (Math.abs(target - q) > 0.15 ? target : q)), 200);
    return () => clearTimeout(id);
  }, [scale]);

  // After a zoom resizes/recenters the stage, scroll so the captured natural
  // point lands back under the cursor (or viewport centre). Reads the real
  // post-layout stage rect, so centering/margins can't cause drift.
  useLayoutEffect(() => {
    const z = pendingZoomRef.current; const root = scrollRef.current; const stage = stageRef.current;
    if (z && root && stage) {
      const rr = root.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const pointVX = (sr.left - rr.left) + z.cxNatural * scale;
      const pointVY = (sr.top - rr.top) + z.cyNatural * scale;
      root.scrollLeft = Math.max(0, root.scrollLeft + (pointVX - z.vx));
      root.scrollTop = Math.max(0, root.scrollTop + (pointVY - z.vy));
      pendingZoomRef.current = null;
    }
  }, [scale]);

  const clampZoom = useCallback((z: number) => { const v = +(+z).toFixed(3); return Number.isFinite(v) ? Math.max(0.3, Math.min(4, v)) : 1; }, []);
  // Capture the natural (unscaled) point under the anchor before zooming.
  const captureAnchor = useCallback((vx: number, vy: number, prev: number) => {
    const root = scrollRef.current, stage = stageRef.current;
    if (!root || !stage) return;
    const rr = root.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    pendingZoomRef.current = { cxNatural: (vx - (sr.left - rr.left)) / prev, cyNatural: (vy - (sr.top - rr.top)) / prev, vx, vy };
  }, []);
  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const root = scrollRef.current;
    setScale(prev => {
      const next = clampZoom(prev * factor);
      if (root && next !== prev) {
        const rr = root.getBoundingClientRect();
        captureAnchor(clientX != null ? clientX - rr.left : root.clientWidth / 2, clientY != null ? clientY - rr.top : root.clientHeight / 2, prev);
      }
      return next;
    });
  }, [clampZoom, captureAnchor]);
  const zoomTo = useCallback((value: number) => {
    const root = scrollRef.current;
    setScale(prev => {
      const next = clampZoom(value);
      if (root && next !== prev) captureAnchor(root.clientWidth / 2, root.clientHeight / 2, prev);
      return next;
    });
  }, [clampZoom, captureAnchor]);

  /* Manual zoom anchored at the cursor: Ctrl/⌘ + wheel and trackpad pinch
     (delivered as ctrlKey wheel), plus +/- / 0 keys. Native non-passive listener
     so preventDefault stops the browser's own page zoom. */
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.2); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.2); }
      else if (e.key === "0") { e.preventDefault(); zoomTo(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [status, zoomBy, zoomTo]);

  const scrollToPage = useCallback((n: number) => {
    const root = scrollRef.current; if (!root) return;
    const el = root.querySelector(`[data-page="${n}"]`) as HTMLElement | null;
    if (!el) return;
    // Rect-based so it works regardless of nesting/positioned ancestors.
    const top = root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - 8;
    root.scrollTo({ top, behavior: "smooth" });
  }, []);
  const goTo = useCallback((n: number) => {
    const c = Math.min(numPages || 1, Math.max(1, n || 1));
    setActivePage(c); scrollToPage(c);
  }, [numPages, scrollToPage]);
  const fitWidth = () => {
    const root = scrollRef.current; const bw = baseWidthRef.current;
    if (!root || !bw) return;
    const avail = root.clientWidth - 24;
    zoomTo(Math.max(0.3, Math.min(4, +(avail / bw).toFixed(3))));
  };
  const toggleFullscreen = () => {
    const el = rootRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };
  // Cross-origin (Supabase) PDFs can't be driven via window.print() from here —
  // browsers block it and the load event never fires. Open in a new tab and let
  // the native viewer's own Print control handle it reliably.
  const printDoc = () => { window.open(url, "_blank", "noopener,noreferrer"); };

  // Hand-drag panning (like Preview): grab the page and drag to move when the
  // content is larger than the viewport.
  const canPan = () => {
    const r = scrollRef.current;
    return !!r && (r.scrollWidth > r.clientWidth + 1 || r.scrollHeight > r.clientHeight + 1);
  };
  const onPanDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const root = scrollRef.current; if (!root || !canPan()) return;
    panRef.current = { x: e.clientX, y: e.clientY, l: root.scrollLeft, t: root.scrollTop };
    setIsPanning(true);
    try { root.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onPanMove = (e: React.PointerEvent) => {
    const p = panRef.current; const root = scrollRef.current;
    if (!p || !root) return;
    root.scrollLeft = p.l - (e.clientX - p.x);
    root.scrollTop = p.t - (e.clientY - p.y);
  };
  const endPan = (e: React.PointerEvent) => {
    if (!panRef.current) return;
    panRef.current = null; setIsPanning(false);
    try { scrollRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-4 text-white/70">
        <FileIcon className="h-16 w-16 opacity-50" />
        <p className="text-[13px]">{t("preview.pdfError", "Couldn't display this PDF here.")}</p>
        <div className="flex items-center gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="h-10 px-5 rounded-xl bg-white/15 border border-white/20 text-[13px] font-semibold flex items-center gap-2 hover:bg-white/25 transition-colors">
            {t("preview.openTab", "Open in new tab")}
          </a>
          <button onClick={onDownload} className="h-10 px-5 rounded-xl bg-white/15 border border-white/20 text-[13px] font-semibold flex items-center gap-2 hover:bg-white/25 transition-colors">
            <DownloadIcon className="h-4 w-4" /> {t("card.download")}
          </button>
        </div>
      </div>
    );
  }

  const btn = "h-8 min-w-8 px-2 rounded-lg flex items-center justify-center gap-1 text-white/90 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";
  const grp = "flex items-center gap-0.5 rounded-xl bg-white/[0.06] border border-white/10 px-1 py-1";

  return (
    <div ref={rootRef} className="flex h-full w-full flex-col bg-black/30">
      {/* Toolbar — full PDF controls */}
      <div className="shrink-0 flex flex-wrap items-center justify-center gap-2 pb-3">
        <div className={grp}>
          <button className={btn} onClick={() => goTo(activePage - 1)} disabled={activePage <= 1} title={t("preview.prevPage", "Previous page")}><AngleLeftIcon className="h-4 w-4 rtl:rotate-180" /></button>
          <input value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { const n = parseInt(pageInput, 10); if (Number.isFinite(n)) goTo(n); else setPageInput(String(activePage)); } }}
            onBlur={() => { const n = parseInt(pageInput, 10); if (Number.isFinite(n)) goTo(n); else setPageInput(String(activePage)); }} inputMode="numeric" aria-label={t("preview.page", "Page")}
            className="h-7 w-10 rounded-md bg-black/30 border border-white/15 text-center text-[12px] text-white tabular-nums outline-none focus:border-white/40" />
          <span className="text-[12px] text-white/50 tabular-nums px-1">/ {numPages || "…"}</span>
          <button className={btn} onClick={() => goTo(activePage + 1)} disabled={activePage >= numPages} title={t("preview.nextPage", "Next page")}><AngleRightIcon className="h-4 w-4 rtl:rotate-180" /></button>
        </div>
        <div className={grp}>
          <button className={btn} onClick={() => zoomBy(1 / 1.2)} title={t("card.zoomOut", "Zoom out")}><ZoomOutIcon className="h-4 w-4" /></button>
          <span className="text-[12px] text-white/80 tabular-nums w-11 text-center">{Math.round(scale * 100)}%</span>
          <button className={btn} onClick={() => zoomBy(1.2)} title={t("card.zoomIn", "Zoom in")}><ZoomInIcon className="h-4 w-4" /></button>
          <span className="mx-0.5 h-4 w-px bg-white/15" />
          <button className={btn} onClick={fitWidth} title={t("preview.fitWidth", "Fit width")}><span className="text-[11px] font-medium px-0.5">{t("preview.fit", "Fit")}</span></button>
          <button className={btn} onClick={() => zoomTo(1)} title={t("preview.actualSize", "Actual size")}><span className="text-[11px] font-medium px-0.5">100%</span></button>
          <button className={btn} onClick={() => setRotation(r => (r + 90) % 360)} title={t("preview.rotate", "Rotate")}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" /></svg>
          </button>
        </div>
        <div className={grp}>
          <a className={btn} href={url} target="_blank" rel="noopener noreferrer" title={t("preview.openTab", "Open in new tab")}><ExternalLinkIcon className="h-4 w-4" /></a>
          <button className={btn} onClick={printDoc} title={t("preview.print", "Print")}><PrinterIcon className="h-4 w-4" /></button>
          <button className={btn} onClick={onDownload} title={t("card.download", "Download")}><DownloadIcon className="h-4 w-4" /></button>
          <button className={`${btn} ${fullscreen ? "bg-white/15" : ""}`} onClick={toggleFullscreen} title={t("preview.fullscreen", "Fullscreen")}><Maximize2Icon className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex gap-3">
        {pdf && numPages > 1 && (
          <div className="hidden sm:block w-[120px] shrink-0 overflow-y-auto space-y-2 pr-1">
            {Array.from({ length: numPages }, (_, i) => (
              <PdfThumb key={i} pdf={pdf} pageNumber={i + 1} active={activePage === i + 1} onClick={() => goTo(i + 1)} />
            ))}
          </div>
        )}
        <div ref={scrollRef}
          onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={endPan} onPointerLeave={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan}
          className={`flex-1 overflow-auto ${isPanning ? "cursor-grabbing select-none" : "cursor-grab"}`}>
          {status === "loading" && <div className="text-white/60 text-[13px] py-10 text-center">{t("common.loading", "Loading…")}</div>}
          {/* Sizer reserves the scaled footprint; the stage is rendered at natural
              size and scaled with one GPU transform (instant zoom, no per-page work). */}
          <div style={(stageSize.w && Number.isFinite(stageSize.w * scale)) ? { width: stageSize.w * scale, height: stageSize.h * scale } : undefined} className="relative mx-auto">
            <div ref={stageRef}
              /* willChange promotes the stage to its own compositor layer, so
                 changing scale() is a pure GPU transform — without it the
                 browser repaints the multi-megapixel page bitmaps on every
                 zoom step, which is what made zooming feel slow. */
              style={{ transform: `scale(${scale})`, transformOrigin: "0 0", willChange: "transform", ...(stageSize.w ? { position: "absolute", top: 0, left: 0 } : {}) }}
              className="w-max flex flex-col items-center gap-4 py-1 px-2">
              {pdf && Array.from({ length: numPages }, (_, i) => (
                <PdfPageCanvas key={i} pdf={pdf} pageNumber={i + 1} quality={quality} rotation={rotation} onActive={setActivePage} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ catalog, onClose, onDownload }: { catalog: CatalogEntry | null; onClose: () => void; onDownload: (id: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const { t } = useTranslation(T);
  useEffect(() => { setZoom(1); }, [catalog?.id]);
  useEffect(() => {
    if (!catalog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
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
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-sm" {...kxInspectAttrs({ component: "CatalogPreviewViewer", module: "Catalogs", section: "Preview", recordId: catalog.id })}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 text-white shrink-0" {...kxInspectAttrs({ component: "CatalogPreviewHeader", module: "Catalogs", section: "Preview" })}>
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
          <PdfViewer url={catalog.file_url} fileSize={catalog.file_size} onDownload={download} />
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
  const queryClient = useQueryClient();
  /* Shared cache key for THIS tenant/scope's catalog list. Reading the cache on
     mount lets a revisit paint the grid instantly (no skeleton) while loadAll
     revalidates in the background. The scope key (tenant + view-as) guarantees a
     cached list never bleeds across tenants. */
  const CATALOGS_QK = ["catalogs", "list", currentScopeKey()] as const;
  /* Seed from cache so returning to Catalogs shows the last-known list
     immediately instead of a skeleton. */
  const [catalogs, setCatalogs] = useState<CatalogEntry[]>(
    () => queryClient.getQueryData<CatalogEntry[]>(CATALOGS_QK) ?? [],
  );
  const [showSupplierImport, setShowSupplierImport] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [divLogos, setDivLogos] = useState<Record<string, string>>({});
  const [catLogos, setCatLogos] = useState<Record<string, string>>({});
  // Split loading: critical catalogs data first, then ancillary data.
  // Skip the skeleton on revisit when the list is already cached.
  const [catalogsLoading, setCatalogsLoading] = useState(
    () => queryClient.getQueryData<CatalogEntry[]>(CATALOGS_QK) == null,
  );

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  /* Column count that MIRRORS the Tailwind grid below (grid-cols-2 sm:3 lg:4
     xl:5). A grouped supplier card must never span MORE columns than the grid
     actually has, or the browser invents a phantom column and the whole grid
     overflows / goes unstable on mobile. */
  const [gridMaxCols, setGridMaxCols] = useState(5);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setGridMaxCols(w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 640 ? 3 : 2);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  // Group-by-supplier (Option A): collapse the flat grid into per-supplier
  // sections so "this supplier has N catalogs" is obvious. Composes with the
  // grid/list view inside each section.
  const [groupBySupplier, setGroupBySupplier] = useState(true);

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sugIndex, setSugIndex] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterDivision, setFilterDivision] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "size" | "year">("newest");
  const [visibleCount, setVisibleCount] = useState(24);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewCatalog, setPreviewCatalog] = useState<CatalogEntry | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  /* Render-stable "now" so the insights memo stays idempotent (calling Date.now()
     directly during render is flagged impure by the React compiler). */
  const [nowTs] = useState(() => Date.now());

  const [uploadModal, setUploadModal] = useState<{ open: boolean; editEntry: CatalogEntry | null }>({ open: false, editEntry: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; catalog: CatalogEntry | null }>({ open: false, catalog: null });
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation(T);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const loadAll = useCallback(async () => {
     // 1️⃣ Load catalogs (critical). Fetch fresh every time (staleTime 0 so a
     //    create/edit/delete → loadAll always reflects the change) but write
     //    through the shared cache so the NEXT visit paints instantly.
     if (process.env.NODE_ENV === "development") console.time("fetchCatalogs");
     const cats = await queryClient
       .fetchQuery({ queryKey: CATALOGS_QK, queryFn: fetchCatalogs, staleTime: 0 })
       .catch(() => queryClient.getQueryData<CatalogEntry[]>(CATALOGS_QK) ?? ([] as CatalogEntry[]));
     if (process.env.NODE_ENV === "development") console.timeEnd("fetchCatalogs");
     setCatalogs(cats);
     setCatalogsLoading(false);

     // 2️⃣ Load ancillary data (non‑critical)
     if (process.env.NODE_ENV === "development") console.time("fetchOtherData");
     const [conts, divs, catgs, dLogos, cLogos] = await Promise.all([
       fetchCatalogContacts().catch(() => [] as ContactOption[]),
       fetchDivisions().catch(() => [] as DivisionRow[]),
       fetchCategories().catch(() => [] as CategoryRow[]),
       fetchDivisionLogos().catch(() => ({}) as Record<string, string>),
       fetchCategoryLogos().catch(() => ({}) as Record<string, string>),
     ]);
     if (process.env.NODE_ENV === "development") console.timeEnd("fetchOtherData");
     setContacts(conts);
     setDivisions(divs);
     setCategories(catgs);
     setDivLogos(dLogos);
     setCatLogos(cLogos);
   }, [queryClient]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reset how many cards are shown when the filter/sort context changes.
  useEffect(() => { setVisibleCount(24); }, [search, filterSupplier, filterDivision, filterType, filterYear, filterTag, sortBy]);

  const filtered = useMemo(() => {
    let result = [...catalogs];

    // ── Smart search ──
    // Multi-keyword (every token must match), diacritic-insensitive, spanning
    // every meaningful field. Results are ranked by relevance (title / prefix
    // hits first) when a query is present.
    const tokens = normalizeText(search).split(/\s+/).filter(Boolean);
    const scores = new Map<string, number>();
    if (tokens.length) {
      result = result.filter(c => {
        const title = normalizeText(`${c.title} ${c.title_cn || ""}`);
        const rest = normalizeText([
          c.description, c.company_name_en, c.company_name_cn, c.contact_name,
          c.file_name, c.division_name, c.category_name, c.created_by_name,
          c.year != null ? String(c.year) : "", c.file_type, ...(c.tags || []),
        ].filter(Boolean).join(" | "));
        const titleWords = searchWords(title);
        const restWords = searchWords(rest);
        let score = 0;
        const ok = tokens.every(tok => {
          if (title.startsWith(tok)) { score += 4; return true; }
          if (tokenHits(title, titleWords, tok)) { score += 3; return true; }
          if (tokenHits(rest, restWords, tok)) { score += 1; return true; }
          return false;
        });
        if (ok) scores.set(c.id, score);
        return ok;
      });
    }

    if (filterSupplier !== "all") result = result.filter(c => c.contact_id === filterSupplier);
    if (filterDivision !== "all") result = result.filter(c => c.division_slug === filterDivision);
    if (filterType !== "all") result = result.filter(c => c.file_type === filterType);
    if (filterYear !== "all") result = result.filter(c => String(c.year ?? "") === filterYear);
    if (filterTag !== "all") result = result.filter(c => (c.tags || []).includes(filterTag));

    result.sort((a, b) => {
      // When searching, the most relevant matches lead.
      if (tokens.length) {
        const d = (scores.get(b.id) || 0) - (scores.get(a.id) || 0);
        if (d !== 0) return d;
      }
      if (sortBy === "name") return a.title.localeCompare(b.title);
      if (sortBy === "size") return (b.file_size || 0) - (a.file_size || 0);
      if (sortBy === "year") return (b.year ?? 0) - (a.year ?? 0);
      return (b.created_at || "").localeCompare(a.created_at || ""); // newest
    });
    return result;
  }, [catalogs, search, filterSupplier, filterDivision, filterType, filterYear, filterTag, sortBy]);

  // Infinite scroll: when the sentinel nears the viewport, reveal the next
  // batch. The Hub scrolls inside .shell-content-offset (not the window), so we
  // observe against that container; rootMargin pre-loads before you hit bottom.
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || filtered.length <= visibleCount) return;
    const root = (el.closest(".shell-content-offset") as HTMLElement) || null;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + 24); },
      { root, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length, visibleCount]);

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

  /* ── Search autocomplete corpus ──
     Every searchable entity (title, supplier, division, category, tag, year)
     becomes a suggestion. Picking one applies the smartest action: a structured
     entity sets its filter, free text fills the query. Works for CN/AR because
     labels keep their script and matching runs through normalizeText(). */
  type SearchSug = {
    type: "title" | "supplier" | "division" | "category" | "tag" | "year";
    label: string; norm: string; words: string[]; count: number; icon?: ReactNode; apply: () => void;
  };
  const allSearchItems = useMemo<SearchSug[]>(() => {
    const items: SearchSug[] = [];
    const seen = new Set<string>();
    const push = (it: Omit<SearchSug, "words">) => {
      const k = `${it.type}|${it.norm}`;
      if (it.norm && !seen.has(k)) { seen.add(k); items.push({ ...it, words: searchWords(it.norm) }); }
    };
    catalogSuppliers.forEach(s => push({
      type: "supplier", label: s.name, norm: normalizeText(s.name),
      count: catalogs.filter(c => c.contact_id === s.id).length,
      icon: <Building2Icon className="h-3.5 w-3.5" />,
      apply: () => { setFilterSupplier(s.id); setSearch(""); },
    }));
    catalogDivisions.forEach(d => {
      const DivIcon = getDivisionIcon(d.slug); const logo = divLogos[d.slug];
      push({
        type: "division", label: d.name, norm: normalizeText(d.name),
        count: catalogs.filter(c => c.division_slug === d.slug).length,
        icon: DivIcon ? <DivIcon className="h-3.5 w-3.5" /> : logo ? <img src={logo} alt="" className="h-3.5 w-3.5 object-contain" /> : undefined,
        apply: () => { setFilterDivision(d.slug); setSearch(""); },
      });
    });
    const catMap = new Map<string, string>();
    catalogs.forEach(c => { if (c.category_name && c.category_slug) catMap.set(c.category_slug, c.category_name); });
    catMap.forEach((name, slug) => {
      const logo = catLogos[slug];
      push({
        type: "category", label: name, norm: normalizeText(name),
        count: catalogs.filter(c => c.category_slug === slug).length,
        icon: logo ? <img src={logo} alt="" className="h-3.5 w-3.5 object-contain" /> : undefined,
        apply: () => setSearch(name),
      });
    });
    catalogTags.forEach(tg => push({
      type: "tag", label: tg, norm: normalizeText(tg),
      count: catalogs.filter(c => (c.tags || []).includes(tg)).length,
      icon: <HashtagIcon className="h-3.5 w-3.5" />,
      apply: () => { setFilterTag(tg); setSearch(""); },
    }));
    catalogYears.forEach(y => push({
      type: "year", label: String(y), norm: String(y),
      count: catalogs.filter(c => String(c.year ?? "") === String(y)).length,
      apply: () => { setFilterYear(String(y)); setSearch(""); },
    }));
    catalogs.forEach(c => {
      if (c.title) push({ type: "title", label: c.title, norm: normalizeText(c.title), count: 0, icon: <FileIcon className="h-3.5 w-3.5" />, apply: () => setSearch(c.title) });
      if (c.title_cn) push({ type: "title", label: c.title_cn, norm: normalizeText(c.title_cn), count: 0, icon: <FileIcon className="h-3.5 w-3.5" />, apply: () => setSearch(c.title_cn!) });
    });
    return items;
  }, [catalogSuppliers, catalogDivisions, catalogTags, catalogYears, catalogs, divLogos, catLogos]);

  const searchSuggestions = useMemo<SearchSug[]>(() => {
    const q = normalizeText(search);
    const tokens = q.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const scored: { it: SearchSug; score: number }[] = [];
    for (const it of allSearchItems) {
      // Every token must hit a word-start (substring for CJK) somewhere in the label.
      if (!tokens.every(tk => tokenHits(it.norm, it.words, tk))) continue;
      const score = it.norm.startsWith(q) ? 3 : it.words.some(w => w.startsWith(q)) ? 2 : 1;
      scored.push({ it, score });
    }
    scored.sort((a, b) => b.score - a.score || a.it.label.length - b.it.label.length);
    return scored.slice(0, 8).map(s => s.it);
  }, [allSearchItems, search]);

  // Keyword chips shown when the box is focused but empty.
  const searchKeywords = useMemo<SearchSug[]>(() => [
    ...allSearchItems.filter(i => i.type === "tag").slice(0, 6),
    ...allSearchItems.filter(i => i.type === "division").slice(0, 4),
    ...allSearchItems.filter(i => i.type === "year").slice(0, 3),
  ], [allSearchItems]);

  useEffect(() => {
    if (!searchFocused) return;
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchFocused(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [searchFocused]);

  // Engagement insights, computed from the loaded catalogs + their counters.
  const insights = useMemo(() => {
    const totalViews = catalogs.reduce((s, c) => s + (c.view_count ?? 0), 0);
    const totalDownloads = catalogs.reduce((s, c) => s + (c.download_count ?? 0), 0);
    const cutoff = nowTs - 30 * 864e5;
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
  }, [catalogs, t, nowTs]);

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
    // Server DELETE removes the supplier-mirror entry too (two-way sync), so no
    // client-side removeCatalogFromContact here — that double-removed and raced.
    await Promise.all(targets.map((c) => deleteCatalog(c.id)));
    setBulkDeleting(false);
    clearSelection();
    loadAll();
  };

  const handleDelete = async () => {
    if (!deleteModal.catalog) return;
    setDeleting(true);
    const cat = deleteModal.catalog;
    await deleteCatalog(cat.id); // server also removes the supplier mirror
    setDeleting(false);
    setDeleteModal({ open: false, catalog: null });
    // Drop the deleted id from any active selection so the bulk bar isn't stale.
    setSelected(prev => { if (!prev.has(cat.id)) return prev; const n = new Set(prev); n.delete(cat.id); return n; });
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
          <div {...kxInspectAttrs({ component: "CatalogInsightsPanel", module: "Catalogs", section: "Insights" })} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
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
        <div {...kxInspectAttrs({ component: "CatalogFiltersBar", module: "Catalogs", section: "Filters" })} className="flex flex-wrap items-center gap-3 mb-6">
          <div ref={searchBoxRef} {...kxInspectAttrs({ component: "CatalogSearchBar", module: "Catalogs", section: "Search" })} className="relative flex-1 min-w-[200px] max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)] z-10" />
            <input type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setSugIndex(-1); setSearchFocused(true); }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSearchFocused(true); setSugIndex(i => Math.min(i + 1, searchSuggestions.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setSugIndex(i => Math.max(i - 1, -1)); }
                else if (e.key === "Enter") { if (sugIndex >= 0 && searchSuggestions[sugIndex]) { searchSuggestions[sugIndex].apply(); setSearchFocused(false); setSugIndex(-1); } else setSearchFocused(false); }
                else if (e.key === "Escape") { setSearchFocused(false); setSugIndex(-1); }
              }}
              placeholder={t("cat.search")} role="combobox" aria-expanded={searchFocused} aria-autocomplete="list"
              className="w-full h-9 pl-9 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 transition-colors" />
            {search && (
              <button onClick={() => { setSearch(""); setSugIndex(-1); }} aria-label="Clear"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <CrossIcon className="h-3 w-3" />
              </button>
            )}

            {/* Autocomplete dropdown */}
            {searchFocused && (search.trim() ? true : searchKeywords.length > 0) && (
              <div className="absolute z-40 left-0 right-0 top-full mt-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-xl shadow-black/40 py-1.5 max-h-[320px] overflow-auto">
                {search.trim() ? (
                  searchSuggestions.length === 0 ? (
                    <p className="px-3 py-3 text-[12px] text-[var(--text-dim)] text-center">{t("cat.sug.none")}</p>
                  ) : searchSuggestions.map((s, i) => (
                    <button key={`${s.type}-${s.label}`} type="button"
                      onMouseEnter={() => setSugIndex(i)}
                      onClick={() => { s.apply(); setSearchFocused(false); setSugIndex(-1); }}
                      className={`w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors ${i === sugIndex ? "bg-[var(--bg-surface-hover)]" : "hover:bg-[var(--bg-surface-hover)]"}`}>
                      <span className="shrink-0 w-4 h-4 flex items-center justify-center text-[var(--text-dim)]">{s.icon || <SearchIcon className="h-3.5 w-3.5" />}</span>
                      <span className="flex-1 truncate text-[12px] text-[var(--text-primary)]">{s.label}</span>
                      {s.count > 0 && <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-dim)]">{s.count}</span>}
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-dim)] px-1.5 py-0.5 rounded bg-[var(--bg-surface)]">{t(`cat.sug.${s.type}`)}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-2">{t("cat.sug.keywords")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {searchKeywords.map(s => (
                        <button key={`${s.type}-${s.label}`} type="button"
                          onClick={() => { s.apply(); setSearchFocused(false); }}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-dim)] transition-colors">
                          {s.icon && <span className="w-3.5 h-3.5 flex items-center justify-center text-[var(--text-dim)]">{s.icon}</span>}
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {catalogSuppliers.length > 0 && (
            <div className="relative">
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
                className="h-9 min-w-0 max-w-[calc(100vw-2rem)] pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
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

          {/* Group by supplier toggle (Option A) */}
          <button
            onClick={() => setGroupBySupplier((v) => !v)}
            title={t("cat.groupBySupplier", "Group by supplier")}
            className={`h-9 px-3 rounded-lg border text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors ${groupBySupplier ? "border-transparent bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
          >
            <Building2Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("cat.groupBySupplier", "Group by supplier")}</span>
          </button>

          <button onClick={() => setShowSupplierImport(true)}
            title={t("cat.importSupplier", "Read a PDF catalog → auto-create the supplier")}
            className="h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 ml-auto">
            <ScanLineIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("cat.importSupplierShort", "Import supplier")}</span>
          </button>
          <button onClick={() => setUploadModal({ open: true, editEntry: null })}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors shrink-0">
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
        {catalogsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {Array.from({ length: 10 }).map((_, i) => <CatalogSkeleton key={i} />)}
          </div>
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
        ) : (groupBySupplier && viewMode === "grid") ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {(() => {
              const items = filtered.slice(0, visibleCount);
              const groups: { key: string; name: string; nameCn: string | null; logo: string | null; contactId: string | null; items: CatalogEntry[] }[] = [];
              const idx = new Map<string, number>();
              for (const c of items) {
                const key = c.contact_id || c.company_name_en || c.contact_name || "__none";
                const name = c.company_name_en || c.contact_name || t("cat.noSupplier", "No supplier");
                let i = idx.get(key);
                if (i === undefined) { i = groups.length; idx.set(key, i); groups.push({ key, name, nameCn: c.company_name_cn ?? null, logo: c.contact_photo_url ?? null, contactId: c.contact_id ?? null, items: [] }); }
                groups[i].items.push(c);
              }
              return groups.map((g) => {
                // Single catalog → normal card. Multiple → a same-height group
                // spanning two columns, each catalog shown as a normal card with
                // the supplier in its usual position (under the Chinese name).
                if (g.items.length === 1) {
                  const catalog = g.items[0];
                  return (
                    <CatalogCard key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                      selected={selected.has(catalog.id)} onToggleSelect={() => toggleSelect(catalog.id)}
                      onPreview={() => handlePreview(catalog)}
                      onDownload={() => bumpMetric(catalog.id, "download")}
                      onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                      onDelete={() => setDeleteModal({ open: true, catalog })} />
                  );
                }
                return (
                  <MergedSupplierCard key={g.key} group={g} maxCols={gridMaxCols} divLogos={divLogos} catLogos={catLogos}
                    selected={selected} onToggleSelect={toggleSelect}
                    onPreview={(c) => handlePreview(c)}
                    onDownload={(c) => bumpMetric(c.id, "download")}
                    onEdit={(c) => setUploadModal({ open: true, editEntry: c })}
                    onDelete={(c) => setDeleteModal({ open: true, catalog: c })} />
                );
              });
            })()}
          </div>
        ) : (groupBySupplier && viewMode === "list") ? (
          <div className="flex flex-col gap-2">
            {(() => {
              const items = filtered.slice(0, visibleCount);
              const groups: { key: string; name: string; nameCn: string | null; logo: string | null; contactId: string | null; items: CatalogEntry[] }[] = [];
              const idx = new Map<string, number>();
              for (const c of items) {
                const key = c.contact_id || c.company_name_en || c.contact_name || "__none";
                const name = c.company_name_en || c.contact_name || t("cat.noSupplier", "No supplier");
                let i = idx.get(key);
                if (i === undefined) { i = groups.length; idx.set(key, i); groups.push({ key, name, nameCn: c.company_name_cn ?? null, logo: c.contact_photo_url ?? null, contactId: c.contact_id ?? null, items: [] }); }
                groups[i].items.push(c);
              }
              return groups.map((g) => {
                if (g.items.length === 1) {
                  const catalog = g.items[0];
                  return (
                    <CatalogRow key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                      selected={selected.has(catalog.id)} onToggleSelect={() => toggleSelect(catalog.id)}
                      onPreview={() => handlePreview(catalog)}
                      onDownload={() => bumpMetric(catalog.id, "download")}
                      onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                      onDelete={() => setDeleteModal({ open: true, catalog })} />
                  );
                }
                return (
                  <div key={g.key} className="flex flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                    {g.items.map(c => (
                      <CatalogRow key={c.id} catalog={c} divLogos={divLogos} catLogos={catLogos} hideSupplier
                        selected={selected.has(c.id)} onToggleSelect={() => toggleSelect(c.id)}
                        onPreview={() => handlePreview(c)}
                        onDownload={() => bumpMetric(c.id, "download")}
                        onEdit={() => setUploadModal({ open: true, editEntry: c })}
                        onDelete={() => setDeleteModal({ open: true, catalog: c })} />
                    ))}
                    {g.contactId ? (
                      <Link href={`/suppliers/${g.contactId}`} className="group/sup flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 hover:bg-[var(--bg-surface-hover)] transition-colors">
                        {g.logo
                          ? <img src={g.logo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                          : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"><Building2Icon className="h-4 w-4 text-[var(--text-dim)]" /></span>}
                        <div className="flex min-w-0 flex-col">
                          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate group-hover/sup:underline">{g.name}</p>
                          <p className="text-[10.5px] text-[var(--text-dim)] truncate">{g.nameCn ? `${g.nameCn} · ` : ""}{g.items.length} {t("cat.catalogsWord", "catalogs")}</p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]"><Building2Icon className="h-4 w-4 text-[var(--text-dim)]" /></span>
                        <div className="flex min-w-0 flex-col">
                          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{g.name}</p>
                          <p className="text-[10.5px] text-[var(--text-dim)] truncate">{g.items.length} {t("cat.catalogsWord", "catalogs")}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
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

        {/* Infinite scroll — auto-loads the next batch as the sentinel nears view */}
        {!catalogsLoading && filtered.length > visibleCount && (
          <div ref={loadMoreRef} className="mt-6 flex items-center justify-center gap-2 py-2 text-[12px] text-[var(--text-dim)]">
            <SpinnerIcon className="h-4 w-4 animate-spin" />
            {t("cat.loading", "Loading…")}
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

      {/* Auto-import a supplier from a PDF catalog (also files the catalog here). */}
      <ImportSupplierFromCatalog
        open={showSupplierImport}
        onClose={() => setShowSupplierImport(false)}
        onCreated={() => {
          setShowSupplierImport(false);
          void loadAll();
        }}
      />
    </div>
  );
}
