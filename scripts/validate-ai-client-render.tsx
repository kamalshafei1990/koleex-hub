/* ---------------------------------------------------------------------------
   validate:ai-client-render — the client test harness (finding N9).

   Every other suite in this repo is server-side. That left the AI client — a
   3 958-line component before Phase 2J — gated only by `tsc`, `eslint` and the
   build, which catch a wrong prop type or a missing import but not a dropped
   class name, a reordered sibling, or a changed default. Phase 2J stopped
   early for exactly that reason and recorded it as N9.

   This is that harness, and it needs NO new dependency: react-dom/server is
   already in the tree because Next uses it, and the repo's convention is
   already tsx scripts run under `tsx`. So a component is rendered to HTML and
   asserted on — the same house style as the other eighty validators, applied
   to the client for the first time.

   What this can and cannot do, stated plainly:
     · CAN — assert text, links, classes, and which branch of a conditional
       rendered. That covers the regressions a refactor actually causes.
     · CANNOT — run effects, exercise event handlers, or measure layout.
       renderToStaticMarkup produces the first paint, not a live component.
   It is not a substitute for a browser test. It is the difference between
   "it compiles" and "it renders what it rendered before".
   --------------------------------------------------------------------------- */

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import DraftCard from "../src/components/ai/DraftCard";
import WelcomeCard from "../src/components/ai/WelcomeCard";
import ProjectDialog from "../src/components/ai/ProjectDialog";
import { COPY } from "../src/components/ai/copy";
import type { QuotationDraftPayload } from "../src/components/ai/types";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}
const html = (el: ReactElement) => renderToStaticMarkup(el);
/* Text as a reader sees it — tags stripped, entities for the few that matter. */
const text = (h: string) =>
  h.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const draft = (over: Partial<QuotationDraftPayload> = {}): QuotationDraftPayload => ({
  id: "11111111-1111-4111-8111-111111111111",
  quote_no: "Q-260830-001",
  customer_id: "22222222-2222-4222-8222-222222222222",
  total: 12400,
  currency: "USD",
  status: "draft",
  line_count: 2,
  approval_required: false,
  review_url: "/quotations/11111111-1111-4111-8111-111111111111",
  resource: { kind: "quotation", id: "11111111-1111-4111-8111-111111111111" },
  ...over,
});

console.log("\n── 1. The draft card shows the quotation, and only the quotation ──");
{
  const h = html(<DraftCard payload={draft()} />);
  const t = text(h);
  check("the quote number is shown", t.includes("Q-260830-001"));
  check("the total is formatted with two decimals", t.includes("12,400.00"));
  check("the currency is shown", t.includes("USD"));
  check("the line count is pluralised", t.includes("2 lines"));
  check("a single line is NOT pluralised", text(html(<DraftCard payload={draft({ line_count: 1 })} />)).includes("1 line "));
  check("the review link points at the record", h.includes('href="/quotations/11111111-1111-4111-8111-111111111111"'));
}

console.log("\n── 2. The card never surfaces the cost side ──");
{
  /* The component's own comment says cost and margin never reach the client.
     A comment is not a guarantee; this is. Rendered with those fields present
     on the payload anyway, because the real risk is someone later spreading
     the whole tool payload into the card. */
  const hostile = { ...draft(), cost: 8000, margin_percent: 35, unit_cost: 4000, supplier: "Some Supplier Ltd" } as unknown as QuotationDraftPayload;
  const h = html(<DraftCard payload={hostile} />);
  check("a cost value on the payload is not rendered", !h.includes("8,000") && !h.includes("8000"));
  check("a margin value on the payload is not rendered", !h.includes("35%") && !text(h).includes("margin"));
  check("a supplier name on the payload is not rendered", !h.includes("Some Supplier Ltd"));
  check("the customer id is not printed to the user", !text(h).includes("22222222"));
}

console.log("\n── 3. Approval state changes what the user is told ──");
{
  const plain = html(<DraftCard payload={draft({ approval_required: false })} />);
  const needs = html(<DraftCard payload={draft({ approval_required: true })} />);
  check("a plain draft is labelled 'Draft'", text(plain).includes("Draft") && !text(plain).includes("needs approval"));
  check("a draft needing approval says so", text(needs).includes("needs approval"));
  check("and is styled differently, not only worded differently", plain !== needs && needs.includes("amber"));
}

console.log("\n── 4. The welcome card renders the localised copy it is given ──");
{
  for (const lang of ["en", "zh", "ar"] as const) {
    const t = text(html(<WelcomeCard copy={COPY[lang]} onPick={() => {}} firstName="Mona" />));
    check(`${lang}: the suggested prompts are rendered`, COPY[lang].prompts.every((pr) => t.includes(pr.slice(0, 20))));
  }
  check("the person's name is used", text(html(<WelcomeCard copy={COPY.en} onPick={() => {}} firstName="Mona" />)).includes("Mona"));
  check(
    "an empty name does not render a dangling greeting fragment",
    !text(html(<WelcomeCard copy={COPY.en} onPick={() => {}} firstName="" />)).includes("  "),
  );
}

console.log("\n── 5. The project dialog knows create from edit ──");
{
  const base = { name: "", icon: "folder", color: "blue" } as never;
  const create = html(
    <ProjectDialog draft={{ ...(base as object), id: null } as never} copy={COPY.en} saving={false} onChange={() => {}} onSave={() => {}} onClose={() => {}} />,
  );
  const edit = html(
    <ProjectDialog draft={{ ...(base as object), id: "p1", name: "China sourcing" } as never} copy={COPY.en} saving={false} onChange={() => {}} onSave={() => {}} onClose={() => {}} />,
  );
  check("create and edit are not the same dialog", create !== edit);
  check("the edit dialog shows the existing name", edit.includes("China sourcing"));
  check("the create dialog does not", !create.includes("China sourcing"));
  check("the name field is length-capped in the markup, not only in the handler", /maxlength="\d+"/i.test(create));
  /* The name must be NON-EMPTY for this case to mean anything: with an empty
     name the confirm control is already disabled, so `saving` changes no
     markup and the assertion passes or fails for the wrong reason. Caught by
     writing the test and watching it fail against correct code. */
  const named = { ...(base as object), id: null, name: "China sourcing" } as never;
  const ready = html(
    <ProjectDialog draft={named} copy={COPY.en} saving={false} onChange={() => {}} onSave={() => {}} onClose={() => {}} />,
  );
  const saving = html(
    <ProjectDialog draft={named} copy={COPY.en} saving onChange={() => {}} onSave={() => {}} onClose={() => {}} />,
  );
  check("with a name typed, the confirm control is enabled", !/disabled=""/.test(ready));
  check("the saving state disables it, so a double submit is impossible", /disabled=""/.test(saving));
  check("an empty name also disables it", /disabled=""/.test(create));
}

console.log("\n── 6. The client can read the client-neutral pointer (Phase 2I) ──");
{
  /* This section exists because the harness found the gap: 2I added `resource`
     to the SERVER result and to this file's header comment, but not to the
     client interface — so no client could read it. A comment claiming a field
     the type does not declare is worse than no comment. */
  const withRef = draft();
  check("the client type carries the resource pointer", withRef.resource?.kind === "quotation");
  const legacy = { ...draft() } as QuotationDraftPayload;
  delete (legacy as { resource?: unknown }).resource;
  check(
    "a conversation persisted BEFORE 2I still renders — resource is optional, not required",
    text(html(<DraftCard payload={legacy} />)).includes("Q-260830-001"),
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(
  "Rendered markup, not source text. Effects and event handlers are out of scope — this is first paint, not a browser.",
);
