import type { DiscountType, DiscountLimit, ApprovalLevel, DiscountScenario, DiscountFlowStep } from './discount-types';

// ── Discount Types ──────────────────────────────────────────────────────
export const DISCOUNT_TYPES: DiscountType[] = [
  {
    id: 'standard',
    name: 'Standard Discount',
    description: 'Regular discount based on customer level and relationship. Applied automatically within approved limits.',
    icon: 'Tag',
    applicableTo: ['Silver', 'Gold', 'Platinum', 'Diamond'],
    approvalRequired: false,
  },
  {
    id: 'volume',
    name: 'Volume Discount',
    description: 'Additional discount for large quantity orders. Rewards bulk purchasing and supports inventory planning.',
    icon: 'Package',
    applicableTo: ['Gold', 'Platinum', 'Diamond'],
    approvalRequired: false,
    maxDiscount: 5,
  },
  {
    id: 'project',
    name: 'Project Discount',
    description: 'Special pricing for large projects or tenders. Lower margin compensated by high volume and strategic value.',
    icon: 'Building2',
    applicableTo: ['Gold', 'Platinum', 'Diamond'],
    approvalRequired: true,
  },
  {
    id: 'competitive',
    name: 'Competitive Discount',
    description: 'Price adjustment to match or beat competitor pricing. Requires competitor price evidence.',
    icon: 'Swords',
    applicableTo: ['Silver', 'Gold', 'Platinum', 'Diamond'],
    approvalRequired: true,
  },
  {
    id: 'market',
    name: 'Market Discount',
    description: 'Adjustment for specific market conditions, economic situations, or market entry strategy.',
    icon: 'Globe',
    applicableTo: ['Gold', 'Platinum', 'Diamond'],
    approvalRequired: true,
  },
  {
    id: 'promotion',
    name: 'Promotion Discount',
    description: 'Temporary promotional pricing for marketing campaigns, seasonal offers, or product launches.',
    icon: 'Sparkles',
    applicableTo: ['Silver', 'Gold', 'Platinum', 'Diamond'],
    approvalRequired: false,
    maxDiscount: 10,
  },
  {
    id: 'special',
    name: 'Special Approval Discount',
    description: 'Exceptional pricing requiring management approval. Used for strategic deals, market entry, or partnership support.',
    icon: 'ShieldCheck',
    applicableTo: ['Platinum', 'Diamond'],
    approvalRequired: true,
  },
];

// ── Customer Level Discount Limits ──────────────────────────────────────
export const DISCOUNT_LIMITS: DiscountLimit[] = [
  {
    level: 'End User',
    levelColor: '#86868B',
    authority: 'No Discount',
    typicalRange: '0%',
    maxWithoutApproval: 0,
    maxWithApproval: 0,
    notes: 'End users receive retail pricing only. No discount authority.',
  },
  {
    level: 'Silver',
    levelColor: '#A8A9AD',
    authority: 'Limited',
    typicalRange: '0% – 3%',
    maxWithoutApproval: 3,
    maxWithApproval: 5,
    notes: 'Small introductory discounts to build relationship. Sales can approve up to 3%.',
  },
  {
    level: 'Gold',
    levelColor: '#C9973F',
    authority: 'Standard',
    typicalRange: '3% – 8%',
    maxWithoutApproval: 5,
    maxWithApproval: 12,
    notes: 'Regular distributor discounts. Volume and project discounts available.',
  },
  {
    level: 'Platinum',
    levelColor: '#7BA1C2',
    authority: 'Extended',
    typicalRange: '5% – 12%',
    maxWithoutApproval: 8,
    maxWithApproval: 18,
    notes: 'Major distributor pricing. Higher discount authority with margin protection.',
  },
  {
    level: 'Diamond',
    levelColor: '#4FC3F7',
    authority: 'Negotiated',
    typicalRange: 'Contract-based',
    maxWithoutApproval: 12,
    maxWithApproval: 25,
    notes: 'Sole agent pricing. Special contract terms. Annual review of pricing structure.',
  },
];

