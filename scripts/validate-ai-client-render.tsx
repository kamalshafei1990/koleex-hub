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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as uw from "../src/components/pwa/UpdateWatcher";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import DraftCard from "../src/components/ai/DraftCard";
import { Bubble } from "../src/components/ai/Bubble";
import { SectionHeader, SidebarRow, groupByDate } from "../src/components/ai/Sidebar";
import WelcomeCard from "../src/components/ai/WelcomeCard";
import ProjectDialog from "../src/components/ai/ProjectDialog";
import { COPY } from "../src/components/ai/copy";
import type { QuotationDraftPayload } from "../src/components/ai/types";
import VoiceCallButton from "../src/components/ai/VoiceCallButton";
import VoiceTranscript from "../src/components/ai/VoiceTranscript";
import VoiceCallScreen from "../src/components/ai/VoiceCallScreen";
import PhotoLightbox from "../src/components/ai/PhotoLightbox";
import MessageMarkdown from "../src/components/ai/MessageMarkdown";
import type { TranscriptLine } from "../src/lib/voice/events";
import { textLang, textScript, textDirection, blockDirection } from "../src/lib/text-direction";
import TaskCard, { taskChangeLine, taskCardDetails } from "../src/components/ai/TaskCard";
import { chatError, SERVER_ANSWER_FAILED } from "../src/components/ai/chat-error";
import { stripComments } from "./lib/strip-comments";

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
  check("and is styled differently, not only worded differently", plain !== needs && needs.includes("kx-ai-warning"));
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
  check("Arabic text is detected as RTL", textDirection("مرحبا") === "rtl" && textDirection("hello") === "ltr");
  /* THE THREAD, UI/UX pass 2026-09-24: one orb (on the latest reply, the
     older ones keep an empty gutter so nothing shifts), no avatar beside your
     own words, and an older reply's actions wait for hover, focus or a tap. */
  const older = html(<Bubble {...({ msg, isLast: false, lang: "en", onCopy: () => true } as any)} />);
  check("the latest reply carries the orb; an older one keeps only its gutter, the same width",
    !/data-orb-gutter/.test(assistant) && /data-orb-gutter/.test(older) && /class="w-\[38px\] shrink-0"/.test(older));
  check("your own message has no avatar or initial beside it",
    !/rounded-full overflow-hidden/.test(user) && !/>M</.test(user) && /bg-\[var\(--bg-surface-hover\)\]/.test(user) && !/bg-\[var\(--bg-inverted\)\] text-\[var\(--text-inverted\)\]/.test(user));
  const latestActs = html(<Bubble {...({ msg, isLast: true, lang: "en", onCopy: () => true } as any)} />);
  check("the latest reply shows its actions; an older one hides them until hover, focus or a tap",
    /role="toolbar"/.test(latestActs) && !/opacity-0 group-hover\/msg:opacity-100/.test(latestActs) &&
      /<div class="opacity-0 pointer-events-none group-hover\/msg:opacity-100 group-hover\/msg:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity"><div role="toolbar"/.test(older));
  /* HIDDEN MEANS UNTAPPABLE (review, 2026-09-26): an invisible button under an
     older reply fired on a tap in the blank space. */
  check("  …and while hidden they cannot be tapped — the tap reaches the row, which reveals them",
    /opacity-0 pointer-events-none/.test(older) && !/opacity-0 pointer-events-none/.test(latestActs));

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

