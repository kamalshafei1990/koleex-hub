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

import { readFileSync } from "node:fs";
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
import { SidebarRow } from "../src/components/ai/Sidebar";
import { COPY as SIDEBAR_COPY } from "../src/components/ai/copy";
import PhotoLightbox from "../src/components/ai/PhotoLightbox";
import MessageMarkdown from "../src/components/ai/MessageMarkdown";
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
  check("a lookup says so rather than leaving a silence",
    text(searchingScreen).includes("Looking it up"));
  check("and it outranks Listening, which is not what is happening",
    !/\bListening\b/.test(text(searchingScreen)));
  /* But it must NOT outrank the two states that are about whether the call
     works at all. A muted call that is also looking something up has a bigger
     problem to report. */
  const searchingMuted = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} searching muted onToggleMute={() => {}} /> as ReactElement,
  );
  check("muted still wins over a lookup", text(searchingMuted).includes("Microphone off"));
  const searchingWobble = renderToStaticMarkup(
    <VoiceCallScreen live reconnecting phase="listening" audioLevel={0.2} lines={lines} lang="en"
      onEnd={() => {}} searching /> as ReactElement,
  );
  check("and reconnecting wins over both", /reconnecting/i.test(text(searchingWobble)));
  for (const [lang, needle] of [["zh", "正在查询"], ["ar", "بدوّر"]] as const) {
    const w = renderToStaticMarkup(
      <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang={lang}
        onEnd={() => {}} searching /> as ReactElement,
    );
    check(`  …said in ${lang} too`, text(w).includes(needle));
  }

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
    "src/components/ai/EmojiButton.tsx",
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
     caller silently monolingual instead of broken. EmojiButton sits inside
     KoleexAiApp, which is far too large to render here, so this is checked
     at the source: weaker than rendering, and the only thing that catches
     it at all. */
  for (const comp of ["EmojiButton", "TypingIndicator"]) {
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
    try { return /<EmojiButton|<TypingIndicator/.test(readFileSync(f, "utf8")); } catch { return false; }
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
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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
  check("muting swaps in a mic-off glyph rather than overdrawing the mic",
    /line x1="4" y1="3\.5" x2="20" y2="20\.5"/.test(mutedControls) &&
    !/<rect x="9" y="2" width="6" height="12"/.test(mutedControls));
  check("  …and unmuted draws the plain mic, with no slash at all",
    /<rect x="9" y="2" width="6" height="12"/.test(controls) &&
    !/y2="20\.5"/.test(controls));

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
  check("closed: a Voice control that opens a dialog, labelled with the voice now speaking, and no tiles",
    /aria-haspopup="dialog"/.test(closedSheet) && /aria-expanded="false"/.test(closedSheet) && />Omar</.test(closedSheet) &&
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
    pressedOf("Omar") === "true" && /ring-\[#0066FF\]\/40/.test(withPicker) && (withPicker.match(/kx-voice-glyph is-on/g) ?? []).length === 1);
  check("and the other one is not", pressedOf("Layla") === "false");
  check("exactly one is chosen at a time",
    withPicker.split('aria-pressed="true"').length - 1 === 1);
  check("the sheet has a title, a Close, a backdrop, and the note that the call carries on",
    /Choose a voice/.test(withPicker) && /aria-label="Close"/.test(withPicker) && /bg-black\/60/.test(withPicker) && /The conversation carries on/.test(withPicker));

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
  check("the picker's own label is localised", arPicker.includes("الصوت"));
  const arSheet = renderToStaticMarkup(
    <VoiceCallScreen live phase="listening" audioLevel={0.2} lines={[]} lang="ar"
      onEnd={() => {}} voices={voices} selectedVoice="v2" onSelectVoice={() => {}} defaultVoiceSheetOpen /> as ReactElement,
  );
  check("but the voice names are the owner's words, not translated",
    arSheet.includes("Omar") && arSheet.includes("Layla") && arSheet.includes("اختار الصوت"));

  /* Brand: the picker introduces no new colour. */
  const pickerHexes = [...withPicker.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase());
  const ok = new Set(["#0D0D0D", "#FF3333", "#0066FF", "#AAAAAA", "#666666", "#2E2E2E", "#FFFFFF", "#000000", "#567FB2", "#7FA9D6", "#BCD8F0", "#0B0D11", "#141414" /* the sheet's own dark grey */]);
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
    !/voiceLines/.test(app) && !/onTranscript/.test(callButtonEl));
  check("the existing mic still hands its transcript to the chat",
    /<MicButton[\s\S]{0,400}?onTranscript=\{\(t\) => send\(t, true\)\}/.test(app));
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
  /* NO LANGUAGE CHIPS. The caller is not asked which language they speak. */
  check("nothing on the screen asks the caller which language they speak",
    !/I speak|بتكلم|我说/.test(thinking) && !/lang="ar"[^>]*aria-pressed/.test(thinking));
  /* THE PICTURE EXPANDS IN PLACE. */
  const lb = renderToStaticMarkup(<PhotoLightbox photo={{ url: "https://cdn.example/kx180.jpg", label: "KX-180" }} onClose={() => {}} closeLabel="Close photo" /> as ReactElement);
  check("the lightbox is a dialog with the picture fitted whole, its name, and a close control",
    /role="dialog"/.test(lb) && /aria-modal="true"/.test(lb) && /<img[^>]*src="https:\/\/cdn\.example\/kx180\.jpg"[^>]*object-contain/.test(lb) && /aria-label="Close photo"/.test(lb) && lb.includes("KX-180</p>"));
  check("  …and draws nothing when there is no picture", renderToStaticMarkup(<PhotoLightbox photo={null} onClose={() => {}} /> as ReactElement) === "");
  /* THE HIDDEN BORDER. The Aurora rim is a ::before with inset:0 against
     the nearest positioned ancestor; a glass surface that is not itself
     positioned lends the rim to its column. */
  const bubbleSrc = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  const welcomeSrc = readFileSync("src/components/ai/WelcomeCard.tsx", "utf8");
  check("every glass surface in the chat is its own positioning context, so the rim stays on it and off the text",
    /"kx-glass relative bg-\[var\(--bg-secondary\)\]/.test(bubbleSrc) && /className="kx-glass relative group flex/.test(welcomeSrc));
}

{
  /* PICTURES LIVE IN THE CONVERSATION, the way ChatGPT shows them — not in a
     strip pinned above the words. A line that carries photos opens the
     conversation view; the orb view draws no pictures at all. */
  const photos = [{ url: "https://cdn.example/kx180.jpg", label: "KX-180 Spreader" }];
  const lines: TranscriptLine[] = [{ role: "assistant", text: "The KX-180.", final: true, photos }];
  const withPhotos = renderToStaticMarkup(
    <VoiceCallScreen live phase="speaking" audioLevel={0} lines={lines} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  const without = renderToStaticMarkup(
    <VoiceCallScreen live phase="speaking" audioLevel={0} lines={[{ role: "assistant", text: "The KX-180.", final: true }]} lang="en" onEnd={() => {}} /> as ReactElement,
  );
  check("a lookup's photos are drawn in the conversation, under the words that named them",
    /<img[^>]*src="https:\/\/cdn\.example\/kx180\.jpg"/.test(withPhotos) && withPhotos.indexOf("The KX-180.") < withPhotos.indexOf("<img"));
  check("  …named, for the eye and for a screen reader", /alt="KX-180 Spreader"/.test(withPhotos) && /aria-label="KX-180 Spreader"/.test(withPhotos));
  check("  …as a labelled group", /role="group"[^>]*aria-label="Photos"/.test(withPhotos));
  check("  …as a button that expands it in place, not a link that leaves the app",
    /<button type="button"[^>]*aria-label="KX-180 Spreader"[^>]*>\s*<img/.test(withPhotos) && !/<a[^>]*href="https:\/\/cdn\.example\/kx180\.jpg"/.test(withPhotos) && !/z-\[260\]/.test(withPhotos));
  check("  …eagerly, with its box reserved", !/loading="lazy"/.test(withPhotos) && /<img[^>]*width="120"[^>]*height="120"/.test(withPhotos));
  check("  …a non-storage URL passes through the pipeline untouched", /src="https:\/\/cdn\.example\/kx180\.jpg"/.test(withPhotos));
  check("  …and a picture opens the CONVERSATION view: the small orb, the words, no big orb",
    /aria-label="Back to Koleex AI"/.test(withPhotos) && !/aria-label="Show conversation"/.test(withPhotos));
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
  check("a markdown image renders as a bounded, styled picture",
    /<img[^>]*class="koleex-md-img"[^>]*src="https:\/\/cdn\.example\/kx180\.jpg"/.test(shown) || /<img[^>]*src="https:\/\/cdn\.example\/kx180\.jpg"[^>]*class="koleex-md-img"/.test(shown));
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
    <VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="en" onEnd={() => {}} onSendText={() => true} /> as ReactElement,
  );
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
    /placeholder="اكتب حاجة في المكالمة…"/.test(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="ar" onEnd={() => {}} onSendText={() => true} /> as ReactElement)) &&
    /placeholder="在通话中输入文字…"/.test(renderToStaticMarkup(<VoiceCallScreen live phase="listening" audioLevel={0} lines={lines} lang="zh" onEnd={() => {}} onSendText={() => true} /> as ReactElement)));
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
  check("the hint under the orb explains the hold instead of saying there is no button to hold — and hands-free keeps the old hint",
    text(holdEmpty).includes("Hold the button while you speak") && !text(holdEmpty).includes("There is no button to hold") &&
    text(handsFreeEmpty).includes("There is no button to hold") && !text(handsFreeEmpty).includes("Hold the button while you speak"));
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
    const base = { active: false, projects: [], copy: SIDEBAR_COPY.en, onOpen: () => {}, onRename: () => {}, onDelete: () => {}, onTogglePin: () => {}, onMove: () => {} };
    const withHint = renderToStaticMarkup(<SidebarRow row={row} {...base} hint="…price for KX-200 was 1,250 USD…" /> as ReactElement);
    const without = renderToStaticMarkup(<SidebarRow row={row} {...base} /> as ReactElement);
    check("a matched row shows the snippet under its title, dim and on one line; a row without a hint is unchanged",
      /data-search-hint/.test(withHint) && withHint.includes("KX-200") && withHint.includes("Ningbo shipment") &&
      !/data-search-hint/.test(without) && without.includes("Ningbo shipment"));
  }

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
