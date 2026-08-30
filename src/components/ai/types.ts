/* ---------------------------------------------------------------------------
   components/ai/types — the shapes the Koleex AI client renders.

   Phase 2J, moved verbatim from KoleexAiApp.tsx. Types only, so this file has
   no runtime footprint at all: it compiles away entirely. That is what makes
   it the safe first cut of a 3 958-line component with no test harness.

   These mirror the server's AgentStep / ToolResult contract but are declared
   separately on purpose — the client must not import from `server-only`
   modules, and a standalone web or native client will consume this contract
   over HTTP without any server code in its bundle.
   --------------------------------------------------------------------------- */

export type MsgRole = "user" | "assistant" | "system";
export interface AgentStep {
  kind: "answer" | "tool-call" | "tool-result" | "recommendation" | "draft" | "denied" | "question";
  text?: string;
  tool?: string;
  payload?: unknown;
  permissionStatus?: "allowed" | "limited" | "denied" | "approval_required";
  sources?: string[];
  filteredFields?: string[];
}
export interface ChatMsg {
  id: string;
  role: MsgRole;
  content: string;
  created_at: string;
  /** Set only on assistant messages from the live agent turn —
   *  renders the tool-call / tool-result chips inline. Not persisted;
   *  audit table is the permanent record. */
  steps?: AgentStep[];
}
export interface ConversationRow {
  id: string;
  title: string;
  last_preview: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  /* Both default on the server and are absent from any sessionStorage cache
     written before this feature shipped — always read them defensively. */
  pinned?: boolean;
  project_id?: string | null;
}

/** Payload of the quotation draft card. Mirrors the tool result; `resource`
 *  (Phase 2I) is the client-neutral pointer any client can resolve, while
 *  `review_url` stays for the Hub web UI that reads it today. */
export interface QuotationDraftPayload {
  id: string;
  quote_no: string;
  customer_id: string;
  total: number;
  currency: string;
  status: "draft";
  line_count: number;
  approval_required: boolean;
  review_url: string;
}

export type MenuItem = {
  key: string;
  label?: string;
  icon?: React.ReactNode;
  danger?: boolean;
  selected?: boolean;
  separator?: boolean;
  onSelect?: () => void;
};
