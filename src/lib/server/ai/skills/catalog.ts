/* ---------------------------------------------------------------------------
   ai/skills/catalog — every tool's domain and risk class, DECLARED.

   Phase 6A. No `server-only`: it is a lookup table, and the suite imports it
   directly.

   WHAT WAS WRONG WITH WHAT WE HAD. Risk was not declared anywhere — it was
   INFERRED at the point of use, by regex over the tool's name:

       if (requiredAction === "delete" || /^delete/i.test(name)) "destructive"
       if (/quotation|invoice|price/i.test(name))                "financial"
       otherwise                                                "high_risk_write"

   That is better than nothing and it was right to start there, but it cannot
   express the matrix in §L. Under it `search_web` is "high_risk_write" rather
   than an external side effect, `remember_about_user` — reversible and scoped
   to the caller — is also "high_risk_write", and a future tool called
   `archiveCustomer` is "high_risk_write" while being destructive. The class is
   a property of what a tool DOES; a name is a coincidence.

   §L's rule 1 is "every tool declares its class in ToolDef — no default", and
   rule 5 is "a new tool without a class fails registry validation". This file
   is that declaration, and validate:ai-skills is that validation.

   ONE TABLE, NOT TWO. The plan names separate `domains.ts` and `risk.ts`.
   They are one table here, deliberately: two files listing the same 45 tools
   are two files that must be kept in sync by hand, and the failure mode is a
   tool present in one and missing from the other. That is the same reasoning
   that kept the Hub connector from growing a parallel method surface in 2G.

   THIS CHANGES NO BEHAVIOUR, and that is checked rather than asserted. The
   only consumer of the old inference is the `risk_class` COLUMN written to
   ai_pending_actions. consumePendingAction matches on tool name, args hash,
   tenant, account and conversation — never on risk class — so a more accurate
   value lands in the audit trail and nothing branches on it.
   --------------------------------------------------------------------------- */

/** §L's classes, verbatim. The two that no tool holds today are still listed:
 *  the matrix names them, future tools need them, and a class that has to be
 *  invented later is a class somebody will get wrong under pressure. */
export const RISK_CLASSES = [
  "read_only",
  "low_risk_write",
  "high_risk_write",
  "destructive",
  "external_side_effect",
  "financial",
  "security_sensitive",
] as const;

export type RiskClass = (typeof RISK_CLASSES)[number];

/** Domains mirror the Hub modules the tools read, plus three for the tools
 *  that belong to no module. Deliberately NOT invented taxonomy: a domain a
 *  user cannot point at in the product is a domain nobody can reason about. */
export const DOMAINS = [
  "customers",
  "products",
  "inventory",
  "quotations",
  "work",
  "knowledge",
  "web",
  "system",
] as const;

export type Domain = (typeof DOMAINS)[number];

export interface SkillMeta {
  domain: Domain;
  risk: RiskClass;
}

/* Every registered tool, classified from what its handler does — not from its
   name. Where a call was a judgement rather than a reading, the reason is on
   the line so it can be argued with instead of guessed at. */
