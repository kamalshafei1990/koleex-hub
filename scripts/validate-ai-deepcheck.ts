/* ---------------------------------------------------------------------------
   validate:ai-deepcheck — the findings of the 2026-09-24 deep check, pinned.

   Owner, 2026-09-24: "make a deep check for this app and fix any issue or
   bug". Five read-only audits (chat client, voice, server, performance,
   UI/UX) produced the list; each fix below is held by a check here so the
   next change cannot quietly undo it. The same-turn confirm guard lives in
   validate:ai-confirm-ledger beside the rest of the ledger.

   Phase 1 — security.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import * as ev from "../src/lib/voice/events";
import type { TranscriptLine as L } from "../src/lib/voice/events";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}
const read = (p: string) => readFileSync(p, "utf8");

console.log("\n── 1. Viewing as someone is read-only on every AI write ──");
{
  const writes: Array<[string, RegExp]> = [
    ["src/app/api/ai/agent/route.ts", /export async function POST\(req: Request\) \{[\s\S]{0,400}?requireAuth\(req\)/],
    ["src/app/api/ai/conversations/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/conversations/[id]/route.ts", /export async function PATCH\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/conversations/[id]/route.ts", /export async function DELETE\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/projects/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/projects/[id]/route.ts", /export async function PATCH\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/projects/[id]/route.ts", /export async function DELETE\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/feedback/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/attachments/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/attachments/chunk/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
  ];
  for (const [file, re] of writes) {
    const name = file.replace("src/app/api/ai/", "").replace("/route.ts", "");
    check(`${name}: the write handler hands its request to requireAuth, which refuses writes while viewing as`, re.test(read(file)));
  }
  check("requireAuth(req) is what blocks a mutating method while viewing as",
    /if \(req && auth\.viewing_as\) \{[\s\S]{0,200}method !== "GET" && method !== "HEAD" && method !== "OPTIONS"/.test(read("src/lib/server/auth.ts")));
}

console.log("\n── 2. Attachments read only the caller's own uploads ──");
{
  const att = read("src/app/api/ai/attachments/route.ts");
  check("the direct storage-path mode is gone: nothing downloads or deletes a path a ref names",
    !/async function extractFromStorage\(/.test(att) && !/\.download\(path\)/.test(att) && !/\.remove\(\[path\]\)/.test(att));
  check("a ref without an upload id is refused, not read",
    /\} else \{\s*\/\*[^*]*\*\/\s*const name = [^;]+;\s*results\.push\(\{ name, error: "read_failed" \}\);/.test(att));
  check("relayed pieces are still read from the signed-in account's own folder",
    /results\.push\(await extractFromParts\(ref, auth\.account_id, question\)\);/.test(att));
}

console.log("\n── 3. The chat list on this device belongs to one account ──");
{
  const app = read("src/components/ai/KoleexAiApp.tsx");
  check("the cache key carries the account id, and no account means no cache",
    /const id = getCurrentAccountIdSync\(\);\s*return id \? `koleex-ai-conversations-cache-v3:\$\{id\}` : null;/.test(app));
  check("the old shared key is removed and never written again",
    /sessionStorage\.removeItem\("koleex-ai-conversations-cache-v2"\)/.test(app) && !/setItem\("koleex-ai-conversations-cache-v2"/.test(app) && !/CONV_CACHE_KEY/.test(app));
  check("a refused list (401/403) clears what is on screen instead of leaving another account's rows",
    /if \(res\.status === 401 \|\| res\.status === 403\) \{\s*setConversations\(\[\]\);\s*return;\s*\}/.test(app));
}

console.log("\n── 4. Knowledge-base text is data, not instructions ──");
{
  const kn = read("src/lib/server/ai-knowledge.ts");
  const nudge = kn.slice(kn.indexOf("export async function getKnowledgeNudgeBlock("));
  check("the nudge's document lines go into the prompt inside the per-turn untrusted fence",
    /fenceUntrusted\(lines\.join\("\\n"\), "document", "Koleex knowledge base", newFenceId\(\)\)/.test(nudge) &&
      !/\+\s*lines\.join\("\\n"\)\s*\)/.test(nudge));
}

console.log("\n── 5. Voice: the call keeps its words, its answers and its sound ──");
{
  const q: L = { role: "user", text: "How much is the machine?", final: true };
  const opened = ev.appendTranscript([q], { role: "assistant", text: "The machine costs", incremental: true, final: false });
  const cut = ev.settleOpenLine(opened, "assistant", { cut: true });
  check("a drop closes the open answer with its words, marked as cut", cut.length === 2 && cut[1].final && cut[1].cut === true && cut[1].text === "The machine costs");
  check("…an answer that ends on its own is never marked", ev.settleOpenLine(opened, "assistant")[1].cut === undefined);
  const rest = ev.appendTranscript(cut, { role: "assistant", text: " five hundred dollars.", incremental: true, final: false });
  const done = ev.appendTranscript(rest, { role: "assistant", text: "The machine costs five hundred dollars.", final: true });
  check("the resumed rest of the SAME answer folds back into the cut line — one answer in the thread, not its start twice",
    done.length === 2 && done[1].text === "The machine costs five hundred dollars." && done[1].final && done[1].cut === undefined);
  const settledOnItsOwn = ev.settleOpenLine(opened, "assistant");
  const next = ev.appendTranscript(ev.appendTranscript(settledOnItsOwn, { role: "assistant", text: " more", incremental: true, final: false }),
    { role: "assistant", text: "The machine costs more than that.", final: true });
  check("…a new answer after one that ended on its own stays its own line, even when it starts the same way", next.length === 3);
  const other = ev.appendTranscript(ev.appendTranscript(cut, { role: "assistant", text: "Sorry", incremental: true, final: false }),
    { role: "assistant", text: "Sorry, the line dropped. What was the question?", final: true });
  check("…and a fresh answer after a cut (a new far side) that does not continue it is kept apart", other.length === 3 && other[1].text === "The machine costs");

  const session = read("src/lib/voice/session.ts");
  check("a lookup's answer and the request to carry on go to the socket that continues the session, not the one the question came on",
    /private sendToolResult\(origin: VoiceChannel, callId: string, output: unknown\): void \{\s*const channel = this\.liveChannelFor\(origin\);/.test(session) &&
      /private sendResponseCreate\(origin: VoiceChannel\): void \{\s*const channel = this\.liveChannelFor\(origin\);/.test(session));
  check("…the link is made by a handover and by a redial the relay RESUMED — never by a fresh session",
    /if \(this\.channel && this\.channel !== channel\) this\.channelSuccessor\.set\(this\.channel, channel\);\s*this\.channel = channel;\s*this\.wsOpenedAt = this\.clock\(\);/.test(session) &&
      /if \(hello\.resumed\) \{[\s\S]{0,160}if \(previousChannel && previousChannel !== channel\) this\.channelSuccessor\.set\(previousChannel, channel\);/.test(session) &&
      (session.match(/channelSuccessor\.set\(/g) ?? []).length === 2);
  check("a redial's socket age starts at its own open, so a refused resume cannot teach a wrong lifetime",
    /this\.ws = ws;\s*\/\*[\s\S]*?\*\/\s*this\.wsOpenedAt = 0;/.test(session));
  const wa = read("src/lib/voice/ws-audio.ts");
  check("the far side's audio is counted BEFORE the worklet takes the buffer (a transferred buffer reads empty)",
    /const n = samples\.length;\s*if \(sink\) sink\.push\(samples\);[\s\S]{0,140}gate\.push\(n\);/.test(wa));
  const btn = read("src/components/ai/VoiceCallButton.tsx");
  check("Confirm on a call names the conversation its preview was recorded under",
    /conversationId: sessionRef\.current\?\.callConversationId \?\? null/.test(btn) &&
      /via: "tap",[\s\S]{0,400}\.\.\.\(pending\.conversationId \? \{ conversation_id: pending\.conversationId \} : \{\}\),/.test(btn));
  const watch = read("src/app/api/cron/voice-watch/route.ts");
  check("the voice watchdog calls it an error only when no region can serve a call",
    /if \(healthy \|\| servable\) console\.warn\(line\);\s*else console\.error\(line\);/.test(watch));
}

console.log("\n── 6. Chat: no duplicate sends, no stuck spinners, Stop really stops ──");
{
  const app = read("src/components/ai/KoleexAiApp.tsx");
  check("a dropped send is resent only after the network COMES BACK — never at once on a link the device still calls online",
    /if \(!onlineRef\.current && now\) \{\s*playSound\("back-online"\);\s*onlineReturnRef\.current \+= 1;\s*setOnlineReturn\(onlineReturnRef\.current\);/.test(app) &&
      /if \(onlineReturn <= pending\.afterReturn\) return;/.test(app));
  check("…and the dropped message's bubble goes with it, so the resend is not shown twice",
    /setMessages\(\(prev\) => prev\.filter\(\(m\) => m\.id !== placeholderId && !\(isNetwork && m\.id === optimistic\.id\)\)\);/.test(app));
  check("Retry on a chat that failed to load loads it (a failed chat is not 'already open')",
    /if \(id === activeIdRef\.current && !loadingConvRef\.current && !loadErrorRef\.current\) \{/.test(app));
  const newChat = app.slice(app.indexOf("const startNewChat = useCallback("), app.indexOf("const startNewChat = useCallback(") + 1600);
  check("New chat clears the spinner and error of the chat just left",
    /setLoadingConv\(false\);\s*loadingConvRef\.current = false;\s*setLoadError\(false\);/.test(newChat));
  check("the first message's new chat is activated only if the user is still there; a switch or Stop ends the turn without jumping back",
    /const created = await createConversation\(\{ activate: false \}\);[\s\S]{0,900}?if \(aborter\.signal\.aborted\) \{[\s\S]{0,300}?return;\s*\}[\s\S]{0,300}?setActiveId\(created\);/.test(app) &&
      /if \(opts\.activate !== false\) setActiveId\(conversation\.id\);/.test(app));
  check("Stop before the request leaves takes both bubbles away and gives the words back",
    /if \(aborter\.signal\.aborted\) \{\s*setMessages\(\(prev\) => prev\.filter\(\(m\) => m\.id !== optimistic\.id && m\.id !== placeholderId\)\);/.test(app));
  check("Regenerate, Edit and a tapped answer leave the composer's draft and files alone; dictation is still the composer's turn",
    /const fromComposer = textOverride === undefined \|\| viaVoice;\s*const filesToSend = fromComposer \? attachments : \[\];/.test(app) && /if \(fromComposer\) \{\s*setInput\(""\);/.test(app));
  check("leaving the app aborts the reply and silences the read-aloud",
    /useEffect\(\(\) => \(\) => \{\s*abortRef\.current\?\.abort\(\);\s*ttsHandleRef\.current\?\.cancel\(\);/.test(app));
  check("a task card keeps its outcome when its reply's id becomes the saved row's",
    (app.match(/carryTaskCard\(placeholderId, (?:persisted\.id|finalMessage\.id)\);\s*setMessages/g) ?? []).length === 2);
  check("deleting a chat on a dead link says so, and a deleted open chat stops loading and leaves the address",
    /\} catch \{\s*setError\(humanizeError\("NetworkError"\)\);\s*return;\s*\}/.test(app) && /syncUrl\(\{ c: null, view: null \}, "replace"\);\s*\}\s*\}, \[pendingDeleteId, syncUrl\]\);/.test(app));
  const md = read("src/components/ai/MessageMarkdown.tsx");
  check("a code fence with no language is drawn as a code block (newlines kept, copy button), not inline code",
    /pre: \(\{ children \}\) => \{[\s\S]{0,400}return <CodeBlock labels=\{labels\}>\{text\}<\/CodeBlock>;/.test(md));
  const route = read("src/app/api/ai/agent/route.ts");
  const orch = read("src/lib/server/ai-agent/orchestrator.ts");
  check("Stop reaches the server: the stream's cancel() sets `stopped`, every frame goes through emit(), and the turn is told",
    /cancel\(\) \{\s*stopped = true;\s*\},/.test(route) && /isCancelled: \(\) => stopped,/.test(route) &&
      !/controller\.enqueue\(send/.test(route.slice(route.indexOf("let stopped = false;"), route.indexOf("try { controller.close(); }"))));
  check("…and a stopped turn runs no further round and no tool — above all no write",
    (orch.match(/if \(isCancelled\?\.\(\)\) return \{ steps, finalReply: "", provider: servedLabel\(turnMeta\), conversationId, failed: true \};/g) ?? []).length === 2 &&
      orch.indexOf("if (isCancelled?.()) return", orch.indexOf("const toolRuns = await Promise.all(") - 400) < orch.indexOf("const toolRuns = await Promise.all("));
  check("a turn no model answered is a failed turn: not revealed, not saved as a reply, logged ok=0",
    /failed: true,\s*\};/.test(orch.slice(orch.indexOf('logSealTransform(msg, safeReply, "call-failed");'))) &&
      /if \(agent\.failed\) throw new TurnFailedError\(\);/.test(route) &&
      /if \(agent\.failed\) \{[\s\S]{0,300}ok: false[\s\S]{0,120}return NextResponse\.json\(\{ error: "unavailable" \}, \{ status: 503 \}\);/.test(route));
}

console.log("\n── 7. Speed ──");
{
  const app = read("src/components/ai/KoleexAiApp.tsx");
  const wavy = read("src/components/ui/WavyBackground.tsx");
  check("the chat's background is still (owner, 2026-09-24): one frame, no loop — and the Hub's own Reduce Motion is honoured everywhere",
    /<WavyBackground still \/>/.test(app) && /stillProp \|\|\s*window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches \|\|\s*document\.documentElement\.classList\.contains\("kx-reduce-motion"\)/.test(wavy) &&
      /if \(still\) return;/.test(wavy));
  const side = read("src/components/ai/Sidebar.tsx");
  check("chat rows are memoised and the app hands every row the SAME handlers, so a streaming reply no longer redraws the list",
    /export const SidebarRow = memo\(SidebarRowImpl\);/.test(side) &&
      (app.match(/onOpen=\{openConversation\}\s*onRename=\{renameConversation\}\s*onDelete=\{requestDeleteConversation\}\s*onTogglePin=\{togglePin\}\s*onMove=\{moveConversation\}\s*onExport=\{exportConversation\}/g) ?? []).length === 3 &&
      !/onOpen=\{\(\) => openConversation\(c\.id\)\}/.test(app));
  const md = read("src/components/ai/MessageMarkdown.tsx");
  check("the reply being written is parsed when the device has time (deferred), not on every frame",
    /const content = useDeferredValue\(liveContent\);/.test(md));
  const bubble = read("src/components/ai/Bubble.tsx");
  check("the markdown renderer is loaded when a reply needs it, with the plain text in its place until then — and warmed after the app is up",
    /const MessageMarkdown = lazy\(\(\) => import\("@\/components\/ai\/MessageMarkdown"\)\);/.test(bubble) &&
      !/^import MessageMarkdown from/m.test(bubble) && /<Suspense fallback=\{<div className="whitespace-pre-wrap"/.test(bubble) &&
      /void import\("@\/components\/ai\/MessageMarkdown"\);/.test(app));
  check("the accounts admin client is loaded for the one save that needs it, not with the app",
    !/^import \{ updateAccountPreferences \} from "@\/lib\/accounts-admin";/m.test(app) && /import\("@\/lib\/accounts-admin"\)/.test(app));
  check("one orb stylesheet for the whole screen (hoisted and de-duplicated), not one per reply",
    /<style href="kx-aiorb-styles" precedence="kx-aiorb">/.test(read("src/components/ai-orb/AIOrb.tsx")));
  const transport = read("src/lib/server/ai/core/transport.ts");
  check("a streaming provider that never sends headers is given up on in 30 s, not 120, so failover can try the next one",
    /const DEFAULT_STREAM_HEADER_MS = 30_000;/.test(transport) &&
      /const headerBudget = Math\.min\(\s*timeoutMs\(process\.env\.AI_HTTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS\),\s*timeoutMs\(process\.env\.AI_HTTP_HEADER_TIMEOUT_MS, DEFAULT_STREAM_HEADER_MS\),\s*\);/.test(transport));
  const route = read("src/app/api/ai/agent/route.ts");
  check("the rate-limit round trip runs beside the ownership read, and a refused turn still returns before any write",
    /const \[refused, \{ data: conv \}, storedLang\] = await Promise\.all\(\[\s*budgetGate\(\),/.test(route) &&
      route.indexOf("if (refused) return refused;") > 0 && route.indexOf("if (refused) return refused;") < route.indexOf('.from("ai_messages")'));
}

console.log("\n── 8. Design, part 1: a quieter screen ──");
{
  const app = read("src/components/ai/KoleexAiApp.tsx");
  const menu = read("src/components/ai/ComposerAddMenu.tsx");
  const copyTs = read("src/components/ai/copy.ts");
  check("the message box has ONE '+' (files and photos, web search) and no emoji picker",
    /<ComposerAddMenu\s+onAttach=\{openFilePicker\}\s+webSearch=\{webSearch\}\s+onWebSearchChange=\{setWebSearch\}/.test(app) &&
      !/EmojiButton|insertEmoji/.test(app) && !/aria-label=\{copy\.searchWeb\}/.test(app));
  check("  …the file picker opens inside the tap (iOS needs the gesture), and search that is ON stays visible as a chip that turns it off",
    /onClick=\{\(\) => \{[\s\S]{0,200}?onAttach\(\);\s*setOpen\(false\);/.test(menu) &&
      /\{webSearch && \(\s*<button[\s\S]{0,80}?onClick=\{\(\) => onWebSearchChange\(false\)\}/.test(menu) &&
      /role="menuitemcheckbox"\s+aria-checked=\{webSearch\}/.test(menu));
  check("no 'Powered by' line under the box, no second subtitle in the header",
    !/copy\.footer/.test(app) && !/footer:/.test(copyTs) && (app.match(/copy\.welcomeSub/g) ?? []).length === 0);
  check("the sidebar's back arrow is phone-only (the desktop header has its own); no second 'New project' row",
    /className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg[^"]*"\s+title=\{copy\.back\}/.test(app) &&
      /\{projects\.length > 0 && \(/.test(app) && !/projects\.length === 0 \? \(/.test(app));
  const side = read("src/components/ai/Sidebar.tsx");
  check("only a pinned chat shows a pin; pinning an unpinned one is in its menu",
    /\{pinned && \(\s*<button/.test(side) && !/\[@media\(hover:none\)\]:opacity-100 focus-visible:opacity-100 text-\[var\(--text-dim\)\] hover:text-\[var\(--text-primary\)\]"/.test(side) &&
      /key: "pin",\s*label: pinned \? copy\.unpin : copy\.pin/.test(side));
  check("the menus portalled to <body> carry the AI colours (the red Delete was plain text), and the row menu opens on the correct side in Arabic",
    /\.kx-ai-root, \.kx-call-root, \.kx-ai-tokens \{/.test(read("src/app/globals.css")) &&
      /kx-pop-panel kx-ai-tokens/.test(side) && /kx-pop-panel kx-ai-tokens/.test(menu) && /kx-pop-panel kx-ai-tokens/.test(read("src/components/ai/ModelPicker.tsx")) &&
      /rtl \? r\.left : r\.right - W/.test(side) && /\[@media\(pointer:coarse\)\]:min-h-11/.test(side));
  check("the greeting uses each language's own punctuation — no 'مرحبًا, Kamal.'",
    /welcomeTitleNamed: "أهلاً يا \{name\}"/.test(copyTs) && /welcomeTitleNamed: "你好，\{name\}。"/.test(copyTs) &&
      /copy\.welcomeTitleNamed\.replace\("\{name\}", firstName\)/.test(read("src/components/ai/WelcomeCard.tsx")));
  const card = read("src/components/ai/TaskCard.tsx");
  check("a task card says the priority in the reader's language and uses the app's own colours",
    /priority === "high" \? copy\.priorityHigh : priority === "low" \? copy\.priorityLow : ""/.test(card) &&
      !/text-tertiary|var\(--danger|var\(--brand|12\.5px|bg-\[#0066FF\]/.test(card) && /lang === "ar" \? "←" : "→"/.test(card));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
