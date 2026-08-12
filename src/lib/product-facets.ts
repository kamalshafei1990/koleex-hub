/* ---------------------------------------------------------------------------
   Product facet registry — the SECOND AXIS of the CL-0020 taxonomy.
   ---------------------------------------------------------------------------

   Product Type answers "what stitch does its mechanism form?" and carries the
   code prefix. THIS file answers "how is it built / configured?" — and it is
   the only place those answers are allowed to be spelled.

   WHY IT EXISTS. Before CL-0020, bed type / feed type / needle count / duty
   lived in three places at once: as subcategories, as Machine Kinds, and as
   coding axes. One concept, three homes, and no two of them agreed on the
   spelling. Deleting the type-masquerading subcategories moved that vocabulary
   onto `MachineKind.attributes` — which was a free-form Record<string,string>,
   i.e. a fourth home with no spelling at all.

   The governed vocabulary already existed and was already right:
   `docs/product-data-v2/reference-data/facet-dictionary-master.md`. The audit's
   OUTPUT 9 item 7 says exactly this — *"align to the dictionary that's already
   right"*. So this file MIRRORS that document rather than inventing anything:
   every key and every value below is quoted from it. Six were not, and were
   carried as `▲ proposed` with a reason until CL-0022 confirmed them into a
   new dictionary §9 — the flag is how you tell "governed" from "my idea".

   THE RULE: a facet key that is not in this registry, or a value that is not in
   its `values` list, is a typo — `validate:budgets` section H fails the build
   on either. That is the whole point: `bed` and `bed_type`, or `heavy` and
   `Heavy`, must never both be reachable.
   --------------------------------------------------------------------------- */

import type { Translations } from "@/lib/i18n";

export type FacetType = "single_select" | "multi_select" | "number" | "boolean" | "measurement";

export interface FacetDefinition {
  /** Governed key. Must match facet-dictionary-master.md verbatim. */
  key: string;
  type: FacetType;
  /** Allowed values for select types. Omitted for number/measurement. */
  values?: string[];
  unit?: string;
  /** Which dictionary section this came from — so a reader can go check. */
  source: string;
  /** ▲ = not yet in the master dictionary; needs a CL entry to be confirmed.
   *  Nothing carries it today — CL-0022 confirmed the last six. Kept because
   *  the next facet will be proposed before it is governed, and marking that
   *  state is what stopped these six from being mistaken for governed. */
  proposed?: boolean;
  note?: string;
}

/* ── The facets the sewing family actually uses today ────────────────────────
   Scoped deliberately: this is not the whole 100-facet dictionary, it is the
   subset that `MachineKind.attributes` is allowed to speak. It grows when a
   kind genuinely needs a new axis — never by guessing ahead. */
