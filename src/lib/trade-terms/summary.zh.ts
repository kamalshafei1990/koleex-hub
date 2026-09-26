/* ---------------------------------------------------------------------------
   trade-terms/summary.zh — LAYER ONE, Simplified Chinese.

   TRANSLATED FROM summary.en.ts, never from the Arabic. English is the
   source; translating a translation compounds drift, and on trade terms a
   drifted sentence is a commercial error.

   THE CODES STAY IN LATIN SCRIPT. FOB, CIF, T/T, L/C and D/A appear exactly
   that way on Chinese contracts, bank forms and supplier quotations — the
   established Chinese names (离岸价 for FOB, 到岸价 for CIF) are given in the
   deep copy, where there is room to connect the two, not in a sentence whose
   only job is to be understood in three seconds.
   --------------------------------------------------------------------------- */

export const SUMMARY_ZH: Record<string, string> = {
  /* ── Incoterms ─────────────────────────────────────────────────────── */
  EXW: "你到卖方所在地自行提货——卖方甚至不负责装车。出了那道门，一切安排和费用都归你。",
  FCA: "卖方办理出口清关，并把货交给你指定的承运人。从交接那一刻起，货就是你的风险。",
  FAS: "卖方把货放在船边的码头上。装船以及之后的一切都归你。",
  FOB: "卖方把货装上船。货一上船，风险就转移给你。",
  CFR: "卖方付运费到目的港——但货物早在装船时就成了你的风险，不是到港时。",
  CIF: "与 CFR 相同，另加卖方必须投保。风险同样在装船时转移给你，你拿到的只是保险索赔权。",
  CPT: "卖方付全程运费到目的地——但第一承运人接管货物的那一刻，风险就已经是你的了。",
  CIP: "与 CPT 相同，另加卖方必须按最宽的险别投保。风险同样在第一承运人处转移。",
  DAP: "卖方把货运到约定地点，并承担全程风险。你负责清关和缴税。",
  DPU: "与 DAP 相同，卖方还要替你卸货。这是唯一强制卖方卸货的规则。",
  DDP: "卖方送到你家门口，进口已清关、税已付清。你只负责收货。",

  /* ── Payment methods ───────────────────────────────────────────────── */
  "cash-in-advance": "买方在发货前付清全款。对卖方而言没有更安全的方式，对买方的现金流也没有更难的方式。",
  "letter-of-credit": "银行承诺在单据相符时付款给卖方——而不是在货物合格时。看的是单据，不是货。",
  dp: "买方付款，银行才放单。不付款，就拿不到货。",
  da: "买方签下远期付款承诺，就能拿到单据——也就是拿到货。卖方手里只剩一个签名。",
  "open-account": "先发货，30 天、60 天或 90 天后付款。在竞争激烈的市场很常见，风险全部由卖方承担。",
  consignment: "只有在经销商把货卖掉之后，卖方才收到钱。货压在国外、在别人手里，而且尚未付款。",

  /* ── T/T structures ────────────────────────────────────────────────── */
  "tt-100-advance": "在生产开始前电汇全款。",
  "tt-30-70-bl": "下单付 30% 定金，出具运输单据后付 70%——卖方在收款前一直持有正本提单。",
  "tt-30-70-preship": "30% 定金，余下 70% 在发货前付清。对卖方比凭单付款更稳妥。",
  "tt-30-40-30": "30% 定金，生产完成付 40%，凭提单副本付 30%。常见于交期较长的设备。",

  /* ── Letter of credit — variants ───────────────────────────────────── */
  "lc-irrevocable": "未经卖方同意不得修改或撤销。按现行规则，每一份信用证都是不可撤销的——合同若提出“可撤销”信用证，等于什么都没提供。",
  "lc-confirmed": "由第二家银行——通常在卖方本国——加上自己的付款承诺。卖方不再依赖外国银行或外国国家。",
  "lc-sight": "银行审核单据无误后立即付款——实际上是五个银行工作日内，而不是当天。",
  "lc-usance": "银行在装船后 30、60、90 或 180 天付款。买方得到账期；卖方通常可以把银行的承诺贴现，今天就拿到现金。",
  "lc-transferable": "中间商可把全部或部分信用证转让给真正的供应商。证上必须注明“可转让”，否则无法操作。",
  "lc-back-to-back": "中间商以买方开来的信用证为担保，另开一份独立的信用证给供应商。一笔生意，两份信用证——两者之间的每一处差异都是中间商的成本。",
  "lc-revolving": "一份信用证，每次发货或每月自动恢复额度，向同一买家的定期供货无需每次重新开证。",
  "lc-red-clause": "银行在装船前预付部分款项给卖方用于生产——风险由买方承担。如今已很少见。",
  "lc-standby": "披着信用证外衣的保函：只有在买方不付款时才付。通常作为赊销发货的后盾。",

  /* ── Bank guarantees & escrow ──────────────────────────────────────── */
  "bg-advance-payment": "卖方银行承诺：若卖方始终不交货，则退还买方的定金。买方在为一台机器汇出 30% 定金前会要求的东西。",
  "bg-performance": "若卖方不履约，卖方银行向买方支付一笔固定金额——通常为合同额的 5–10%。",
  "bg-bid": "随投标文件一起提交：若投标人中标后拒绝签约，其银行付款。",
  "bg-warranty": "替代买方原本会在保修期内扣留的款项——卖方全额收款，银行为缺陷兜底。",
  escrow: "中立的第三方保管买方的钱，只有在约定条件达成——已发货、已收货或已验货——时才放款给卖方。",
};

/** The name a colleague says out loud. English stays on the card as the
 *  contract wording; this is what goes above it. Only the terms whose title
 *  is a name — the T/T structures are titled by their split. */
export const NAMES_ZH: Record<string, string> = {
  EXW: "工厂交货", FCA: "货交承运人", FAS: "船边交货", FOB: "船上交货（离岸价）",
  CFR: "成本加运费", CIF: "成本、保险费加运费（到岸价）", CPT: "运费付至", CIP: "运费、保险费付至",
  DAP: "目的地交货", DPU: "卸货地交货", DDP: "完税后交货",
  "cash-in-advance": "预付货款", "letter-of-credit": "信用证", dp: "付款交单", da: "承兑交单",
  "open-account": "赊销（记账）", consignment: "寄售",
  "lc-irrevocable": "不可撤销信用证", "lc-confirmed": "保兑信用证", "lc-sight": "即期信用证",
  "lc-usance": "远期信用证", "lc-transferable": "可转让信用证", "lc-back-to-back": "背对背信用证",
  "lc-revolving": "循环信用证", "lc-red-clause": "红条款信用证", "lc-standby": "备用信用证",
  "bg-advance-payment": "预付款保函", "bg-performance": "履约保函", "bg-bid": "投标保函",
  "bg-warranty": "质量保函", escrow: "资金托管",
};