// ── Approval Levels ─────────────────────────────────────────────────────
export const APPROVAL_LEVELS: ApprovalLevel[] = [
  {
    range: '0% – 3%',
    minPercent: 0,
    maxPercent: 3,
    approver: 'Sales Person',
    role: 'sales',
    icon: 'User',
    color: '#34C759',
    responseTime: 'Immediate',
  },
  {
    range: '3% – 5%',
    minPercent: 3,
    maxPercent: 5,
    approver: 'Sales Manager',
    role: 'sales_manager',
    icon: 'UserCheck',
    color: '#007AFF',
    responseTime: 'Same day',
  },
  {
    range: '5% – 10%',
    minPercent: 5,
    maxPercent: 10,
    approver: 'Commercial Manager',
    role: 'commercial_manager',
    icon: 'Briefcase',
    color: '#FF9500',
    responseTime: '24 hours',
  },
  {
    range: '10% – 15%',
    minPercent: 10,
    maxPercent: 15,
    approver: 'General Manager',
    role: 'general_manager',
    icon: 'Shield',
    color: '#FF3B30',
    responseTime: '48 hours',
  },
  {
    range: 'Above 15%',
    minPercent: 15,
    maxPercent: 100,
    approver: 'CEO',
    role: 'ceo',
    icon: 'Crown',
    color: '#AF52DE',
    responseTime: 'Case by case',
  },
];

// ── Minimum Margin Rules ────────────────────────────────────────────────
export const MINIMUM_MARGINS = {
  level1: { name: 'Level 1 — Entry/Volume', baseMargin: 5, minMargin: 2, color: '#34C759' },
  level2: { name: 'Level 2 — Standard Commercial', baseMargin: 10, minMargin: 5, color: '#007AFF' },
  level3: { name: 'Level 3 — Advanced/Semi-Industrial', baseMargin: 15, minMargin: 8, color: '#FF9500' },
  level4: { name: 'Level 4 — High-End/Strategic', baseMargin: 25, minMargin: 15, color: '#FF3B30' },
};

// ── Discount Flow Steps ─────────────────────────────────────────────────
export const DISCOUNT_FLOW_STEPS: DiscountFlowStep[] = [
  { id: 1, title: 'Base Price', description: 'Start with the channel price for the customer level', icon: 'DollarSign' },
  { id: 2, title: 'Customer Level Check', description: 'Verify customer level and discount authority', icon: 'Users' },
  { id: 3, title: 'Standard Discount', description: 'Apply standard level-based discount if applicable', icon: 'Tag' },
  { id: 4, title: 'Volume Discount', description: 'Apply volume discount for bulk orders', icon: 'Package' },
  { id: 5, title: 'Project / Competitive', description: 'Apply project or competitive discount if applicable', icon: 'Building2' },
  { id: 6, title: 'Check Minimum Margin', description: 'Verify final price respects minimum margin rules', icon: 'ShieldAlert', isDecision: true },
  { id: 7, title: 'Approval Required?', description: 'Determine if discount exceeds authority level', icon: 'AlertCircle', isDecision: true },
  { id: 8, title: 'Management Approval', description: 'Route to appropriate approval level', icon: 'CheckCircle' },
  { id: 9, title: 'Final Price', description: 'Confirmed discounted price ready for quotation', icon: 'FileText' },
];