export const FACETS: Record<string, FacetDefinition> = {
  /* §2 Machine facets */
  bed_type: {
    key: "bed_type", type: "single_select", source: "§2 Machine facets",
    values: ["flat", "cylinder", "post", "feed-off-arm", "long-arm"],
    note: "Long-arm is a BED value, not a separate 'arm' facet — the dictionary lists it here.",
  },
  needle_count: {
    key: "needle_count", type: "number", source: "§2 Machine facets",
    values: ["1", "2", "3", "4", "multi"],
    note: "The dictionary writes '1 · 2 · multi'; 3 and 4 are printed on real chainstitch heads, so they are spelled out rather than collapsed into 'multi'.",
  },
  feed_type: {
    key: "feed_type", type: "single_select", source: "§2 Machine facets",
    values: ["drop", "needle", "compound-unison", "differential", "puller", "top-and-bottom", "walking-foot"],
    note: "'walking-foot' is the shop-floor name for compound/unison feed; both spellings are kept because catalogues print both.",
  },
  drive_type: {
    key: "drive_type", type: "single_select", source: "§2 Machine facets",
    values: ["clutch", "servo", "direct-drive"],
  },
  stations: {
    key: "stations", type: "number", source: "§2 Machine facets",
  },

  /* §1 Universal facets */
  automation_level: {
    key: "automation_level", type: "single_select", source: "§1 Universal facets",
    values: ["manual", "semi-automatic", "automatic", "programmable"],
  },
  working_field: {
    key: "working_field", type: "measurement", unit: "mm × mm", source: "§1 Universal facets",
  },

  /* §8 Lockstitch v1.1 promoted facets (reusable across the sewing family) */
  fabric_weight_class: {
    key: "fabric_weight_class", type: "single_select", source: "§8d · CL-0005",
    values: ["light", "medium", "heavy", "extra-heavy"],
    note: "THIS is the governed home for 'duty'. The retired XSH subcategory said the same thing as a shelf; it is a value here.",
  },
  template_recognition: {
    key: "template_recognition", type: "single_select", source: "§8c · CL-0005",
    values: ["rfid", "none"],
  },

  /* §7 Application facets */
  application: {
    key: "application", type: "multi_select", source: "§7 Application facets",
    note: "Open vocabulary — governed by application-dictionary-master.md, not by a closed list here.",
  },

  /* ── ✅ CONFIRMED by CL-0022 (2026-08-12). Each was checked against the whole
     dictionary before sign-off: none duplicates an existing facet, and each is
     used by at least one real Machine Kind. Two names sit close to older
     facets and are deliberately NOT the same thing —
       `needle_bar_type` (fixed | split)  vs  §8a `needle_bar_stroke` (mm travel)
       `vision_guided` (a sewing head)    vs  §2 `inspection_method: Vision/AI`
     Confusing either pair would put a value in the wrong column. */
  working_field_class: {
    key: "working_field_class", type: "single_select", source: "§9 · confirmed CL-0022",
    values: ["small", "medium", "large", "xxl"],
    note: "`working_field` is a numeric mm × mm pair. A KIND is a preset, not a model, so it carries the size BAND the catalogue advertises ('Small-Area Pattern Sewer'). The number stays on the product.",
  },
  needle_bar_type: {
    key: "needle_bar_type", type: "single_select", source: "§9 · confirmed CL-0022",
    values: ["fixed", "split"],
    note: "Split-bar lets one needle disengage to turn corners. A real, printed, buying-relevant split on twin-needle machines.",
  },
  buttonhole_type: {
    key: "buttonhole_type", type: "single_select", source: "§9 · confirmed CL-0022",
    values: ["straight", "eyelet-keyhole"],
    note: "Straight (shirt) vs eyelet/keyhole (jacket, denim) are different machines commercially, same stitch class.",
  },
  welt_count: {
    key: "welt_count", type: "single_select", source: "§9 · confirmed CL-0022",
    values: ["single", "double"],
  },
  flap_handling: {
    key: "flap_handling", type: "boolean", source: "§9 · confirmed CL-0022",
    values: ["true", "false"],
  },
  vision_guided: {
    key: "vision_guided", type: "boolean", source: "§9 · confirmed CL-0022",
    values: ["true", "false"],
    note: "The audit's OUTPUT 8 names vision-guidance explicitly as an ATTRIBUTE, so that it never becomes a 'Vision-X' type under every stitch class.",
  },
};

/** Every facet key, for validators and pickers. */
export const FACET_KEYS = Object.keys(FACETS);

/** Is this key/value pair sayable? Used by validate:budgets section H. */
export function isValidFacet(key: string, value: string): boolean {
  const f = FACETS[key];
  if (!f) return false;
  if (!f.values) return true; // open vocabulary (application) or free numeric
  return f.values.includes(value);
}

/* Display labels. Facet keys and values are English-canonical in the data — the
   same contract the product schemas follow — and localised only for display. */
