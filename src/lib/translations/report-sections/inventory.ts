import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the Inventory templates (Phase 5C). */
const WAREHOUSE = { en: "Warehouse", zh: "仓库", ar: "المخزن" };
const KEEPER_SIGN = { en: "Storekeeper signature", zh: "仓管员签字", ar: "توقيع أمين المخزن" };

const words: Translations = {
  "tpl.inv_count.s.warehouse": WAREHOUSE,
  "tpl.inv_count.s.count": { en: "Stock in the system and counted", zh: "系统库存与实盘", ar: "الكمية في السيستم واللي اتعد" },
  "tpl.inv_count.s.findings": { en: "What the count found", zh: "盘点结果", ar: "الجرد طلع إيه" },
  "tpl.inv_count.s.findings.hint": { en: "Where the differences are and why — missing, damaged or not yet recorded.", zh: "差异在哪里、原因是什么——丢失、损坏或尚未登记。", ar: "الفروق فين وليه — ناقص، تالف، أو لسه ما اتسجلش." },
  "tpl.inv_count.s.keeper_sign": KEEPER_SIGN,

  "tpl.inv_writeoff.s.warehouse": WAREHOUSE,
  "tpl.inv_writeoff.s.items": { en: "Items to write off", zh: "报损物品", ar: "الأصناف الهالكة والتالفة" },
  "tpl.inv_writeoff.s.items.c.item": { en: "Item", zh: "物品", ar: "الصنف" },
  "tpl.inv_writeoff.s.items.c.quantity": { en: "Quantity", zh: "数量", ar: "الكمية" },
  "tpl.inv_writeoff.s.items.c.value": { en: "Value", zh: "金额", ar: "القيمة" },
  "tpl.inv_writeoff.s.items.c.reason": { en: "Reason", zh: "原因", ar: "السبب" },
  "tpl.inv_writeoff.s.posted": { en: "Written off in the system", zh: "系统中的报损", ar: "الهالك المتسجّل في السيستم" },
  "tpl.inv_writeoff.s.cause": { en: "Why it happened", zh: "发生原因", ar: "حصل ليه" },
  "tpl.inv_writeoff.s.cause.hint": { en: "How the stock was damaged or lost, and how we stop it happening again.", zh: "库存如何损坏或丢失，以及如何防止再次发生。", ar: "الأصناف اتلفت أو ضاعت إزاي، وهنمنع ده يتكرر إزاي." },
  "tpl.inv_writeoff.s.keeper_sign": KEEPER_SIGN,

  "tpl.inv_movement.s.warehouse": WAREHOUSE,
  "tpl.inv_movement.s.moves": { en: "Movements", zh: "出入库明细", ar: "حركة المخزن" },
  "tpl.inv_movement.s.summary": { en: "The day in short", zh: "当日概要", ar: "اليوم باختصار" },
  "tpl.inv_movement.s.summary.hint": { en: "Anything unusual — a big delivery, a shortage, a mistake to fix.", zh: "有无异常——大批到货、短缺或需要更正的错误。", ar: "أي حاجة مش عادية — شحنة كبيرة، نقص، أو غلطة محتاجة تتصلح." },

  "tpl.inv_low_stock.s.warehouse": WAREHOUSE,
  "tpl.inv_low_stock.s.low": { en: "Low in stock", zh: "低库存", ar: "الأصناف الناقصة" },
  "tpl.inv_low_stock.s.actions": { en: "What we are doing", zh: "处理措施", ar: "بنعمل إيه" },
  "tpl.inv_low_stock.s.actions.hint": { en: "Purchase orders placed, transfers from another warehouse, or the approval we wait for.", zh: "已下的采购单、从其他仓库调拨，或正在等待的审批。", ar: "أوامر شراء اتعملت، تحويل من مخزن تاني، أو موافقة لسه مستنينها." },
};

export default words;