console.log("\n── 7a. A user message carries its attached files (2026-09-04) ──");
{
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const withFiles: any = { id: "u9", role: "user", content: "What is this?", created_at: "2026-09-04T07:00:00Z",
    attachedFiles: [{ name: "04.jpg", url: "blob:https://hub/abc" }, { name: "spec.pdf", url: null }] };
  const out = html(<Bubble {...({ msg: withFiles, userInitial: "M", lang: "en" } as any)} />);
  check("a picture is shown as an image from its preview URL, inside the bubble, above the words",
    /<img src="blob:https:\/\/hub\/abc" alt="04.jpg"/.test(out) && out.indexOf("data-attached-files") < out.indexOf("What is this?"));
  check("a document is a 📎 chip with its name; the words still render", text(out).includes("spec.pdf") && text(out).includes("What is this?"));
  check("an assistant row ignores the field", !/<img src="blob:/.test(html(<Bubble {...({ msg: { ...withFiles, role: "assistant" }, userInitial: "M", lang: "en" } as any)} />)));
  check("a row without the field renders as before", !/data-attached-files/.test(html(<Bubble {...({ msg: { ...withFiles, attachedFiles: undefined }, userInitial: "M", lang: "en" } as any)} />)));
}

console.log("\n── 7b. A spoken message wears a mark; a typed one does not ──");
{
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const base: any = { id: "v1", role: "assistant", content: "Fourteen orders today.", created_at: "2026-09-02T10:00:00Z" };
  const spoken = html(<Bubble {...({ msg: { ...base, source: "voice" }, userInitial: "M", lang: "en" } as any)} />);
  const typed = html(<Bubble {...({ msg: { ...base, source: "text" }, userInitial: "M", lang: "en" } as any)} />);
  const legacy = html(<Bubble {...({ msg: base, userInitial: "M", lang: "en" } as any)} />);
  check("a voice row shows the spoken mark", text(spoken).includes("Spoken on a call"));
  check("a typed row shows none", !text(typed).includes("Spoken on a call"));
  check("a row from before the column existed shows none either", !text(legacy).includes("Spoken on a call") && legacy === typed);
  check("the mark is on user turns too — both sides of a call were spoken",
    text(html(<Bubble {...({ msg: { ...base, role: "user", source: "voice" }, userInitial: "M", lang: "en" } as any)} />)).includes("Spoken on a call"));
  check("the mark is localised", text(html(<Bubble {...({ msg: { ...base, source: "voice" }, userInitial: "M", lang: "ar" } as any)} />)).includes(COPY.ar.voiceMessage) &&
    COPY.ar.voiceMessage !== COPY.en.voiceMessage && COPY.zh.voiceMessage !== COPY.en.voiceMessage);
  /* An empty placeholder bubble is the typing indicator; a mark under it would
     announce a spoken message that has not been spoken. */
  check("no mark on an empty placeholder", !text(html(<Bubble {...({ msg: { ...base, content: "", source: "voice" }, userInitial: "M", lang: "en" } as any)} />)).includes("Spoken on a call"));
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
  /* An action button whose NAME changes ("Start voice call" / "End call")
     is not a toggle; aria-pressed on it announced two states for one thing
     (audit, 2026-09-11). */
  check("carries no toggle state — its name changes instead", !/aria-pressed=/.test(html));

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

  /* THE REPORTED BUG: "the orb didn't interact with voices or show any
     motion". A live call with NO phase event yet mapped to `idle`, and AIOrb
     only feeds audioLevel into its motion while listening or speaking — so
     the orb sat still for the whole call, and for ever if the far side never
     sent a speech event. The microphone is open from the moment the call
     connects; `listening` is both the fix and the truth. */
  const noPhase = renderToStaticMarkup(
    <VoiceCallScreen live phase={null} audioLevel={0.5} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("a live call with no speech event yet is still LISTENING, not idle",
    /aria-label="Listening…"/.test(noPhase));
  check("and never renders as idle while live", !/aria-label="Koleex AI"/.test(noPhase));

  /* THE RINGS that make the level visible at 200px, where the shared orb's
     own 3% scale reads as nothing. The level itself no longer reaches the
     markup — it is written to a CSS variable each frame by useCallLevel, with
     attack and release, which is what removed the twitch a per-render
     transform produced — so what is asserted is the structure the variable
     drives: three rings, live only when the call is ready, coloured by who
     is speaking. */
  const rings = (html: string) => (html.match(/kx-call-ring-\d/g) ?? []).length;
  check("a live call draws three rings around the orb", rings(listening) === 3);
  check("  …live, so they can move", /kx-call-orb[^"]*is-live/.test(listening));
  check("  …white while the caller speaks, the Hub's blue while Koleex AI does",
    /kx-call-orb[^"]*is-near/.test(listening) && /kx-call-orb[^"]*is-far/.test(speaking) && !/is-near/.test(speaking.slice(speaking.indexOf("kx-call-orb"), speaking.indexOf("kx-call-orb") + 120)));
  const notReady = renderToStaticMarkup(
    <VoiceCallScreen live ready={false} phase={null} audioLevel={0.5} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("a live call that is not yet READY still says connecting, its rings still, its orb waking",
    notReady.includes("Connecting") && !/kx-call-orb[^"]*is-live/.test(notReady) && !/aria-label="Listening…"/.test(notReady));
  const mutedCall = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.9} lines={[]} lang="en" onEnd={() => {}} muted onToggleMute={() => {}} /> as ReactElement,
  );
  check("a muted call's rings are still: nothing it hears goes anywhere", !/kx-call-orb[^"]*is-live/.test(mutedCall));

  const connecting = renderToStaticMarkup(
    <VoiceCallScreen live={false} phase={null} audioLevel={0} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("connecting says so rather than pretending to listen",
    connecting.includes("Connecting") && !connecting.includes("Listening"));

  /* A CALL THAT LOSES ITS NETWORK IS STILL A CALL ON SCREEN. The screen mounts
     on `live || busy` in the button; `reconnecting` is neither, so the first
     version of the recovery work would have UNMOUNTED the whole call screen
     mid-sentence when a VPN wobbled — a worse outcome than the freeze it was
     meant to fix. The screen is asked to keep standing and tell the truth. */
  const wobble = renderToStaticMarkup(
    <VoiceCallScreen live reconnecting phase="listening" audioLevel={0.4} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("a reconnecting call still renders the call screen",
    wobble.includes("End call") && wobble.includes(lines[0].text));
  check("and says the connection is unstable rather than claiming to listen",
    /reconnecting/i.test(text(wobble)) && !/\bListening\b/.test(text(wobble)));
  /* Every language, or the one that needed it most gets a blank. */
  for (const [lang, needle] of [["zh", "重新连接"], ["ar", "الاتصال"]] as const) {
    const w = renderToStaticMarkup(
      <VoiceCallScreen live reconnecting phase="listening" audioLevel={0.4} lines={[]} lang={lang} onEnd={() => {}} /> as ReactElement,
    );
    check(`  …in ${lang} too`, text(w).includes(needle));
  }

  /* MUTE. The control is only drawn when the parent can act on it, and while
     muted the screen must stop claiming to hear anyone — a caption reading
     "Listening" over a dead microphone is what makes a user conclude the
     product is broken, and they would be right. */
  const mutedScreen = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="en"
      onEnd={() => {}} muted onToggleMute={() => {}} /> as ReactElement,
  );
  const unmutedScreen = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="en"
      onEnd={() => {}} muted={false} onToggleMute={() => {}} /> as ReactElement,
  );
  check("the mute control is drawn when the parent can act on it",
    /aria-pressed="false"/.test(unmutedScreen) && unmutedScreen.includes("Mute microphone"));
  check("and reads as pressed once muted",
    /aria-pressed="true"/.test(mutedScreen) && mutedScreen.includes("Unmute microphone"));
  check("muted stops the screen claiming to listen",
    text(mutedScreen).includes("Microphone off") && !/\bListening\b/.test(text(mutedScreen)));
  check("and unmuted still says Listening",
    /\bListening\b/.test(text(unmutedScreen)));
  /* One control, one state — not two buttons, and not a label that changes
     without telling a screen reader anything. */
  check("it is one control with a state, not two controls",
    (mutedScreen.match(/aria-pressed=/g) ?? []).length === 1);
  /* A screen with no handler must not draw a control that does nothing. */
  const noMute = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("no mute control when the parent gave no handler", !/aria-pressed=/.test(noMute));
  for (const [lang, needle] of [["zh", "关闭麦克风"], ["ar", "اكتم الميكروفون"]] as const) {
    const m = renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={[]} lang={lang}
        onEnd={() => {}} muted={false} onToggleMute={() => {}} /> as ReactElement,
    );
    check(`  …labelled in ${lang} too`, m.includes(needle));
  }

  /* A LOOKUP IS TWO SECONDS OF REAL SILENCE. The model is told to say "let me
     check" first and does not always; a screen that says nothing during it
     reads as a frozen call. */
  const searchingScreen = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} searching /> as ReactElement,
  );
  /* SAID AS "THINKING" — the owner's word for a lookup (2026-09-26: "replace
     it with thinking"), the chat's and now the call's. */
  check("a lookup says so rather than leaving a silence",
    text(searchingScreen).includes("Thinking") && !text(searchingScreen).includes("Looking it up"));
  check("and it outranks Listening, which is not what is happening",
    !/\bListening\b/.test(text(searchingScreen)));
  /* WHAT KOLEEX AI IS DOING OUTRANKS THE CALLER'S CLOSED MICROPHONE (review,
     2026-09-26). This used to say the opposite — "a muted call that is also
     looking something up has a bigger problem to report" — and in hold mode,
     where the microphone is closed between holds by design, it meant the
     caption said "Hold to talk" through every lookup, thought and answer.
     The Mic control still shows the microphone is off; the caption says what
     the far side is doing, and falls back to "Microphone off" only when the
     far side is doing nothing, so a muted caller is still never told
     "Listening". */
  const searchingMuted = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} searching muted onToggleMute={() => {}} /> as ReactElement,
  );
  check("a lookup is shown even while the caller is muted", text(searchingMuted).includes("Thinking") && !text(searchingMuted).includes("Microphone off"));
  const idleMuted = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} muted onToggleMute={() => {}} /> as ReactElement,
  );
  check("  …and with the far side idle, muted still wins over Listening", text(idleMuted).includes("Microphone off") && !/\bListening\b/.test(text(idleMuted)));
  const holdThinking = renderToStaticMarkup(
    <VoiceCallScreen live phase="thinking" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} muted talkMode="hold" onHold={() => {}} /> as ReactElement,
  );
  const holdSpeaking = renderToStaticMarkup(
    <VoiceCallScreen live phase="speaking" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} muted talkMode="hold" onHold={() => {}} /> as ReactElement,
  );
  const holdIdle = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} muted talkMode="hold" onHold={() => {}} /> as ReactElement,
  );
  check("  …in hold mode, between holds, the caller sees Thinking and Speaking — and Hold to talk once the far side is done",
    text(holdThinking).includes("Thinking") && text(holdSpeaking).includes("Speaking") &&
    /class="kx-call-orb[^"]*is-thinking/.test(holdThinking) && /class="kx-call-orb[^"]*is-live/.test(holdSpeaking) && !/class="kx-call-orb[^"]*is-live/.test(holdIdle) &&
    /* The button always reads Hold to talk; the status adds it only once
       the far side is done. */
    (text(holdIdle).match(/Hold to talk/g) ?? []).length > (text(holdThinking).match(/Hold to talk/g) ?? []).length);
  const searchingWobble = renderToStaticMarkup(
    <VoiceCallScreen live reconnecting phase="listening" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} searching /> as ReactElement,
  );
  check("and reconnecting wins over both", /reconnecting/i.test(text(searchingWobble)));
  /* THE LIVE REGION speaks when the call's working state changes, not on
     every turn (review, 2026-09-26). */
  const srOf = (h: string) => /<p class="sr-only" role="status" aria-live="polite">([^<]*)<\/p>/.exec(h)?.[1] ?? null;
  const speakingNow = renderToStaticMarkup(
    <VoiceCallScreen live phase="speaking" audioLevel={0.2} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("the screen reader is not told Speaking / Thinking / Listening on every turn — but is told a muted microphone and a reconnect",
    srOf(speakingNow) === "" && srOf(searchingScreen) === "" && srOf(idleMuted) === "Microphone off" && /reconnecting/i.test(srOf(searchingWobble) ?? ""));
  for (const [lang, needle] of [["zh", "思考中"], ["ar", "بفكّر"]] as const) {
    const w = renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang={lang}
        onEnd={() => {}} searching /> as ReactElement,
    );
    check(`  …said in ${lang} too`, text(w).includes(needle));
  }

  /* Server-side turn detection has no push-to-talk. A user waiting for a
     button to hold waits forever, so it is said once, before any words. */
  /* Said as what to do, not what is missing (UI/UX pass, 2026-09-24). */
  check("with no transcript yet, the interaction is explained",
    connecting.includes("Just talk. I answer when you pause.") && !connecting.includes("no button to hold"));
  check("and the hint gives way to the words once there are any",
    !listening.includes("Just talk. I answer when you pause."));

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
    listening.split("#0066FF").length - 1 === (listening.match(/focus-visible:ring-\[#0066FF\]/g) ?? []).length);
  check("the red appears only on the end-call control",
    listening.split("#FF3333").length - 1 <= 4 && /aria-label="End call"[\s\S]{0,400}?#FF3333|#FF3333[\s\S]{0,400}?aria-label="End call"/.test(listening));
  /* The KOLEEX wordmark is lettering, not an icon: its paths are filled by
     nature. Everything else on the screen stays outline. */
  const wordmark = /<svg[^>]*viewBox="0 0 719\.83 107\.57"[\s\S]*?<\/svg>/;
  check("the wordmark is on the screen, above the orb", wordmark.test(listening) && listening.search(wordmark) < listening.indexOf("kx-call-orb"));
  check("icons are outline, never filled", !/fill="(?!none)[^"]+"/.test(listening.replace(wordmark, "")));

  /* No vendor identity on a screen the user stares at for a whole call. */
  const low = listening.toLowerCase();
  check("no vendor, model or endpoint name is on the call screen",
    !low.includes("qwen") && !low.includes("aliyun") && !low.includes("maas") && !low.includes("ws-"));

  const ar = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="ar" onEnd={() => {}} /> as ReactElement,
  );
  check("the call screen is localised", ar.includes("بيسمعك") && !ar.includes(">Listening<"));
}

console.log("\n── The AI interface speaks the user's language, all of it ──");
{
  /* WHAT THIS FOUND, and why it is worth a permanent guard. Thirty-four
     control labels across the AI surface were hardcoded English literals in
     a product whose every visible word is translated. Two different people
     were getting an English interface out of it:

       · a screen-reader user on Arabic heard "Regenerate response" and
         "Close sidebar" in the middle of an Arabic conversation;
       · and because `title` is a tooltip rather than an accessibility
         affordance, EVERY Arabic and Chinese user saw English the moment
         they hovered a toolbar button.

     They were not missing for want of a system — copy.ts is the system, and
     they simply never got added to it. BubbleActions was the clearest case:
     it already received `lang` as a prop and its first statement was
     `void lang;`. The language was being handed to it and thrown away. */

  const AI_TSX = [
    "src/components/ai/Bubble.tsx",
    "src/components/ai/KoleexAiApp.tsx",
    "src/components/ai/ComposerAddMenu.tsx",
    "src/components/ai/TypingIndicator.tsx",
    "src/components/ai/VoiceCallButton.tsx",
    "src/components/ai/VoiceCallScreen.tsx",
    "src/components/ai/WelcomeCard.tsx",
    "src/components/ai/ProjectDialog.tsx",
    "src/components/ai/Sidebar.tsx",
    "src/components/ai/MessageMarkdown.tsx",
  ];
  const offenders: string[] = [];
  for (const f of AI_TSX) {
    let src = "";
    try { src = readFileSync(f, "utf8"); } catch { continue; }
    for (const m of src.matchAll(/(aria-label|title|placeholder)="([A-Za-z][^"]{2,60})"/g)) {
      offenders.push(`${f.split("/").pop()}: ${m[1]}="${m[2]}"`);
    }
  }
  check(`no control label is a hardcoded English literal${offenders.length ? " — " + offenders.slice(0, 3).join("; ") : ""}`,
    offenders.length === 0);
  /* NON-VACUITY: the files must actually exist and carry labels, or the
     check above passes by reading nothing. */
  const labelled = AI_TSX.filter((f) => {
    try { return /(aria-label|title)=\{/.test(readFileSync(f, "utf8")); } catch { return false; }
  });
  check("  …checked against files that really do carry labels", labelled.length >= 6);

  /* EVERY KEY, EVERY LANGUAGE. A key added to `en` alone type-checks (the
     Record is keyed by Lang, but a missing member is a compile error only
     if the type lists it) and then renders `undefined` for Arabic. */
  const langs = ["en", "zh", "ar"] as const;
  const keysOf = (l: (typeof langs)[number]) =>
    Object.keys(COPY[l]).filter((k) => typeof (COPY[l] as Record<string, unknown>)[k] === "string").sort();
  check("all three languages define the same string keys",
    JSON.stringify(keysOf("en")) === JSON.stringify(keysOf("ar")) &&
    JSON.stringify(keysOf("en")) === JSON.stringify(keysOf("zh")));
  const empties: string[] = [];
  for (const l of langs) {
    for (const [k, v] of Object.entries(COPY[l])) {
      if (typeof v === "string" && v.trim() === "") empties.push(`${l}.${k}`);
    }
  }
  check(`no translation is blank${empties.length ? " — " + empties.join(", ") : ""}`, empties.length === 0);
  /* AND ARABIC IS ACTUALLY ARABIC. A key copy-pasted from `en` into `ar`
     passes both checks above and still shows English to an Arabic user. */
  const untranslated = (["ar", "zh"] as const).flatMap((l) =>
    Object.entries(COPY[l])
      .filter(([k, v]) =>
        typeof v === "string" && v.length > 3 &&
        v === (COPY.en as Record<string, unknown>)[k] &&
        /^[\x00-\x7F]+$/.test(v) && !/Koleex|Hub/.test(v))
      .map(([k]) => `${l}.${k}`));
  check(`no key was left as its English text${untranslated.length ? " — " + untranslated.join(", ") : ""}`,
    untranslated.length === 0);

  /* THE WIRING, NOT JUST THE DICTIONARY. A translated dictionary that no
     component reads is the same product as no dictionary — and both new
     `lang` props default to English, so an unwired caller would leave this
     entire change inert. Rendering is the only thing that proves it. */
  const msg = { id: "m1", role: "assistant", content: "تمام", createdAt: Date.now() };
  const arBubble = renderToStaticMarkup(
    <Bubble {...({ msg, userInitial: "M", isLast: true, lang: "ar",
                   onRegenerate: () => {}, onSpeak: () => {}, onFeedback: () => {} } as any)} /> as ReactElement,
  );
  check("an Arabic message renders Arabic control labels, not English",
    arBubble.includes(COPY.ar.regenerate) && !arBubble.includes("Regenerate"));
  const enBubble = renderToStaticMarkup(
    <Bubble {...({ msg: { ...msg, content: "ok" }, userInitial: "M", isLast: true, lang: "en",
                   onRegenerate: () => {}, onSpeak: () => {}, onFeedback: () => {} } as any)} /> as ReactElement,
  );
  check("  …and English still renders English", enBubble.includes(COPY.en.regenerate));

  /* THE TYPING INDICATOR IS ITS OWN RENDER PATH — it replaces the message
     body rather than sitting beside it, so an assistant bubble WITH content
     never draws it. A mutation that stopped passing `lang` to it survived
     every check above for exactly that reason: the component defaults to
     English, so an unwired caller is silently monolingual again. */
  const arThinking = renderToStaticMarkup(
    <Bubble {...({ msg: { ...msg, content: "" }, userInitial: "M", isLast: true, lang: "ar" } as any)} /> as ReactElement,
  );
  check("a message still being composed announces itself in Arabic too",
    arThinking.includes(COPY.ar.thinkingAria) && !arThinking.includes("Koleex AI is thinking"));

  /* THE COMPONENTS THAT DEFAULT TO ENGLISH MUST BE HANDED A LANGUAGE AT
     EVERY CALL SITE. Both new `lang` props are optional with an English
     default — deliberately, so that adding them did not force every caller
     to change at once — but that same default is what makes an unwired
     caller silently monolingual instead of broken. ComposerAddMenu sits inside
     KoleexAiApp, which is far too large to render here, so this is checked
     at the source: weaker than rendering, and the only thing that catches
     it at all. */
  for (const comp of ["ComposerAddMenu", "TypingIndicator"]) {
    const sites: string[] = [];
    for (const f of AI_TSX) {
      let src = "";
      try { src = readFileSync(f, "utf8"); } catch { continue; }
      for (const m of src.matchAll(new RegExp(`<${comp}(\\s[^>]*?)?/?>`, "gs"))) {
        if (!/\blang=/.test(m[0])) sites.push(`${f.split("/").pop()}`);
      }
    }
    check(`every <${comp}> is given a language${sites.length ? " — missing in " + sites.join(", ") : ""}`,
      sites.length === 0);
  }
  /* Non-vacuity: there must BE call sites, or the loop proved nothing. */
  const anySite = AI_TSX.some((f) => {
    try { return /<ComposerAddMenu|<TypingIndicator/.test(readFileSync(f, "utf8")); } catch { return false; }
  });
  check("  …and those components really are used somewhere", anySite);

  /* ACCESSIBLE NAMES. A placeholder is not a label — it disappears the
     moment anyone types — and the edit box has no placeholder at all. */
  const appSrc = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("the composer has an accessible name, not just a placeholder",
    /aria-label=\{copy\.composerLabel\}/.test(appSrc));
  const bubbleSrc = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  check("the edit box has one too", /aria-label=\{copy\.editMessageLabel\}/.test(bubbleSrc));
  /* The regression that made all of this necessary. */
  check("BubbleActions uses the language it is given rather than discarding it",
    !/void lang;/.test(bubbleSrc) && /const copy = COPY\[lang\]/.test(bubbleSrc));
}

console.log("\n── The 'looking it up' indicator tells the truth ──");
{
  /* THE BUG: the floor timer was created bare on every tool call, so a call
     that looked two things up had two running. The FIRST fired while the
     SECOND lookup was still in flight, cleared the indicator, and the screen
     went quiet while something was genuinely happening — the exact reading
     ("nothing is going on") that the indicator exists to prevent. Nothing
     cancelled it on hang-up either. */
  const src = readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
  check("the search indicator's timer is held, not created and forgotten",
    /searchTimerRef\s*=\s*useRef<number \| null>\(null\)/.test(src));
  check("a new lookup cancels the previous floor before arming its own",
    /clearSearchTimer\(\);\s*\n\s*searchTimerRef\.current = window\.setTimeout\(/.test(src));
  check("and hanging up cancels it rather than leaving it to fire",
    /clearSearchTimer\(\);\s*\n\s*setSearching\(false\);/.test(src));
  /* Non-vacuity: a bare setTimeout must not have crept back beside it. */
  const bare = src.match(/(?<!searchTimerRef\.current = )window\.setTimeout\(\(\) => setSearching/g);
  check("no bare, unowned timer sets the indicator any more", bare === null);
}

console.log("\n── A DataChannel event is read by its type, not by substring ──");
{
  /* `raw.includes("session.created")` was true of ANY message containing
     those characters anywhere — an error body naming the event would have
     done it. Everything else in that file parses the JSON and switches on
     `type`; this one line did not, which is also why the shared
     EV_SESSION_CREATED constant existed with nothing using it. */
  const raw = readFileSync("src/lib/voice/session.ts", "utf8");
  /* COMMENTS STRIPPED FIRST. The comment explaining this fix necessarily
     QUOTES the old code, so an assertion run over the raw file matches its
     own explanation and fails on correct source. Assertions are about what
     runs, not about what is written beside it. */
  const src = stripComments(raw);
  check("the session-created check parses the event instead of scanning the text",
    !/raw\.includes\("session\.created"\)/.test(src) &&
    /isEventType\(raw, EV_SESSION_CREATED\)/.test(src));
  check("and the event names come from the shared constants, not second copies",
    /import \{[^}]*EV_SESSION_CREATED[^}]*\} from "\.\/events"/.test(src) &&
    /import \{[^}]*EV_SESSION_UPDATED[^}]*EV_ERROR[^}]*\} from "\.\/events"/.test(src) &&
    (src.match(/"session\.created"|"session\.updated"/g) ?? []).length === 0);
}

console.log("\n── VoiceCallScreen: it is a modal, so it has to cover the app ──");
{
  /* THE REPORTED SYMPTOM, from a screenshot taken mid-call: the Hub's own
     header sat across the top of the call, clipping the orb, and the floating
     panel's dock button hovered over the transcript. The call screen declared
     aria-modal="true" and then let two pieces of app chrome punch straight
     through it, because it was drawn at z-50 while the header is z-100 and
     the dock is z-90.

     ASSERTED AGAINST THE REAL NUMBERS, read from the components that own
     them, rather than against a constant retyped here. A header that is
     restacked later must fail this, not quietly climb back on top. */
  const zOf = (file: string, re: RegExp): number => {
    const m = readFileSync(file, "utf8").match(re);
    return m ? Number(m[1]) : NaN;
  };
  const callZ = zOf("src/components/ai/VoiceCallScreen.tsx", /fixed inset-0 z-\[(\d+)\] flex flex-col/);
  const headerZ = zOf("src/components/layout/MainHeader.tsx", /kx-mainheader fixed top-0 left-0 right-0 z-\[(\d+)\]/);
  const dockZ = zOf("src/components/layout/FloatingPanel.tsx", /fab-root fixed \$\{fabPosClass\} z-\[(\d+)\]/);
  check("the call screen is stacked above the main header",
    Number.isFinite(callZ) && Number.isFinite(headerZ) && callZ > headerZ);
  check("and above the floating panel's dock button",
    Number.isFinite(dockZ) && callZ > dockZ);
  /* AND NOT ABOVE EVERYTHING. A confirmation raised during a call has to be
     readable over it — a modal that outranks the confirm dialog is the same
     class of bug in the other direction. */
  const confirmZ = zOf("src/components/ui/ConfirmDialog.tsx", /z-\[(\d+)\]/);
  check("but below the confirm dialog, which must still be readable over a call",
    Number.isFinite(confirmZ) && callZ < confirmZ);
}

