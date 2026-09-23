/* ---------------------------------------------------------------------------
   Koleex AI models — what the user chooses between.

   Owner, 2026-09-23: the Hub buys from three providers; make them three
   Koleex AI models, each good at something, that the user switches between
   like the pickers in the big chat apps — with Koleex names, never a
   vendor's. Names chosen by the owner from a long list: Blink, Mind, Deep.

     auto   Koleex picks per question — THE DEFAULT for everyone
     blink  fast answers, translation, Chinese         (voice: yes)
     mind   everyday work: products, prices, quotes    (voice: no — text only)
     deep   deep thinking: analysis, long files        (voice: yes)

   SHARED, NOT SERVER-ONLY, AND NOTHING SECRET. The picker renders this; the
   server validates against it. Which provider stands behind a name lives
   only on the server (lib/server/ai/provider/koleex-model-slots.ts), so
   swapping a vendor never touches a name the user sees — and no vendor name
   is ever in this file, the bundle, or a response.

   The client ASKS for a model; it never decides. The server normalises the
   request, applies any model an operator has switched off, and answers with
   the model that actually served — which, after a failover, can differ.
   --------------------------------------------------------------------------- */

export type KoleexModelId = "auto" | "blink" | "mind" | "deep";
/** A model that can actually answer a turn — "auto" is a choice, not one. */
export type KoleexServingModel = Exclude<KoleexModelId, "auto">;

/** Picker order: Auto first, then fastest to deepest. */
export const KOLEEX_MODELS: readonly KoleexModelId[] = ["auto", "blink", "mind", "deep"] as const;
export const KOLEEX_SERVING_MODELS: readonly KoleexServingModel[] = ["blink", "mind", "deep"] as const;
export const DEFAULT_KOLEEX_MODEL: KoleexModelId = "auto";

type Copy = { en: string; zh: string; ar: string };

export interface KoleexModelInfo {
  id: KoleexModelId;
  /** Brand names are not translated; "Auto" is, because it is a word. */
  name: Copy;
  /** One line under the name: what it is good at. */
  blurb: Copy;
  /** Can it hold a voice call? A text-only model hands a call to Auto. */
  voice: boolean;
}

export const KOLEEX_MODEL_INFO: Readonly<Record<KoleexModelId, KoleexModelInfo>> = {
  auto: {
    id: "auto",
    name: { en: "Auto", zh: "自动", ar: "تلقائي" },
    blurb: {
      en: "Picks the best model for each question",
      zh: "为每个问题自动选择最合适的模型",
      ar: "بيختار الأنسب لكل سؤال",
    },
    voice: true,
  },
  blink: {
    id: "blink",
    name: { en: "Koleex Blink", zh: "Koleex Blink", ar: "Koleex Blink" },
    blurb: {
      en: "Fast answers, translation and Chinese",
      zh: "快速回答、翻译与中文",
      ar: "ردود سريعة وترجمة وصيني",
    },
    voice: true,
  },
  mind: {
    id: "mind",
    name: { en: "Koleex Mind", zh: "Koleex Mind", ar: "Koleex Mind" },
    blurb: {
      en: "Everyday work: products, prices and quotations",
      zh: "日常工作：产品、价格与报价",
      ar: "الشغل اليومي: المنتجات والأسعار والعروض",
    },
    voice: false,
  },
  deep: {
    id: "deep",
    name: { en: "Koleex Deep", zh: "Koleex Deep", ar: "Koleex Deep" },
    blurb: {
      en: "Deep thinking: analysis and long files",
      zh: "深度思考：分析与长文件",
      ar: "تفكير عميق: تحليل وملفات طويلة",
    },
    voice: true,
  },
};

/** Anything that is not a known model is Auto — an old client, a typo, or a
 *  hand-made request can never select something that does not exist. Pure. */
export function normalizeKoleexModel(v: unknown): KoleexModelId {
  return typeof v === "string" && (KOLEEX_MODELS as readonly string[]).includes(v)
    ? (v as KoleexModelId)
    : DEFAULT_KOLEEX_MODEL;
}

/** Same rule for a model that served a turn: only the three, else null. */
export function normalizeServingModel(v: unknown): KoleexServingModel | null {
  return typeof v === "string" && (KOLEEX_SERVING_MODELS as readonly string[]).includes(v)
    ? (v as KoleexServingModel)
    : null;
}
