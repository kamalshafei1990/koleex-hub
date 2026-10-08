"use client";

/* ---------------------------------------------------------------------------
   FieldHelp — the small (?) chip + bilingual EN/中文 hover tooltip used beside
   form-field labels, ported from the Quotations Quick Fill help pattern so
   both apps explain fields the same way. Fixed-positioned with edge-aware
   placement so section overflow can never clip it; tap works on touch
   (click toggles).
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  /* PORTALLED to <body> — the owner caught the tip rendering at the top of
     the card instead of at the chip. The chip lives inside a .kx-glass form
     card whose backdrop-filter makes the CARD the containing block for
     position:fixed, so viewport coordinates landed relative to the card
     (same MN-5 lesson as the AI chat-row menu). Outside the card, fixed
     means the viewport again and the glass material can actually blur. */
  return createPortal(
    <span
      role="tooltip"
      dir="ltr"
      style={{ position: "fixed", top, left, width: WIDTH, zIndex: 99999 }}
      className="kx-glass-pop block px-3 py-2.5 rounded-lg bg-[#1f2937] text-white border border-white/[0.18] shadow-2xl text-[11px] leading-relaxed font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none"
    >
      <span className="block text-[9px] font-bold tracking-widest text-white/55 mb-0.5">EN</span>
      <span className="block mb-2">{en}</span>
      <span className="block text-[9px] font-bold tracking-widest text-white/55 mb-0.5">中文</span>
      <span className="block">{zh}</span>
    </span>,
    document.body,
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

/* Bilingual help for the product↔supplier link card (Supplier tab in the
   product form — the fields that appear after a supplier is linked).
   Same voice as the Quotations Quick Fill helps. */
export const SUPPLIER_LINK_HELP: Record<string, { en: string; zh: string }> = {
  productName: {
    en: "Supplier product name — What THIS supplier calls the product in their own catalog. Often differs from the KOLEEX name; keeping it makes their quotes, manuals and spare-part lists easy to match.",
    zh: "供应商产品名称 — 该供应商在自己目录中对此产品的叫法，常与 KOLEEX 名称不同。记录后便于核对其报价单、说明书和配件表。",
  },
  modelNumber: {
    en: "Supplier model number — The supplier's own model/part code for this product. Used on their quotations and shipping documents; the KOLEEX code stays our official identity.",
    zh: "供应商型号 — 供应商自己的型号/编码，出现在其报价单和出货单上。KOLEEX 编码仍是我们的正式标识。",
  },
  costPrice: {
    en: "Cost price (CNY) — The factory unit cost this supplier quoted, always entered in CNY: the pricing engine and all margin levels calculate from this number.",
    zh: "成本价（人民币）— 该供应商报的出厂单价，一律以人民币录入：定价引擎和所有利润级别都以此数计算。",
  },
  costIncludes: {
    en: "Cost includes — What's already inside the quoted price: full delivered-to-KOLEEX, packing only, or bare ex-works. Costs on different bases are NOT directly comparable.",
    zh: "成本包含 — 报价中已含的内容：全含送达 KOLEEX、仅含包装、或纯出厂价。不同口径的成本不能直接比较。",
  },
  taxVat: {
    en: "Tax (VAT) — Whether the quoted cost includes Chinese VAT. A tax-excluded quote looks cheaper than it is; the toggle keeps margins honest.",
    zh: "税（增值税）— 报价是否含增值税。不含税的报价看起来更便宜；此开关保证利润计算真实。",
  },
  quotedOn: {
    en: "Quoted on — The date the supplier issued this price. Old quotes drift from reality; the date tells you when to re-confirm.",
    zh: "报价日期 — 供应商给出该价格的日期。旧报价会失真，此日期提醒何时需要重新确认。",
  },
  validUntil: {
    en: "Valid until — The expiry date of the quotation. After it, the badge turns red and the price must be re-confirmed before quoting customers.",
    zh: "有效期至 — 报价的到期日。过期后标记变红，向客户报价前必须与供应商重新确认。",
  },
  volumePricing: {
    en: "Volume pricing — Price breaks by quantity (e.g. 10+ → lower unit price). Lets quotations pick the right tier automatically for bigger orders.",
    zh: "批量定价 — 按数量的价格阶梯（如 10 台以上单价更低）。报价时可按订单量自动匹配档位。",
  },
  quoteFile: {
    en: "Quotation / spec file — The supplier's original quotation PDF or spec sheet, attached as evidence for the numbers entered here.",
    zh: "报价单/规格文件 — 供应商的原始报价 PDF 或规格表，作为此处所填数据的凭证。",
  },
  incoterms: {
    en: "Incoterms — International trade term for this supplier's price: EXW = you collect at factory; FOB = supplier delivers to the port; CIF/CFR = supplier pays freight (CIF adds insurance); DAP/DDP = delivered to you (DDP includes duties).",
    zh: "贸易术语 — 该供应商价格对应的国际贸易条款：EXW 工厂自提；FOB 供方送至装运港；CIF/CFR 供方付运费（CIF 含保险）；DAP/DDP 送达目的地（DDP 含关税）。",
  },
  sampleCost: {
    en: "Sample cost — What the supplier charges for one sample unit (often refunded against a bulk order). Blank = not discussed yet.",
    zh: "样品费用 — 供应商单件样品的收费（常在批量下单后返还）。留空 = 尚未谈及。",
  },
  warrantyMonths: {
    en: "Supplier warranty (months) — How long the SUPPLIER covers defects toward us. Independent of the warranty KOLEEX offers customers (Compliance tab).",
    zh: "供应商保修（月）— 供应商对我们承担质保的时长。与 KOLEEX 向客户提供的保修（合规页）互相独立。",
  },
  sourcingStatus: {
    en: "Sourcing status — This supplier's role for THIS product: Preferred = default choice; Backup = alternative kept warm; Trial = being evaluated; Phasing out = orders winding down.",
    zh: "采购状态 — 该供应商对此产品的定位：首选=默认下单对象；备选=保持联系的替代方案；试用=考察中；逐步淘汰=订单收尾。",
  },
  whyThisSupplier: {
    en: "Why this supplier — One line of reasoning (best price / quality / lead time) so the next buyer understands the choice without asking around.",
    zh: "选择原因 — 一句话说明（价格最优/质量最好/交期最快），让接手的采购不用四处打听就明白当初的选择。",
  },
  minOrderValue: {
    en: "Min order value (CNY) — The smallest order amount this supplier accepts. Below it they may refuse or add surcharges.",
    zh: "最低订单金额（人民币）— 供应商接受的最小订单金额。低于此数可能拒单或加收费用。",
  },
  toolingOwner: {
    en: "Tooling / mold owner — Who owns the molds or special tooling: KOLEEX-owned means we can move production to another factory; supplier-owned means switching costs money.",
    zh: "工装/模具归属 — 模具或专用工装归谁：KOLEEX 所有则可随时转厂生产；供应商所有则更换供应商需要重新开模。",
  },
  toolingCost: {
    en: "Tooling / mold cost — One-time cost of the molds/tooling for this product, usually amortised over the first orders.",
    zh: "工装/模具费用 — 此产品模具/工装的一次性费用，通常在首批订单中摊销。",
  },
  notes: {
    en: "Notes — Sourcing remarks specific to this product-supplier pair: packaging quirks, negotiation history, quality incidents.",
    zh: "备注 — 针对该产品-供应商组合的采购备注：包装细节、谈判历史、质量事件等。",
  },
  moq: {
    en: "MOQ — Minimum Order Quantity: the smallest number of units the supplier will produce per order.",
    zh: "MOQ — 最小起订量：供应商每单愿意生产的最少台数/件数。",
  },
  leadTime: {
    en: "Lead time — Days from order confirmation (or deposit) until the goods are ready at the factory.",
    zh: "交货周期 — 从确认订单（或收到定金）到工厂备好货物所需的天数。",
  },
  paymentTerms: {
    en: "Payment terms — How this supplier is paid, e.g. 30% deposit + 70% before shipment, or T/T against B/L copy.",
    zh: "付款条件 — 与该供应商的结算方式，如 30% 定金 + 70% 发货前付清，或凭提单副本电汇。",
  },
  supplyType: {
    en: "Supply type — Whether this partner is the actual manufacturer or a trading company. Affects pricing room, spare parts and quality control.",
    zh: "供应类型 — 该伙伴是实际制造商还是贸易公司。影响议价空间、配件供应与品控。",
  },
};
