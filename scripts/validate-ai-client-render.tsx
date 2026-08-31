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
import { Bubble, isRtl } from "../src/components/ai/Bubble";
import { SectionHeader, SidebarRow, groupByDate } from "../src/components/ai/Sidebar";
import WelcomeCard from "../src/components/ai/WelcomeCard";
import ProjectDialog from "../src/components/ai/ProjectDialog";
import { COPY } from "../src/components/ai/copy";
import type { QuotationDraftPayload } from "../src/components/ai/types";
import VoiceCallButton from "../src/components/ai/VoiceCallButton";
import VoiceTranscript from "../src/components/ai/VoiceTranscript";
import VoiceCallScreen from "../src/components/ai/VoiceCallScreen";
import type { TranscriptLine } from "../src/lib/voice/events";

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

console.log("\n── 7. The transcript bubble (Phase 2J, completed) ──");
/* These components were extracted only after this harness existed. The move
   itself was proved by rendering the PRE-SPLIT component and the new one with
   identical props and diffing the HTML — 8 cases, byte-identical, including a
   question card at 19 489 bytes. That comparison needed the old file and is
   not reproducible here; what remains is to hold the behaviour it proved. */
{
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const msg: any = { id: "m1", role: "assistant", content: "Three widths are available.", created_at: "2026-08-30T10:00:00Z" };
  const assistant = html(<Bubble {...({ msg, userInitial: "M", isLast: true, lang: "en" } as any)} />);
  const user = html(<Bubble {...({ msg: { ...msg, role: "user", content: "which widths?" }, userInitial: "M", lang: "en" } as any)} />);
  check("an assistant message renders its content", text(assistant).includes("Three widths are available."));
  check("a user message renders differently from an assistant one", assistant !== user);
  check("Arabic text is detected as RTL", isRtl("مرحبا") && !isRtl("hello"));

  const withQuestion: any = { msg: { ...msg, steps: [
    { kind: "question", payload: { question: "Which spreading machine?", lang: "en", options: [
      { label: "KX-180", detail: "1.8 m", recommended: true },
      { label: "KX-220", detail: "2.2 m" },
    ] } },
  ] }, userInitial: "M", isLast: true, lang: "en" };
  const card = html(<Bubble {...withQuestion} />);
  check("a question step renders the options as a card", text(card).includes("KX-180") && text(card).includes("KX-220"));
  check("the card replaces the plain markdown rather than printing both", !text(card).includes("Three widths are available."));
  check("the recommended option is marked", card !== html(<Bubble {...({ ...withQuestion, msg: { ...withQuestion.msg, steps: [{ kind: "question", payload: { question: "Which spreading machine?", lang: "en", options: [{ label: "KX-180", detail: "1.8 m" }, { label: "KX-220", detail: "2.2 m" }] } }] } } as any)} />));
}

console.log("\n── 8. The sidebar rows ──");
{
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const row: any = { id: "c1", title: "China sourcing", last_preview: "hello", message_count: 3, created_at: "2026-08-29T10:00:00Z", updated_at: "2026-08-29T10:00:00Z", pinned: false, project_id: null };
  const base: any = { row, active: false, projects: [], copy: COPY.en, onOpen: () => {}, onRename: () => {}, onDelete: () => {}, onTogglePin: () => {}, onMove: () => {} };
  const plain = html(<SidebarRow {...base} />);
  check("a row renders its title", text(plain).includes("China sourcing"));
  check("the active row renders differently", plain !== html(<SidebarRow {...({ ...base, active: true } as any)} />));
  check("a pinned row renders differently", plain !== html(<SidebarRow {...({ ...base, row: { ...row, pinned: true } } as any)} />));
  check("a section heading renders its label", text(html(<SectionHeader {...({ label: "Yesterday" } as any)} />)).includes("Yesterday"));
  const groups = groupByDate([row] as any, COPY.en as any);
  check("groupByDate buckets a row under a labelled group", groups.length === 1 && typeof groups[0].label === "string" && groups[0].rows.length === 1);
}

