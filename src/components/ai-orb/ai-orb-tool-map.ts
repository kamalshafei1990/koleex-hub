/* ---------------------------------------------------------------------------
   Real Koleex AI tool registry → orb activity. Inspected from
   src/lib/server/ai-agent/tools/*.ts — every tool the orchestrator can
   emit as a tool-call step is mapped here; unknown tools fall back to
   "executing-action". validate:ai-orb asserts full coverage.
   --------------------------------------------------------------------------- */

import type { AIOrbActivity } from "./ai-orb-types";

export const TOOL_ACTIVITY_MAP: Record<string, AIOrbActivity> = {
  /* permissions-tool.ts */
  getUserPermissions: "retrieving-data",
  /* inventory.ts */
  getInventoryStatus: "retrieving-data",
  /* customers.ts */
  getCustomerByName: "searching",
  getCustomerByCode: "retrieving-data",
  /* calendar.ts */
  listMyCalendar: "retrieving-data",
  createCalendarEvent: "creating-record",
  /* quotations.ts */
  getProductDetails: "reading",
  getPricingRules: "retrieving-data",
  calculateQuotationPricing: "analyzing",
  createQuotationDraft: "creating-record",
  /* projects.ts */
  listMyProjects: "retrieving-data",
  listProjectTasks: "retrieving-data",
  createProjectTask: "creating-record",
  addProjectMember: "updating-record",
  /* notes.ts */
  searchNotes: "searching",
  readNote: "retrieving-data",
  createNote: "creating-record",
  /* products.ts */
  searchProducts: "searching",
  countProducts: "analyzing",
  getCatalogStats: "analyzing",
  getProductByCode: "retrieving-data",
  /* planning.ts */
  listMyPlanning: "retrieving-data",
  createPlanningItem: "creating-record",
  /* todos.ts */
  listMyTodos: "retrieving-data",
  createTodo: "creating-record",
  updateTodo: "updating-record",
  completeTodo: "updating-record",
  reassignTodo: "updating-record",
  deleteTodo: "executing-action",
  /* projects.ts, planning.ts, calendar.ts — the edits */
  updateProjectTask: "updating-record",
  completeProjectTask: "updating-record",
  deleteProjectTask: "executing-action",
  updatePlanningItem: "updating-record",
  copyLastWeek: "creating-record",
  publishWeek: "updating-record",
  deletePlanningItem: "executing-action",
  updateCalendarEvent: "updating-record",
  deleteCalendarEvent: "executing-action",
  /* products.ts, product-price.ts, catalog */
  getProductFullDetails: "reading",
  getProductPrice: "retrieving-data",
  listCatalogFamilies: "retrieving-data",
  searchCatalog: "searching",
  auditProductData: "analyzing",
  /* knowledge, web, machines, trade terms — the lookups. THE WEB IS
     "browsing", its own activity, so the orb and the trace can tell it
     apart from a Hub search. The words for it are "Thinking" (owner,
     2026-09-26 — see components/ai/activity-copy.ts). */
  search_web: "browsing",
  /* Koleex AI opening a result page (core/read-page.ts): "Reading the details". */
  read_page: "reading",
  search_knowledge: "searching",
  searchMachineKnowledge: "searching",
  searchTradeTerms: "searching",
  suggest_team_knowledge: "creating-record",
  /* people */
  findTeamMember: "searching",
  /* the user's own memory */
  remember_about_user: "creating-record",
  forget_about_user: "executing-action",
  /* pictures */
  generate_image: "generating",
  /* a question back to the user is thinking, not doing */
  askUser: "reasoning",
};

export function toolActivity(tool: string | undefined | null): AIOrbActivity {
  if (!tool) return "none";
  return TOOL_ACTIVITY_MAP[tool] ?? "executing-action";
}