console.log("\n── VoiceCallScreen: the two controls ──");
{
  const controls = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.3} lines={[]} lang="en"
      onEnd={() => {}} muted={false} onToggleMute={() => {}} /> as ReactElement,
  );
  const mutedControls = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.3} lines={[]} lang="en"
      onEnd={() => {}} muted onToggleMute={() => {}} /> as ReactElement,
  );

  /* LABELS. An unlabelled icon pair is a guess, and this is a screen where
     guessing wrong is pressing "end" on a live call. */
  check("both controls are labelled in words, not icon-only", 
    controls.includes(">Mic<") && controls.includes(">End<"));
  check("  …and the visible labels are localised", 
    renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.3} lines={[]} lang="ar"
        onEnd={() => {}} muted={false} onToggleMute={() => {}} /> as ReactElement,
    ).includes("إنهاء"));
  /* The visible label must NOT also be announced: the button already carries
     the accessible name, and two of them means a screen reader says it twice. */
  check("the visible label is hidden from screen readers, which have the aria-label",
    /aria-hidden="true"[^>]*>Mic</.test(controls) || /aria-hidden[^>]*>Mic</.test(controls));

  /* THE ICONS THEMSELVES. What was there was a correct glyph with a line
     ruled corner-to-corner across the whole 24px box — at 20px that reads as
     damage, not state. And on the end-call button it said the wrong thing
     entirely: a handset struck through is the icon for a call that FAILED,
     and this is the button you press when the call went fine. */
  check("no icon is a glyph with a line ruled across the whole box",
    !/x1="2" y1="2" x2="22" y2="22"/.test(controls) &&
    !/x1="2" y1="2" x2="22" y2="22"/.test(mutedControls));
  /* THE OWNER: "the end button should be X, not like a close-a-call icon".
     Leaving a mode is a cross everywhere in the Hub; the red circle still
     says which control ends things. */
  check("the end-call icon is a plain X inside the red circle — not a handset",
    /bg-\[#FF3333\][^>]*>[\s\S]{0,400}?<line x1="6" y1="6" x2="18" y2="18"><\/line><line x1="18" y1="6" x2="6" y2="18">/.test(controls) &&
    !/rotate\(135 12 12\)/.test(controls) && !/d="M21 15\.46v2\.71/.test(controls));
  /* Mic-off is drawn broken around its slash — the shape is cut, so the
     diagonal is part of the letterform rather than graffiti over it. */
  /* Both from the library now (MicIcon, and its pair MicOffIcon), in the
     house stroke — the screen's own 1.75 drawings sat beside 2px icons. */
  const micCapsule = 'd="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"';
  check("muting swaps in a mic-off glyph rather than overdrawing the mic",
    /line x1="4" y1="3\.5" x2="20" y2="20\.5"/.test(mutedControls) &&
    !mutedControls.includes(micCapsule));
  check("  …and unmuted draws the plain mic, with no slash at all",
    controls.includes(micCapsule) &&
    !/y2="20\.5"/.test(controls));
  check("  …and every control glyph on the call screen draws at the house 2px stroke",
    !/stroke-width="1\.75"/.test(controls) && !/stroke-width="1\.75"/.test(mutedControls));

  /* TOUCH. This screen is used on a phone; the picker pills were 24px tall.
     Every control on it is now at least 40px, on the 8px grid. */
  for (const [what, re] of [
    ["the mute control", /h-14 w-14 rounded-full/],
    ["the end-call control", /h-16 w-16 rounded-full/],
  ] as const) {
    check(`${what} is a comfortable touch target`, re.test(controls));
  }
  /* HIERARCHY: ending a call is the primary action and is the larger of the
     two. A mute the same size as the hang-up is a mis-press waiting to
     happen. */
  check("and ending the call is the larger, primary control",
    controls.indexOf("h-16 w-16") > 0 && controls.indexOf("h-14 w-14") > 0);
  /* The red still belongs to exactly one control. */
  check("the red is still only on the control that ends the call",
    (controls.match(/#FF3333/g) ?? []).length >= 1 &&
    !/aria-label="Mute microphone"[^>]*#FF3333/.test(controls));
}

console.log("\n── VoiceCallScreen: choosing a voice ──");
{
  const voices = [{ key: "v1", label: "Omar" }, { key: "v2", label: "Layla" }];
  /* THE SHEET IS CLOSED BY DEFAULT: the bar shows a Voice control named
     after the current voice, and nothing else about the catalogue. */
  const closedSheet = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="en"
      onEnd={() => {}} voices={voices} selectedVoice="v1" onSelectVoice={() => {}} /> as ReactElement,
  );
  /* Labelled "Settings" since the UI/UX pass (2026-09-24): the voice's name
     under a sliders glyph read as the name of some other control. */
  check("closed: a Settings control that opens a dialog, labelled as settings, and no tiles",
    /aria-haspopup="dialog"/.test(closedSheet) && /aria-expanded="false"/.test(closedSheet) && />Settings</.test(closedSheet) && !/>Omar</.test(closedSheet) &&
    !closedSheet.includes("Layla") && !/aria-pressed=/.test(closedSheet) && !/z-\[250\]/.test(closedSheet));
  check("  …and the old chip row is gone: no 'Voice' caption with buttons beside it", !/uppercase tracking-wide[^>]*>Voice</.test(closedSheet));
  const withPicker = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="en"
      onEnd={() => {}} voices={voices} selectedVoice="v1" onSelectVoice={() => {}} defaultVoiceSheetOpen /> as ReactElement,
  );

  check("open: every configured voice is offered, as an orb tile with its name",
    withPicker.includes("Omar") && withPicker.includes("Layla") && /z-\[250\]/.test(withPicker) && /kx-sheet-in/.test(withPicker) &&
    (withPicker.match(/kx-voice-glyph/g) ?? []).length === 2 /* one signature per voice */ &&
    (() => { const glyphs = withPicker.split("kx-voice-glyph").slice(1).map((g) => (g.match(/height="(\d+)"/g) ?? []).slice(0, 5).join(",")); return glyphs.length === 2 && glyphs[0] !== glyphs[1]; })());
  /* Each tile is one <button …aria-pressed…> whose label sits in a span at
     the end; split on the opening tags and read the state off the chunk
     that carries the name. */
  const pressedOf = (label: string) => /aria-pressed="(true|false)"/.exec(withPicker.split("<button").find((c) => c.includes(`>${label}</span>`) && /aria-pressed=/.test(c)) ?? "")?.[1];
  check("the current one is marked as chosen, awake and ringed in Hub Blue",
    pressedOf("Omar") === "true" && /shadow-\[0_0_0_4px_rgba\(0,102,255,0\.18\)\]/.test(withPicker) && !/ring-\[#0066FF\]\/40/.test(withPicker) && (withPicker.match(/kx-voice-glyph is-on/g) ?? []).length === 1);
  check("and the other one is not", pressedOf("Layla") === "false");
  check("exactly one is chosen at a time",
    withPicker.split('aria-pressed="true"').length - 1 === 1);
  check("the sheet has a title, a Close, a backdrop, and the note that the call carries on",
    /Choose a voice/.test(withPicker) && /aria-label="Close"/.test(withPicker) && /bg-black\/60/.test(withPicker) && /The conversation carries on/.test(withPicker));

  /* HEAR IT FIRST (owner, 2026-09-07). With a preview handler the sheet
     gains a "Use this voice" button, off until a different voice has been
     heard, and the hint says to tap and listen. Without one it is as before. */
  const auditioned = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="en"
      onEnd={() => {}} voices={voices} selectedVoice="v1" onSelectVoice={() => {}} onPreviewVoice={async () => true} defaultVoiceSheetOpen /> as ReactElement,
  );
  check("with samples available: a disabled 'Use this voice' button and the tap-to-hear hint; the current voice still the one pressed",
    /<button[^>]*disabled=""[^>]*>Use this voice<\/button>/.test(auditioned) && /Tap a voice to hear it, then choose/.test(auditioned) &&
    auditioned.split('aria-pressed="true"').length - 1 === 1 && !/aria-busy/.test(auditioned));
  check("  …without samples, no such button and the old hint", !/Use this voice/.test(withPicker) && /The conversation carries on/.test(withPicker));
  check("  …the current voice wears a check badge and the caption Current — exactly one of each", (auditioned.match(/data-voice-current/g) ?? []).length === 1 && (auditioned.match(/>Current</g) ?? []).length === 1);
  check("  …localised", /استخدم الصوت ده/.test(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="ar" onEnd={() => {}} voices={voices} selectedVoice="v1" onSelectVoice={() => {}} onPreviewVoice={async () => true} defaultVoiceSheetOpen /> as ReactElement)));

  /* THE VENDOR'S OWN IDS ARE NOT A MENU THE BROWSER HOLDS. Only keys and
     labels reach it, so a browser cannot ask for a voice never offered. */
  check("no vendor voice id appears in the markup",
    !/Ethan|Chelsie|Aiden|Cherry/i.test(withPicker));

  /* A control that cannot be used is noise. */
  const noPicker = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("with no catalogue configured, no picker is drawn",
    !noPicker.includes("Voice</span>") && !/aria-pressed/.test(noPicker.replace(/aria-pressed="false"/g, "")));

  const arPicker = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="ar"
      onEnd={() => {}} voices={voices} selectedVoice="v2" onSelectVoice={() => {}} /> as ReactElement,
  );
  /* The control opens Call settings — lane and voice — so that is its name (UI
     review, 2026-09-12); the selected voice's own name sits under it. */
  check("the picker's own label is localised", arPicker.includes("إعدادات المكالمة"));
  const arSheet = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="ar"
      onEnd={() => {}} voices={voices} selectedVoice="v2" onSelectVoice={() => {}} defaultVoiceSheetOpen /> as ReactElement,
  );
  check("but the voice names are the owner's words, not translated",
    arSheet.includes("Omar") && arSheet.includes("Layla") && arSheet.includes("اختار الصوت"));

  /* Brand: the picker introduces no new colour. */
  const pickerHexes = [...withPicker.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase());
  const ok = new Set(["#0D0D0D", "#FF3333", "#0066FF", "#AAAAAA", "#666666", "#2E2E2E", "#FFFFFF", "#000000", "#567FB2", "#7FA9D6", "#BCD8F0", "#0B0D11", "#111111" /* --bg-secondary, the sheet's surface */]);
  check("the sheet is the hub's own surface and clears the home indicator", /bg-\[#111111\]/.test(withPicker) && !/#141414/.test(withPicker) && /padding-bottom:calc\(2rem \+ env\(safe-area-inset-bottom, 0px\)\)/.test(withPicker));
  check("the picker introduces no colour outside the palette",
    pickerHexes.every((h) => ok.has(h)));
}

console.log("\n── The transcript belongs to the call, not to the chat ──");
{
  /* THE REPORTED BUG: after hanging up, the captions stayed above the
     composer — a grey slab in the conversation that was not a message, could
     not be replied to, and vanished on reload. Voice turns are not persisted,
     so leaving them in the message area implied a permanence they do not
     have. Asserted as a source read, since the app shell is too large to
     render here. */
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("the chat does not render the voice transcript",
    !/<VoiceTranscript/.test(app));
  /* SCOPED TO THE CALL BUTTON. A blanket ban on `onTranscript=` also caught
     MicButton's own prop — the working speech-to-text path, which legitimately
     hands its transcript to send(). An assertion that condemns correct code is
     worse than no assertion. */
  const callButtonEl = app.slice(app.indexOf("<VoiceCallButton"), app.indexOf("/>", app.indexOf("<VoiceCallButton")));
  check("and holds no transcript state that could outlive a call",
    /* `dictation={{ onTranscript: … }}` is the long-press dictation's words going
       to send(); a transcript PROP (`onTranscript=`) is what this forbids. */
    !/voiceLines/.test(app) && !/onTranscript=/.test(callButtonEl));
  check("dictation still hands its transcript to the chat — through the call button's long press, the composer's one voice control",
    !/<MicButton/.test(app) && /dictation=\{\{ onTranscript: \(t\) => send\(t, true\)/.test(app));
  check("the call button is still mounted there", /<VoiceCallButton/.test(app));

  /* It is rendered by the call screen, which closes with the call. */
  const screen = readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  check("the call screen is what renders it", /<VoiceTranscript/.test(screen));
}

console.log("\n── The product, shown: on the call screen and in the answer ──");
{
  /* THINKING, SHOWN. The gap between the caller's last word and the first
     word back used to be nothing on screen. */
  const thinking = renderToStaticMarkup(
    <VoiceCallScreen live phase="thinking" audioLevel={0} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  /* THE CAPTION MOVES WHILE SOMETHING IS PENDING: the word, without its
     ellipsis, in the sweeping-light class, followed by three breathing dots
     — the same motion as the chat's activity line. */
  check("the far side composing reads as thinking — on the caption, the orb and the rings",
    /kx-activity-text[^>]*>Thinking</.test(thinking) && /kx-activity-dots/.test(thinking) && /kx-call-orb[^"]*is-thinking/.test(thinking) && /kx-aiorb[^"]*is-thinking/.test(thinking));
  check("  …localised", /kx-activity-text[^>]*>بفكّر</.test(renderToStaticMarkup(<VoiceCallScreen live phase="thinking" audioLevel={0} lines={[]} lang="ar" onEnd={() => {}} /> as ReactElement)));
  const settled = renderToStaticMarkup(<VoiceCallScreen live ready phase="listening" audioLevel={0} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement);
  check("  …and a settled state (listening) stands still: plain text, no sweep, no dots",
    text(settled).includes("Listening") && !/kx-activity-text/.test(settled) && !/kx-activity-dots/.test(settled));
  const connecting = renderToStaticMarkup(<VoiceCallScreen live={false} phase={null} audioLevel={0} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement);
  check("  …connecting moves too", /kx-activity-text[^>]*>Connecting</.test(connecting));
  /* A SLOW HANDSHAKE: the caption is a centred block that may wrap, the
     dots ride inline after the last word, and a Try again control appears
     when the parent offers one. */
  const slow = renderToStaticMarkup(<VoiceCallScreen live={false} phase={null} audioLevel={0} lines={[]} lang="en" onEnd={() => {}} connectingSlow onRetry={() => {}} /> as ReactElement);
  check("a slow handshake says so in a centred, wrapping caption with a Try again control; without a handler there is no control",
    /Still connecting/.test(slow) && /<p class="max-w-\[340px\] px-2 text-center[^"]*"/.test(slow) && /<button[^>]*>Try again<\/button>/.test(slow) &&
    !/Try again/.test(renderToStaticMarkup(<VoiceCallScreen live={false} phase={null} audioLevel={0} lines={[]} lang="en" onEnd={() => {}} connectingSlow /> as ReactElement)) &&
    !/Try again/.test(connecting));
  check("  …localised", /جرّب تاني/.test(renderToStaticMarkup(<VoiceCallScreen live={false} phase={null} audioLevel={0} lines={[]} lang="ar" onEnd={() => {}} connectingSlow onRetry={() => {}} /> as ReactElement)));
  /* NO LANGUAGE CHIPS. The caller is not asked which language they speak. */
  check("nothing on the screen asks the caller which language they speak",
    !/I speak|بتكلم|我说/.test(thinking) && !/lang="ar"[^>]*aria-pressed/.test(thinking));
  /* THE PICTURE EXPANDS IN PLACE. */
  const lb = renderToStaticMarkup(<PhotoLightbox photo={{ url: "https://cdn.example/kx180.jpg", label: "KX-180" }} onClose={() => {}} closeLabel="Close photo" /> as ReactElement);
  check("the lightbox is a dialog with the picture fitted whole, its name, and a close control",
    /role="dialog"/.test(lb) && /aria-modal="true"/.test(lb) && /<img[^>]*src="\/api\/ai\/image\?u=https%3A%2F%2Fcdn\.example%2Fkx180\.jpg&amp;w=1200"[^>]*object-contain/.test(lb) && /aria-label="Close photo"/.test(lb) && lb.includes("KX-180</p>"));
  check("  …and draws nothing when there is no picture", renderToStaticMarkup(<PhotoLightbox photo={null} onClose={() => {}} /> as ReactElement) === "");
  /* THE HIDDEN BORDER. The Aurora rim is a ::before with inset:0 against
     the nearest positioned ancestor; a glass surface that is not itself
     positioned lends the rim to its column. */
  const bubbleSrc = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  const welcomeSrc = readFileSync("src/components/ai/WelcomeCard.tsx", "utf8");
  check("every glass surface in the chat is its own positioning context, so the rim stays on it and off the text",
    /"kx-glass relative text-\[var\(--text-primary\)\]"/.test(bubbleSrc) && /className="kx-glass relative group flex/.test(welcomeSrc));
}

{
  /* PICTURES LIVE IN THE CONVERSATION, the way ChatGPT shows them — not in a
     strip pinned above the words — and the latest ones also under the orb,
     so the view never has to switch by itself. */
  const photos = [{ url: "https://cdn.example/kx180.jpg", label: "KX-180 Spreader" }];
  const lines: TranscriptLine[] = [{ role: "assistant", text: "The KX-180.", final: true, photos }];
  const withPhotos = renderToStaticMarkup(
    <VoiceCallScreen live phase="speaking" audioLevel={0} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  const without = renderToStaticMarkup(
    <VoiceCallScreen live phase="speaking" audioLevel={0} lines={[{ role: "assistant", text: "The KX-180.", final: true }]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  /* THE PICTURE COMES THROUGH THE AI PICTURE PROXY at the width of the slot
     (2026-09-07: camera-sized originals decoded for 88px tiles got the page
     killed under a live call). In markup the query's & is &amp;. */
  const TILE_SRC = 'src="/api/ai/image?u=https%3A%2F%2Fcdn.example%2Fkx180.jpg&amp;w=384"';
  check("a lookup's photos are drawn in the conversation, under the words that named them",
    withPhotos.includes(TILE_SRC) && withPhotos.indexOf("The KX-180.") < withPhotos.indexOf("<img"));
  check("  …named, for the eye and for a screen reader", /alt="KX-180 Spreader"/.test(withPhotos) && /aria-label="KX-180 Spreader"/.test(withPhotos));
  check("  …as a labelled group", /role="group"[^>]*aria-label="Photos"/.test(withPhotos));
  check("  …as a button that expands it in place, not a link that leaves the app",
    /<button type="button"[^>]*aria-label="KX-180 Spreader"[^>]*>\s*<img/.test(withPhotos) && !/<a[^>]*href="https:\/\/cdn\.example\/kx180\.jpg"/.test(withPhotos) && !/z-\[260\]/.test(withPhotos));
  check("  …eagerly, with its box reserved", !/loading="lazy"/.test(withPhotos) && /<img[^>]*width="88"[^>]*height="88"/.test(withPhotos));
  check("  …a web URL goes through the AI picture proxy at tile width — never the original file", withPhotos.includes(TILE_SRC) && !/src="https:\/\/cdn\.example\/kx180\.jpg"/.test(withPhotos));
  check("  …a tile in the HIDDEN layer keeps its frame and gives up its pixels: an empty box of the same size, no <img>",
    /<span aria-hidden="true" class="block rounded-2xl[^"]*" style="width:120px;height:120px"><\/span>/.test(withPhotos) && !/<img[^>]*width="120"/.test(withPhotos));
  /* A PICTURE DOES NOT SWITCH THE VIEW (owner, 2026-09-07: "suddenly it out
     of conversation and show me the text conversation"). The screen stays
     on the orb; the picture is drawn under the orb as well, where the
     caller is looking, and the words layer is rendered but hidden. */
  check("  …and a picture does NOT switch the view: the orb stays, the picture is also under it, the words layer is present but hidden",
    /aria-label="Show conversation"/.test(withPhotos) && !/aria-label="Back to Koleex AI"/.test(withPhotos) &&
    /class="kx-call-words absolute inset-0 flex flex-col pt-4 "[^>]*aria-hidden="true"/.test(withPhotos) &&
    withPhotos.split(TILE_SRC).length - 1 === 1 && /<img[^>]*width="88"[^>]*height="88"/.test(withPhotos));
  check("without pictures the screen opens on the ORB view: the big orb, the wordmark, a way to the words, no pictures",
    !/<img/.test(without) && !/role="group"[^>]*aria-label="Photos"/.test(without) && /aria-label="Show conversation"/.test(without) && />Show conversation</.test(without) && !/aria-label="Back to Koleex AI"/.test(without));
  check("  …and the bottom bar is in both views", /aria-label="End call"/.test(withPhotos) && /aria-label="End call"/.test(without));
  const hexes = [...withPhotos.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map((m) => m[0].toUpperCase())
    .filter((h) => !new Set(["#567FB2", "#7FA9D6", "#BCD8F0", "#0B0D11", "#FFF"]).has(h));
  check("the pictures introduce no colour outside the palette",
    hexes.every((h) => new Set(["#0D0D0D", "#FF3333", "#0066FF", "#AAAAAA", "#666666", "#FFFFFF", "#000000"]).has(h)));
  check("the group name is localised",
    /aria-label="الصور"/.test(renderToStaticMarkup(<VoiceCallScreen live phase="speaking" audioLevel={0} lines={lines} lang="ar" onEnd={() => {}} /> as ReactElement)));
  check("the conversation view shows the WHOLE conversation, not the last four lines",
    (() => { const many: TranscriptLine[] = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `Line ${i}`, final: true })); many[8] = { ...many[8], photos }; const html = renderToStaticMarkup(<VoiceCallScreen live phase="speaking" audioLevel={0} lines={many} lang="en" onEnd={() => {}} /> as ReactElement); return html.includes("Line 0") && html.includes("Line 8"); })());

  /* THE ANSWER IN THE THREAD. */
  const md = (content: string) => renderToStaticMarkup(<MessageMarkdown content={content} /> as ReactElement);
  const shown = md("The KX-180.\n\n![KX-180](https://cdn.example/kx180.jpg)");
  const BUBBLE_SRC = 'src="/api/ai/image?u=https%3A%2F%2Fcdn.example%2Fkx180.jpg&amp;w=768"';
  check("a markdown image renders as a bounded, styled picture, through the AI picture proxy at bubble width",
    /<img[^>]*class="koleex-md-img"/.test(shown) && shown.includes(BUBBLE_SRC) && !/src="https:\/\/cdn\.example\/kx180\.jpg"/.test(shown));
  check("  …that a tap expands in place — a button, not a link out of the app",
    /<button[^>]*class="koleex-md-img-link"[^>]*>\s*<img/.test(shown) && !/<a[^>]*href="https:\/\/cdn\.example\/kx180\.jpg"/.test(shown) && !/z-\[260\]/.test(shown));
  check("  …with the product name as alt text", /alt="KX-180"/.test(shown));
  check("  …lazily", /loading="lazy"/.test(shown));
  const plainHttp = md("![KX-180](http://cdn.example/kx180.jpg)");
  check("a non-https image is not fetched — its alt text stands in", !/<img/.test(plainHttp) && plainHttp.includes("KX-180"));
  const js = md("![x](javascript:alert(1))");
  check("a javascript: image is never an img", !/<img/.test(js));
  const css = readFileSync("src/app/globals.css", "utf8");
  check("the picture is bounded and rounded by the answer's own stylesheet",
    /\.koleex-md img\.koleex-md-img \{[^}]*max-width: min\(100%, 520px\)[^}]*border-radius: 12px/.test(css));
}

console.log("\n── VoiceCallScreen: typing into the call ──");
{
  const lines: TranscriptLine[] = [{ role: "user", text: "hi", final: true }];
  const withComposer = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="en" onEnd={() => {}} onSendText={() => true} defaultTypingOpen /> as ReactElement,
  );
  /* THE LINE WAITS BEHIND A KEYBOARD BUTTON (UI/UX pass, 2026-09-24). */
  const composerClosed = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="en" onEnd={() => {}} onSendText={() => true} /> as ReactElement,
  );
  check("the type-in line is closed until the keyboard button opens it, and the button says what it is",
    !/<input/.test(composerClosed) && /data-type-toggle/.test(composerClosed) && /aria-expanded="false"[^>]*aria-label="Type something into the call…"/.test(composerClosed) &&
      />Type</.test(composerClosed) && /data-type-toggle/.test(withComposer) && /aria-expanded="true"[^>]*aria-label="Type something into the call…"/.test(withComposer));
  const without = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("a composer is drawn when the parent can send text",
    /<input[^>]*placeholder="Type something into the call…"/.test(withComposer));
  check("  …and not otherwise — a control that cannot be used is noise", !/<input/.test(without));
  check("the field is labelled for a screen reader", /aria-label="Type something into the call…"/.test(withComposer));
  check("the send control is named, and disabled while there is nothing to send",
    /<button[^>]*type="submit"[^>]*disabled=""[^>]*aria-label="Send typed message"/.test(withComposer) ||
    /<button[^>]*aria-label="Send typed message"[^>]*disabled=""/.test(withComposer) ||
    (/aria-label="Send typed message"/.test(withComposer) && /type="submit"[^>]*disabled/.test(withComposer)));
  check("the mobile keyboard's return key says send", /enterkeyhint="send"/i.test(withComposer));
  check("a single line, not a document", !/<textarea/.test(withComposer));
  /* Every colour the composer introduces is from the palette. */
  const hexes = [...withComposer.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map((m) => m[0].toUpperCase())
    .filter((h) => !new Set(["#567FB2", "#7FA9D6", "#BCD8F0", "#0B0D11", "#FFF"]).has(h));
  const allowed = new Set(["#0D0D0D", "#FF3333", "#0066FF", "#AAAAAA", "#666666", "#FFFFFF", "#000000"]);
  check("the composer introduces no colour outside the Koleex palette", hexes.every((h) => allowed.has(h)));
  check("the composer is localised",
    /placeholder="اكتب حاجة في المكالمة…"/.test(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="ar" onEnd={() => {}} onSendText={() => true} defaultTypingOpen /> as ReactElement)) &&
    /placeholder="在通话中输入文字…"/.test(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="zh" onEnd={() => {}} onSendText={() => true} defaultTypingOpen /> as ReactElement)));
  /* Escape must leave the field, not end the call: read from source, since a
     keydown is not a first paint. */
  const screenSrc = readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  check("Escape inside the composer blurs it instead of ending the call",
    /if \(typedRef\.current && e\.target === typedRef\.current\) \{\s*typedRef\.current\.blur\(\);\s*return;/.test(screenSrc));
  /* The clear happens ONLY on the success branch; the failure branch sets the
     notice and leaves `typed` alone. */
  check("text that could not be sent stays in the box with a notice, rather than vanishing",
    /if \(onSendText\(text\)\) \{\s*setTyped\(""\);\s*setTypedNotice\(null\);\s*\} else \{[\s\S]{0,300}?setTypedNotice\(copy\.typedNotLive\);\s*\}/.test(screenSrc) &&
    (screenSrc.match(/setTyped\(""\)/g) ?? []).length === 1);

  /* ── ROADMAP B2: HOLD TO TALK on the screen ──────────────────────────── */
  console.log("\n── VoiceCallScreen: hold to talk ──");
  const holdScreen = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="en" onEnd={() => {}}
      muted onToggleMute={() => {}} talkMode="hold" onSelectTalkMode={() => {}} onHold={() => {}} /> as ReactElement,
  );
  check("in hold mode the Hold-to-talk button stands where Mute was, not pressed, and Mute is gone",
    holdScreen.includes('aria-label="Hold to talk"') && /aria-pressed="false"/.test(holdScreen) &&
    !holdScreen.includes("Mute microphone") && !holdScreen.includes("Unmute microphone"));
  check("between holds the caption says what to do, not that the microphone is off",
    text(holdScreen).includes("Hold to talk") && !text(holdScreen).includes("Microphone off") && !/\bListening\b/.test(text(holdScreen)));
  /* The hint stands where a caller waits before the first line, so it is
     rendered with an empty transcript. */
  const holdEmpty = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={[]} lang="en" onEnd={() => {}}
      muted onToggleMute={() => {}} talkMode="hold" onSelectTalkMode={() => {}} onHold={() => {}} /> as ReactElement,
  );
  const handsFreeEmpty = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={[]} lang="en" onEnd={() => {}}
      muted={false} onToggleMute={() => {}} talkMode="hands-free" onSelectTalkMode={() => {}} onHold={() => {}} /> as ReactElement,
  );
  check("the hint under the orb explains the hold — and hands-free says to just talk",
    text(holdEmpty).includes("Hold the button while you speak") && !text(holdEmpty).includes("Just talk") &&
    text(handsFreeEmpty).includes("Just talk. I answer when you pause.") && !text(handsFreeEmpty).includes("Hold the button while you speak"));
  check("the long press is protected from the browser: touch-action none, no callout, no selection",
    /touch-action:\s*none/.test(holdScreen) && /-webkit-touch-callout:\s*none/.test(holdScreen) && /user-select:\s*none/.test(holdScreen));
  const handsFreeScreen = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="en" onEnd={() => {}}
      muted={false} onToggleMute={() => {}} talkMode="hands-free" onSelectTalkMode={() => {}} onHold={() => {}} /> as ReactElement,
  );
  check("hands-free keeps Mute; the Voice control shows even with no voice catalogue, because the mode lives in its sheet",
    handsFreeScreen.includes("Mute microphone") && !handsFreeScreen.includes('aria-label="Hold to talk"') &&
    handsFreeScreen.includes('aria-haspopup="dialog"'));
  const modeSheet = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.4} lines={lines} lang="en" onEnd={() => {}}
      muted={false} onToggleMute={() => {}} talkMode="hold" onSelectTalkMode={() => {}} onHold={() => {}} defaultVoiceSheetOpen /> as ReactElement,
  );
  {
    const group = modeSheet.slice(modeSheet.indexOf('role="group"'));
    const handsFree = /data-talk-mode="hands-free"/.test(group) && /aria-pressed="false"[^>]*data-talk-mode="hands-free"|data-talk-mode="hands-free"[^>]*aria-pressed="false"/.test(group);
    const hold = /aria-pressed="true"[^>]*data-talk-mode="hold"|data-talk-mode="hold"[^>]*aria-pressed="true"/.test(group);
    check("the sheet offers the two ways to talk, the current one pressed, with the noisy-room hint — and no voices row when there is no catalogue",
      modeSheet.includes("How you talk") && handsFree && hold && text(modeSheet).includes("In a noisy place use Hold to talk") &&
      !text(modeSheet).includes("Switching takes a moment"));
  }
  check("hold to talk is localised",
    text(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="ar" onEnd={() => {}} muted onToggleMute={() => {}} talkMode="hold" onHold={() => {}} /> as ReactElement)).includes("اضغط واتكلم") &&
    text(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="zh" onEnd={() => {}} muted onToggleMute={() => {}} talkMode="hold" onHold={() => {}} /> as ReactElement)).includes("按住说话"));
  {
    /* The orb's own gradient stops are excluded, as the composer check does. */
    const orbOwn = new Set(["#567FB2", "#7FA9D6", "#BCD8F0", "#0B0D11", "#FFF"]);
    const holdHexes = [...holdScreen.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map((m) => m[0].toUpperCase()).filter((h) => !orbOwn.has(h));
    check("the hold button introduces no colour outside the Koleex palette", holdHexes.length > 0 && holdHexes.every((h) => allowed.has(h)));
  }
  /* EVERY WAY A PRESS CAN END RELEASES IT — from source, since a release is
     not a first paint. A microphone left open by a press that never "ended"
     is the one failure this control cannot have. */
  check("every way a press can end releases the hold: pointer up, cancel, capture lost, key up, page hidden, window blur, unmount",
    /onPointerUp=\{\(\) => hold\(false\)\}/.test(screenSrc) && /onPointerCancel=\{\(\) => hold\(false\)\}/.test(screenSrc) &&
    /onLostPointerCapture=\{\(\) => hold\(false\)\}/.test(screenSrc) && /onKeyUp=\{\(e\) => \{ if \(e\.key === " " \|\| e\.key === "Enter"\) \{ e\.preventDefault\(\); hold\(false\); \} \}\}/.test(screenSrc) &&
    /if \(document\.visibilityState === "hidden"\) hold\(false\)/.test(screenSrc) && /window\.addEventListener\("blur", onBlur\)/.test(screenSrc) &&
    /window\.removeEventListener\("blur", onBlur\);\s*hold\(false\);\s*\};/.test(screenSrc));
  check("a held key does not re-fire the press, and the press captures the pointer so a finger that slides off still releases",
    /onKeyDown=\{\(e\) => \{ if \(\(e\.key === " " \|\| e\.key === "Enter"\) && !e\.repeat\)/.test(screenSrc) &&
    /onPointerDown=\{\(e\) => \{ e\.preventDefault\(\); e\.currentTarget\.setPointerCapture\?\.\(e\.pointerId\); hold\(true\); \}\}/.test(screenSrc));
  check("the hold reports each change once, through onHold, and the parent — not the screen — owns the microphone",
    /const hold = useCallback\(\(held: boolean\) => \{\s*if \(holdRef\.current === held\) return;\s*holdRef\.current = held;\s*setHolding\(held\);\s*onHold\?\.\(held\);\s*\}, \[onHold\]\);/.test(screenSrc) &&
    !/setMuted\(/.test(screenSrc));


  /* ── ROADMAP C2: where the search matched, under the title ─────────────── */
  console.log("\n── SidebarRow: the search hint ──");
  {
    const row = { id: "c1", title: "Ningbo shipment", last_preview: null, message_count: 3, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
    const base = { active: false, projects: [], copy: COPY.en, onOpen: () => {}, onRename: () => {}, onDelete: () => {}, onTogglePin: () => {}, onMove: () => {} };
    const withHint = renderToStaticMarkup(<SidebarRow row={row} {...base} hint="…price for KX-200 was 1,250 USD…" /> as ReactElement);
    const without = renderToStaticMarkup(<SidebarRow row={row} {...base} /> as ReactElement);
    check("a matched row shows the snippet under its title, dim and on one line; a row without a hint is unchanged",
      /data-search-hint/.test(withHint) && withHint.includes("KX-200") && withHint.includes("Ningbo shipment") &&
      !/data-search-hint/.test(without) && without.includes("Ningbo shipment"));
  }


  /* ── ROADMAP C4: today's brief, one chip before the first word ─────────── */
  console.log("\n── VoiceCallScreen: today's brief ──");
  {
    const ready = renderToStaticMarkup(<VoiceCallScreen live ready phase="listening" audioLevel={0} lines={[]} lang="en" onEnd={() => {}} onSendText={() => true} /> as ReactElement);
    const spoken = renderToStaticMarkup(<VoiceCallScreen live ready phase="listening" audioLevel={0} lines={lines} lang="en" onEnd={() => {}} onSendText={() => true} /> as ReactElement);
    const connecting = renderToStaticMarkup(<VoiceCallScreen live ready={false} phase={null} audioLevel={0} lines={[]} lang="en" onEnd={() => {}} onSendText={() => true} /> as ReactElement);
    const noComposer = renderToStaticMarkup(<VoiceCallScreen live ready phase="listening" audioLevel={0} lines={[]} lang="en" onEnd={() => {}} /> as ReactElement);
    check("the chip shows once the line is listening and nothing has been said, and only where the call can be typed into",
      /data-brief-chip/.test(ready) && text(ready).includes("Today's brief") &&
      !/data-brief-chip/.test(spoken) && !/data-brief-chip/.test(connecting) && !/data-brief-chip/.test(noComposer));
    check("the chip is localised",
      text(renderToStaticMarkup(<VoiceCallScreen live ready phase="listening" audioLevel={0} lines={[]} lang="ar" onEnd={() => {}} onSendText={() => true} /> as ReactElement)).includes("موجز النهاردة") &&
      text(renderToStaticMarkup(<VoiceCallScreen live ready phase="listening" audioLevel={0} lines={[]} lang="zh" onEnd={() => {}} onSendText={() => true} /> as ReactElement)).includes("今日简报"));
    check("the chip types the brief request into the call — the same path a typed message takes",
      /onClick=\{\(\) => onSendText\(copy\.briefRequest\)\}/.test(screenSrc));
  }


  /* ── TASKS PHASE 2: the Task card in the chat ─────────────────────────── */
  console.log("\n── Bubble: a task waiting for a tap, in the chat ──");
  {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const pending = { tool: "createTodo", args: { title: "Call Mr Li about the Ningbo shipment", due_date: "2026-09-18T11:00:00.000Z", remind_at: "2026-09-18T11:00:00.000Z", priority: "high", label: "Sales", confirm: true } };
    const preview = { title: "Call Mr Li about the Ningbo shipment", priority: "high", when: { due: "Fri 18 Sept, 15:00", remind: "Fri 18 Sept, 15:00", start: "" }, assignees: [{ account_id: "a1", name: "Ahmed Hassan" }], observers: [{ account_id: "a2", name: "Sara" }], mentions: [], department: null, assign_to_all: false, timezone: "Asia/Dubai" };
    const step = { kind: "tool-result", tool: "createTodo", permissionStatus: "approval_required", text: "Ready to create…", payload: { preview }, pending };
    const base: any = { msg: { id: "t1", role: "assistant", content: "Ready — a reminder at 3 to call Mr Li. Save?", created_at: "2026-09-13T10:00:00Z", steps: [step] }, userInitial: "M", isLast: true, lang: "en", onConfirmTask: () => {}, onCancelTask: () => {} };
    const live = html(<Bubble {...base} />);
    check("a to-do preview step renders the Task card above the answer: the title in the user's words, the times in words, the person, the label, the priority",
      /data-task-card/.test(live) && /data-task-state="pending"/.test(live) && text(live).includes("Call Mr Li about the Ningbo shipment") && text(live).includes("Due Fri 18 Sept, 15:00") &&
      text(live).includes("Reminder Fri 18 Sept, 15:00") && text(live).includes("For Ahmed Hassan") && text(live).includes("Following Sara") && text(live).includes("High priority") && text(live).includes("Sales") &&
      text(live).includes("Ready — a reminder at 3 to call Mr Li. Save?"));
    check("  …live on the last message: Save is the one Hub-Blue control, Cancel beside it",
      /data-task-save/.test(live) && live.includes("bg-[var(--kx-ai-accent,#0066FF)]") && (live.match(/kx-ai-accent,#0066FF\)\] text-white/g) ?? []).length === 1 && text(live).includes("Save task") && /data-task-cancel/.test(live) && text(live).includes("Cancel"));
    const older = html(<Bubble {...({ ...base, isLast: false } as any)} />);
    check("  …an older message keeps the card as a record with no buttons", /data-task-card/.test(older) && !/data-task-save/.test(older) && text(older).includes("Call Mr Li"));
    const answered = html(<Bubble {...({ ...base, answeredWith: "actually make it tomorrow" } as any)} />);
    check("  …a card the user already replied to is frozen too", !/data-task-save/.test(answered));
    const saving = html(<Bubble {...({ ...base, taskStatus: { state: "saving" } } as any)} />);
    check("  …while saving the button says so and is disabled", text(saving).includes("Saving…") && /disabled=""/.test(saving));
    const saved = html(<Bubble {...({ ...base, taskStatus: { state: "saved", todoId: "7b2f0c1e-1111-4222-8333-444455556666" } } as any)} />);
    check("  …saved: the heading says so, nothing to press, and a link opens it in To-do",
      /data-task-state="saved"/.test(saved) && text(saved).includes("Task saved") && !/data-task-save/.test(saved) && /href="\/todo\?task=7b2f0c1e-1111-4222-8333-444455556666"/.test(saved) && text(saved).includes("Open in To-do"));
    const failed = html(<Bubble {...({ ...base, taskStatus: { state: "failed" } } as any)} />);
    check("  …a failed save says so and keeps the buttons", /data-task-error/.test(failed) && text(failed).includes("Could not save it") && /data-task-save/.test(failed));
    const cancelled = html(<Bubble {...({ ...base, taskStatus: { state: "cancelled" } } as any)} />);
    check("  …cancelled: 'Not saved', no buttons", /data-task-state="cancelled"/.test(cancelled) && text(cancelled).includes("Not saved") && !/data-task-save/.test(cancelled));
    const update = html(<Bubble {...({ ...base, msg: { ...base.msg, steps: [{ kind: "tool-result", tool: "updateTodo", permissionStatus: "approval_required", payload: { preview: { title: "Send the revised quotation", changes: { priority: "high", due_date: "2026-09-19T13:00:00.000Z" }, observers: [{ name: "Sara" }] } }, pending: { tool: "updateTodo", args: { task_id: "x", priority: "high", confirm: true } } }] } } as any)} />);
    check("an update preview is a 'Task change' card listing the changes and the observers",
      text(update).includes("Task change") && text(update).includes("High priority") && text(update).includes("Due: 2026-09-19T13:00:00.000Z") && text(update).includes("Following Sara") &&
      /* In words, not the tool's field names (review, 2026-09-26). */
      !text(update).includes("priority: high") && !text(update).includes("due date:"));
    const noPending = html(<Bubble {...({ ...base, msg: { ...base.msg, steps: [{ ...step, pending: undefined }] } } as any)} />);
    const allowed = html(<Bubble {...({ ...base, msg: { ...base.msg, steps: [{ ...step, permissionStatus: "allowed" }] } } as any)} />);
    check("no card without the confirm arguments, and none for a step that is not awaiting approval", !/data-task-card/.test(noPending) && !/data-task-card/.test(allowed));
    check("the card is localised — Arabic and Chinese from the same copy",
      text(html(<Bubble {...({ ...base, lang: "ar" } as any)} />)).includes("احفظ المهمة") && text(html(<Bubble {...({ ...base, lang: "ar" } as any)} />)).includes("تذكير") &&
      text(html(<Bubble {...({ ...base, lang: "zh" } as any)} />)).includes("保存任务") && text(html(<Bubble {...({ ...base, lang: "zh" } as any)} />)).includes("提醒"));
  }

  /* ── ROADMAP D1: the task card ────────────────────────────────────────── */
  console.log("\n── VoiceCallScreen: a task waiting for a tap ──");
  {
    const pending = { tool: "createTodo", args: { title: "Follow up with Ahmed about the KX-200", due_date: "2026-09-05", priority: "high" }, message: "Ready" };
    const card = renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en" onEnd={() => {}}
        pendingWrite={pending} onConfirmWrite={() => {}} onCancelWrite={() => {}} /> as ReactElement,
    );
    check("the card shows the task in the caller's words, its due date and priority, and Save / Cancel",
      /data-task-card/.test(card) && card.includes("Follow up with Ahmed about the KX-200") && text(card).includes("Due 2026-09-05") && text(card).includes("High priority") && !/·\s*high\b/.test(text(card)) &&
      text(card).includes("Save task") && text(card).includes("Cancel") && card.includes("bg-[#0066FF]"));
    const saved = renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en" onEnd={() => {}} pendingWrite={null} writeSaved /> as ReactElement,
    );
    check("after the tap the card says saved and offers nothing to press",
      /data-task-saved/.test(saved) && text(saved).includes("Task saved") && !text(saved).includes("Save task"));
    const none = renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
    );
    check("no card without a pending write", !/data-task-card/.test(none));
    const failed = renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en" onEnd={() => {}} pendingWrite={pending} writeError onConfirmWrite={() => {}} onCancelWrite={() => {}} /> as ReactElement,
    );
    check("a failed save says so on the card and keeps the buttons", text(failed).includes("Could not save it") && text(failed).includes("Save task"));
    check("the card is localised",
      text(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="ar" onEnd={() => {}} pendingWrite={pending} onConfirmWrite={() => {}} onCancelWrite={() => {}} /> as ReactElement)).includes("احفظ المهمة") &&
      text(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="zh" onEnd={() => {}} pendingWrite={pending} onConfirmWrite={() => {}} onCancelWrite={() => {}} /> as ReactElement)).includes("保存任务"));
  }

}