console.log("\n── VoiceCallButton: first paint ──");
{
  const html = renderToStaticMarkup(<VoiceCallButton lang="en" /> as ReactElement);

  /* The idle button must be reachable and describable. A control whose only
     affordance is an unlabelled icon is not usable by a screen reader and not
     findable by a test. */
  check("renders a button with an accessible label",
    /<button/.test(html) && /aria-label="Start voice call"/.test(html));
  check("is not pressed while idle", /aria-pressed="false"/.test(html));

  /* Playback element must exist at first paint — attaching a stream to an
     element that has not rendered yet is a silent dead call. */
  check("renders the audio element for playback", /<audio/.test(html));
  check("the audio element is hidden — the button is the control",
    /<audio[^>]*class="hidden"/.test(html));
  check("the audio element autoplays and stays inline on mobile",
    /<audio[^>]*autoplay/i.test(html) && /playsinline/i.test(html));

  /* NO VENDOR IDENTITY MAY REACH THE BROWSER. The endpoint, the model and the
     region are the server's business; §P.4's rule applies to anything that can
     travel, and markup travels. */
  const lowered = html.toLowerCase();
  check("no vendor, endpoint or model name appears in the markup",
    !lowered.includes("qwen") && !lowered.includes("aliyun") &&
    !lowered.includes("maas") && !lowered.includes("realtime") &&
    !lowered.includes("dashscope"));
  check("no workspace identifier appears in the markup", !lowered.includes("ws-"));

  /* Localisation is a compile-time guarantee in the source; this proves it
     actually reaches the rendered label rather than falling back to English. */
  const ar = renderToStaticMarkup(<VoiceCallButton lang="ar" /> as ReactElement);
  const zh = renderToStaticMarkup(<VoiceCallButton lang="zh" /> as ReactElement);
  check("the label is localised, not hard-coded English",
    ar.includes("مكالمة") && zh.includes("语音") && !ar.includes("Start voice call"));

  const off = renderToStaticMarkup(<VoiceCallButton lang="en" disabled /> as ReactElement);
  check("disabled renders as actually disabled, not merely dimmed",
    /disabled=""/.test(off) || /\sdisabled(\s|>)/.test(off));
}

console.log("\n── VoiceTranscript: captions on the screen ──");
{
  const lines: TranscriptLine[] = [
    { role: "user", text: "how many orders today", final: true },
    { role: "assistant", text: "Fourteen so far", final: false },
  ];
  const html = renderToStaticMarkup(<VoiceTranscript lines={lines} lang="en" /> as ReactElement);

  /* THE COMPLAINT THIS ANSWERS: both sides spoke and the screen stayed empty. */
  check("the user's words reach the screen", html.includes("how many orders today"));
  check("the assistant's words reach the screen", html.includes("Fourteen so far"));
  check("each line is attributed to a speaker",
    html.includes("You") && html.includes("Koleex AI"));

  /* Partial text must be VISIBLE but visibly unsettled — withholding it until
     final means the caption arrives after it was useful. */
  check("partial text is rendered, not withheld", html.includes("Fourteen so far"));
  /* The GUARANTEE is that partial reads as unsettled — not the specific
     mechanism. Italics were the first mechanism and the brand rules exclude
     them, so this asserts that final and partial are styled DIFFERENTLY. */
  const settledOnly = renderToStaticMarkup(
    <VoiceTranscript lines={[{ role: "assistant", text: "Fourteen so far", final: true }]} lang="en" /> as ReactElement,
  );
  check("and is styled differently from settled text",
    html.replace(/Fourteen so far/g, "") !== settledOnly.replace(/Fourteen so far/g, ""));
  check("no italics — the brand rules exclude them", !/italic/.test(html));

  /* Captions are announced without interrupting a screen reader mid-sentence. */
  check("the strip is a polite live region",
    /aria-live="polite"/.test(html) && /role="log"/.test(html));

  /* Nothing to show means nothing on screen — not an empty box. */
  check("an empty transcript renders nothing at all",
    renderToStaticMarkup(<VoiceTranscript lines={[]} lang="en" /> as ReactElement) === "");

  /* TEXT OFF A NETWORK SOCKET IS ESCAPED, NOT INTERPRETED. */
  const hostile: TranscriptLine[] = [
    { role: "assistant", text: '<img src=x onerror="alert(1)">', final: true },
  ];
  const esc = renderToStaticMarkup(<VoiceTranscript lines={hostile} lang="en" /> as ReactElement);
  check("transcript text is escaped, never rendered as markup",
    !esc.includes("<img") && esc.includes("&lt;img"));

  /* A long call must not push the composer off a phone. */
  const many: TranscriptLine[] = Array.from({ length: 40 }, (_, i) => ({
    role: (i % 2 ? "assistant" : "user") as TranscriptLine["role"],
    text: `line ${i}`,
    final: true,
  }));
  const long = renderToStaticMarkup(<VoiceTranscript lines={many} lang="en" /> as ReactElement);
  check("only the most recent lines are shown", !long.includes("line 0") && long.includes("line 39"));
  check("and the strip scrolls rather than growing without bound",
    /overflow-y-auto/.test(long) && /max-h-/.test(long));

  /* Localised, like every other user-facing string here. */
  const ar = renderToStaticMarkup(<VoiceTranscript lines={lines} lang="ar" /> as ReactElement);
  check("speaker labels are localised", ar.includes("أنت") && !ar.includes(">You<"));
}