export const FACET_I18N: Translations = {
  "fk:bed_type": { en: "Bed Type", zh: "机床形式", ar: "نوع القاعدة" },
  "fk:needle_count": { en: "Needles", zh: "针数", ar: "عدد الإبر" },
  "fk:feed_type": { en: "Feed Type", zh: "送料方式", ar: "نوع التغذية" },
  "fk:drive_type": { en: "Drive", zh: "驱动方式", ar: "نظام الدفع" },
  "fk:stations": { en: "Stations", zh: "工位数", ar: "عدد المحطات" },
  "fk:automation_level": { en: "Automation Level", zh: "自动化程度", ar: "مستوى الأتمتة" },
  "fk:working_field": { en: "Working Field", zh: "加工范围", ar: "مساحة العمل" },
  "fk:working_field_class": { en: "Working Field Size", zh: "加工范围级别", ar: "فئة مساحة العمل" },
  "fk:fabric_weight_class": { en: "Duty / Fabric Weight", zh: "适用面料厚度", ar: "فئة التحمّل / وزن القماش" },
  "fk:template_recognition": { en: "Template Recognition", zh: "模板识别", ar: "التعرّف على القالب" },
  "fk:application": { en: "Application", zh: "应用", ar: "الاستخدام" },
  "fk:needle_bar_type": { en: "Needle Bar", zh: "针杆形式", ar: "نوع حامل الإبرة" },
  "fk:buttonhole_type": { en: "Buttonhole Type", zh: "锁眼类型", ar: "نوع العروة" },
  "fk:welt_count": { en: "Welts", zh: "嵌线数", ar: "عدد الحواف" },
  "fk:flap_handling": { en: "Flap Handling", zh: "袋盖处理", ar: "معالجة اللسان" },
  "fk:vision_guided": { en: "Vision Guided", zh: "视觉引导", ar: "موجَّه بالرؤية" },

  "fv:flat": { en: "Flat Bed", zh: "平板", ar: "قاعدة مسطّحة" },
  "fv:cylinder": { en: "Cylinder Bed", zh: "筒式", ar: "قاعدة أسطوانية" },
  "fv:post": { en: "Post Bed", zh: "柱式", ar: "قاعدة عمودية" },
  "fv:feed-off-arm": { en: "Feed-off-the-Arm", zh: "缝袖筒", ar: "تغذية من الذراع" },
  "fv:long-arm": { en: "Long Arm", zh: "长臂", ar: "ذراع طويل" },
  "fv:multi": { en: "Multi", zh: "多针", ar: "متعدد" },
  "fv:drop": { en: "Drop Feed", zh: "下送料", ar: "تغذية سفلية" },
  "fv:needle": { en: "Needle Feed", zh: "针送料", ar: "تغذية بالإبرة" },
  "fv:compound-unison": { en: "Compound (Unison) Feed", zh: "综合送料", ar: "تغذية مركّبة" },
  "fv:differential": { en: "Differential Feed", zh: "差动送料", ar: "تغذية تفاضلية" },
  "fv:puller": { en: "Puller Feed", zh: "拉布送料", ar: "تغذية بالسحب" },
  "fv:top-and-bottom": { en: "Top and Bottom Feed", zh: "上下送料", ar: "تغذية علوية وسفلية" },
  "fv:walking-foot": { en: "Walking Foot", zh: "行走压脚", ar: "قدم ماشية" },
  "fv:clutch": { en: "Clutch Motor", zh: "离合电机", ar: "موتور كلتش" },
  "fv:servo": { en: "Servo Motor", zh: "伺服电机", ar: "موتور سيرفو" },
  "fv:direct-drive": { en: "Direct Drive", zh: "直驱", ar: "دفع مباشر" },
  "fv:manual": { en: "Manual", zh: "手动", ar: "يدوي" },
  "fv:semi-automatic": { en: "Semi-Automatic", zh: "半自动", ar: "نصف تلقائي" },
  "fv:automatic": { en: "Automatic", zh: "全自动", ar: "تلقائي" },
  "fv:programmable": { en: "Programmable", zh: "可编程", ar: "قابل للبرمجة" },
  "fv:light": { en: "Light", zh: "薄料", ar: "خفيف" },
  "fv:medium": { en: "Medium", zh: "中厚料", ar: "متوسط" },
  "fv:heavy": { en: "Heavy", zh: "厚料", ar: "ثقيل" },
  "fv:extra-heavy": { en: "Extra Heavy", zh: "特厚料", ar: "ثقيل جدًا" },
  "fv:rfid": { en: "RFID", zh: "RFID", ar: "RFID" },
  "fv:none": { en: "None", zh: "无", ar: "لا يوجد" },
  "fv:small": { en: "Small", zh: "小型", ar: "صغير" },
  "fv:large": { en: "Large", zh: "大型", ar: "كبير" },
  "fv:xxl": { en: "XXL", zh: "超大", ar: "كبير جدًا" },
  "fv:fixed": { en: "Fixed Bar", zh: "固定针杆", ar: "حامل ثابت" },
  "fv:split": { en: "Split Bar", zh: "分离针杆", ar: "حامل منفصل" },
  "fv:straight": { en: "Straight (Shirt)", zh: "平头（衬衫）", ar: "مستقيمة (قميص)" },
  "fv:eyelet-keyhole": { en: "Eyelet / Keyhole", zh: "圆头（凤眼）", ar: "عين / ثقب المفتاح" },
  "fv:single": { en: "Single", zh: "单", ar: "مفرد" },
  "fv:double": { en: "Double", zh: "双", ar: "مزدوج" },
  "fv:true": { en: "Yes", zh: "有", ar: "نعم" },
  "fv:false": { en: "No", zh: "无", ar: "لا" },
  "fv:1": { en: "1", zh: "1", ar: "1" },
  "fv:2": { en: "2", zh: "2", ar: "2" },
  "fv:3": { en: "3", zh: "3", ar: "3" },
  "fv:4": { en: "4", zh: "4", ar: "4" },
};
