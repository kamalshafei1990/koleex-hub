/* ---------------------------------------------------------------------------
   Commercial Policy — internal navigation tree
   Maps the 70+ page policy portal into a sidebar-friendly structure.
   --------------------------------------------------------------------------- */

export interface PolicyNavItem {
  id: string;
  label: string;
  path: string;
  section?: "manual" | "tools" | "system";
  children?: PolicyNavItem[];
}

export const POLICY_NAV: PolicyNavItem[] = [
  /* ═══════════════════════════════════════
     MANUAL
     ═══════════════════════════════════════ */
  { id: "introduction", label: "Introduction", path: "/knowledge/commercial-policy/introduction", section: "manual" },
  {
    id: "business-model", label: "Business Model", path: "/knowledge/commercial-policy/business-model", section: "manual",
    children: [
      { id: "bm-overview", label: "Overview", path: "/knowledge/commercial-policy/business-model" },
      { id: "bm-margin", label: "Margin Strategy", path: "/knowledge/commercial-policy/margin-strategy" },
    ],
  },

  /* 3. Global Pricing System */
  {
    id: "pricing-system", label: "Global Pricing System", path: "/knowledge/commercial-policy/pricing", section: "manual",
    children: [
      { id: "ps-overview", label: "Pricing Overview", path: "/knowledge/commercial-policy/pricing" },
      { id: "ps-flow", label: "Pricing Flow", path: "/knowledge/commercial-policy/pricing/flow" },
      { id: "ps-math", label: "Pricing Mathematics", path: "/knowledge/commercial-policy/pricing/math" },
      { id: "ps-levels", label: "Product Levels", path: "/knowledge/commercial-policy/pricing/product-levels" },
      { id: "ps-algorithm", label: "Pricing Algorithm", path: "/knowledge/commercial-policy/pricing/algorithm" },
      { id: "ps-bands", label: "Market Bands", path: "/knowledge/commercial-policy/pricing/market-bands" },
      { id: "ps-channel", label: "Channel Pricing", path: "/knowledge/commercial-policy/pricing/channel-structure" },
      { id: "ps-customer", label: "Customer Pricing", path: "/knowledge/commercial-policy/pricing/customer-types" },
      { id: "ps-discount", label: "Discount System", path: "/knowledge/commercial-policy/pricing/discount" },
      { id: "ps-formula", label: "Pricing Formula", path: "/knowledge/commercial-policy/pricing/formula" },
      { id: "ps-fx", label: "FX Policy", path: "/knowledge/commercial-policy/pricing/fx-risk" },
      { id: "ps-governance", label: "Pricing Governance", path: "/knowledge/commercial-policy/pricing/governance" },
    ],
  },

  /* 4. Commission System */
  {
    id: "commission-system", label: "Commission System", path: "/knowledge/commercial-policy/commission", section: "manual",
    children: [
      { id: "comm-overview", label: "Overview", path: "/knowledge/commercial-policy/commission" },
      { id: "comm-policy", label: "Commission Policy", path: "/knowledge/commercial-policy/commission/policy" },
      { id: "comm-calc", label: "How It Works", path: "/knowledge/commercial-policy/commission/calculation" },
      { id: "comm-flow", label: "Commission Flow", path: "/knowledge/commercial-policy/commission/flow" },
      { id: "comm-examples", label: "Examples", path: "/knowledge/commercial-policy/commission/examples" },
      { id: "comm-visuals", label: "Visuals", path: "/knowledge/commercial-policy/commission/visuals" },
      { id: "comm-scenarios", label: "Scenarios", path: "/knowledge/commercial-policy/commission/scenarios" },
      { id: "comm-calculator", label: "Calculator", path: "/knowledge/commercial-policy/commission/calculator" },
      { id: "comm-faq", label: "FAQ", path: "/knowledge/commercial-policy/commission/faq" },
    ],
  },

  /* 5. Customer Credit System */
  {
    id: "credit-system", label: "Customer Credit System", path: "/knowledge/commercial-policy/credit", section: "manual",
    children: [
      { id: "cred-overview", label: "Overview", path: "/knowledge/commercial-policy/credit" },
      { id: "cred-policy", label: "Credit Policy", path: "/knowledge/commercial-policy/credit/policy" },
      { id: "cred-levels", label: "Customer Levels", path: "/knowledge/commercial-policy/credit/customer-levels" },
      { id: "cred-matrix", label: "Credit Matrix", path: "/knowledge/commercial-policy/credit/matrix" },
      { id: "cred-flow", label: "Credit Flow", path: "/knowledge/commercial-policy/credit/flow" },
      { id: "cred-limits", label: "Credit Limits", path: "/knowledge/commercial-policy/credit/limits" },
      { id: "cred-days", label: "Credit Days", path: "/knowledge/commercial-policy/credit/days" },
      { id: "cred-overdue", label: "Overdue Policy", path: "/knowledge/commercial-policy/credit/overdue" },
      { id: "cred-upgrade", label: "Upgrade Logic", path: "/knowledge/commercial-policy/credit/upgrade" },
      { id: "cred-profiles", label: "Customer Profiles", path: "/knowledge/commercial-policy/credit/profiles" },
      { id: "cred-examples", label: "Examples", path: "/knowledge/commercial-policy/credit/examples" },
      { id: "cred-calculator", label: "Calculator", path: "/knowledge/commercial-policy/credit/calculator" },
      { id: "cred-faq", label: "FAQ", path: "/knowledge/commercial-policy/credit/faq" },
    ],
  },

  /* 6. Discount System */
  {
    id: "discount-system", label: "Discount System", path: "/knowledge/commercial-policy/discount", section: "manual",
    children: [
      { id: "disc-overview", label: "Overview", path: "/knowledge/commercial-policy/discount" },
      { id: "disc-types", label: "Discount Types", path: "/knowledge/commercial-policy/discount/types" },
      { id: "disc-approval", label: "Approval Rules", path: "/knowledge/commercial-policy/discount/approval" },
      { id: "disc-margin", label: "Margin Protection", path: "/knowledge/commercial-policy/discount/margin" },
      { id: "disc-flow", label: "Discount Flow", path: "/knowledge/commercial-policy/discount/flow" },
      { id: "disc-calculator", label: "Calculator", path: "/knowledge/commercial-policy/discount/calculator" },
      { id: "disc-examples", label: "Examples", path: "/knowledge/commercial-policy/discount/examples" },
      { id: "disc-special", label: "Special Pricing", path: "/knowledge/commercial-policy/discount/special-pricing" },
    ],
  },

  /* 7. Agent System */
  {
    id: "agent-system", label: "Agent System", path: "/knowledge/commercial-policy/agents", section: "manual",
    children: [
      { id: "agent-overview", label: "Overview", path: "/knowledge/commercial-policy/agents" },
      { id: "agent-partner", label: "Partner System", path: "/knowledge/commercial-policy/agents/partners" },
      { id: "agent-credit", label: "Annual Agent Credit", path: "/knowledge/commercial-policy/agents/credit" },
    ],
  },

  /* 8. Case Studies */
  { id: "case-studies", label: "Case Studies", path: "/knowledge/commercial-policy/case-studies", section: "manual" },

  /* 9. Commercial Flow */
  {
    id: "commercial-flow", label: "Commercial Flow", path: "/knowledge/commercial-policy/commercial-flow", section: "manual",
    children: [
      { id: "cf-overview", label: "Overview", path: "/knowledge/commercial-policy/commercial-flow" },
      { id: "cf-price", label: "Price Flow", path: "/knowledge/commercial-policy/commercial-flow/price" },
      { id: "cf-margin", label: "Margin & Discount", path: "/knowledge/commercial-policy/commercial-flow/margin" },
      { id: "cf-commission", label: "Commission Flow", path: "/knowledge/commercial-policy/commercial-flow/commission" },
      { id: "cf-credit", label: "Credit Check", path: "/knowledge/commercial-policy/commercial-flow/credit" },
      { id: "cf-approval", label: "Approval Flow", path: "/knowledge/commercial-policy/commercial-flow/approval" },
      { id: "cf-decision", label: "Decision Tree", path: "/knowledge/commercial-policy/commercial-flow/decision-tree" },
      { id: "cf-scenarios", label: "Scenarios", path: "/knowledge/commercial-policy/commercial-flow/scenarios" },
    ],
  },

  /* 10. Approval Authority */
  {
    id: "approval-system", label: "Approval Authority", path: "/knowledge/commercial-policy/approval", section: "manual",
    children: [
      { id: "appr-overview", label: "Overview", path: "/knowledge/commercial-policy/approval" },
      { id: "appr-levels", label: "Approval Levels", path: "/knowledge/commercial-policy/approval/levels" },
      { id: "appr-discount", label: "Discount Approval", path: "/knowledge/commercial-policy/approval/discount" },
      { id: "appr-special", label: "Special Pricing", path: "/knowledge/commercial-policy/approval/special-price" },
      { id: "appr-credit", label: "Credit Approval", path: "/knowledge/commercial-policy/approval/credit" },
      { id: "appr-commission", label: "Commission", path: "/knowledge/commercial-policy/approval/commission" },
      { id: "appr-diamond", label: "Diamond / Agent", path: "/knowledge/commercial-policy/approval/diamond" },
      { id: "appr-flows", label: "Flow Diagrams", path: "/knowledge/commercial-policy/approval/flows" },
    ],
  },

  /* ═══════════════════════════════════════
     TOOLS
     ═══════════════════════════════════════ */
  {
    id: "pricing-engine", label: "Pricing Engine", path: "/knowledge/commercial-policy/tools/pricing-engine", section: "tools",
    children: [
      { id: "pe-dashboard", label: "Dashboard", path: "/knowledge/commercial-policy/tools/pricing-engine" },
      { id: "pe-calculator", label: "Price Calculator", path: "/knowledge/commercial-policy/tools/pricing-engine/calculator" },
      { id: "pe-bands", label: "Markets & Bands", path: "/knowledge/commercial-policy/tools/pricing-engine/market-bands" },
      { id: "pe-landed", label: "Landed Cost", path: "/knowledge/commercial-policy/tools/pricing-engine/landed-cost" },
      { id: "pe-competitors", label: "Competitors", path: "/knowledge/commercial-policy/tools/pricing-engine/competitors" },
      { id: "pe-profit", label: "Profit Analysis", path: "/knowledge/commercial-policy/tools/pricing-engine/profit" },
      { id: "pe-scenarios", label: "Scenario Library", path: "/knowledge/commercial-policy/tools/pricing-engine/scenarios" },
    ],
  },

  { id: "quick-reference", label: "Quick Reference", path: "/knowledge/commercial-policy/quick-reference", section: "tools" },

  /* ═══════════════════════════════════════
     SYSTEM
     ═══════════════════════════════════════ */
  { id: "settings", label: "Settings", path: "/knowledge/commercial-policy/settings", section: "system" },
  { id: "access-control", label: "Access Control", path: "/knowledge/commercial-policy/access-control", section: "system" },
];

/** Flatten all nav items (including children) into a flat list */
export function flattenNav(items: PolicyNavItem[] = POLICY_NAV): PolicyNavItem[] {
  const flat: PolicyNavItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (item.children) flat.push(...flattenNav(item.children));
  }
  return flat;
}

/** Get next/prev page for bottom navigation */
export function getAdjacentPages(currentPath: string) {
  const flat = flattenNav();
  const idx = flat.findIndex((p) => p.path === currentPath);
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}