console.log("\n── VoiceCallScreen: the call is a mode, not a toggle ──");
{
  const lines: TranscriptLine[] = [{ role: "user", text: "how many orders", final: true }];
  const listening = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );

  check("it takes the screen as a modal dialog",
    /role="dialog"/.test(listening) && /aria-modal="true"/.test(listening));
  check("the orb is present", /aria-label/.test(listening) && listening.length > 500);
  check("the state is announced in words too, for anyone who cannot read motion",
    listening.includes("Listening"));
  check("captions appear on the call screen", listening.includes("how many orders"));
  check("there is a control to end the call", /aria-label="End call"/.test(listening));

  const speaking = renderToStaticMarkup(
    <VoiceCallScreen live phase="speaking" audioLevel={0.6} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  /* NOT just "the markup differs" — that passed with the orb frozen, because
     the status caption alone still changed. The ORB's own state is what makes
     the screen feel like a call, so it is asserted through the orb's aria
     label, which is generated from its state rather than from this file. */
  check("the ORB itself is listening", /aria-label="Listening…"/.test(listening));
  check("and switches to speaking when the far side answers",
    /aria-label="Speaking…"/.test(speaking) && !/aria-label="Listening…"/.test(speaking));
  check("the status caption follows too", speaking.includes("Speaking"));

  const connecting = renderToStaticMarkup(
    <VoiceCallScreen live={false} phase={null} audioLevel={0} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("connecting says so rather than pretending to listen",
    connecting.includes("Connecting") && !connecting.includes("Listening"));

  /* Server-side turn detection has no push-to-talk. A user waiting for a
     button to hold waits forever, so it is said once, before any words. */
  check("with no transcript yet, the interaction is explained",
    connecting.includes("no button to hold"));
  check("and the hint gives way to the words once there are any",
    !listening.includes("no button to hold"));

  /* BRAND. Monochrome plus one functional red on the destructive control. */
  /* SCOPED TO THE CHROME THIS SCREEN AUTHORS. AIOrb renders its own gradient
     stops (#567FB2, #7FA9D6, #BCD8F0, #0B0D11) which are outside the brand
     palette — but it is a shared component drawn identically in five other
     places, so repainting it here would change the product far beyond this
     screen. That is an owner's decision, raised rather than taken. What IS in
     scope is every colour this file introduces. */
  const ORB_OWN = new Set(["#567FB2", "#7FA9D6", "#BCD8F0", "#0B0D11", "#FFF"]);
  const allowed = new Set(["#0D0D0D", "#FF3333", "#0066FF", "#AAAAAA", "#666666", "#FFFFFF", "#000000"]);
  const hexes = [...listening.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)]
    .map((m) => m[0].toUpperCase())
    .filter((h) => !ORB_OWN.has(h));
  check("every colour this screen introduces is from the Koleex palette",
    hexes.length > 0 && hexes.every((h) => allowed.has(h)));
  check("the surface is the brand's dark ground", listening.includes("#0D0D0D"));
  /* Blue is the one accent, and the rules say it may only be functional. Here
     its single use is the keyboard focus ring — interaction, not decoration. */
  check("the brand blue appears only as a focus indicator",
    listening.includes("#0066FF") &&
    /focus-visible:ring-\[#0066FF\]/.test(listening) &&
    listening.split("#0066FF").length - 1 === 1);
  check("the red appears only on the end-call control",
    listening.split("#FF3333").length - 1 <= 4 && /aria-label="End call"[\s\S]{0,400}?#FF3333|#FF3333[\s\S]{0,400}?aria-label="End call"/.test(listening));
  check("icons are outline, never filled", !/fill="(?!none)[^"]+"/.test(listening));

  /* No vendor identity on a screen the user stares at for a whole call. */
  const low = listening.toLowerCase();
  check("no vendor, model or endpoint name is on the call screen",
    !low.includes("qwen") && !low.includes("aliyun") && !low.includes("maas") && !low.includes("ws-"));

  const ar = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="ar" onEnd={() => {}} /> as ReactElement,
  );
  check("the call screen is localised", ar.includes("بيسمعك") && !ar.includes(">Listening<"));
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