// ── Example Scenarios ───────────────────────────────────────────────────
export const DISCOUNT_SCENARIOS: DiscountScenario[] = [
  {
    id: 'silver-small',
    title: 'Silver — Small Order',
    customerLevel: 'Silver',
    levelColor: '#A8A9AD',
    type: 'Standard',
    basePrice: 1820,
    discount: 2,
    quantity: 5,
    cost: 1655,
    minMargin: 5,
    description: 'New Silver customer orders 5 units. Sales offers 2% introductory discount.',
    outcome: 'approved',
    notes: 'Within Silver 3% auto-approval limit. Margin remains above minimum.',
  },
  {
    id: 'gold-medium',
    title: 'Gold — Medium Order with Volume',
    customerLevel: 'Gold',
    levelColor: '#C9973F',
    type: 'Volume',
    basePrice: 1965,
    discount: 5,
    quantity: 50,
    cost: 1655,
    minMargin: 5,
    description: 'Gold distributor orders 50 units. Volume discount of 5% applied.',
    outcome: 'approved',
    notes: 'Within Gold 5% auto-approval limit. Good margin retained.',
  },
  {
    id: 'platinum-project',
    title: 'Platinum — Large Project',
    customerLevel: 'Platinum',
    levelColor: '#7BA1C2',
    type: 'Project',
    basePrice: 2122,
    discount: 10,
    quantity: 200,
    cost: 1655,
    minMargin: 5,
    description: 'Platinum partner bids on a large industrial project. 10% project discount requested.',
    outcome: 'escalated',
    notes: 'Exceeds Platinum 8% auto-limit. Needs Commercial Manager approval. Margin still above minimum.',
  },
  {
    id: 'competitive-match',
    title: 'Competitive Price Match',
    customerLevel: 'Gold',
    levelColor: '#C9973F',
    type: 'Competitive',
    basePrice: 1965,
    discount: 8,
    quantity: 30,
    cost: 1655,
    minMargin: 5,
    description: 'Gold customer shows competitor quote $50 lower. Competitive discount to match.',
    outcome: 'escalated',
    notes: 'Competitive discount exceeds auto-approval. Sales Manager approval required. Competitor evidence attached.',
  },
  {
    id: 'diamond-support',
    title: 'Diamond — Partner Support',
    customerLevel: 'Diamond',
    levelColor: '#4FC3F7',
    type: 'Special',
    basePrice: 2122,
    discount: 15,
    quantity: 500,
    cost: 1655,
    minMargin: 5,
    description: 'Diamond sole agent needs pricing support for market penetration campaign.',
    outcome: 'escalated',
    notes: 'Special pricing for strategic market expansion. GM approval required. Contract terms apply.',
  },
  {
    id: 'margin-breach',
    title: 'Rejected — Margin Below Minimum',
    customerLevel: 'Gold',
    levelColor: '#C9973F',
    type: 'Competitive',
    basePrice: 1965,
    discount: 18,
    quantity: 20,
    cost: 1655,
    minMargin: 5,
    description: 'Gold customer requests 18% discount to match very low competitor price.',
    outcome: 'rejected',
    notes: 'Discount would reduce margin below 5% minimum. Rejected by system. Alternative: negotiate value-add.',
  },
  {
    id: 'market-entry',
    title: 'Market Entry Pricing',
    customerLevel: 'Platinum',
    levelColor: '#7BA1C2',
    type: 'Market',
    basePrice: 2122,
    discount: 12,
    quantity: 100,
    cost: 1655,
    minMargin: 5,
    description: 'Platinum partner entering new market. Special market entry pricing for first 6 months.',
    outcome: 'escalated',
    notes: 'Time-limited market entry pricing. GM approval. Review after 6 months.',
  },
  {
    id: 'promotion',
    title: 'Seasonal Promotion',
    customerLevel: 'Silver',
    levelColor: '#A8A9AD',
    type: 'Promotion',
    basePrice: 1820,
    discount: 5,
    quantity: 10,
    cost: 1655,
    minMargin: 5,
    description: 'Year-end promotion offering 5% discount to all Silver+ customers.',
    outcome: 'approved',
    notes: 'Approved promotion campaign. Time-limited. Within promotion discount cap.',
  },
];

// ── Special Pricing Conditions ──────────────────────────────────────────
export const SPECIAL_PRICING_CONDITIONS = [
  { condition: 'Large Project', description: 'Orders exceeding $100,000 or 200+ units', approval: 'Commercial Manager', icon: 'Building2' },
  { condition: 'Strategic Customer', description: 'Key account or market leader partnership', approval: 'General Manager', icon: 'Star' },
  { condition: 'Market Entry', description: 'First-time market penetration pricing', approval: 'General Manager', icon: 'Globe' },
  { condition: 'Competitive Response', description: 'Price match with documented competitor evidence', approval: 'Sales Manager+', icon: 'Swords' },
  { condition: 'Clear Stock', description: 'Inventory clearance for older product models', approval: 'Commercial Manager', icon: 'Package' },
  { condition: 'Promotion Campaign', description: 'Time-limited marketing campaign pricing', approval: 'Commercial Manager', icon: 'Sparkles' },
  { condition: 'Diamond Support', description: 'Sole agent market development support', approval: 'Contract-based', icon: 'Diamond' },
  { condition: 'OEM Pricing', description: 'Original equipment manufacturer bulk pricing', approval: 'General Manager', icon: 'Cpu' },
];

// ── Helper Functions ────────────────────────────────────────────────────
export function calculateDiscount(basePrice: number, discountPercent: number, quantity: number, cost: number) {
  const discountAmount = basePrice * (discountPercent / 100);
  const finalPrice = basePrice - discountAmount;
  const margin = ((finalPrice - cost) / finalPrice) * 100;
  const totalRevenue = finalPrice * quantity;
  const totalProfit = (finalPrice - cost) * quantity;

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
  };
}

export function getApprovalLevel(discountPercent: number): ApprovalLevel {
  return APPROVAL_LEVELS.find(l => discountPercent >= l.minPercent && discountPercent < l.maxPercent) || APPROVAL_LEVELS[APPROVAL_LEVELS.length - 1];
}

export function checkMinMargin(finalPrice: number, cost: number, minMarginPercent: number): boolean {
  const margin = ((finalPrice - cost) / finalPrice) * 100;
  return margin >= minMarginPercent;
}

export function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