export const SKILL_CATALOG: Readonly<Record<string, SkillMeta>> = Object.freeze({
  /* ── customers ─────────────────────────────────────────────────────── */
  getCustomerByName: { domain: "customers", risk: "read_only" },
  getCustomerByCode: { domain: "customers", risk: "read_only" },

  /* ── products & catalog ────────────────────────────────────────────── */
  getProductFullDetails: { domain: "products", risk: "read_only" },
  auditProductData: { domain: "products", risk: "read_only" },
  searchProducts: { domain: "products", risk: "read_only" },
  getProductByCode: { domain: "products", risk: "read_only" },
  getProductDetails: { domain: "products", risk: "read_only" },
  /* READ_ONLY for the same reason calculateQuotationPricing is: a pure
     computation over the policy tables, guarded on the OUTPUT by the pricing
     seal. It returns a selling price and never a cost. */
  getProductPrice: { domain: "products", risk: "read_only" },
  countProducts: { domain: "products", risk: "read_only" },
  getCatalogStats: { domain: "products", risk: "read_only" },
  searchCatalog: { domain: "products", risk: "read_only" },
  listCatalogFamilies: { domain: "products", risk: "read_only" },
  searchMachineKnowledge: { domain: "products", risk: "read_only" },

  /* ── inventory ─────────────────────────────────────────────────────── */
  getInventoryStatus: { domain: "inventory", risk: "read_only" },

  /* ── quotations ────────────────────────────────────────────────────── */
  getPricingRules: { domain: "quotations", risk: "read_only" },
  /* READ_ONLY, and the reasoning is worth stating because "it touches money"
     argues for FINANCIAL. §L's classes govern CONFIRMATION and AUDIT, and a
     pure computation needs neither — there is nothing to confirm and nothing
     to roll back. Its figures are guarded by sealPricingSafety, which is a
     deterministic check on the OUTPUT, not a ledger on the input. Calling it
     FINANCIAL would imply a ledger requirement it does not have and cannot
     satisfy. */
  calculateQuotationPricing: { domain: "quotations", risk: "read_only" },
  /* The one genuinely FINANCIAL tool today: it writes a draft that becomes a
     commercial document. §L requires ledger + deterministic verification, and
     both exist — the pending-action ledger and the quotation seal. */
  createQuotationDraft: { domain: "quotations", risk: "financial" },

  /* ── work management ───────────────────────────────────────────────── */
  listMyTodos: { domain: "work", risk: "read_only" },
  findTeamMember: { domain: "work", risk: "read_only" },
  createTodo: { domain: "work", risk: "high_risk_write" },
  completeTodo: { domain: "work", risk: "high_risk_write" },
  updateTodo: { domain: "work", risk: "high_risk_write" },
  reassignTodo: { domain: "work", risk: "high_risk_write" },
  deleteTodo: { domain: "work", risk: "destructive" },

  listMyProjects: { domain: "work", risk: "read_only" },
  listProjectTasks: { domain: "work", risk: "read_only" },
  createProjectTask: { domain: "work", risk: "high_risk_write" },
  completeProjectTask: { domain: "work", risk: "high_risk_write" },
  updateProjectTask: { domain: "work", risk: "high_risk_write" },
  deleteProjectTask: { domain: "work", risk: "destructive" },

  listMyPlanning: { domain: "work", risk: "read_only" },
  createPlanningItem: { domain: "work", risk: "high_risk_write" },
  updatePlanningItem: { domain: "work", risk: "high_risk_write" },
  deletePlanningItem: { domain: "work", risk: "destructive" },

  listMyCalendar: { domain: "work", risk: "read_only" },
  createCalendarEvent: { domain: "work", risk: "high_risk_write" },
  updateCalendarEvent: { domain: "work", risk: "high_risk_write" },
  deleteCalendarEvent: { domain: "work", risk: "destructive" },

  /* ── knowledge ─────────────────────────────────────────────────────── */
  search_knowledge: { domain: "knowledge", risk: "read_only" },
  searchTradeTerms: { domain: "knowledge", risk: "read_only" },
  /* LOW_RISK_WRITE rather than HIGH. It affects shared state in the sense
     that the row is not the caller's own, but it does NOT become knowledge:
     the handler writes a DRAFT into the super-admin approval queue, and no
     other user can see it until a human approves. Reversible, and gated by a
     person rather than by a model's confidence. */
  suggest_team_knowledge: { domain: "knowledge", risk: "low_risk_write" },
  /* Self-scoped and reversible — §L's own examples for this class. */
  remember_about_user: { domain: "knowledge", risk: "low_risk_write" },
  forget_about_user: { domain: "knowledge", risk: "low_risk_write" },

  /* ── the public internet ───────────────────────────────────────────── */
  /* The only tool that leaves our network. The inference this file replaces
     called it "high_risk_write", which is wrong in both halves: it writes
     nothing, and what makes it risky is EGRESS. Its guard is the egress
     scanner, not a ledger. */
  search_web: { domain: "web", risk: "external_side_effect" },
  /* Same class for the same reason, plus money: the prompt leaves the
     network and the vendor is paid per call. Its guards are the egress
     scanner and the per-account / per-tenant budget, not a ledger. */
  generate_image: { domain: "web", risk: "external_side_effect" },

  /* ── system ────────────────────────────────────────────────────────── */
  getUserPermissions: { domain: "system", risk: "read_only" },
  /* Changes no state anywhere: it returns a question for the UI to render as
     a card. It is in the registry because the model must be able to CHOOSE to
     ask rather than guess. */
  askUser: { domain: "system", risk: "read_only" },
});

/** Declared metadata for a tool, or null when it has none.
 *
 *  Null is a REAL answer here, not a fallback: §L rule 1 is "no default", and
 *  a lookup that invented `read_only` for an unknown tool would silently
 *  classify a new write tool as harmless. The registry validation turns null
 *  into a failure; nothing else is allowed to paper over it. */
export function skillMeta(toolName: string): SkillMeta | null {
  return SKILL_CATALOG[toolName] ?? null;
}

/** Tool names in one domain. */
export function toolsInDomain(domain: Domain): string[] {
  return Object.entries(SKILL_CATALOG)
    .filter(([, m]) => m.domain === domain)
    .map(([name]) => name);
}

/** Does this class require a confirmation ledger entry before it executes?
 *
 *  Straight from §L, and stated as a function so the matrix is machine-checked
 *  rather than prose someone has to remember. */
export function requiresLedger(risk: RiskClass): boolean {
  return (
    risk === "high_risk_write" ||
    risk === "destructive" ||
    risk === "financial" ||
    risk === "security_sensitive"
  );
}

/** Does this class change state at all? */
export function isWrite(risk: RiskClass): boolean {
  return risk !== "read_only" && risk !== "external_side_effect";
}
