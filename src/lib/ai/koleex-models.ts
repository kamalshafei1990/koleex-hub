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

export {
  KOLEEX_MODELS,
  KOLEEX_SERVING_MODELS,
  DEFAULT_KOLEEX_MODEL,
  normalizeKoleexModel,
  normalizeServingModel,
  type KoleexModelId,
  type KoleexServingModel,
} from "./koleex-model-ids";
import type { KoleexModelId } from "./koleex-model-ids";

type Copy = { en: string; zh: string; ar: string };

export interface KoleexModelInfo {
  id: KoleexModelId;
  /** Brand names are not translated; "Auto" is, because it is a word. */
  name: Copy;
  /** What the picker's button says — the name without "Koleex", which the
   *  whole screen already says. */
  short: Copy;
  /** One line under the name: what it is good at. */
  blurb: Copy;
  /** Can it hold a voice call? A text-only model hands a call to Auto. */
  voice: boolean;
}

export const KOLEEX_MODEL_INFO: Readonly<Record<KoleexModelId, KoleexModelInfo>> = {
  auto: {
    id: "auto",
    name: { en: "Auto", zh: "自动", ar: "تلقائي" },
    short: { en: "Auto", zh: "自动", ar: "تلقائي" },
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
    short: { en: "Blink", zh: "Blink", ar: "Blink" },
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
    short: { en: "Mind", zh: "Mind", ar: "Mind" },
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
    short: { en: "Deep", zh: "Deep", ar: "Deep" },
    blurb: {
      en: "Deep thinking: analysis and long files",
      zh: "深度思考：分析与长文件",
      ar: "تفكير عميق: تحليل وملفات طويلة",
    },
    voice: true,
  },
};
