/* ---------------------------------------------------------------------------
   ai/core/resource-ref — a client-neutral pointer to a Koleex record.

   Phase 2I, finding N6. A tool that has just created something wants to tell
   the client "here it is". Until now the only way it did that was a
   Hub-relative path (`/quotations/<id>`), which is meaningful in the Hub web
   app and meaningless everywhere else: on an iPhone `/quotations/abc` is not
   a destination, it is a string.

   A ResourceRef says WHAT the thing is, not WHERE to find it. Each client
   resolves it into its own navigation — the Hub into a route, a native app
   into a screen, a standalone web client into a URL. The AI core never has to
   know which client is listening, which is the whole point of the standalone
   work in Amendment 1.

   Deliberately additive. The Hub UI reads `review_url` today and keeps
   reading it; removing that field to "clean up" would break a working Hub
   feature for no benefit. New clients read `resource`. The two coexist until
   there is a reason for them not to.

   NOT to be used for the Hub's own inbox and push-notification links. Those
   are Hub features consumed by the Hub, they are correctly Hub-relative, and
   they never travel in a ToolResult. Verified before this file was written:
   every `/todo?task=` link in the tool layer is an `inbox_messages` row or a
   push payload, not something the AI hands back.
   --------------------------------------------------------------------------- */

/** The record kinds a tool can currently point at. Deliberately a closed
 *  union: a client that receives an unknown kind cannot navigate anywhere
 *  useful, so adding one is a decision, not an accident. */
export type ResourceKind =
  | "quotation"
  | "customer"
  | "product"
  | "todo"
  | "project"
  | "planning_item"
  | "calendar_event";

export interface ResourceRef {
  kind: ResourceKind;
  id: string;
}

export function resourceRef(kind: ResourceKind, id: string): ResourceRef {
  return { kind, id };
}
