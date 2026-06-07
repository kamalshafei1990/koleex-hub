// Preorder sample data — transcribed faithfully from the customer's
// "PREORDER COLEEX.xlsx" (KOLEEX ORDER). One customer, four sub-buyers, grouped
// into category sections. `q` = quantities in buyer order [Hazem, Esmat, Allam,
// Bayoumy]. Photo + Price are filled in the system (price is what we quote).
// This is seed/preview data for the document design; persistence comes later.

export interface PreorderItem {
  model: string;
  desc: string;
  q: [number, number, number, number];
  photo?: string | null;
}
export interface PreorderSection {
  en: string;
  ar: string;
  items: PreorderItem[];
}

export const PREORDER_BUYERS = ["حازم", "الحاج عصمت", "عمر علام", "محمد البيومى"] as const;

export const PREORDER_META = {
  title: "KOLEEX ORDER",
  customerEn: "Koleex Egypt",
  customerAr: "كوليكس مصر",
  reference: "PREORDER COLEEX",
  currency: "USD",
};

export const PREORDER_SECTIONS: PreorderSection[] = [
  {
    en: "Cutting machines",
    ar: "ماكينات القص",
    items: [
      { model: "", desc: "مقص 12 بوصة مجلفن 1850 وات", q: [0, 0, 0, 10] },
      { model: "", desc: "مقص 15 بوصة مجلفن 1850 وات", q: [0, 0, 0, 5] },
      { model: "XC-P10", desc: "مقص 10 بوصة ديجيتال 1200 وات", q: [5, 2, 0, 5] },
      { model: 'XC-9988-6"', desc: "مقص 6 بوصة", q: [2, 0, 0, 0] },
      { model: 'XC-9988-8"', desc: "مقص 8 بوصة", q: [10, 0, 0, 5] },
      { model: 'XC-9988-10"', desc: "مقص 10 بوصة", q: [15, 10, 0, 20] },
      { model: 'XC-9988-12"', desc: "مقص 12 بوصة", q: [10, 2, 0, 20] },
      { model: 'XC-9988-15"', desc: "مقص 15 بوصة", q: [5, 0, 0, 5] },
      { model: "XC-3", desc: "", q: [0, 0, 5, 0] },
      { model: "XC-90", desc: "مقص دائرى", q: [5, 0, 0, 0] },
      { model: "XC-100", desc: "", q: [0, 0, 5, 0] },
      { model: "XC-110", desc: "مقص دائرى", q: [5, 0, 0, 25] },
      { model: "XC-70", desc: "مقص دائرى صغير", q: [10, 0, 0, 0] },
      { model: "XC-C2", desc: "مقص كهربائى يدوى", q: [25, 0, 0, 0] },
      { model: "XC-110B", desc: "مقص دائرى بالشاحن", q: [1, 0, 0, 20] },
      { model: "XC-933", desc: "مقص شريط اوتوماتيك", q: [10, 0, 1, 0] },
      { model: "XC-802A", desc: "مقص شريط صينى 2 سكينة", q: [5, 0, 0, 0] },
      { model: "XC-ATC-A2", desc: "مقص شريط واقف توب كامل", q: [1, 0, 0, 0] },
      { model: "XC-206", desc: "لاند كتر", q: [25, 15, 0, 50] },
      { model: "XC-205A", desc: "اند كتر اوتوماتيك", q: [2, 0, 0, 10] },
      { model: "XC-205B", desc: "اند كتر سيمى اوتوماتيك", q: [2, 0, 0, 0] },
    ],
  },
  {
    en: "Single needle machines",
    ar: "ماكينات الإبرة الواحدة",
    items: [
      { model: "XSL-L9", desc: "ماكينة خياطة اوتوماتيك قص فتلة موتور ستيبر حوض مفتوح", q: [50, 0, 50, 0] },
      { model: "XSL-L8", desc: "ماكينة خياطة اوتوماتيك قص فتلة موتور ستيبر حوض مفتوح", q: [25, 3, 0, 5] },
      { model: "XSL-L7", desc: "ماكينة خياطة موتور سيرفو", q: [15, 10, 10, 20] },
      { model: "", desc: "ماكينة خياطة موتور سيرفو قص فتلة", q: [10, 40, 10, 0] },
      { model: "XSL-0352E", desc: "ماكينة سحب مزدوج كومبيوتر كامل", q: [10, 0, 0, 0] },
      { model: "", desc: "ماكينة سحب مزدوج موتور سيرفو", q: [5, 5, 0, 0] },
    ],
  },
  {
    en: "Overlock machines",
    ar: "ماكينات الأوفر",
    items: [
      { model: "XSO-777A", desc: "اوفر 4 فتلة موديل سيروبا", q: [25, 0, 0, 0] },
      { model: "XSO-730S", desc: "اوفر 4 فتلة عمود LX", q: [25, 0, 0, 0] },
      { model: "XSO-H6D", desc: "اوفر 4 فتلة عمود LX", q: [25, 0, 0, 0] },
      { model: "XSO-988LC-4T", desc: "اوفر 4 فتلة LX", q: [20, 20, 20, 30] },
      { model: "XSO-988LC-5T", desc: "اوفر 5 فتلة LX", q: [10, 0, 0, 5] },
      { model: "XSO-988LC-4T", desc: "اوفر 4 فتلة قص فتلة موتور ستيبر", q: [25, 0, 20, 5] },
      { model: "XSO-888ST-4T-24UT", desc: "اوفر 4 فتلة سلندر قص فتلة", q: [2, 0, 0, 0] },
      { model: "KSO-988LC-4T-24BK", desc: "اوفر قرماتورة اوتوماتيك", q: [0, 0, 0, 2] },
      { model: "XSO-H8T-4H-24B", desc: "اوفر سحب مزدوج", q: [10, 0, 0, 0] },
      { model: "", desc: "اوفر موكيت", q: [0, 0, 0, 2] },
    ],
  },
  {
    en: "Flatlock machines",
    ar: "ماكينات الأورليه",
    items: [
      { model: "004 PRO", desc: "اورليه بلاطة قص فتلة", q: [5, 0, 0, 5] },
      { model: "004 LITE", desc: "اورليه بلاطة", q: [25, 0, 10, 5] },
      { model: "XSI-360S-35W", desc: "ماكينة اورليه تعريش قص فتلة", q: [5, 0, 0, 0] },
      { model: "XSI-360S-33WP", desc: "ماكينة بوكسر شورت", q: [5, 0, 0, 0] },
      { model: "XSL-360S-01WP", desc: "اورليه ببولر", q: [0, 0, 1, 0] },
    ],
  },
  {
    en: "Elastic machines",
    ar: "ماكينات الاستيك",
    items: [
      { model: "XSI-008-12064P", desc: "ماكينة استيك 12 ابرة", q: [25, 0, 0, 10] },
      { model: "XSI-008-12064P-UT", desc: "ماكينة استيك 12 ابرة قص فتلة", q: [5, 0, 1, 0] },
      { model: "XSI-008-13032P", desc: "ماكينة استيك 13 ابرة", q: [3, 0, 0, 0] },
      { model: "KSI-1412-VPQ", desc: "ماكينة سموكس 12 ابرة", q: [10, 0, 0, 0] },
    ],
  },
  {
    en: "Buttonhole & button machines",
    ar: "ماكينات العراوى والزراير",
    items: [
      { model: "XSS-781SSR", desc: "ماكينة عراوى رافع دواسة مع موتور ستيبر للسكينة", q: [5, 0, 1, 10] },
      { model: "XSS-9820", desc: "ماكينة عراوى بوجى", q: [1, 0, 1, 0] },
      { model: "XSS-1790B", desc: "ماكينة عراوى اوتوماتيك", q: [1, 0, 0, 0] },
      { model: "XSS-1790BF", desc: "ماكينة عراوى اوتوماتيك", q: [1, 0, 0, 0] },
      { model: "XSS-988R", desc: "ماكينة زراير تلقيم", q: [0, 0, 0, 1] },
      { model: "XSS-1377D", desc: "ماكينة زراير", q: [5, 0, 2, 10] },
    ],
  },
  {
    en: "Bartack machines",
    ar: "ماكينات التجنيط",
    items: [
      { model: "KXSS-430D-MY", desc: "", q: [1, 0, 0, 5] },
      { model: "XSS-430D-MY", desc: "", q: [3, 0, 1, 0] },
      { model: "XSS-430D-96", desc: "ماكينة تجنيط استيك بوكسر", q: [2, 0, 1, 0] },
    ],
  },
  {
    en: "Zigzag machines",
    ar: "ماكينات الزجزاج",
    items: [
      { model: "XSS-20U73D", desc: "ماكينة 20 يو", q: [2, 0, 0, 5] },
      { model: "XSS-1530D", desc: "ماكينة زجزاج كروشيه كبير", q: [5, 0, 0, 5] },
      { model: "XSS-2284D", desc: "ماكينة زجزاج 3 نقطة", q: [5, 0, 0, 0] },
      { model: "XA-TW111", desc: "ماكينة رفى طرحة", q: [0, 0, 0, 1] },
    ],
  },
  {
    en: "Pressing machines",
    ar: "ماكينات المكابس والمكاوى",
    items: [
      { model: "XS-M 4060", desc: "مكبس 40 في 60 شبه الماكس", q: [5, 5, 0, 20] },
      { model: "KS-M 4080", desc: "مكبس 40 في 80", q: [0, 0, 0, 20] },
      { model: "KS-M4090", desc: "مكبس 40 في 90", q: [0, 0, 0, 3] },
      { model: "", desc: "مكبس 40 في 60 اوتوماتيك", q: [0, 0, 0, 3] },
      { model: "", desc: "مكبس 40 في 80 اوتوماتيك", q: [0, 0, 0, 3] },
      { model: "XP-120100", desc: "مكبس", q: [0, 0, 0, 1] },
      { model: "XP-80100", desc: "مكبس", q: [0, 0, 0, 1] },
      { model: "XS-32 4060", desc: "مكبس 40 في 60", q: [5, 5, 0, 0] },
      { model: "XS-32 4082", desc: "مكبس 40 في 80", q: [5, 2, 0, 0] },
      { model: "XP-TG1", desc: "مكواة", q: [0, 0, 1, 0] },
      { model: "XP-589", desc: "مكواة", q: [0, 0, 1, 0] },
      { model: "X1-826", desc: "مكواة اوتوماتيك", q: [0, 0, 0, 5] },
      { model: "X1-TDZ-B1", desc: "طاولة مربع", q: [0, 0, 0, 20] },
      { model: "X1-5", desc: "مكواة 5 لتر", q: [0, 0, 0, 20] },
      { model: "KA-6889K", desc: "شق جيب", q: [0, 0, 1, 0] },
      { model: "138", desc: "قلاب بنطلون", q: [0, 0, 1, 0] },
      { model: "XSL-4830S", desc: "", q: [0, 0, 2, 0] },
      { model: "XSL-7640S-SQ-460HQ", desc: "فلات سيم", q: [2, 0, 1, 0] },
      { model: "XSL-9752A", desc: "ماكينة 2 ابرة عادة", q: [0, 0, 0, 2] },
      { model: "XSL-9752A/3", desc: "ماكينة 2 ابرة قص فتلة", q: [0, 0, 0, 2] },
      { model: "XSL-4830DP", desc: "", q: [0, 0, 0, 5] },
    ],
  },
];
