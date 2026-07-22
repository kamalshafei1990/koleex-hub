import type { Translations } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Shared en/zh/ar labels for the Visual Library's fixed vocabularies
   (ASSET_TYPES + RELATIONSHIP_TYPES from src/lib/visual-library/types.ts).
   Spread into a component's local dict:  const T = { ...VL_LABELS_T, ... }
   and resolve with  t(`vl.type.${value}`, prettyFallback).
   --------------------------------------------------------------------------- */

export const VL_LABELS_T: Translations = {
  /* Asset types */
  "vl.type.icon":              { en: "icon",              zh: "图标",     ar: "أيقونة" },
  "vl.type.illustration":      { en: "illustration",      zh: "插画",     ar: "رسم توضيحي" },
  "vl.type.photo":             { en: "photo",             zh: "照片",     ar: "صورة" },
  "vl.type.diagram":           { en: "diagram",           zh: "示意图",   ar: "مخطط" },
  "vl.type.badge":             { en: "badge",             zh: "徽章",     ar: "شارة" },
  "vl.type.logo":              { en: "logo",              zh: "标志",     ar: "شعار" },
  "vl.type.pattern":           { en: "pattern",           zh: "图案",     ar: "نمط" },
  "vl.type.ui_element":        { en: "ui element",        zh: "界面元素", ar: "عنصر واجهة" },
  "vl.type.feature_graphic":   { en: "feature graphic",   zh: "功能图形", ar: "رسم الميزات" },
  "vl.type.technical_visual":  { en: "technical visual",  zh: "技术图",   ar: "صورة تقنية" },

  /* Relationship types */
  "vl.relType.similar_to":            { en: "Similar to",          zh: "相似于",     ar: "مشابه لـ" },
  "vl.relType.alternative_of":        { en: "Alternative of",      zh: "可替代",     ar: "بديل عن" },
  "vl.relType.parent_of":             { en: "Parent of",           zh: "父级",       ar: "أصل لـ" },
  "vl.relType.child_of":              { en: "Child of",            zh: "子级",       ar: "فرع من" },
  "vl.relType.used_with":             { en: "Used with",           zh: "搭配使用",   ar: "يُستخدم مع" },
  "vl.relType.opposite_of":           { en: "Opposite of",         zh: "相反于",     ar: "عكس" },
  "vl.relType.represents":            { en: "Represents",          zh: "代表",       ar: "يمثّل" },
  "vl.relType.recommended_for":       { en: "Recommended for",     zh: "推荐用于",   ar: "موصى به لـ" },
  "vl.relType.not_recommended_for":   { en: "Not recommended for", zh: "不推荐用于", ar: "غير موصى به لـ" },
  "vl.relType.variation_of":          { en: "Variation of",        zh: "变体",       ar: "تنويع من" },
  "vl.relType.belongs_to_collection": { en: "In collection",       zh: "属于合集",   ar: "ضمن مجموعة" },
  "vl.relType.semantic_match":        { en: "Semantic match",      zh: "语义匹配",   ar: "تطابق دلالي" },
  "vl.relType.visual_match":          { en: "Visual match",        zh: "视觉匹配",   ar: "تطابق بصري" },
  "vl.relType.style_match":           { en: "Style match",         zh: "风格匹配",   ar: "تطابق أسلوبي" },
};