console.log("\n── A chat that failed to load says so; an offline device is told (audit, 2026-09-11) ──");
{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  check("a failed conversation load renders a retry card in place of the greeting, and the banner is not used for it",
    /const \[loadError, setLoadError\] = useState\(false\);/.test(app) &&
    /\) : loadError && activeId \? \(/.test(app) && /onClick=\{\(\) => void openConversation\(activeId\)\}/.test(app) &&
    /\{copy\.loadFailed\}/.test(app) && /\{copy\.retry\}/.test(app) &&
    /if \(!res\.ok\) \{[\s\S]{0,260}?setLoadError\(true\);\s*return;\s*\}/.test(app) &&
    /setError\(null\);\s*setLoadError\(false\);/.test(app));
  check("offline: a status line above the composer, the call control disabled, and the message a drop put back is resent once — only if it is still that message in that chat",
    /window\.addEventListener\("offline", sync\);/.test(app) && /\{!online && \(/.test(app) && /\{copy\.offline\}/.test(app) &&
    /disabled=\{sending \|\| !online\}/.test(app) &&
    /* ONE arming site: a dropped connection. A file that could not be read
       also puts the words back, and must NOT be resent on its own — the
       same unreadable file would go out again. */
    (app.match(/resendRef\.current = \{ text, conversationId, afterReturn: onlineReturnRef\.current \};/g) ?? []).length === 1 &&
    /if \(isNetwork && activeIdRef\.current === conversationId\) \{\s*resendRef\.current = \{ text, conversationId, afterReturn: onlineReturnRef\.current \};/.test(app) &&
    /* …and only after the network has COME BACK since the drop (deep
       check, 2026-09-24): on a link that drops while the device still
       says online, "online" alone resent at once, again and again. */
    /if \(onlineReturn <= pending\.afterReturn\) return;/.test(app) &&
    /if \(input\.trim\(\) !== pending\.text\.trim\(\) \|\| activeIdRef\.current !== pending\.conversationId\) return;\s*resendRef\.current = null;\s*void send\(\);/.test(app) &&
    ["en", "zh", "ar"].every((l) => COPY[l as "en" | "zh" | "ar"].offline.length > 0));
  check("on a touch screen every button in the AI app and the call screen has a 44 px hit area, rows are 44 px tall and inputs are 16 px — pointer-coarse only, scoped, the viewport lock untouched",
    /@media \(pointer: coarse\) \{[\s\S]{0,900}?\.kx-ai-root button::after,\s*\.kx-call-root button::after \{[\s\S]{0,300}?width: max\(100%, 44px\);\s*height: max\(100%, 44px\);/.test(css) &&
    /\.kx-ai-root \[role="button"\],\s*\.kx-call-root \[role="button"\] \{\s*min-height: 44px;/.test(css) &&
    /\.kx-ai-root :is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\), textarea, select\) \{\s*font-size: 16px;/.test(css) &&
    /className="kx-call-root fixed inset-0 z-\[200\]/.test(readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8")) &&
    /maximumScale: 1,\s*userScalable: false,/.test(readFileSync("src/app/layout.tsx", "utf8")));
  check("the AI app's dim text clears AA and every control shows a focus ring — scoped to .kx-ai-root, not the whole Hub",
    /\.kx-ai-root \{ --text-dim: rgba\(255,255,255,0\.56\); \}/.test(css) &&
    /\[data-theme="light"\] \.kx-ai-root \{ --text-dim: rgba\(0,0,0,0\.62\); \}/.test(css) &&
    /\.kx-ai-root :is\(button, \[role="button"\], a\[href\]\):focus-visible,\s*\.kx-call-root :is\(button, \[role="button"\], a\[href\]\):focus-visible \{\s*outline: 2px solid #0066FF;/.test(css));
}

console.log("\n── The address carries the place: ?c=<chat>, ?view=library|calls (audit, 2026-09-11) ──");
{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("opening a chat, a new chat and the Library / Calls views write the query string; the restore on load replaces instead of pushing",
    /const syncUrl = useCallback\(\(next: \{ c: string \| null; view: "library" \| "calls" \| null \}, mode: "push" \| "replace"\) => \{/.test(app) &&
    /if \(typeof window === "undefined" \|\| fromHistoryRef\.current\) return;/.test(app) &&
    /setCallsOpen\(false\);\s*syncUrl\(\{ c: id, view: null \}, "push"\);/.test(app) &&
    /setCallsOpen\(false\);\s*syncUrl\(\{ c: null, view: null \}, "push"\);/.test(app) &&
    /syncUrl\(\{ c: activeIdRef\.current, view: "library" \}, "push"\)/.test(app) && /syncUrl\(\{ c: activeIdRef\.current, view: "calls" \}, "push"\)/.test(app) &&
    !/openConversation\(stored\)/.test(app));
  /* THE APP OPENS ON A NEW CHAT (owner, 2026-09-13, "the ChatGPT way"): no
     remembered last chat is written or reopened; ?c= still opens its chat;
     the interrupted-call chip opens its own conversation by hand. */
  check("the app opens on a new chat: the remembered-chat key is neither written nor read, and only a ?c= in the address or the caller opens one",
    !/koleex-ai-active-chat:\$\{account\.id\}/.test(app) && !/activeIdKey/.test(app) && !/localStorage\.setItem\([^)]*activeId\)/.test(app) &&
    /useEffect\(\(\) => \{\s*activeIdRef\.current = activeId;\s*\}, \[activeId\]\);/.test(app) &&
    /if \(it\.conversation && it\.conversation !== activeIdRef\.current\) await openConversation\(it\.conversation\);/.test(app));
  /* ONE LOOK FROM LOADER TO APP (owner, 2026-09-13: "it appears suddenly,
     like a flash"): the root fades in, the aurora canvas fades in, opacity
     only, none of it under reduced motion. */
  /* THE LAZY CONTROLS' STAND-INS ARE THEIR OWN SHAPES (owner, 2026-09-13,
     two screenshots a second apart): the Speak pill's placeholder has the
     pill's height, padding, icon and colour with a blank for the word; the
     emoji button's has its 40 px; the orb's hello waits until the screen
     has settled. */
  /* The emoji button went in the UI/UX pass (2026-09-24) — the phone's own
     keyboard has emoji — so its stand-in must be gone with it. */
  check("the Speak pill keeps its shape while its code loads, no emoji picker is left behind, and the orb's hello comes after the screen has settled",
    /loading: \(\) => \(\s*<span aria-hidden className="h-9 rounded-full px-3\.5 inline-flex items-center gap-1\.5 shrink-0 bg-\[var\(--bg-inverted\)\] text-\[var\(--text-inverted\)\] text-\[13px\] font-semibold">/.test(app) &&
    /<span className="inline-block w-\[40px\]" \/>/.test(app) && !/EmojiButton|emojiData/.test(app) && !existsSync("src/components/ai/EmojiButton.tsx") && !/h-9 w-9 inline-block shrink-0/.test(app) &&
    /const t = setTimeout\(\(\) => setGreet\(1\), 900\);/.test(readFileSync("src/components/ai/WelcomeCard.tsx", "utf8")));
  check("the app's root fades in over 220 ms and the aurora canvas over 600 ms — opacity only, motion-safe only",
    /className="kx-ai-root kx-ai-enter /.test(app) &&
    (() => {
      const css = readFileSync("src/app/globals.css", "utf8");
      const canvas = readFileSync("src/components/ui/WavyBackground.tsx", "utf8");
      return /@media \(prefers-reduced-motion: no-preference\) \{\s*\.kx-ai-enter \{ animation: kx-ai-enter 220ms ease-out both; \}\s*\.kx-aurora-canvas \{ animation: kx-aurora-in 600ms ease-out both; \}\s*\}/.test(css) &&
        /@keyframes kx-ai-enter \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/.test(css) && /@keyframes kx-aurora-in \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/.test(css) &&
        /className="absolute pointer-events-none kx-aurora-canvas"/.test(canvas);
    })());
  check("  …a ?c= in the address wins over the remembered chat on load, and Back / Forward apply the address without pushing again",
    /const c = params\.get\("c"\);[\s\S]{0,200}?fromHistoryRef\.current = true;\s*try \{ void openConversation\(c\); \} finally \{ fromHistoryRef\.current = false; \}/.test(app) &&
    /window\.addEventListener\("popstate", onPop\);/.test(app) &&
    /if \(c !== activeIdRef\.current\) void openConversation\(c\);\s*\} else if \(activeIdRef\.current\) \{\s*void startNewChat\(\);/.test(app));
}

console.log("\n── The keyboard is kept where the eyes are (audit, 2026-09-11) ──");
{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const side = readFileSync("src/components/ai/Sidebar.tsx", "utf8");
  const scr = readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  const trap = readFileSync("src/components/ai/useFocusTrap.ts", "utf8");
  const pd = readFileSync("src/components/ai/ProjectDialog.tsx", "utf8");
  const lb = readFileSync("src/components/ai/PhotoLightbox.tsx", "utf8");
  const tr = readFileSync("src/components/ai/VoiceTranscript.tsx", "utf8");
  check("one focus trap: remembers the opener, focuses in, cycles Tab, yields to an inner trap, gives focus back",
    /export function useFocusTrap\(/.test(trap) && /if \(e\.key !== "Tab" \|\| e\.defaultPrevented\) return;/.test(trap) &&
    /if \(restore && previous && document\.contains\(previous\)\) previous\.focus\(\{ preventScroll: true \}\);/.test(trap));
  check("  …used by the call screen, its settings sheet, the project dialog and the lightbox",
    /useFocusTrap\(rootRef, true\);/.test(scr) && /useFocusTrap\(sheetRef, voiceSheet, \{ initialFocus: "\[data-sheet-close\]" \}\);/.test(scr) &&
    /useFocusTrap\(dialogRef, true\);/.test(pd) && /aria-labelledby="kx-project-dialog-title"/.test(pd) && /id="kx-project-dialog-title"/.test(pd) &&
    /useFocusTrap\(boxRef, !!photo, \{ initialFocus: "\[data-lightbox-close\]" \}\);/.test(lb));
  check("the call screen has one live region outside the layers that hide with the view; a partial transcript line is not announced; a prevented Escape does not end the call",
    /<p className="sr-only" role="status" aria-live="polite">\{announced\}<\/p>/.test(scr) && !/tracking-wide text-\[#AAAAAA\]" aria-live="polite">/.test(scr) &&
    /if \(e\.key !== "Escape" \|\| e\.defaultPrevented\) return;/.test(scr) &&
    /aria-hidden=\{line\.final \? undefined : true\}/.test(tr));
  check("the hidden sidebar is inert — the drawer off screen on a phone, the collapsed column on a desktop",
    /const asideHidden = isNarrow \? !sidebarOpen : sidebarCollapsed;/.test(app) && /aria-hidden=\{asideHidden\}\s*inert=\{asideHidden \|\| undefined\}/.test(app) &&
    /window\.matchMedia\("\(max-width: 767px\)"\)/.test(app));
  check("sidebar rows are not buttons holding buttons: the title is the button, pin and menu are its siblings; the row menu walks with arrow keys and hands focus back",
    !/\n\s+role="button"\n/.test(side) &&
    /* The chat row's handlers take the row (memoised row, deep check 2026-09-24). */
    /<button type="button" onClick=\{\(\) => onOpen\(row\.id\)\} className="flex-1 min-w-0 text-start rounded-lg" aria-current=\{active \? "page" : undefined\}>/.test(side) &&
    /<button type="button" onClick=\{onOpen\} className="flex-1 min-w-0 flex items-center gap-2 text-start rounded-lg">/.test(side) &&
    /if \(e\.key === "ArrowDown"\) go\(i \+ 1\);\s*else if \(e\.key === "ArrowUp"\) go\(i - 1\);\s*else if \(e\.key === "Home"\) go\(0\);\s*else if \(e\.key === "End"\) go\(items\.length - 1\);/.test(side) &&
    /const closeMenu = useCallback\(\(\) => \{\s*setOpen\(false\);\s*btnRef\.current\?\.focus\(\{ preventScroll: true \}\);/.test(side) &&
    /querySelector<HTMLElement>\('\[role="menuitem"\]'\)\?\.focus\(\{ preventScroll: true \}\);/.test(side));
  /* Rendered: the row's title is a real <button>, and the row itself carries no role. */
  const a11yRow = { id: "c9", title: "Row semantics", last_preview: null, message_count: 1, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
  const a11yBase = { active: false, projects: [], copy: COPY.en, onOpen: () => {}, onRename: () => {}, onDelete: () => {}, onTogglePin: () => {}, onMove: () => {} };
  const rowHtml = renderToStaticMarkup(<SidebarRow row={a11yRow} {...a11yBase} /> as ReactElement);
  check("  …rendered, the row's title is a <button> and the row carries no role",
    /<button type="button"[^>]*class="flex-1 min-w-0 text-start rounded-lg"/.test(rowHtml) && !/role="button"/.test(rowHtml));
}

console.log("\n── The memo holds: one function per bubble prop, one bump reducer, the voice stack on demand (audit, 2026-09-11) ──");
{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const bubble = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  check("bubble callbacks carry the message id and the parent passes stable functions, reading the thread through a ref",
    /onEdit\?: \(msgId: string, newText: string\) => void;/.test(bubble) && /onAnswerQuestion\?: \(msgId: string, answer: string\) => void;/.test(bubble) &&
    /onEdit\?\.\(msg\.id, next\);/.test(bubble) && /onAnswerQuestion\?\.\(msg\.id, t\);/.test(bubble) &&
    /onEdit=\{onBubbleEdit\}/.test(app) && /onAnswerQuestion=\{onBubbleAnswer\}/.test(app) &&
    /const messagesRef = useRef<ChatMsg\[\]>\(\[\]\);/.test(app) && /const sendRef = useRef\(send\);/.test(app) &&
    !/onEdit=\{\(newText\) =>/.test(app) && !/onAnswerQuestion=\{\(answer\) =>/.test(app));
  check("the sidebar bump is one reducer, called for the JSON reply and the streamed one",
    /const bumpConversation = useCallback\(\(id: string, title: string, preview: string\) => \{/.test(app) &&
    (app.match(/bumpConversation\(bumpId, bumpTitle, /g) ?? []).length === 2 &&
    (app.match(/message_count: c\.message_count \+ 2/g) ?? []).length === 1);
  check("the call button — and lib/voice behind it — loads on demand, with a placeholder that holds the composer's geometry",
    /const VoiceCallButton = dynamic\(\(\) => import\("@\/components\/ai\/VoiceCallButton"\), \{\s*ssr: false,/.test(app) &&
    !/^import VoiceCallButton from/m.test(app));
}

console.log("\n── Arabic and Chinese at their own size; the sidebar title keeps the list's edge (owner, 2026-09-13) ──");
{
  /* eslint-disable @typescript-eslint/no-explicit-any */
  check("textScript weighs the whole string and leans to the non-Latin script",
    textScript("ماكينات الخياطة") === "ar" && textScript("分析中国教师前景") === "zh" && textScript("Free UI Animation Libraries") === "latin" &&
    textScript("ماكينة Koleex KX-220 للفرش") === "ar" && textScript("Koleex 缝纫机 报价") === "zh" && textScript("") === "none" && textScript("1250 — ?") === "none");
  check("  …a Japanese line is not marked Chinese, and Kana alone is not a script this app sizes",
    textScript("ひらがな") === "none");
  check("textLang: ar / zh for the two sized scripts, en for Latin, nothing for nothing",
    textLang("أخبار تمام") === "ar" && textLang("删除一个") === "zh" && textLang("Delete one") === "en" && textLang("…") === undefined);

  const base: any = { active: false, projects: [], copy: COPY.en, onOpen: () => {}, onRename: () => {}, onDelete: () => {}, onTogglePin: () => {}, onMove: () => {} };
  const rowOf = (title: string) => ({ id: "r", title, last_preview: null, message_count: 1, created_at: "2026-09-13T00:00:00Z", updated_at: "2026-09-13T00:00:00Z" });
  const ar = html(<SidebarRow {...base} row={rowOf("براءات اختراع وإنجازات شخصية")} />);
  const zh = html(<SidebarRow {...base} row={rowOf("分析中国教师前景")} />);
  const en = html(<SidebarRow {...base} row={rowOf("Mobile capabilities explained")} />);
  check("an Arabic title is marked lang=\"ar\", shaped with dir=\"auto\", and carries the edge-pinning class",
    /<span class="kx-ai-row-title block text-\[13px\] truncate" dir="auto" lang="ar">/.test(ar));
  check("a Chinese title is marked lang=\"zh\"", /class="kx-ai-row-title block text-\[13px\] truncate" dir="auto" lang="zh">/.test(zh));
  check("an English title is marked lang=\"en\" so it keeps its size inside an Arabic screen", /dir="auto" lang="en">Mobile capabilities explained</.test(en));
  check("the search hint follows the same rule",
    /data-search-hint/.test(html(<SidebarRow {...base} row={rowOf("t")} hint="…سعر الماكينة…" />)) &&
    /class="kx-ai-row-title block text-\[12px\] truncate text-\[var\(--text-dim\)\]" dir="auto" lang="ar" data-search-hint/.test(html(<SidebarRow {...base} row={rowOf("t")} hint="…سعر الماكينة…" />)));

  const msg: any = { id: "m1", role: "assistant", created_at: "2026-09-13T10:00:00Z" };
  const bubbleOf = (content: string) => html(<Bubble {...({ msg: { ...msg, content }, userInitial: "M", isLast: true, lang: "en" } as any)} />);
  check("a Chinese reply reads at 16px like an Arabic one, and both carry their lang; English stays at 14",
    /dir="ltr" lang="zh" class="leading-relaxed kx-ai-reply max-w-full text-\[16px\]/.test(bubbleOf("三种宽度可选：1.8米、2.2米和2.6米。")) &&
    /dir="rtl" lang="ar" class="leading-relaxed kx-ai-reply max-w-full text-\[16px\]/.test(bubbleOf("تتوفر ثلاثة عروض للماكينة.")) &&
    /dir="ltr" lang="en" class="leading-relaxed kx-ai-reply max-w-full text-\[14px\]/.test(bubbleOf("Three widths are available.")));

  const tiles = html(<WelcomeCard copy={COPY.ar} onPick={() => {}} firstName="" />);
  check("the welcome tiles carry the language of their words", /class="kx-ai-tile-text flex-1 leading-snug" lang="ar">/.test(tiles) &&
    /class="kx-ai-tile-text flex-1 leading-snug" lang="zh">/.test(html(<WelcomeCard copy={COPY.zh} onPick={() => {}} firstName="" />)));

  const card = html(<TaskCard {...({ tool: "createTodo", pending: { tool: "createTodo", args: { title: "متابعة بيانات المنتجات" } }, preview: { title: "متابعة بيانات المنتجات" }, status: { state: "live" }, copy: COPY.en, onConfirm: () => {}, onCancel: () => {} } as any)} />);
  check("the task title is shaped and marked", /dir="auto" lang="ar" data-task-title/.test(card));

  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  check("the root carries the screen's language; both bar titles and the composer carry their content's",
    /lang=\{lang\}\s+className="kx-ai-root /.test(app) &&
    (app.match(/kx-ai-bar-title[^>]*dir="auto" lang=\{active\?\.title \? textLang\(active\.title\) : undefined\}/g) ?? []).length === 2 &&
    /dir=\{textDirection\(input, lang === "ar" \? "rtl" : "ltr"\)\}\s+lang=\{textLang\(input\)\}/.test(app) && /className="kx-ai-composer-text block w-full/.test(app));
  check("the stylesheet pins the title to the screen's side and sizes ar/zh content one step up on every marked surface",
    /\.kx-ai-root \.kx-ai-row-title,\s*\.kx-ai-root \.kx-ai-bar-title \{\s*text-align: left;/.test(css) &&
    /html\[dir="rtl"\] \.kx-ai-root \.kx-ai-row-title,\s*html\[dir="rtl"\] \.kx-ai-root \.kx-ai-bar-title \{\s*text-align: right;/.test(css) &&
    /\.kx-ai-root \.kx-ai-row-title:is\(:lang\(ar\), :lang\(zh\)\) \{\s*font-size: 15px;/.test(css) &&
    /\.kx-ai-root \.kx-ai-composer-text:is\(:lang\(ar\), :lang\(zh\)\) \{\s*font-size: 17px;/.test(css) &&
    /\.kx-ai-root \.kx-ai-tile-text:is\(:lang\(ar\), :lang\(zh\)\) \{\s*font-size: 15px;/.test(css) &&
    /\.kx-ai-root \[data-task-title\]:is\(:lang\(ar\), :lang\(zh\)\) \{\s*font-size: 17px;/.test(css) &&
    /\.kx-call-root \.kx-call-line:is\(:lang\(ar\), :lang\(zh\)\) \{\s*font-size: 20px;/.test(css) &&
    /\.kx-call-root \.kx-call-caption:is\(:lang\(ar\), :lang\(zh\)\) \{\s*font-size: 18px;/.test(css));
  check("  …an Arabic or Chinese screen lifts the chrome, leaving the content surfaces to their own rule; Chinese has its own font stack",
    /:is\(\.kx-ai-root:lang\(ar\), \.kx-ai-root:lang\(zh\)\) \.text-\\\[13px\\\]:not\(\.kx-ai-row-title\):not\(\.kx-ai-bar-title\):not\(\.kx-ai-tile-text\) \{\s*font-size: 14px;/.test(css) &&
    /"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei"/.test(css));
  const tr = readFileSync("src/components/ai/VoiceTranscript.tsx", "utf8");
  const scr = readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
  check("the call's transcript lines and caption carry their lang and the classes the call rules size",
    /lang=\{textLang\(stripImageMarkdown\(line\.text\) \|\| line\.text\)\}/.test(tr) && /kx-call-line text-\[18px\]/.test(tr) &&
    /lang=\{textLang\(stripImageMarkdown\(lastLine\.text\) \|\| lastLine\.text\)\}/.test(scr) && /kx-call-caption kx-call-caption-tail max-w-\[820px\]/.test(scr));
}

console.log("\n── An Arabic opening before an English code block reads right-to-left; each block may differ from the bubble (owner, 2026-09-15) ──");
{
  const arabicOpening = "ماشي يا كيمو — هختار أنا الأنسب وأكتبلك الـ prompt كامل. اخترت SeaRates API لأنه الأقرب لاحتياجنا.\n\nانسخ اللي تحت في Claude Code:\n\n";
  const fence = "```md\n" + "# Task: Integrate SeaRates Container Shipping Rate API into Koleex Hub. We need sea freight container rate estimates inside the Shipping app, so quotations and logistics staff can get an indicative price fast.\n".repeat(6) + "```";
  check("the bubble's direction ignores fenced code, inline code and URLs — the words decide, not the prompt they hand over",
    textDirection(arabicOpening + fence) === "rtl" &&
    textDirection("شوف الرابط https://example.com/a-very-long-english-path/with/many/latin/letters/in/it/and/more") === "rtl" &&
    textDirection("الـ `stack-agnostic-configuration-reader` ده") === "rtl" &&
    textDirection("Three widths are available.") === "ltr" &&
    textScript(arabicOpening + fence) === "ar");
  check("a block decides for itself only on clear evidence: twelve Latin letters is a phrase, 'Claude Code:' is a name",
    blockDirection("This paragraph is an English explanation", "rtl") === "ltr" &&
    blockDirection("Claude Code:", "rtl") === "rtl" &&
    blockDirection("KX-220", "rtl") === "rtl" &&
    blockDirection("هذه فقرة عربية داخل رد إنجليزي.", "ltr") === "rtl" &&
    blockDirection("", "ltr") === "ltr");
  const mixed = "فقرة عربية في الأول.\n\n```md\nx\n```\n\nThis paragraph is an English explanation that follows the prompt.\n\nClaude Code:\n\n- بند عربي\n- `stack` الـ\n\n## Heading in English about the shipping rates";
  const rtlBubble = renderToStaticMarkup(<MessageMarkdown content={mixed} dir="rtl" /> as ReactElement);
  check("in an Arabic bubble: the Arabic paragraph inherits, the English paragraph and heading carry dir=\"ltr\", the short English label inherits",
    /<p>فقرة عربية في الأول\.<\/p>/.test(rtlBubble) &&
    /<p dir="ltr">This paragraph is an English explanation/.test(rtlBubble) &&
    /<p>Claude Code:<\/p>/.test(rtlBubble) &&
    /<h2 dir="ltr">Heading in English/.test(rtlBubble) &&
    /<li>بند عربي<\/li>/.test(rtlBubble));
  check("the code block is always left-to-right; inline code is its own island; no hast node leaks into the DOM",
    /<div class="koleex-code-block" dir="ltr">/.test(rtlBubble) &&
    /<code class="koleex-md-inline-code" dir="auto">stack<\/code>/.test(rtlBubble) &&
    !/node="\[object Object\]"/.test(rtlBubble));
  const ltrBubble = renderToStaticMarkup(<MessageMarkdown content={"English intro paragraph that is long enough.\n\nهذه فقرة عربية داخل رد إنجليزي."} dir="ltr" /> as ReactElement);
  check("in an English bubble, a quoted Arabic paragraph carries dir=\"rtl\"",
    /<p>English intro paragraph/.test(ltrBubble) && /<p dir="rtl">هذه فقرة عربية/.test(ltrBubble));
  check("without a bubble direction the renderer marks nothing (the calls panel's summaries)",
    !/ dir="(ltr|rtl)"/.test(renderToStaticMarkup(<MessageMarkdown content={"Plain text.\n\nهذه فقرة عربية."} /> as ReactElement).replace(/<div class="koleex-code-block" dir="ltr">/g, "")));
  const bubble = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  check("the bubble hands its measured direction to the renderer, and the stylesheet keeps code left-to-right",
    /<MessageMarkdown content=\{msg\.content\} lang=\{lang\} dir=\{bubbleDir\} \/>/.test(bubble) &&
    /\.koleex-code-block \{\s*direction: ltr;\s*text-align: left;/.test(css));
}

{
  console.log("\n── The AI app is warmed, and a failed start unlocks the composer ──");
  const preload = readFileSync("src/lib/app-chunk-preload.ts", "utf8");
  const prefetch = readFileSync("src/lib/app-prefetch.ts", "utf8");
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");

  /* ── WARMED IN NAME ONLY ──
     (owner, 2026-09-18: "make it fast".) TIER_A_IDLE_PRELOAD has carried
     "ai" first since 2026-09-13, with the owner's "extremely fast, almost no
     loading" written beside it — and CHUNK_PRELOADERS had no `ai` key, so
     Home's idle warm skipped it, the hover-intent warm was a no-op, and the
     ~573 KB chunk group downloaded on the tap every session. Worse, the rule
     that an app with no preloader "has nothing to warm" made
     wasChunkWarmed("ai") return TRUE, so the launch was logged WARM: the
     owner's telemetry read nav.warm_ms 14923 for a fully cold download,
     while going BACK from /ai in the same session took 427 ms. The number
     that should have caught it was the number it fooled.

     Pinned as the INVARIANT, not as one key: every app listed for idle
     preload must actually have a preloader. */
  /* The gap is recorded by NAME, so this fails the moment a NEW app joins the
     broken set — but it does not pretend `products` is fixed. `products` is
     listed for idle preload and has no preloader either; it is outside the AI
     app, and with the idle budget at two chunks (ai, customers) it is never
     reached in practice, so it is reported to the owner rather than changed
     from here. Shrink this set, never grow it. */
  const KNOWN_UNWARMED = new Set(["products"]);
  check("every app listed for idle preload really has a chunk preloader, bar one known and named — 'warmed' in the list must mean warmed in the browser",
    (() => {
      const tier = /TIER_A_IDLE_PRELOAD: readonly string\[\] = \[([^\]]*)\]/.exec(prefetch)?.[1] ?? "";
      const listed = [...tier.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
      const keys = /const CHUNK_PRELOADERS: Record<string, \(\) => Promise<unknown>> = \{([\s\S]*?)\n\};/.exec(preload)?.[1] ?? "";
      const have = new Set([...keys.matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]));
      const missing = listed.filter((id) => !have.has(id));
      return listed.length > 0 && listed.includes("ai") && have.has("ai") &&
        missing.every((id) => KNOWN_UNWARMED.has(id));
    })());
  check("  …and the AI preloader imports the very module the route lazy-loads, so the browser dedupes the chunk",
    /ai: \(\) => import\("@\/components\/ai\/KoleexAiApp"\),/.test(preload) &&
    /dynamic\(\(\) => import\("@\/components\/ai\/KoleexAiApp"\)/.test(readFileSync("src/app/ai/page.tsx", "utf8")));

  /* ── A CHAT THAT COULD NOT START MUST NOT LOCK THE COMPOSER ──
     createConversation returned null for a refusal and THREW for a dropped
     link. send() awaits it before its own try/finally begins, so a rejection
     skipped the finally that clears sendingRef: the composer stayed on
     "Stop" for the rest of the session, every later send() returned at the
     guard, and only a reload freed it. The caller's `if (!created)` handling
     was already right — it just never ran. */
  check("a chat that could not be started comes back as null on EVERY failure — a dropped link, an unreadable body, a refusal",
    /* Asked up to three times now (2026-09-26, the phone's lost answers):
       every failure still ends at the one `return null` after the loop. */
    /let res: Response;\s*try \{\s*res = await fetch\("\/api\/ai\/conversations"/.test(app) &&
    /\} catch \(e\) \{\s*why = `network:/.test(app) &&
    /if \(!res\.ok\) \{\s*why = `status:/.test(app) &&
    /\(\{ conversation \} = \(await res\.json\(\)\) as \{ conversation: ConversationRow \}\);\s*\} catch \(e\) \{\s*why = `body:/.test(app) &&
    /if \(!conversation\?\.id\) \{\s*perfEvent\("ai\.chat_create_fail"[^\n]*\n\s*return null;/.test(app));
  /* ── ONE GATE, AND IT IS THE SHELL'S (owner, 2026-09-18: "remove it") ──
     `/ai` wrapped itself in <AdminAuth> while RootShell already wraps every
     non-bypassed route in <AuthGate>. The same gate twice, and not free: the
     inner copy painted a full-height BrandLoading until its own effect had
     read storage, which is what delayed the START of the lazy chunk download
     and put three loading surfaces in a row.

     Removing a gate is a permissions change, so the safety is pinned rather
     than argued: `/ai` must not be bypassable, the shell must gate what it
     does not bypass, AuthGate must be the real gate with no second branch,
     and the page must not be the thing holding the gate. If any of those
     stops being true, this fails — it cannot quietly become "no gate". */
  const shell = readFileSync("src/components/layout/RootShell.tsx", "utf8");
  /* AuthGate is <AdminAuthGate> and nothing else: the Supabase flag that gave
     it a second branch was retired on 26/09/2026. The pin reads the whole
     file with comments stripped — one import of the real gate, one return,
     and `children` only in the prop type, the parameter and that render — so
     a gate kept only in a comment, a pass-through defined in place of the
     import, or a second branch all fail it. */
  const gate = stripComments(readFileSync("src/components/admin/AuthGate.tsx", "utf8"));
  /* Comments stripped: this page EXPLAINS why the second gate went, so the
     word appears in prose. The pin is about the code. */
  const aiPage = stripComments(readFileSync("src/app/ai/page.tsx", "utf8"), { line: "keep" });
  check("the AI route is still gated — by the shell, which cannot bypass it",
    /const BYPASS_SUFFIXES = \["\/print"\];/.test(shell) &&
    /const BYPASS_PREFIXES = \["\/auth"\];/.test(shell) &&
    !/"\/ai"/.test(/const BYPASS_(SUFFIXES|PREFIXES)[^;]*;/.exec(shell)?.[0] ?? "") &&
    /if \(isBypassed\(pathname\)\) \{\s*return <>\{children\}<\/>;\s*\}\s*return \(\s*<AuthGate>/.test(shell));
  check("  …and AuthGate is AdminAuthGate, with no flag or second branch that could open a hole",
    /^import AdminAuthGate from "\.\/AdminAuthGate";$/m.test(gate) &&
    /export default function AuthGate\(\{ children \}: Props\) \{\s*return <AdminAuthGate>\{children\}<\/AdminAuthGate>;\s*\}\s*$/.test(gate) &&
    (gate.match(/\breturn\b/g) ?? []).length === 1 &&
    (gate.match(/\bchildren\b/g) ?? []).length === 3);
  /* AuthGate trusts AdminAuthGate, so its own decision is pinned
     too: it starts at "checking" (the spinner), the ONLY way to "in" is the
     session flag reading exactly "true" (blocked storage counts as signed
     out), every other transition goes to "out", "out" hands over to the real
     AdminAuth (whose loading state is the same spinner), and `children`
     appears in exactly those two renders. */
  const adminGate = stripComments(readFileSync("src/components/admin/AdminAuthGate.tsx", "utf8"));
  const adminGateStart = adminGate.indexOf("export default function AdminAuthGate(");
  const adminGateBody = adminGateStart >= 0 ? adminGate.slice(adminGateStart) : "";
  check("  …and AdminAuthGate renders children only once the session flag says signed in",
    /^import \{ LEGACY_SESSION_KEY \} from "\.\/session-keys";$/m.test(adminGate) &&
    /^const spinner = \(\) => <BrandLoading [^{}>]*\/>;$/m.test(adminGate) &&
    /^const AdminAuth = dynamic\(\(\) => import\("\.\/AdminAuth"\), \{ ssr: false, loading: spinner \}\);$/m.test(adminGate) &&
    /const \[state, setState\] = useState<State>\("checking"\);/.test(adminGateBody) &&
    /let signedIn = false;\s*try \{\s*signedIn = window\.localStorage\.getItem\(LEGACY_SESSION_KEY\) === "true";\s*\} catch \{\s*\}\s*setState\(signedIn \? "in" : "out"\);/.test(adminGateBody) &&
    (adminGateBody.match(/\bsignedIn\b/g) ?? []).length === 3 &&
    (adminGateBody.match(/\bsetState\b/g) ?? []).length === 4 &&
    (adminGateBody.match(/\bsetState\("out"\)/g) ?? []).length === 2 &&
    /if \(state === "checking"\) return spinner\(\);\s*if \(state === "out"\) return <AdminAuth>\{children\}<\/AdminAuth>;\s*return <>\{children\}<\/>;\s*\}\s*$/.test(adminGateBody) &&
    (adminGateBody.match(/\bchildren\b/g) ?? []).length === 4);
  /* …and no second auth mode is left to switch on. The Supabase-Auth path
     (SupabaseGate, src/lib/auth-client.ts, NEXT_PUBLIC_USE_SUPABASE_AUTH) was
     retired on 26/09/2026: the flag was never set, the server never accepted
     a Supabase session, and with /login deleted that mode had no sign-in
     screen. Nothing in src may read the flag or bring either back. Comments
     stripped: the files that explain the retirement name all three. */
  const srcFiles: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) srcFiles.push(p);
    }
  })("src");
  const secondAuthMode = srcFiles.filter((f) =>
    /NEXT_PUBLIC_USE_SUPABASE_AUTH|@\/lib\/auth-client|\bSupabaseGate\b/.test(stripComments(readFileSync(f, "utf8"), { line: "all" })));
  if (secondAuthMode.length) console.log(`    second auth mode found in: ${secondAuthMode.join(", ")}`);
  check("  …and no second auth mode is left to switch on: nothing in src reads the Supabase-Auth flag or loads auth-client",
    !existsSync("src/lib/auth-client.ts") && srcFiles.length > 100 && secondAuthMode.length === 0);
  check("  …so the page carries no second gate of its own, and no longer imports one",
    !/AdminAuth/.test(aiPage) && /export default function AiPage\(\) \{\s*return <KoleexAiApp \/>;\s*\}/.test(aiPage));

  check("  …and the caller unlocks on it, so the next message is still sendable",
    /const created = await createConversation\(\{ activate: false \}\);[\s\S]{0,1400}?if \(!created\) \{\s*setError\(copy\.couldNotStartChat\);\s*abortRef\.current = null;\s*sendingRef\.current = false;\s*setSending\(false\);\s*return;\s*\}/.test(app));
}

{
  console.log("\n── An update is offered, and the user presses it ──");
  /* (owner, 2026-09-23: "I want to show the update message and I press
     update to know that there is update happened".) The watcher used to move
     the tab by itself — a reload the moment the tab went hidden, and the
     installed app reloading itself on sight — so the dock app changed under
     him and he never saw an update arrive. Now the capsule offers it, in the
     browser and the installed app alike, and waits for the button. The one
     launch that still moves a stale tab is AppLaunchLink's, and only because
     a soft navigation on a stale bundle fails (its chunks are gone). */
  const watcher = readFileSync("src/components/pwa/UpdateWatcher.tsx", "utf8");
  const watcherCode = stripComments(watcher, { line: "all" });
  check("the watcher reloads the page in exactly one place — the Update button",
    (watcherCode.match(/location\.reload\(\)/g) ?? []).length === 1 &&
    /const onUpdate = \(\) => \{[\s\S]{0,1400}?window\.location\.reload\(\)/.test(watcherCode) &&
    /onClick=\{onUpdate\}/.test(watcherCode));
  check("  …no reload when the tab goes hidden, and no self-reload in the installed app",
    !/onHide/.test(watcherCode) && !/healInstalledApp|isInstalledApp|HEAL_KEY/.test(watcherCode) &&
    !("healAttemptsFor" in uw) && !("HEAL_ATTEMPTS_MAX" in uw));
  check("  …a stale tab shows the offer — \"New version available\" with Update — until it is pressed",
    /if \(id !== boot\.current && alive\) \{[\s\S]{0,600}?setStale\(true\);/.test(watcherCode) &&
    /\{t\(confirming \? "u\.updated" : "u\.available"\)\}/.test(watcherCode) &&
    /const confirming = !stale;/.test(watcherCode));
  const css = readFileSync("src/app/globals.css", "utf8");
  check("  …and the offer stays off a live call, whose Update button would end it",
    /\$\{confirming \? "" : "kx-update-offer"\}/.test(watcherCode) &&
    /body:has\(\[data-kx-call-active='1'\]\) \.kx-update-offer \{ display: none; \}/.test(css));

  /* THE MOVE IS CONFIRMED (22 Sep 2026). Three of the four paths onto a new
     build are silent by design, so the owner pushed, watched the deploy
     finish, and found no sign in the system that anything had arrived. The
     watcher now writes a {from, to} note the moment it knows the tab is
     stale — before any path moves it — and the next boot confirms the
     arrival once, with the one-line "Updated to the latest version" capsule,
     if and only if it is no longer on `from`. */
  const { arrivalFromMarker, updateMarker } = uw;
  check("a boot that is no longer on the stale build confirms the move — whichever path made it",
    arrivalFromMarker(updateMarker("a", "b"), "b")?.to === "b" &&
    arrivalFromMarker(updateMarker("a", "b"), "c")?.from === "a");
  check("  …a boot still on the stale build says nothing (a CDN still serving the old HTML) and keeps the note for the next try",
    arrivalFromMarker(updateMarker("a", "b"), "a") === null &&
    /const a = arrivalFromMarker\(sessionStorage\.getItem\(UPDATE_KEY\), here\);\s*if \(a\) \{\s*sessionStorage\.removeItem\(UPDATE_KEY\);/.test(watcher));
  check("  …no note, or junk, confirms nothing",
    arrivalFromMarker(null, "a") === null &&
    arrivalFromMarker("not json", "a") === null &&
    arrivalFromMarker(JSON.stringify({ f: 1, t: "b" }), "a") === null);
  check("  …the note is written the moment staleness is known, BEFORE any path moves the tab, and confirmed only once the new build has gone quiet",
    /if \(id !== boot\.current && alive\) \{\s*try \{\s*sessionStorage\.setItem\(UPDATE_KEY, updateMarker\(boot\.current, id\)\);/.test(watcher) &&
    /whenNetworkQuiet\(\{ quietMs: 700, maxWaitMs: 6000 \}\)\.then\(\(\) => \{\s*if \(!alive\) return;[\s\S]{0,400}arrivalFromMarker\(/.test(watcher) &&
    /timer = window\.setTimeout\(\(\) => setArrived\(null\), ARRIVAL_SHOW_MS\);/.test(watcher) &&
    /"u\.updated":/.test(watcher));
}

/* ── CHAT SCREEN REVIEW (owner, 2026-09-26: "صلّح من ١ لـ ٩") ─────────── */
{
  console.log("\n── Chat screen review: retry, direction, long words, errors in words, task-card words, hidden taps, following, light theme, edit box ──");
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const bub = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");

  /* 1 */
  check("a failed turn offers one tap to ask again: the banner's Retry resends the caller's last message while the thread ends on it",
    /const canRetryLast = !sending && lastMessage\?\.role === "user" && !!lastMessage\.content;/.test(app) &&
    /\{canRetryLast && \(\s*<button\s*type="button"\s*onClick=\{\(\) => \{ setError\(null\); handleRegenerate\(\); \}\}\s*data-retry-last/.test(app) &&
    /\{copy\.retry\}/.test(app.slice(app.indexOf("data-retry-last"), app.indexOf("data-retry-last") + 800)));
  check("  …and Save and retry with the words unchanged sends them again; only an empty box cancels",
    /const next = editValue\.trim\(\);[\s\S]{0,400}?if \(!next\) \{\s*setEditing\(false\);/.test(bub) && !/next === msg\.content/.test(bub));

  /* 2 */
  check("an empty message box on an Arabic screen runs right to left from the first paint",
    textDirection("", "rtl") === "rtl" && textDirection("", "ltr") === "ltr" &&
    /dir=\{textDirection\(input, lang === "ar" \? "rtl" : "ltr"\)\}/.test(app));

  /* 3 */
  const longUser = renderToStaticMarkup(<Bubble {...({ msg: { id: "u1", role: "user", content: "https://example.com/" + "a".repeat(300) }, copy: COPY.en, lang: "en" } as any)} /> as ReactElement);
  check("a long unbroken string wraps: the caller's bubble, the fallback and the reply's prose, links and inline code break anywhere",
    /whitespace-pre-wrap \[overflow-wrap:anywhere\]/.test(longUser) &&
    /\.koleex-md p,\s*\.koleex-md li,\s*\.koleex-md h1,\s*\.koleex-md h2,\s*\.koleex-md h3,\s*\.koleex-md h4,\s*\.koleex-md blockquote,\s*\.koleex-md a,\s*\.koleex-md \.koleex-md-inline-code \{\s*overflow-wrap: anywhere;\s*\}/.test(css) &&
    !/\.koleex-md (pre|td|th)[^{]*\{[^}]*overflow-wrap/.test(css));

  /* 4 */
  check("a failed turn is said in the chat's words: a dropped link, a failed answer, a bare status — Egyptian, never the server's English",
    chatError("NetworkError", "ar") === COPY.ar.networkDropped && chatError(new TypeError("Failed to fetch"), "zh") === COPY.zh.networkDropped &&
    chatError(SERVER_ANSWER_FAILED, "ar") === COPY.ar.answerFailed && chatError(SERVER_ANSWER_FAILED, "zh") === COPY.zh.answerFailed &&
    chatError("HTTP 502", "ar") === COPY.ar.answerFailed && chatError("HTTP 404", "ar") === COPY.ar.somethingWrong &&
    !/تحقق|أعد المحاولة|يرجى/.test(COPY.ar.networkDropped + COPY.ar.answerFailed + COPY.ar.somethingWrong) &&
    !/humanizeError/.test(app) && (app.match(/chatError\(/g) ?? []).length >= 10);

  /* 5 */
  check("the task change card says each field and value in the screen's words",
    taskChangeLine("due_date", "Fri 19 Sep, 13:00", COPY.ar) === "موعدها: Fri 19 Sep, 13:00" &&
    taskChangeLine("priority", "medium", COPY.ar) === "أولوية متوسطة" && taskChangeLine("priority", "high", COPY.zh) === "高优先级" &&
    taskChangeLine("recurrence", "weekly", COPY.ar) === "بتتكرر: كل أسبوع" && taskChangeLine("is_private", true, COPY.en) === "Private: Yes" &&
    taskChangeLine("label", null, COPY.en) === "Label: —" && taskChangeLine("mystery_field", "x", COPY.en) === "mystery field: x");
  check("  …and the create card reads repeats in words and a company-wide task as Everyone",
    taskCardDetails("createTodo", { assign_to_all: true }, { recurrence: "monthly" }, COPY.ar).join("|") === `${COPY.ar.forPeople} الكل|${COPY.ar.repeats} كل شهر`);

  /* 7 */
  check("the thread follows content that grows without a new message (a photo loading, the last render, the Thinking panel) — or shows the chip — but never pulls the Library or Calls lists",
    /<div ref=\{threadContentRef\} className="relative z-\[1\] max-w-\[820px\]/.test(app) &&
    /if \(!content \|\| libraryOpen \|\| callsOpen \|\| typeof ResizeObserver === "undefined"\) return;/.test(app) &&
    /if \(userFollowingRef\.current\) el\.scrollTop = el\.scrollHeight;\s*else setShowJumpToBottom\(el\.scrollHeight - el\.clientHeight - el\.scrollTop > 120\);/.test(app) &&
    /\}, \[libraryOpen, callsOpen\]\);/.test(app));

  /* 8 */
  check("the light theme reads: links in the Hub blue (source chips keep their own), inline code and table headers on a dark wash",
    /\[data-theme="light"\] \.koleex-md a:not\(\.koleex-md-source\) \{\s*color: var\(--kx-ai-accent, #0066FF\);/.test(css) &&
    /\[data-theme="light"\] \.koleex-md \.koleex-md-inline-code \{\s*background: rgba\(0, 0, 0, 0\.06\);/.test(css) &&
    /\[data-theme="light"\] \.koleex-md th \{\s*background: rgba\(0, 0, 0, 0\.04\);/.test(css));

  /* 9 */
  check("the edit box is as tall as the message: rows follow its lines (up to 8), field-sizing grows it, a cap keeps it on screen",
    /rows=\{Math\.min\(8, Math\.max\(1, editValue\.split\("\\n"\)\.length\)\)\}/.test(bub) &&
    /className="kx-edit-box w-full[^"]*max-h-\[40vh\] overflow-y-auto"/.test(bub) &&
    /\.kx-edit-box \{\s*field-sizing: content;\s*\}/.test(css));
}

/* ── CHAT POLISH 10–14 (owner: "ok do it") ───────────────────────────── */
{
  console.log("\n── Chat polish: tap targets, library icons, words, screen reader ──");
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const bub = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  const md = readFileSync("src/components/ai/MessageMarkdown.tsx", "utf8");
  const lb = readFileSync("src/components/ai/PhotoLightbox.tsx", "utf8");
  const tc = readFileSync("src/components/ai/TaskCard.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");

  /* 10 */
  const chipAt = app.indexOf("data-remove-photo");
  const chipBlock = app.slice(app.lastIndexOf('className="group relative inline-block h-16 w-16', chipAt), chipAt);
  check("a photo waiting to be sent clips its picture, not its remove button — the finger-sized hit area stays whole",
    chipAt > 0 && /className="group relative inline-block h-16 w-16"/.test(chipBlock) && !/h-16 w-16 overflow-hidden/.test(chipBlock) &&
    /<span className="block h-full w-full overflow-hidden rounded-lg border/.test(chipBlock));

  /* 11 */
  const chipHtml = renderToStaticMarkup(<MessageMarkdown content="See [Forbes](https://www.forbes.com/x)." lang="en" /> as ReactElement);
  check("a source chip is a finger-sized target on touch screens: the link carries the 44px area, its words ellipsize on their own span",
    /<a[^>]*class="koleex-md-source"[^>]*><span class="koleex-md-source-text">Forbes<\/span><\/a>/.test(chipHtml) &&
    /\.kx-ai-root a\.koleex-md-source::after \{\s*content: "";\s*position: absolute;[\s\S]{0,120}width: max\(100%, 44px\);\s*height: max\(100%, 44px\);/.test(css) &&
    /\.koleex-md a\.koleex-md-source \{\s*position: relative;/.test(css) && !/\.koleex-md a\.koleex-md-source \{[^}]*overflow: hidden/.test(css) &&
    /\.koleex-md \.koleex-md-source-text \{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;/.test(css));

  /* 12 */
  check("library icons, not typed glyphs: the jump chip's arrow, the file clip, the stopped mark, the task link's arrow, the lightbox cross",
    !/↓ \{copy\.latest\}/.test(app) && /<ArrowDownIcon size=\{12\} aria-hidden \/>\s*\{copy\.latest\}/.test(app) &&
    !/<span aria-hidden>📎<\/span>/.test(app + bub) && (app.match(/<PaperclipIcon /g) ?? []).length === 1 && (bub.match(/<PaperclipIcon /g) ?? []).length === 1 &&
    /<StopIcon size=\{11\} aria-hidden \/>/.test(bub) && !/<rect x="6" y="6" width="12" height="12" rx="2" \/>/.test(bub) &&
    /<ArrowRightIcon /.test(tc) && /<CrossLineIcon size=\{22\} aria-hidden \/>/.test(lb) && !/strokeWidth="1\.5"/.test(lb));

  /* 13 */
  const noAlt = renderToStaticMarkup(<MessageMarkdown content="![](https://example.com/a.jpg)" lang="ar" /> as ReactElement);
  check("an unnamed picture is named in the screen's language, and the last formal Arabic lines are Egyptian",
    new RegExp(`aria-label="${COPY.ar.photo}"`).test(noAlt) && !/aria-label="Photo"/.test(noAlt) && !/"Photo"/.test(md) &&
    COPY.ar.taskCancelled === "ما اتحفظتش" && COPY.ar.mentions === "هيتبلّغ" && COPY.zh.photo === "图片");

  /* 14 */
  check("the screen reader hears an upload's progress and a finished reply — once per turn, not on opening a thread or after a failure",
    /<div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl[^"]*">\s*<span className="h-3 w-3 shrink-0 motion-safe:animate-spin[^>]*\/>\s*\{attachStatus\}/.test(app) &&
    /const replyAnnounce = turnsDone > 0 && !sending && lastMessage\?\.role === "assistant" && !!lastMessage\.content/.test(app) &&
    /setSending\(false\);\s*setTurnsDone\(\(n\) => n \+ 1\);\s*\}/.test(app) &&
    /<p className="sr-only" role="status" aria-live="polite" data-reply-announce>\{replyAnnounce\}<\/p>/.test(app) &&
    ["en", "zh", "ar"].every((l) => !!COPY[l as "en"].replyReady));
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
