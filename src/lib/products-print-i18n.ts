/* products-print-i18n — the words on the printed product sheet, in the three
 * languages the brochure is printed in (owner: "print multi-page in 3
 * languages"). Server-only reader (the print route renders on the server
 * from ?lang=), so none of this reaches a browser bundle. Kept apart from
 * the page's dictionary for that reason: the screen never needs "Page 1 of
 * 4", and the sheet never needs "Ask AI".
 */
import type { Translations } from "@/lib/i18n";

export const PRODUCTS_PRINT_I18N: Translations = {
  "print.productSheet": { en: "Product Sheet", zh: "产品资料", ar: "بطاقة المنتج" },
  "print.model": { en: "Model", zh: "型号", ar: "الموديل" },
  "print.classification": { en: "Classification", zh: "分类", ar: "التصنيف" },
  "print.highlights": { en: "Highlights", zh: "亮点", ar: "أبرز المزايا" },
  "print.specifications": { en: "Technical Specifications", zh: "技术参数", ar: "المواصفات الفنية" },
  "print.family": { en: "Models in this family", zh: "本系列型号", ar: "موديلات هذه العائلة" },
  "print.packing": { en: "Packing & Logistics", zh: "包装与物流", ar: "التعبئة واللوجستيات" },
  "print.compliance": { en: "Compliance", zh: "合规", ar: "الامتثال" },
  "print.knowledge": { en: "Product Knowledge", zh: "产品知识", ar: "معلومات المنتج" },
  "print.options": { en: "Options", zh: "选项", ar: "الخيارات" },
  "print.standard": { en: "Standard", zh: "标准配置", ar: "قياسي" },
  "print.required": { en: "Required", zh: "必选", ar: "إلزامي" },
  "print.page": { en: "Page", zh: "第", ar: "صفحة" },
  "print.of": { en: "of", zh: "页，共", ar: "من" },
  "print.pageSuffix": { en: "", zh: "页", ar: "" },
  "print.yes": { en: "Yes", zh: "是", ar: "نعم" },
  "print.no": { en: "No", zh: "否", ar: "لا" },
  "print.warranty": { en: "Warranty", zh: "保修", ar: "الضمان" },
  "print.origin": { en: "Country of origin", zh: "原产国", ar: "بلد المنشأ" },
  "print.hsCode": { en: "HS code", zh: "海关编码", ar: "الرمز الجمركي HS" },
  "print.ipRating": { en: "IP rating", zh: "防护等级", ar: "درجة الحماية IP" },
  "print.months": { en: "months", zh: "个月", ar: "شهر" },
  "print.packingType": { en: "Packing", zh: "包装方式", ar: "التعبئة" },
  "print.woodTreatment": { en: "Wood treatment", zh: "木材处理", ar: "معالجة الخشب" },
  "print.netWeight": { en: "Net weight", zh: "净重", ar: "الوزن الصافي" },
  "print.grossWeight": { en: "Gross weight", zh: "毛重", ar: "الوزن الإجمالي" },
  "print.cbm": { en: "Volume", zh: "体积", ar: "الحجم" },
  "print.stackable": { en: "Stackable", zh: "可堆叠", ar: "قابل للتكديس" },
  "print.portOfLoading": { en: "Port of loading", zh: "装货港", ar: "ميناء الشحن" },
  "print.container": { en: "Units per container", zh: "每柜装载量", ar: "وحدات لكل حاوية" },
  "print.package": { en: "Package", zh: "包装件", ar: "الطرد" },
  "print.qty": { en: "Qty", zh: "数量", ar: "الكمية" },
  "print.dimensions": { en: "L × W × H (cm)", zh: "长 × 宽 × 高 (cm)", ar: "الطول × العرض × الارتفاع (سم)" },
  "print.dangerousGoods": { en: "Dangerous goods", zh: "危险品", ar: "بضائع خطرة" },
  "print.primary": { en: "Primary", zh: "主型号", ar: "أساسي" },
  "print.printedOn": { en: "Printed", zh: "打印日期", ar: "تاريخ الطباعة" },
  "print.priceNote": { en: "Prices on request — please contact us for a quotation.", zh: "价格面议，请联系我们获取报价。", ar: "الأسعار عند الطلب — تواصل معنا للحصول على عرض سعر." },
  /* knowledge block headings, by type */
  "print.kb.overview": { en: "Overview", zh: "概述", ar: "نظرة عامة" },
  "print.kb.key_features": { en: "Key features", zh: "主要特点", ar: "الميزات الرئيسية" },
  "print.kb.applications": { en: "Applications", zh: "应用", ar: "الاستخدامات" },
  "print.kb.suitable_materials": { en: "Suitable materials", zh: "适用面料", ar: "الخامات المناسبة" },
  "print.kb.selling_points": { en: "Why it wins", zh: "核心优势", ar: "لماذا يتفوّق" },
  "print.kb.technical_advantages": { en: "Technical advantages", zh: "技术优势", ar: "المزايا الفنية" },
  "print.kb.operation_notes": { en: "Operation notes", zh: "操作说明", ar: "ملاحظات التشغيل" },
  "print.kb.maintenance_notes": { en: "Maintenance", zh: "维护保养", ar: "الصيانة" },
  "print.kb.buyer_questions": { en: "Buyer questions", zh: "买家常见问题", ar: "أسئلة المشتري" },
  "print.kb.recommended_use_cases": { en: "Recommended use", zh: "推荐用途", ar: "الاستخدام الموصى به" },
  "print.kb.limitations": { en: "Limitations", zh: "局限", ar: "القيود" },
  "print.kb.warnings": { en: "Warnings & safety", zh: "警告与安全", ar: "التحذيرات والسلامة" },
  "print.kb.package_contents": { en: "What's included", zh: "包装内容", ar: "محتويات العبوة" },
  "print.kb.warranty_notes": { en: "Warranty notes", zh: "保修说明", ar: "ملاحظات الضمان" },
};
