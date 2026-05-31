/* ===========================================================================
   Guidance Registry — Phase 2.5

   Single source of truth for every operational help string in the
   Hub. Each entry has:

     · id          stable namespaced key like "treasury.runway"
     · title       short label, often the same as the surface term
     · default     base explanation in EN + ZH
     · states      optional state-aware variants keyed by status value

   Discipline rules:
     · keep explanations one sentence in each language
     · anchor on operational consequence ("what does this mean for ME?")
     · never use marketing language
     · never quote brand color names
     · bilingual: every entry MUST have both EN + ZH

   Adding a new entry is a one-place edit. Consumers pass an `id` (and
   optional `state`) to `getGuidance()` and receive `{ en, zh, title }`.
   ========================================================================== */

export interface GuidanceContent {
  en: string;
  zh: string;
}

export interface GuidanceEntry {
  id: string;
  title: GuidanceContent;
  default: GuidanceContent;
  /** State-aware variants. Key is the state value (e.g. "mismatch"). */
  states?: Record<string, GuidanceContent>;
}

/* ---------------------------------------------------------------------------
   The registry — grouped by surface for readability. Comments inside
   each group note where the entry is consumed.
   --------------------------------------------------------------------------- */

const REGISTRY: Record<string, GuidanceEntry> = {

  /* ── Intelligence / cross-module surfaces ─────────────────────── */
  "intelligence.businessHealth": {
    id: "intelligence.businessHealth",
    title: { en: "Business health", zh: "业务健康度" },
    default: {
      en: "A composite 0–100 score derived from finance, customer, supplier, logistics, inventory, approval, payment, and treasury dimensions. Lower scores mean operational pressure is building somewhere.",
      zh: "由财务、客户、供应商、物流、库存、审批、付款与资金各维度合成的 0–100 综合分数。分数越低,说明运营层面存在压力。",
    },
  },
  "intelligence.pressure": {
    id: "intelligence.pressure",
    title: { en: "Pressure level", zh: "压力等级" },
    default: {
      en: "The worst pressure across all health dimensions. Calm means nothing material; Watch is informational; Risk needs attention this week; Critical needs action now.",
      zh: "各健康维度中最差的压力级别。'平稳' 表示无重大问题;'关注' 仅供参考;'风险' 需本周处理;'严重' 需立即行动。",
    },
    states: {
      calm:     { en: "All operational dimensions are within healthy bands.", zh: "所有运营维度均处于健康区间。" },
      watch:    { en: "At least one dimension shows mild pressure — informational, not urgent.", zh: "至少一个维度出现轻微压力 — 仅供关注,无需紧急处理。" },
      risk:     { en: "Elevated pressure on a meaningful dimension — review this week.", zh: "某个重要维度压力升高 — 请于本周内复核。" },
      critical: { en: "Severe pressure that warrants immediate action.", zh: "出现严重压力,需立即采取行动。" },
    },
  },
  "intelligence.confidence": {
    id: "intelligence.confidence",
    title: { en: "Confidence", zh: "置信度" },
    default: {
      en: "How strongly the system trusts a cross-module narrative. Above 0.6 means the pattern has at least two supporting signals at meaningful severity.",
      zh: "系统对跨模块判断的信任程度。高于 0.6 表示该模式至少有两个有意义的佐证信号。",
    },
  },
  "intelligence.state.worsening": {
    id: "intelligence.state.worsening",
    title: { en: "Worsening signal", zh: "趋势恶化" },
    default: {
      en: "This signal was present in a prior run at a lower severity and has escalated since. Take action before it persists further.",
      zh: "该信号在过往运行中曾以较低严重度出现,现已升级。建议在其持续之前及时处理。",
    },
  },
  "intelligence.state.recurring": {
    id: "intelligence.state.recurring",
    title: { en: "Recurring signal", zh: "重复出现" },
    default: {
      en: "This signal has appeared in multiple recent runs without changing severity. A persistent issue rarely resolves itself.",
      zh: "该信号在最近多次运行中持续出现且严重度未变。持续性问题极少自行解决。",
    },
  },
  "intelligence.state.improving": {
    id: "intelligence.state.improving",
    title: { en: "Improving signal", zh: "趋势改善" },
    default: {
      en: "This signal was present at a higher severity in a prior run and has de-escalated. Continue the corrective action.",
      zh: "该信号在过往运行中曾以更高严重度出现,现已降级。请继续执行已有的纠正措施。",
    },
  },
  "intelligence.digestNarrative": {
    id: "intelligence.digestNarrative",
    title: { en: "Executive digest", zh: "管理层摘要" },
    default: {
      en: "Up to five curated narratives ranked by operational urgency. Fewer items is OK — the system will not pad the list to look busy.",
      zh: "按运营紧迫度排序的最多五条精选要点。条目较少属正常 — 系统不会为了显得忙碌而虚增内容。",
    },
  },

  /* ── Finance dashboard surfaces ──────────────────────────────── */
  "finance.liquidity": {
    id: "finance.liquidity",
    title: { en: "Liquidity", zh: "流动性" },
    default: {
      en: "Whether projected inflows cover projected outflows in the forward window. Treasury runway is the most direct read on liquidity.",
      zh: "前瞻窗口内预计现金流入是否能覆盖流出。'资金跑道天数' 是流动性最直接的指标。",
    },
  },
  "finance.arPressure": {
    id: "finance.arPressure",
    title: { en: "AR pressure", zh: "应收账款压力" },
    default: {
      en: "Outstanding customer balances relative to revenue. High AR pressure means cash is stuck in receivables and collection effort is needed.",
      zh: "未收款相对于营收的比例。AR 压力高表示现金滞留在应收账款中,需加强催收。",
    },
  },
  "finance.apPressure": {
    id: "finance.apPressure",
    title: { en: "AP pressure", zh: "应付账款压力" },
    default: {
      en: "Outstanding supplier balances. High AP pressure usually means staggered payment scheduling is required to protect cash.",
      zh: "未付供应商款项。AP 压力高通常需分批安排付款以保护现金。",
    },
  },
  "finance.concentration": {
    id: "finance.concentration",
    title: { en: "Concentration", zh: "集中度" },
    default: {
      en: "Share of revenue (or cost) attributable to a single counterparty. Above 40% revenue or 50% COGS, the business is structurally exposed.",
      zh: "单一交易对手在营收(或成本)中的占比。营收超 40% 或成本超 50% 时,公司在结构上存在风险敞口。",
    },
  },
  "finance.margin": {
    id: "finance.margin",
    title: { en: "Gross margin", zh: "毛利率" },
    default: {
      en: "Gross profit ÷ revenue. Below 15% the business has thin operational headroom; below 0 the period was unprofitable at the cost line.",
      zh: "毛利 ÷ 营收。低于 15% 时运营空间紧张;低于 0 表示该期内成本已侵蚀利润。",
    },
  },

  /* ── Approval workflow ──────────────────────────────────────── */
  "approval.status": {
    id: "approval.status",
    title: { en: "Approval status", zh: "审批状态" },
    default: {
      en: "The permission lifecycle on this record. Independent of payment state and evidence state — three separate dimensions.",
      zh: "本条记录的审批生命周期。与付款状态、凭证状态相互独立,共三个维度。",
    },
    states: {
      draft:              { en: "Not yet submitted. Edits are unrestricted.", zh: "尚未提交,可自由编辑。" },
      submitted:          { en: "Awaiting a manager's first review.",        zh: "等待经理首次审核。" },
      under_review:       { en: "A reviewer has started looking but has not yet decided.", zh: "审核人已开始查看,但尚未做出决定。" },
      approved:           { en: "Cleared for execution. Cash can flow if other gates allow.", zh: "已通过,可执行。如其他条件满足即可走款。" },
      partially_approved: { en: "Approved at a reduced amount or scope.",     zh: "按缩减金额或范围获批。" },
      rejected:           { en: "Decision was no. A written reason is recorded in the history.", zh: "审批未通过。理由已记入审批历史。" },
      requires_changes:   { en: "Sent back to the submitter with a specific change request.", zh: "已退回提交人,并附具体修改要求。" },
    },
  },
  "approval.health": {
    id: "approval.health",
    title: { en: "Approval health", zh: "审批健康度" },
    default: {
      en: "Combines backlog count, age, reviewer concentration, rejection rate, and unresolved-change items. Low scores mean review operations are slowing.",
      zh: "由待审数量、积压时长、审核人集中度、拒绝率和未解决修改请求合成。分数低表示审核流程正在放缓。",
    },
  },

  /* ── Evidence ──────────────────────────────────────────────── */
  "evidence.status": {
    id: "evidence.status",
    title: { en: "Evidence status", zh: "凭证状态" },
    default: {
      en: "Whether bank or supporting evidence is attached and whether it has been reviewed.",
      zh: "是否已附银行或佐证凭证,以及是否已经审核。",
    },
    states: {
      missing:  { en: "No attachment yet. Required before the expense can be marked verified.", zh: "尚未上传附件。需先上传才能标记为已核验。" },
      pending:  { en: "At least one attachment exists; a reviewer hasn't checked it yet.", zh: "已上传至少一个附件,但尚未审核。" },
      partial:  { en: "Some evidence is present but the reviewer flagged it as incomplete.", zh: "已有部分凭证,审核人标记为不完整。" },
      verified: { en: "A reviewer has checked the evidence and confirmed it matches.", zh: "审核人已确认凭证与款项相符。" },
    },
  },

  /* ── Payment + reconciliation ──────────────────────────────── */
  "payment.reconciliation": {
    id: "payment.reconciliation",
    title: { en: "Reconciliation", zh: "对账状态" },
    default: {
      en: "Whether the bank's report matches our intent. Independent of approval and payment state.",
      zh: "银行流水是否与我方预期一致。与审批状态、付款状态相互独立。",
    },
    states: {
      unreconciled:       { en: "No bank evidence matched yet. Awaiting reconciliation.", zh: "尚未与银行流水核对。等待对账。" },
      matched:            { en: "Actual bank amount matches expected within tolerance.", zh: "实际银行金额在容差范围内与预期一致。" },
      partially_matched:  { en: "Some but not all of the expected amount is covered by bank evidence.", zh: "银行凭证覆盖了部分但非全部预期金额。" },
      mismatch:           { en: "This bank movement does not match the expected payment amount.", zh: "该银行流水与预期付款金额不一致。" },
      disputed:           { en: "Manager escalated the mismatch; awaiting counterparty response.", zh: "经理已将差异升级处理;等待交易对手回应。" },
      verified:           { en: "This payment was reviewed and verified against bank activity.", zh: "该付款已与银行流水核对并确认。" },
    },
  },
  "payment.bankReference": {
    id: "payment.bankReference",
    title: { en: "Bank reference", zh: "银行参考号" },
    default: {
      en: "The bank's own identifier for this transaction — typically the MT103 message ID, wire reference, or T/T number. Required for verified reconciliation.",
      zh: "银行对该交易的内部标识 — 通常为 MT103 报文号、电汇参考号或 T/T 编号。'已核验' 状态须有此信息。",
    },
  },
  "payment.movementStatus": {
    id: "payment.movementStatus",
    title: { en: "Payment status", zh: "付款状态" },
    default: {
      en: "Where the cash actually sits in its lifecycle. Independent of approval and reconciliation.",
      zh: "该笔资金实际所处的生命周期阶段。与审批状态、对账状态相互独立。",
    },
    states: {
      scheduled:           { en: "Planned but not yet sent to the bank.", zh: "已安排但尚未提交银行。" },
      pending:             { en: "Submitted to the bank; awaiting settlement.", zh: "已提交银行,等待结算。" },
      paid:                { en: "Bank confirmed an outgoing transfer left our account.", zh: "银行确认款项已从我方账户汇出。" },
      received:            { en: "Bank confirmed an incoming transfer landed in our account.", zh: "银行确认款项已到达我方账户。" },
      partially_paid:      { en: "Part of the expected amount has been paid; the remainder is still pending.", zh: "已支付部分金额,剩余款项仍待付。" },
      partially_received:  { en: "Part of the expected amount has been received; the remainder is still owed.", zh: "已收到部分款项,剩余款项仍未到账。" },
      failed:              { en: "The bank rejected this transfer. Recovery action is required.", zh: "银行拒绝该笔汇款,需采取补救措施。" },
      cancelled:           { en: "The instruction was cancelled before settlement.", zh: "该指令在结算前已被取消。" },
      overdue:             { en: "Payment was expected but has not landed within tolerance.", zh: "已超过预期时间但款项仍未在容差范围内到账。" },
    },
  },
  "payment.health": {
    id: "payment.health",
    title: { en: "Payment health", zh: "付款健康度" },
    default: {
      en: "Combines pending-approval volume, unreconciled count, mismatch count, missing-evidence count, and bank failures. Low scores mean cash control is slipping.",
      zh: "由待审付款金额、未对账数、不一致项数、缺失凭证数和银行失败数合成。分数低表示资金控制开始失守。",
    },
  },

  /* ── Treasury ─────────────────────────────────────────────── */
  "treasury.health": {
    id: "treasury.health",
    title: { en: "Treasury health", zh: "资金健康度" },
    default: {
      en: "Runway, cash buffer, reconciliation pressure, bank concentration, FX exposure, and overdrafts roll up into one 0–100 score. Runway is the dominant lever.",
      zh: "资金跑道、现金缓冲、对账压力、银行集中度、FX 风险与透支风险合成的 0–100 综合分数。'跑道天数' 是首要因素。",
    },
  },
  "treasury.available": {
    id: "treasury.available",
    title: { en: "Available cash", zh: "可用现金" },
    default: {
      en: "Reporting-currency-translated cash you can actually deploy today. Excludes pending and restricted balances.",
      zh: "已折算为报告货币、今日真正可动用的现金。不含在途余额和受限余额。",
    },
  },
  "treasury.restricted": {
    id: "treasury.restricted",
    title: { en: "Restricted cash", zh: "受限现金" },
    default: {
      en: "Cash locked against an LC, escrow, court order, or similar — present in the bank but not deployable.",
      zh: "因信用证、托管、法院命令等而被冻结的现金 — 虽存在于银行,但无法动用。",
    },
  },
  "treasury.pending": {
    id: "treasury.pending",
    title: { en: "Pending cash", zh: "在途现金" },
    default: {
      en: "Cash sent or expected but not yet cleared the bank. Includes outstanding wires and uncleared cheques.",
      zh: "已汇出或预计到账、尚未结算的现金,包含未到账电汇及未结清票据。",
    },
  },
  "treasury.projected": {
    id: "treasury.projected",
    title: { en: "Projected cash", zh: "预测现金" },
    default: {
      en: "Forward cash position at the end of the window. Blends today's balance with confidence-weighted inflows and outflows from the timeline.",
      zh: "前瞻窗口结束时的现金头寸。基于当前余额与依置信度加权的预期流入流出合并计算。",
    },
  },
  "treasury.runway": {
    id: "treasury.runway",
    title: { en: "Runway", zh: "资金跑道" },
    default: {
      en: "Days until projected cash crosses zero. \"Beyond horizon\" means the 60-day projection never goes negative — that's the healthy state.",
      zh: "至预测现金降至零所剩天数。'超出区间' 表示 60 天内预测现金不会转负 — 这是健康状态。",
    },
  },
  "treasury.fxExposure": {
    id: "treasury.fxExposure",
    title: { en: "FX exposure", zh: "汇率敞口" },
    default: {
      en: "Share of cash held outside the reporting currency. Above 60% the business is materially exposed to currency moves.",
      zh: "以非报告货币持有现金的占比。超过 60% 时,业务对汇率波动有实质性敞口。" ,
    },
  },
  "treasury.liquidityGap": {
    id: "treasury.liquidityGap",
    title: { en: "Liquidity gap", zh: "流动性缺口" },
    default: {
      en: "A 30-day forward projection that turns negative — outflows are outpacing inflows in the window.",
      zh: "30 天前瞻预测转负 — 该窗口内流出快于流入。",
    },
  },
  "treasury.pressure": {
    id: "treasury.pressure",
    title: { en: "Treasury pressure", zh: "资金压力" },
    default: {
      en: "Composite read across runway, buffer, reconciliation, concentration, FX, and overdraft risks.",
      zh: "综合资金跑道、现金缓冲、对账、集中度、汇率与透支风险的整体评估。",
    },
  },
  "treasury.correlations": {
    id: "treasury.correlations",
    title: { en: "Cross-module correlations", zh: "跨模块关联" },
    default: {
      en: "Narratives that connect a treasury signal to another module — e.g. \"delayed collections amplify a forming liquidity gap\".",
      zh: "将资金信号与其他模块关联的叙述 — 例如 '收款延迟正在放大正在形成的流动性缺口'。",
    },
  },

  /* ── Finance dashboard — Hero KPIs + secondary metrics ──────── */
  "finance.revenue": {
    id: "finance.revenue",
    title: { en: "Revenue", zh: "营收" },
    default: {
      en: "Total selling price across all orders in this window. Not yet adjusted for supplier cost, expenses, tax refund, or bank fees.",
      zh: "本期内所有订单的销售总额。尚未扣除供应商成本、费用、退税或银行手续费。",
    },
  },
  "finance.netProfit": {
    id: "finance.netProfit",
    title: { en: "Net profit", zh: "净利润" },
    default: {
      en: "Gross profit − operating expenses + tax refund − bank charges. The bottom-line result for the period.",
      zh: "毛利 − 运营费用 + 退税 − 银行手续费。本期的最终净结果。",
    },
  },
  "finance.cashIn": {
    id: "finance.cashIn",
    title: { en: "Cash in", zh: "现金流入" },
    default: {
      en: "Actual payments received from customers in this window. Different from revenue — revenue is sold, cash-in is collected.",
      zh: "本期内实际收到的客户付款。与营收不同 — 营收是已售,现金流入是已收。",
    },
  },
  "finance.cashOut": {
    id: "finance.cashOut",
    title: { en: "Cash out", zh: "现金流出" },
    default: {
      en: "Actual payments sent to suppliers + paid expenses in this window. The other half of the cash-velocity equation.",
      zh: "本期内实际支付给供应商的款项加已付费用。现金流动公式的另一半。",
    },
  },
  "finance.accountsReceivable": {
    id: "finance.accountsReceivable",
    title: { en: "Money to collect", zh: "应收账款" },
    default: {
      en: "Outstanding customer balances — invoiced but not yet paid. High AR means cash is stuck in receivables.",
      zh: "未结清的客户余额 — 已开票但尚未收款。AR 高表示现金被应收账款占用。",
    },
  },
  "finance.accountsPayable": {
    id: "finance.accountsPayable",
    title: { en: "Money to pay", zh: "应付账款" },
    default: {
      en: "Outstanding supplier balances + unpaid bills. Often needs staggered payment scheduling.",
      zh: "未结清的供应商款项及未付账单。通常需要分批安排付款。",
    },
  },
  "finance.grossMargin": {
    id: "finance.grossMargin",
    title: { en: "Gross margin", zh: "毛利率" },
    default: {
      en: "Gross profit ÷ revenue × 100. Above 30% is comfortable; 15–30% is acceptable; below 15% is thin operational headroom.",
      zh: "毛利 ÷ 营收 × 100。30% 以上属健康;15–30% 可接受;低于 15% 运营空间紧张。",
    },
  },
  "finance.healthStatus": {
    id: "finance.healthStatus",
    title: { en: "Financial health", zh: "财务健康度" },
    default: {
      en: "A quick read of the period: Healthy (profit positive, cash flowing), Watch (some pressure), or Stress (negative profit / major overdue).",
      zh: "本期的快速指标:健康(盈利、现金流正常)、关注(存在压力)、紧张(亏损或严重逾期)。",
    },
  },

  /* ── Profit flow steps ──────────────────────────────────────── */
  "finance.supplierCost": {
    id: "finance.supplierCost",
    title: { en: "Supplier cost", zh: "供应商成本" },
    default: {
      en: "Total amount paid (or owed) to suppliers for goods on the orders. The biggest line that comes out of revenue.",
      zh: "为订单货物向供应商支付(或欠付)的总金额。营收中最大的扣减项。",
    },
  },
  "finance.grossProfit": {
    id: "finance.grossProfit",
    title: { en: "Gross profit", zh: "毛利" },
    default: {
      en: "Revenue − supplier cost. Does NOT include tax refund or operating expenses.",
      zh: "营收 − 供应商成本。不含退税或运营费用。",
    },
  },
  "finance.orderExpenses": {
    id: "finance.orderExpenses",
    title: { en: "Order expenses", zh: "订单费用" },
    default: {
      en: "Operating costs charged to specific orders — typically shipping, customs, packaging, and freight.",
      zh: "归集到具体订单的运营成本 — 通常包括运输、清关、包装和货运。",
    },
  },
  "finance.taxRefund": {
    id: "finance.taxRefund",
    title: { en: "Tax refund", zh: "出口退税" },
    default: {
      en: "VAT or export tax refund expected on the period's orders. Added back AFTER gross profit, before net profit.",
      zh: "本期订单预期的增值税或出口退税。在毛利之后、净利之前回加。",
    },
  },
  "finance.bankCharges": {
    id: "finance.bankCharges",
    title: { en: "Bank charges", zh: "银行费用" },
    default: {
      en: "Wire fees, L/C charges, FX spreads, and other bank costs on the period's orders. Subtracted at the net-profit line.",
      zh: "本期订单的电汇费、信用证费、汇兑差价及其他银行成本。在净利节点扣减。",
    },
  },

  /* ── Top insights ──────────────────────────────────────────── */
  "finance.topOrders": {
    id: "finance.topOrders",
    title: { en: "Top profitable orders", zh: "最盈利订单" },
    default: {
      en: "Orders ranked by net profit in this period. Useful for understanding which customers + product mixes deliver actual bottom-line value.",
      zh: "本期按净利润排序的订单。可用于了解哪些客户与产品组合带来真正的利润。",
    },
  },
  "finance.topCategories": {
    id: "finance.topCategories",
    title: { en: "Top expense categories", zh: "最大支出类别" },
    default: {
      en: "Biggest spend buckets this period. Heavy concentration in one category often signals a single-vendor risk or a margin-pressure source.",
      zh: "本期最大的支出类别。某一类别占比过高,通常意味着单一供应商风险或毛利压力来源。",
    },
  },

  /* ── Section headers ───────────────────────────────────────── */
  "finance.section.atGlance": {
    id: "finance.section.atGlance",
    title: { en: "At a glance", zh: "概览" },
    default: {
      en: "The two most important numbers in the period: revenue and net profit, with their period-over-period direction.",
      zh: "本期最重要的两个数字:营收和净利润,以及其环比变化方向。",
    },
  },
  "finance.section.cashRadar": {
    id: "finance.section.cashRadar",
    title: { en: "Cash radar", zh: "现金雷达" },
    default: {
      en: "Forward 45-day window of expected collections, supplier dues, and the resulting liquidity projection. Operational treasury reading.",
      zh: "未来 45 天的预期收款、供应商应付款以及由此得出的流动性预测。运营层面的资金视图。",
    },
  },
  "finance.section.aging": {
    id: "finance.section.aging",
    title: { en: "Aging", zh: "账龄" },
    default: {
      en: "Outstanding receivables and payables bucketed by how old they are. Anything past 30 days needs deliberate attention.",
      zh: "按账龄分桶的应收应付款。超过 30 天的项需特别关注。",
    },
  },
  "finance.section.trend": {
    id: "finance.section.trend",
    title: { en: "Trend", zh: "走势" },
    default: {
      en: "Revenue, costs + expenses, and net profit plotted over the period. Look at slope, not absolutes — direction beats magnitude here.",
      zh: "本期内营收、成本加费用、净利润的走势。重点看斜率,方向比绝对值更重要。",
    },
  },
  "finance.section.profitFlow": {
    id: "finance.section.profitFlow",
    title: { en: "Profit flow", zh: "利润流向" },
    default: {
      en: "Step-by-step accounting from revenue down to net profit. Each tile is one operational adjustment to the running total.",
      zh: "从营收到净利润的逐步核算。每个图块代表一个对运行总额的运营调整。",
    },
  },
  "finance.section.topInsights": {
    id: "finance.section.topInsights",
    title: { en: "Top insights", zh: "重点洞察" },
    default: {
      en: "Where profit is being made (top orders) and where it's leaking (top expense categories). Tells you what to do more of and what to compress.",
      zh: "利润来源(最盈利订单)和利润流失点(最大支出类别)。告诉你应增加什么、应削减什么。",
    },
  },
  "finance.section.intelligence": {
    id: "finance.section.intelligence",
    title: { en: "Intelligence", zh: "智能洞察" },
    default: {
      en: "Automatic interpretations of the period's signals. The system has already read the numbers and pulled out what's worth knowing.",
      zh: "对本期信号的自动解读。系统已经读完数字并提取出值得关注的要点。",
    },
  },

  /* ── Executive view stat row labels ─────────────────────────── */
  "finance.dso": {
    id: "finance.dso",
    title: { en: "DSO — days sales outstanding", zh: "DSO — 应收账款周转天数" },
    default: {
      en: "Average days from invoice to collection. AR ÷ daily revenue. Lower is better; > 60d means cash is structurally stuck.",
      zh: "从开票到收款的平均天数。AR ÷ 日营收。越低越好;>60 天表示资金结构性滞留。",
    },
  },
  "finance.ccc": {
    id: "finance.ccc",
    title: { en: "CCC — cash conversion cycle", zh: "CCC — 现金转换周期" },
    default: {
      en: "Days between paying suppliers and getting paid by customers (DSO − DPO). Lower or negative = the business funds itself; higher = working-capital pressure.",
      zh: "从付款给供应商到收款的天数差 (DSO − DPO)。越低或为负表示业务自循环;越高表示运营资金压力。",
    },
  },

  /* ── Approval workflow actions ──────────────────────────────── */
  "approval.action.submit": {
    id: "approval.action.submit",
    title: { en: "Submit for review", zh: "提交审核" },
    default: {
      en: "Move the record from draft to submitted. The next approver in the chain will receive it. You can still see it; you cannot edit it without resetting.",
      zh: "将记录从草稿状态提交。下一位审批人将收到。提交后仍可查看,但需先重置才能编辑。",
    },
  },
  "approval.action.approve": {
    id: "approval.action.approve",
    title: { en: "Approve", zh: "批准" },
    default: {
      en: "Clear the record for execution. Approval is recorded in the history with your name and timestamp.",
      zh: "通过审批以允许执行。批准操作将以你的姓名和时间戳记入审批历史。",
    },
  },
  "approval.action.reject": {
    id: "approval.action.reject",
    title: { en: "Reject", zh: "拒绝" },
    default: {
      en: "Decline the record. A written reason is required and saved to the audit trail.",
      zh: "拒绝该记录。必须提供书面理由,并记入审计日志。",
    },
  },
  "approval.action.requestChanges": {
    id: "approval.action.requestChanges",
    title: { en: "Request changes", zh: "请求修改" },
    default: {
      en: "Send the record back to the submitter with a specific change instruction. They resubmit when fixed.",
      zh: "退回给提交人并附具体修改要求。修改完成后由提交人重新提交。",
    },
  },

  /* ── Expense fields ─────────────────────────────────────────── */
  "expense.title": {
    id: "expense.title",
    title: { en: "Title", zh: "标题" },
    default: {
      en: "A short, findable description. Keep it to one line — \"Sea freight to Alexandria\" beats \"Misc cost 2026-05\".",
      zh: "简短、可检索的描述。控制在一行 — '至亚历山大海运' 优于 '2026-05 杂项'。",
    },
  },
  "expense.amount": {
    id: "expense.amount",
    title: { en: "Amount", zh: "金额" },
    default: {
      en: "The total expense in the selected currency. The system never auto-converts — pick the currency the bill is in.",
      zh: "所选币种下的费用总额。系统不会自动换算 — 请选择账单的实际币种。",
    },
  },
  "expense.category": {
    id: "expense.category",
    title: { en: "Category", zh: "类别" },
    default: {
      en: "The bucket used for analytics, intelligence, and tax mapping. Choose the closest match — \"Other\" is allowed but reduces signal quality.",
      zh: "用于分析、智能洞察和税务归集的分类。请选择最贴近的一项 — '其他' 可用但会降低信号质量。",
    },
  },
  "expense.dueDate": {
    id: "expense.dueDate",
    title: { en: "Due date", zh: "到期日" },
    default: {
      en: "When the bill must be paid. Used for overdue detection and forward cash projection. Optional but recommended for unpaid expenses.",
      zh: "账单需付清的日期。用于逾期检测和现金预测。未付费用建议填写。",
    },
  },
  "expense.linkedOrder": {
    id: "expense.linkedOrder",
    title: { en: "Linked order", zh: "关联订单" },
    default: {
      en: "Optional — ties the expense to a specific order so its profit calculation deducts it correctly.",
      zh: "可选 — 将费用关联到具体订单,使该订单的利润计算正确扣减此项。",
    },
  },

  /* ── Payment review drawer ──────────────────────────────────── */
  "payment.direction": {
    id: "payment.direction",
    title: { en: "Direction", zh: "方向" },
    default: {
      en: "Money in = received from a customer. Money out = sent to a supplier / vendor / tax authority.",
      zh: "现金流入 = 收款。现金流出 = 向供应商、服务商或税务机关付款。",
    },
  },
  "payment.expectedAmount": {
    id: "payment.expectedAmount",
    title: { en: "Expected amount", zh: "预期金额" },
    default: {
      en: "What the operator anticipated would land at the bank. Compare to actual amount during reconciliation.",
      zh: "操作员预期到账的金额。对账时与实际金额对比。",
    },
  },
  "payment.actualAmount": {
    id: "payment.actualAmount",
    title: { en: "Actual amount", zh: "实际金额" },
    default: {
      en: "What the bank reported. Once set, this is the authoritative figure for reconciliation.",
      zh: "银行报告的金额。一经填写,即为对账的权威数字。",
    },
  },
  "payment.difference": {
    id: "payment.difference",
    title: { en: "Difference", zh: "差额" },
    default: {
      en: "Actual − expected. Within 0.01 is a match; outside is a mismatch that needs reconciliation action.",
      zh: "实际 − 预期。差额在 0.01 内视为一致;超出则为差异,需对账处理。",
    },
  },
  "payment.method": {
    id: "payment.method",
    title: { en: "Payment method", zh: "付款方式" },
    default: {
      en: "How the money moves: T/T (wire), L/C (letter of credit), cash, cheque, or card. Affects bank fees and clearing timing.",
      zh: "资金移动方式:电汇 (T/T)、信用证 (L/C)、现金、支票或卡。会影响手续费与清算时间。",
    },
  },
  "payment.party": {
    id: "payment.party",
    title: { en: "Party", zh: "交易对手" },
    default: {
      en: "The other side of the cash movement — the customer paying us or the supplier we're paying.",
      zh: "资金往来的对方 — 付款给我们的客户或我们向其付款的供应商。",
    },
  },
  "payment.linkedOrder": {
    id: "payment.linkedOrder",
    title: { en: "Linked order", zh: "关联订单" },
    default: {
      en: "Which order this payment fulfils, partly or fully. Drives outstanding-balance calculation per order.",
      zh: "此笔付款部分或全部对应的订单。用于计算订单层级的未结余额。",
    },
  },

  /* ── Filter strips ─────────────────────────────────────────── */
  "expense.filter.needsReview": {
    id: "expense.filter.needsReview",
    title: { en: "Needs review", zh: "待审核" },
    default: {
      en: "Expenses sitting in submitted or under-review state. This is the approver's inbox.",
      zh: "处于已提交或审核中状态的费用。这是审批人的收件箱。",
    },
  },
  "expense.filter.drafts": {
    id: "expense.filter.drafts",
    title: { en: "Drafts", zh: "草稿" },
    default: {
      en: "Expenses you've created but not yet submitted for review. They never move forward until you submit.",
      zh: "你已创建但尚未提交审核的费用。在你提交前不会进入流程。",
    },
  },
  "expense.filter.rejected": {
    id: "expense.filter.rejected",
    title: { en: "Rejected", zh: "已拒绝" },
    default: {
      en: "Expenses an approver declined. Open the row to see the reason and decide whether to resubmit or delete.",
      zh: "审批人已拒绝的费用。打开该行可查看理由,并决定是否重新提交或删除。",
    },
  },
  "expense.filter.changesNeeded": {
    id: "expense.filter.changesNeeded",
    title: { en: "Changes needed", zh: "需修改" },
    default: {
      en: "Expenses an approver sent back with a specific change request. Fix what was asked and resubmit.",
      zh: "审批人退回并附具体修改要求的费用。按要求修改后重新提交。",
    },
  },
  "expense.filter.approved": {
    id: "expense.filter.approved",
    title: { en: "Approved", zh: "已批准" },
    default: {
      en: "Expenses that cleared review. Includes partially-approved items (approved at a reduced amount).",
      zh: "通过审核的费用,包含部分批准项(按缩减金额获批)。",
    },
  },

  /* ── Intelligence panel — workflow rail ─────────────────────── */
  "intelligence.workflowRail": {
    id: "intelligence.workflowRail",
    title: { en: "Operational queue", zh: "运营队列" },
    default: {
      en: "Six fast actions ranked by current pressure. The highest-priority action is always first; badges show open volume.",
      zh: "按当前压力排序的六个快速操作。最紧迫的操作始终居首;徽章显示未处理量。",
    },
  },
  "intelligence.copilot": {
    id: "intelligence.copilot",
    title: { en: "Copilot hints", zh: "Copilot 提示" },
    default: {
      en: "Up to three proactive operational hints. The Copilot prioritises cross-module narratives over single-module facts.",
      zh: "最多三条主动运营提示。Copilot 优先呈现跨模块综合判断,而非单模块单项数据。",
    },
  },
  "intelligence.copilotEmpty": {
    id: "intelligence.copilotEmpty",
    title: { en: "Calm state", zh: "平稳状态" },
    default: {
      en: "Nothing material is happening across Finance, customer, supplier, logistics, inventory, approval, payment, or treasury. The system stays silent on purpose.",
      zh: "财务、客户、供应商、物流、库存、审批、付款及资金各维度均无重大问题。系统主动保持沉默。",
    },
  },

  /* ── Period / mode toggles ─────────────────────────────────── */
  "finance.period": {
    id: "finance.period",
    title: { en: "Period", zh: "周期" },
    default: {
      en: "Time window for KPIs and trend charts. Week = last 7 days; Quarter = last 90 days; Year = last 12 months.",
      zh: "KPI 与走势图的时间窗口。Week = 最近 7 天;Quarter = 最近 90 天;Year = 最近 12 个月。",
    },
  },
  "finance.mode": {
    id: "finance.mode",
    title: { en: "View mode", zh: "视图模式" },
    default: {
      en: "Operational mode foregrounds daily workflows + queues; Executive mode foregrounds strategic surfaces (runway, concentration, FX).",
      zh: "运营模式聚焦日常工作流与队列;管理层模式聚焦战略视图(资金跑道、集中度、汇率)。",
    },
  },

  /* ── Expense tabs (payment-status filter) ───────────────────── */
  "expense.tab.all": {
    id: "expense.tab.all",
    title: { en: "All expenses", zh: "全部费用" },
    default: {
      en: "Every expense in the period, regardless of payment status.",
      zh: "本期内的全部费用,不区分付款状态。",
    },
  },
  "expense.tab.unpaid": {
    id: "expense.tab.unpaid",
    title: { en: "Unpaid", zh: "未付" },
    default: {
      en: "Expenses with payment_status ≠ paid. These still need to be settled and will affect cash projection.",
      zh: "付款状态不为 'paid' 的费用。需后续付清,将影响现金预测。",
    },
  },
  "expense.tab.paid": {
    id: "expense.tab.paid",
    title: { en: "Paid", zh: "已付" },
    default: {
      en: "Expenses that have been settled. They no longer affect AP or forward cash, but still affect period profit.",
      zh: "已结算的费用。不再影响应付账款或未来现金,但仍计入本期利润。",
    },
  },
  "expense.tab.overdue": {
    id: "expense.tab.overdue",
    title: { en: "Overdue", zh: "已逾期" },
    default: {
      en: "Unpaid expenses past their due date. These compound AP pressure and damage supplier relationships.",
      zh: "已超过到期日仍未付款的费用。会加剧应付账款压力并损害供应商关系。",
    },
  },
  "expense.search": {
    id: "expense.search",
    title: { en: "Search", zh: "搜索" },
    default: {
      en: "Free-text search across title, notes, and category name. Case-insensitive substring match.",
      zh: "针对标题、备注和类别名称的全文搜索。不区分大小写,匹配子字符串。",
    },
  },
  "expense.notes": {
    id: "expense.notes",
    title: { en: "Notes", zh: "备注" },
    default: {
      en: "One-line context, optional. Useful for explaining unusual items or one-off operations to a reviewer.",
      zh: "可选的一句话备注。便于向审核人说明异常项或一次性操作。",
    },
  },
  "expense.paymentStatus": {
    id: "expense.paymentStatus",
    title: { en: "Payment status", zh: "付款状态" },
    default: {
      en: "Unpaid / Partial / Paid. Drives overdue detection and AP balance. Independent of approval status.",
      zh: "未付 / 部分已付 / 已付。决定逾期检测与应付余额。与审批状态相互独立。",
    },
  },
  "expense.section.topCategories": {
    id: "expense.section.topCategories",
    title: { en: "Top categories", zh: "主要类别" },
    default: {
      en: "Most-used expense categories this period. Click a tile to filter the list below to that bucket.",
      zh: "本期使用最多的费用类别。点击图块可将下方列表过滤为该类别。",
    },
  },

  /* ── Order surfaces ─────────────────────────────────────────── */
  "order.number": {
    id: "order.number",
    title: { en: "Order number", zh: "订单编号" },
    default: {
      en: "Auto-generated stable ID (ORD-YYYY-NNNN). Used for cross-referencing in payments, expenses, attachments, and the audit log.",
      zh: "自动生成的稳定编号 (ORD-YYYY-NNNN)。用于付款、费用、附件与审计日志中的交叉引用。",
    },
  },
  "order.customer": {
    id: "order.customer",
    title: { en: "Customer", zh: "客户" },
    default: {
      en: "The buyer of this order. Linking to a contact enables customer behaviour analytics + concentration tracking.",
      zh: "本订单的买家。关联到联系人即可启用客户行为分析与集中度追踪。",
    },
  },
  "order.sellingPrice": {
    id: "order.sellingPrice",
    title: { en: "Selling price", zh: "销售价" },
    default: {
      en: "The total invoiced to the customer for this order. Source of revenue.",
      zh: "向客户开票的订单总额。营收来源。",
    },
  },
  "order.status": {
    id: "order.status",
    title: { en: "Order status", zh: "订单状态" },
    default: {
      en: "Open → in production → shipped → delivered → closed (or cancelled). Drives the operational pipeline view.",
      zh: "进行中 → 生产中 → 已发运 → 已交付 → 已完成(或已取消)。驱动运营流水线视图。",
    },
  },
  "order.paymentStatus": {
    id: "order.paymentStatus",
    title: { en: "Payment status", zh: "付款状态" },
    default: {
      en: "Customer-side payment progress on this order: unpaid → partial → paid (or overdue if past due date).",
      zh: "本订单的客户付款进度:未付 → 部分已付 → 已付(超过到期日则为 'overdue')。",
    },
  },
  "order.dueDate": {
    id: "order.dueDate",
    title: { en: "Customer due date", zh: "客户到期日" },
    default: {
      en: "When the customer is expected to settle. Powers AR aging buckets + the forward cash projection.",
      zh: "客户应付清的日期。驱动应收账龄分桶与未来现金预测。",
    },
  },
  "order.collected": {
    id: "order.collected",
    title: { en: "Collected", zh: "已收款" },
    default: {
      en: "Total customer payments received against this order. Equals selling price when fully paid.",
      zh: "本订单已收到的客户付款总额。全部收回时等于销售价。",
    },
  },
  "order.outstandingReceivable": {
    id: "order.outstandingReceivable",
    title: { en: "Outstanding receivable", zh: "应收余额" },
    default: {
      en: "max(0, selling price − collected). The cash you still expect from this customer on this order.",
      zh: "max(0, 销售价 − 已收款)。本订单上预期仍需收回的款项。",
    },
  },
  "order.outstandingPayable": {
    id: "order.outstandingPayable",
    title: { en: "Outstanding payable", zh: "应付余额" },
    default: {
      en: "Sum of unpaid supplier costs + unpaid linked expenses on this order. The cash you still owe.",
      zh: "本订单未付供应商成本与未付关联费用之和。仍需对外支付的金额。",
    },
  },
  "order.taxRefundPct": {
    id: "order.taxRefundPct",
    title: { en: "Tax refund %", zh: "退税率" },
    default: {
      en: "Export VAT refund rate applied to this order. The refund is added back AFTER gross profit, before net profit.",
      zh: "适用于本订单的出口退税率。退税金额在毛利之后、净利之前回加。",
    },
  },
  "order.netProfit": {
    id: "order.netProfit",
    title: { en: "Net profit (order)", zh: "订单净利润" },
    default: {
      en: "Gross profit − linked expenses + tax refund − bank charges. The bottom-line result for THIS order.",
      zh: "毛利 − 关联费用 + 退税 − 银行费用。本订单的最终净结果。",
    },
  },
  "order.netProfitPct": {
    id: "order.netProfitPct",
    title: { en: "Net profit %", zh: "净利率" },
    default: {
      en: "Net profit ÷ selling price × 100. Above 15% is strong; below 0 means the order lost money.",
      zh: "净利润 ÷ 销售价 × 100。15% 以上属优;低于 0 表示亏损。",
    },
  },
  "order.realizedCash": {
    id: "order.realizedCash",
    title: { en: "Realized cash", zh: "实际到账现金" },
    default: {
      en: "Collected − paid supplier − paid expenses. Actual cash position from this order at this moment.",
      zh: "已收款 − 已付供应商 − 已付费用。本订单当下的实际现金状况。",
    },
  },
  "order.riskLevel": {
    id: "order.riskLevel",
    title: { en: "Order risk", zh: "订单风险" },
    default: {
      en: "Composite read of AR exposure, AP exposure, collection %, and aging. Low / Medium / High / Critical.",
      zh: "综合应收风险、应付风险、回款率与账龄。低 / 中 / 高 / 严重。",
    },
  },
  "order.supplierCost": {
    id: "order.supplierCost",
    title: { en: "Supplier cost", zh: "供应商成本" },
    default: {
      en: "Total amount owed to suppliers for THIS order. Sum of all supplier-line costs.",
      zh: "本订单应付给供应商的总额,即所有供应商行成本之和。",
    },
  },
  "order.linkedExpenses": {
    id: "order.linkedExpenses",
    title: { en: "Linked expenses", zh: "关联费用" },
    default: {
      en: "Operating costs (shipping, customs, packaging, freight, etc.) charged specifically to this order.",
      zh: "归集到本订单的运营成本(运输、清关、包装、货运等)。",
    },
  },
  "order.zone.booked": {
    id: "order.zone.booked",
    title: { en: "Booked", zh: "已记账" },
    default: {
      en: "The accounting picture: revenue minus supplier cost and expenses + tax refund. What the order IS on paper.",
      zh: "记账视角:营收 − 供应商成本与费用 + 退税。账面上本订单的状态。",
    },
  },
  "order.zone.realized": {
    id: "order.zone.realized",
    title: { en: "Realized cash", zh: "实际现金" },
    default: {
      en: "What actually moved: collected − paid supplier − paid expenses. Bank reality of this order so far.",
      zh: "实际发生的现金流:已收款 − 已付供应商 − 已付费用。本订单的银行实际进展。",
    },
  },
  "order.zone.exposure": {
    id: "order.zone.exposure",
    title: { en: "Exposure", zh: "敞口" },
    default: {
      en: "What's still outstanding: AR + AP + collection % + risk level. The forward view of this order.",
      zh: "尚未结清的部分:应收 + 应付 + 回款率 + 风险等级。本订单的未来视角。",
    },
  },

  /* ── Suppliers + customers ─────────────────────────────────── */
  "supplier.dependency": {
    id: "supplier.dependency",
    title: { en: "Supplier dependency", zh: "供应商依赖度" },
    default: {
      en: "This supplier's share of total COGS. Above 50% is meaningful single-source risk; above 70% is critical.",
      zh: "该供应商在 COGS 中的占比。高于 50% 即为单一来源风险;高于 70% 属严重。",
    },
  },
  "supplier.reliability": {
    id: "supplier.reliability",
    title: { en: "Supplier reliability", zh: "供应商可靠度" },
    default: {
      en: "Composite score based on on-time payment cadence and outstanding-balance behaviour with this supplier.",
      zh: "基于对该供应商按时付款节奏与未结余额行为的综合评分。",
    },
  },
  "customer.healthScore": {
    id: "customer.healthScore",
    title: { en: "Customer health", zh: "客户健康度" },
    default: {
      en: "0–100 score: payment delay + late-payment rate + overdue exposure + concentration. Lower = riskier.",
      zh: "0–100 分:付款延迟 + 逾期率 + 逾期敞口 + 集中度。越低表示风险越大。",
    },
  },
  "customer.collectionDelay": {
    id: "customer.collectionDelay",
    title: { en: "Avg collection delay", zh: "平均回款延迟" },
    default: {
      en: "Average days between invoice due date and payment received. Trend matters more than absolute value.",
      zh: "发票到期日与实际收款之间的平均天数。趋势比绝对值更重要。",
    },
  },
  "customer.creditStatus": {
    id: "customer.creditStatus",
    title: { en: "Credit status", zh: "信用状态" },
    default: {
      en: "Good / Watch / Hold / Blocked. Affects whether new orders for this customer require manager approval.",
      zh: "良好 / 关注 / 暂停 / 拉黑。决定该客户新订单是否需要经理审批。",
    },
  },

  /* ── Attachments ────────────────────────────────────────────── */
  "attachment.category": {
    id: "attachment.category",
    title: { en: "Attachment category", zh: "附件类别" },
    default: {
      en: "Receipt / invoice / shipping doc / customs doc / payment screenshot / contract / other. Drives evidence classification.",
      zh: "票据 / 发票 / 运输单 / 报关单 / 付款截图 / 合同 / 其他。用于凭证分类。",
    },
  },
  "attachment.primary": {
    id: "attachment.primary",
    title: { en: "Primary file", zh: "主文件" },
    default: {
      en: "Marks ONE attachment as the canonical evidence — its URL is exposed via the primary_receipt_url shortcut.",
      zh: "将某个附件标记为主要凭证 — 其 URL 通过 primary_receipt_url 快捷字段对外公开。",
    },
  },

  /* ── Anomaly chips ──────────────────────────────────────────── */
  "intelligence.anomaly": {
    id: "intelligence.anomaly",
    title: { en: "Anomaly", zh: "异常" },
    default: {
      en: "Period-over-period deviation flagged by the materiality gate. Up-arrow = grew; down-arrow = shrank. Severity = how much.",
      zh: "经实质性闸门检测的环比偏差。↑ 表示增加;↓ 表示减少。严重度对应变化幅度。",
    },
  },

  /* ── Period selector / chart ────────────────────────────────── */
  "finance.section.trendChart": {
    id: "finance.section.trendChart",
    title: { en: "Cash flow over time", zh: "现金流走势" },
    default: {
      en: "Inflow (revenue), outflow (costs + expenses), and net profit plotted over the period. Slope > absolute value.",
      zh: "本期的流入(营收)、流出(成本与费用)及净利润走势。斜率比绝对值更重要。",
    },
  },

  /* ── Supplier · Department filter ──────────────────────────────── */
  "supplier.deptFilter": {
    id: "supplier.deptFilter",
    title: { en: "Filter fields by department", zh: "按部门筛选字段" },
    default: {
      en: "A supplier record holds data owned by many departments. Pick your department (e.g. Finance) to hide everything else and see only the fields you are responsible for. Choose 'All' to see the whole record again.",
      zh: "一条供应商记录包含多个部门负责的数据。选择你所在的部门(如财务),即可隐藏其他内容、只显示你负责填写的字段。选择'全部'可重新查看完整记录。",
    },
  },

  /* ── Supplier · Trade & Tax IDs ─────────────────────────────────
     Consumed by Contacts.tsx supplier add/edit form. Bilingual field
     help for international-trade identifiers. ── */
  "supplier.gst_number": {
    id: "supplier.gst_number",
    title: { en: "VAT / GST number", zh: "增值税 / GST 税号" },
    default: {
      en: "The supplier's value-added / goods-and-services tax registration number — used to validate tax-compliant invoices and reclaim input tax.",
      zh: "供应商的增值税 / 商品服务税登记号 — 用于核验合规发票并抵扣进项税。",
    },
  },
  "supplier.cr_number": {
    id: "supplier.cr_number",
    title: { en: "Commercial registration (CR)", zh: "商业登记号 (CR)" },
    default: {
      en: "The supplier's official company registration number from its national business registry — proves the entity is legally incorporated.",
      zh: "供应商在所在国工商登记机构的正式注册号 — 证明该主体已合法注册成立。",
    },
  },
  "supplier.duns_number": {
    id: "supplier.duns_number",
    title: { en: "D-U-N-S number", zh: "邓白氏编码 (D-U-N-S)" },
    default: {
      en: "A unique nine-digit Dun & Bradstreet identifier used worldwide to verify a business and pull its credit profile.",
      zh: "由邓白氏分配的九位唯一企业识别码,全球通用,用于核实企业身份并查询其信用档案。",
    },
  },
  "supplier.iec": {
    id: "supplier.iec",
    title: { en: "Importer / Exporter Code (IEC)", zh: "进出口企业代码 (IEC)" },
    default: {
      en: "The license code that authorizes the supplier to clear goods through customs for international trade — required for cross-border shipments.",
      zh: "授权供应商办理跨境货物通关的进出口许可代码 — 跨境发货所必需。",
    },
  },
  "supplier.customs_code": {
    id: "supplier.customs_code",
    title: { en: "Customs code", zh: "海关编码" },
    default: {
      en: "The supplier's registered customs / trader code used by the customs authority to identify it on import-export declarations.",
      zh: "供应商在海关登记的报关 / 贸易代码,海关凭此在进出口申报中识别该企业。",
    },
  },

  /* ── Supplier · Logistics & Trade ──────────────────────────────── */
  "supplier.incoterms": {
    id: "supplier.incoterms",
    title: { en: "Incoterms", zh: "国际贸易术语 (Incoterms)" },
    default: {
      en: "The agreed delivery term (e.g. FOB, CIF, EXW) that defines where the supplier's responsibility and cost end and yours begin.",
      zh: "约定的交货条款(如 FOB、CIF、EXW),界定供应商的责任与成本在何处结束、由您接手的起点。",
    },
  },
  "supplier.lead_time": {
    id: "supplier.lead_time",
    title: { en: "Lead time", zh: "交货周期" },
    default: {
      en: "How long the supplier needs from confirmed order to ready-to-ship — the basis for your reorder and planning timelines.",
      zh: "供应商从确认订单到可发货所需的时间 — 是您补货与计划排期的依据。",
    },
  },
  "supplier.moq": {
    id: "supplier.moq",
    title: { en: "Minimum order quantity (MOQ)", zh: "最小起订量 (MOQ)" },
    default: {
      en: "The smallest quantity the supplier will accept per order — drives whether their pricing fits your purchase volumes.",
      zh: "供应商每单可接受的最小数量 — 决定其报价是否匹配您的采购量。",
    },
  },
  "supplier.container_preference": {
    id: "supplier.container_preference",
    title: { en: "Container preference", zh: "集装箱偏好" },
    default: {
      en: "The supplier's preferred shipping container type (e.g. 20ft, 40ft, LCL) — affects consolidation and freight cost per unit.",
      zh: "供应商偏好的运输集装箱类型(如 20 尺、40 尺、拼箱)— 影响拼柜方式与单位运费。",
    },
  },
  "supplier.port_of_entry": {
    id: "supplier.port_of_entry",
    title: { en: "Port of loading / entry", zh: "装运港 / 入境港" },
    default: {
      en: "The port the supplier ships from (or your goods enter through) — used to estimate transit time and routing.",
      zh: "供应商发货的装运港(或货物入境的口岸)— 用于估算运输时间与路线安排。",
    },
  },

  /* ── Supplier · Factory ────────────────────────────────────────── */
  "supplier.factory_name": {
    id: "supplier.factory_name",
    title: { en: "Factory name", zh: "工厂名称" },
    default: {
      en: "The name of the production facility — may differ from the trading company you contract with; identifies where goods are actually made.",
      zh: "生产工厂的名称 — 可能与您签约的贸易公司不同;用于标明货物的实际生产地。",
    },
  },
  "supplier.factory_type": {
    id: "supplier.factory_type",
    title: { en: "Factory type", zh: "工厂类型" },
    default: {
      en: "Whether the supplier is a manufacturer, trading company, or both — tells you if you are buying direct from the source or through a middleman.",
      zh: "供应商是制造商、贸易公司还是两者兼具 — 表明您是直接向源头采购还是经由中间商。",
    },
  },
  "supplier.production_lines": {
    id: "supplier.production_lines",
    title: { en: "Production lines", zh: "生产线数量" },
    default: {
      en: "The number of active production lines — a rough indicator of how much the factory can run in parallel.",
      zh: "在用生产线的数量 — 大致反映工厂可同时并行生产的能力。",
    },
  },
  "supplier.monthly_capacity": {
    id: "supplier.monthly_capacity",
    title: { en: "Monthly capacity", zh: "月产能" },
    default: {
      en: "The maximum output the factory can produce in a month — check it comfortably covers your peak order volumes.",
      zh: "工厂每月可生产的最大产量 — 请确认其能从容覆盖您的高峰订单量。",
    },
  },
  "supplier.annual_output": {
    id: "supplier.annual_output",
    title: { en: "Annual output", zh: "年产量" },
    default: {
      en: "Total units the factory produces per year — a scale indicator for assessing whether the supplier fits long-term demand.",
      zh: "工厂每年的总产量 — 衡量其规模、判断是否匹配长期需求的指标。",
    },
  },
  "supplier.factory_size": {
    id: "supplier.factory_size",
    title: { en: "Factory size (sqm)", zh: "工厂面积(平方米)" },
    default: {
      en: "The factory's floor area in square metres — a proxy for production scale and how much capacity could expand.",
      zh: "工厂的建筑面积(平方米)— 反映生产规模及未来产能扩张空间的参考。",
    },
  },
  "supplier.employees": {
    id: "supplier.employees",
    title: { en: "Employees", zh: "员工人数" },
    default: {
      en: "Total headcount at the factory — indicates labour scale and how it might handle large or rush orders.",
      zh: "工厂的员工总数 — 反映用工规模及应对大单或加急订单的能力。",
    },
  },
  "supplier.qc_staff": {
    id: "supplier.qc_staff",
    title: { en: "QC staff", zh: "质检人员" },
    default: {
      en: "The number of dedicated quality-control inspectors — a higher count signals more disciplined in-house quality checks.",
      zh: "专职质检人员的数量 — 数量越多,通常意味着厂内质量管控越严格。",
    },
  },
  "supplier.rd_staff": {
    id: "supplier.rd_staff",
    title: { en: "R&D staff", zh: "研发人员" },
    default: {
      en: "The number of research & development staff — indicates the factory's ability to customise products or develop new designs.",
      zh: "研发人员的数量 — 反映工厂定制产品或开发新款式的能力。",
    },
  },
  "supplier.export_pct": {
    id: "supplier.export_pct",
    title: { en: "Export percentage", zh: "出口占比" },
    default: {
      en: "The share of output that is exported (0–100) — a high figure means the factory is experienced with international shipping and compliance.",
      zh: "出口产量所占的比例(0–100)— 比例越高,说明工厂在国际运输与合规方面经验越丰富。",
    },
  },
  "supplier.export_markets": {
    id: "supplier.export_markets",
    title: { en: "Export markets", zh: "出口市场" },
    default: {
      en: "The regions the factory already ships to (comma-separated) — confirms experience with your target markets' standards and paperwork.",
      zh: "工厂目前已出口的地区(用逗号分隔)— 用于确认其熟悉您目标市场的标准与单证要求。",
    },
  },
  "supplier.production_categories": {
    id: "supplier.production_categories",
    title: { en: "Production categories", zh: "生产品类" },
    default: {
      en: "The product categories the factory specialises in (comma-separated) — verifies it actually makes what you need to source.",
      zh: "工厂擅长生产的产品品类(用逗号分隔)— 用于核实其确实生产您需要采购的品类。",
    },
  },
  "supplier.odm": {
    id: "supplier.odm",
    title: { en: "ODM support", zh: "ODM 支持" },
    default: {
      en: "Whether the factory can design and develop a product for you to sell under your brand (Original Design Manufacturing).",
      zh: "工厂是否能为您设计并开发产品、由您贴牌销售(原始设计制造,ODM)。",
    },
  },
  "supplier.private_label": {
    id: "supplier.private_label",
    title: { en: "Private label", zh: "贴牌 / 自有品牌" },
    default: {
      en: "Whether the factory will produce existing products under your own brand name and packaging.",
      zh: "工厂是否愿意以您的品牌名称与包装生产现有产品。",
    },
  },
  "supplier.low_moq": {
    id: "supplier.low_moq",
    title: { en: "Low MOQ", zh: "低起订量" },
    default: {
      en: "Whether the factory accepts small minimum order quantities — useful for trial orders or low-volume product lines.",
      zh: "工厂是否接受较小的最小起订量 — 适用于试单或小批量产品线。",
    },
  },
};

/* ---------------------------------------------------------------------------
   Public API
   --------------------------------------------------------------------------- */

export function getGuidance(
  id: string,
  state?: string,
): { title: GuidanceContent; content: GuidanceContent } | null {
  const entry = REGISTRY[id];
  if (!entry) return null;
  const stateContent = state && entry.states ? entry.states[state] : undefined;
  return {
    title: entry.title,
    content: stateContent ?? entry.default,
  };
}

/** Convenience: return the localized string only. */
export function getLocalizedGuidance(
  id: string,
  locale: "en" | "zh",
  state?: string,
): { title: string; content: string } | null {
  const g = getGuidance(id, state);
  if (!g) return null;
  return { title: g.title[locale], content: g.content[locale] };
}

/** For tests / debug — lists every registered id. */
export function listGuidanceIds(): string[] {
  return Object.keys(REGISTRY);
}
