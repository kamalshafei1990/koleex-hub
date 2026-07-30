"use client";

/* ---------------------------------------------------------------------------
   FieldHelp — the small (?) chip + bilingual EN/中文 hover tooltip used beside
   form-field labels, ported from the Quotations Quick Fill help pattern so
   both apps explain fields the same way. Fixed-positioned with edge-aware
   placement so section overflow can never clip it; tap works on touch
   (click toggles).
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export function FieldHelp({ en, zh }: { en: string; zh: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  /* Close a tap-opened tooltip when the user taps anywhere else. */
  useEffect(() => {
    if (!rect) return;
    const off = () => setRect(null);
    window.addEventListener("scroll", off, true);
    return () => window.removeEventListener("scroll", off, true);
  }, [rect]);

  return (
    <span
      onMouseEnter={(e) => setRect((e.currentTarget as HTMLElement).getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setRect(rect ? null : (e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
      className="inline-flex items-center justify-center h-[15px] w-[15px] rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)] text-[10px] font-bold cursor-help select-none align-middle ml-1.5 shrink-0 normal-case tracking-normal"
    >
      ?
      {rect && <BilingualTip anchorRect={rect} en={en} zh={zh} />}
    </span>
  );
}

function BilingualTip({ anchorRect, en, zh }: { anchorRect: DOMRect; en: string; zh: string }) {
  const WIDTH = 320;
  const margin = 8;
  let left = anchorRect.left;
  if (typeof window !== "undefined" && left + WIDTH + 16 > window.innerWidth) {
    left = Math.max(8, window.innerWidth - WIDTH - 16);
  }
  let top = anchorRect.bottom + margin;
  if (typeof window !== "undefined" && top + 180 > window.innerHeight) {
    top = Math.max(8, anchorRect.top - 180 - margin);
  }
  return (
    <span
      role="tooltip"
      dir="ltr"
      style={{ position: "fixed", top, left, width: WIDTH, zIndex: 99999 }}
      className="block px-3 py-2.5 rounded-lg bg-[#1f2937] text-white border border-white/[0.18] shadow-2xl text-[11px] leading-relaxed font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none"
    >
      <span className="block text-[9px] font-bold tracking-widest text-white/55 mb-0.5">EN</span>
      <span className="block mb-2">{en}</span>
      <span className="block text-[9px] font-bold tracking-widest text-white/55 mb-0.5">中文</span>
      <span className="block">{zh}</span>
    </span>
  );
}

/* Bilingual help copy for every field in Identifiers & Lifecycle. Written
   for non-specialist operators — says what the field means and when to
   fill it, mirroring the Quotations QUICK_FILL_HELP voice. */
export const IDENTIFIER_HELP: Record<string, { en: string; zh: string }> = {
  manufacturer: {
    en: "Manufacturer (OEM) — The company that actually builds the machine, when it differs from the brand on the badge. Fill it for rebranded/OEM products so sourcing and service know the real maker.",
    zh: "制造商 (OEM) — 实际生产该机器的工厂。当产品是贴牌/OEM 时填写，让采购和售后知道真正的生产方。",
  },
  mpn: {
    en: "MPN (Manufacturer Part Number) — The maker's own catalog number for this exact product. Used to cross-reference the factory's catalog, manuals and spare-part lists.",
    zh: "MPN (制造商零件号) — 制造商自己目录中该产品的编号。用于对照工厂目录、说明书和零配件清单。",
  },
  gtin: {
    en: "GTIN / EAN / UPC — The global retail barcode number (8, 12, 13 or 14 digits). Needed for marketplaces, retail scanning and customs systems. The field checks the digit-sum automatically.",
    zh: "GTIN / EAN / UPC — 全球零售条码号（8、12、13 或 14 位）。电商平台、零售扫码和海关系统需要。系统会自动校验校验位。",
  },
  internalSku: {
    en: "Internal SKU — KOLEEX's own stock-keeping code for this product, independent of the supplier's numbering. Used in inventory, invoices and internal reports.",
    zh: "内部 SKU — KOLEEX 自己的库存编码，与供应商编号无关。用于库存、发票和内部报表。",
  },
  generation: {
    en: "Generation / Version — Which iteration of the product this is (e.g. Gen 2, v3). Helps tell apart machines that share a name but differ in features across releases.",
    zh: "代际 / 版本 — 该产品属于第几代（如 Gen 2、v3）。用于区分名称相同但功能不同的不同批次机型。",
  },
  legacyCode: {
    en: "Old model no. / Legacy code — The code this product had before the KOLEEX coding system (the supplier's or an older internal one). Kept as a cross-reference so old quotes and documents still match.",
    zh: "旧型号 / 历史编码 — 该产品在 KOLEEX 编码体系之前使用的编号（供应商编号或旧内部编号）。保留作对照，让旧报价单和文件仍能对上。",
  },
  modelYear: {
    en: "Model year — The market year of this product (e.g. 2025). Useful for catalogs and for telling yearly refreshes apart.",
    zh: "型号年份 — 产品的市场年份（如 2025）。便于目录管理和区分年度改款。",
  },
  launchDate: {
    en: "Launch date — The day the product officially goes (or went) on sale. Drives 'new product' badges and lifecycle reports.",
    zh: "上市日期 — 产品正式开售的日期。用于“新品”标识和生命周期报表。",
  },
  eolDate: {
    en: "End-of-life date — The day the product is discontinued: no longer sold or produced. After this date it should not appear in new quotations.",
    zh: "停产日期 — 产品停止销售/生产的日期。此日期之后不应再出现在新报价中。",
  },
  availableFrom: {
    en: "Available from — The first day customers can actually order. Can be later than the launch announcement (pre-launch marketing, stock arriving).",
    zh: "可订购日期 — 客户可以正式下单的第一天。可能晚于发布日期（预热宣传、备货在途）。",
  },
  lastOrderDate: {
    en: "Last-order date — The final day orders are accepted, set before the end-of-life date so the last production run can be planned.",
    zh: "最后订购日期 — 接受订单的最后一天，早于停产日期，以便安排最后一批生产。",
  },
  statusReason: {
    en: "Status reason — WHY the product is in its current lifecycle state, e.g. 'Replaced by XSL-9100'. Gives sales an answer when a customer asks for a discontinued machine.",
    zh: "状态原因 — 产品处于当前状态的原因，例如“已被 XSL-9100 替代”。当客户询问停产机型时，销售可以直接回答。",
  },
  brandMark: {
    en: "Brand mark / logo override — A special logo image to show on this product's public page instead of the brand's default logo (e.g. a co-brand or series mark). Leave empty to use the brand logo.",
    zh: "品牌标志 / Logo 覆盖 — 在该产品公开页面上显示的特殊标志（如联名或系列标志），留空则使用品牌默认 Logo。",
  },
  revisionHistory: {
    en: "Revision history — A short log of engineering/spec revisions: version, date, and what changed. Keeps the team aligned on which revision a customer owns.",
    zh: "修订记录 — 工程/规格修订的简要记录：版本、日期、变更内容。让团队清楚客户手上是哪个修订版。",
  },
  alternateNames: {
    en: "Alternate names / aliases — Other names people use for this product (market nicknames, supplier names, common misspellings). Improves search and matching across the Hub.",
    zh: "别名 / 其他名称 — 人们对该产品的其他叫法（市场俗称、供应商名称、常见错拼）。提升全平台搜索和匹配的命中率。",
  },
};
