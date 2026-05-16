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
