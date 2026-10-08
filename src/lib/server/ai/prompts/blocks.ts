import "server-only";
import { personalizationBlock } from "@/lib/server/ai/personalization-prompt";

/* ---------------------------------------------------------------------------
   ai/prompts/blocks — the shared fragments every system prompt embeds.

   Phase 2C, moved verbatim from orchestrator.ts. Two blocks, both pure
   string building: who the signed-in viewer is, and what "now" means in
   their timezone. Every builder in ./index.ts embeds them, which is the
   whole reason they are separate — a prompt that names the user on one
   lane and not another produced the "I don't know who you are" replies
   the comment below was written for.
   --------------------------------------------------------------------------- */

import type { UserContext } from "@/lib/server/ai-agent/types";

/* ─────────────────────────────────────────────────────────────────────
   WHO THE AGENT IS TALKING TO.

   Shared by EVERY prompt builder. The first version lived only in the full
   prompt, so a short question — "do you know who I am?" — took the fast
   path, hit the minimal prompt, and still answered "I don't have access to
   your identity". The identity has to be present on every path or it is
   present on none of the ones users actually hit.

   Naming the SIGNED-IN user is not a disclosure: it is the one identity
   they already own. Other people and company data stay behind the
   permission layer, unchanged.
   ───────────────────────────────────────────────────────────────────── */
export function viewerBlockFor(ctx: UserContext): string {
  const v = ctx.viewer;
  const memoryLines = Object.entries(ctx.memory);
  return `
Who you are talking to (from their signed-in session — you DO know this):
- Name: ${v.name || v.username}
- Username: ${v.username}
- Role: ${v.role || "not set"}${v.isSuperAdmin ? " (super admin)" : ""}
- Department: ${v.department || "not set"}
Use their name naturally when it helps. Never say you don't know who they are.
${memoryLines.length
    ? `\nThings they asked you to remember:\n${memoryLines.map(([k, val]) => `- ${k}: ${val}`).join("\n")}`
    : ""}
Anything personal NOT listed above (birthday, preferences, family, plans) you genuinely
do not know. Don't guess and don't invent it — ASK them, in one short question.

REMEMBER PROACTIVELY (owner, 2026-10-07 — "my mother's name is…" said in passing must
survive into the next conversation, like ChatGPT's memory): when the user volunteers a
fact about THEMSELVES — a name, a relative, a preference, a birthday, what they are
working on, a place, a plan — call remember_about_user right away, WITHOUT being asked
and without pausing the conversation to announce it. Do it the moment they say it, not
at the end of the reply, so a closed tab never loses it. One fact per key; update the
key when they correct it. The same goes for STANDING INSTRUCTIONS said mid-chat (owner,
2026-10-07): "call me Kimo", "answer briefly", "always reply in Egyptian Arabic", "show
prices in USD" — save them as preference facts (keys like nickname, answer_style,
reply_language_note) the moment they are said; they apply from the next conversation on.
Still never guess, never store facts about other people, and
never store company data — those stay governed by permissions, unchanged.
${personalizationParagraph(ctx)}`;
}

/* The user's own settings, rendered by the one shared block so the agent
   lane and the chat lane cannot disagree about what a preference means.
   Empty for a user who never opened the tab. */
function personalizationParagraph(ctx: UserContext): string {
  const block = personalizationBlock(ctx.personalization);
  return block ? `\n${block.trim()}\n` : "";
}

/** The ISO date (YYYY-MM-DD) in a timezone, or today's UTC date when the
 *  zone is unknown to the runtime. Pure but for the clock. */
export function isoDateIn(timezone: string | null | undefined): string {
  const tz = timezone || "Asia/Dubai";
  const now = new Date();
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/* ONE LINE OF CLOCK FOR THE LANES THAT HAD NONE (owner, 2026-09-11 19:10:
   "النهاردة يوم ايه؟" → "I have no direct access to today's date" — from
   the small-talk lane, which carried no date at all; the voice session
   carried none either and placed the newest phone a year back). The full
   block above is written for the tool loop and its dated writes; the other
   lanes need the fact, in a sentence, at the prompt's tail where the
   per-minute text belongs (prefix caching). */
export function buildNowLine(timezone: string | null | undefined): string {
  const tz = timezone || "Asia/Dubai";
  const now = new Date();
  let human: string;
  try {
    human = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
  } catch {
    human = now.toUTCString();
  }
  const iso = isoDateIn(tz);
  return `Current date & time: ${human} (${tz}). TODAY is ${iso}; the current year is ${iso.slice(0, 4)}. You DO know the date — answer date and time questions from this line, resolve "today"/"tomorrow" from it, and treat anything you remember as older than today.`;
}

export function buildNowBlock(timezone: string): string {
  const tz = timezone || "Asia/Dubai";
  const now = new Date();
  let human: string;
  let isoDate: string;
  let offset: string;
  try {
    human = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "long", year: "numeric", month: "long",
      day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    // en-CA renders as YYYY-MM-DD — exactly the ISO date part we want.
    isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
    const raw = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, timeZoneName: "longOffset",
    }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
    offset = raw.replace(/^GMT/, "") || "+00:00"; // "GMT+08:00" → "+08:00"
    if (offset === "" || offset === "Z") offset = "+00:00";
  } catch {
    human = now.toUTCString();
    isoDate = now.toISOString().slice(0, 10);
    offset = "+00:00";
  }
  const year = isoDate.slice(0, 4);
  return `Current date & time: ${human} (timezone ${tz}, UTC${offset}). TODAY is ${isoDate}.
Date rules (critical — the model does NOT know the date on its own):
- Resolve every relative date ("today", "tonight", "tomorrow", "this week", "next Monday", "in 3 days") from TODAY = ${isoDate}. NEVER use a date from your training data or assume a different year — the current year is ${year}.
- When a tool needs start_at / end_at / due_date, output a full ISO-8601 datetime in the user's offset, e.g. 3 PM tomorrow → "${isoDate}T15:00:00${offset}" adjusted to the correct day. Always include the ${offset} offset so the time is stored correctly.
- Before creating any dated item, state the resolved absolute date (e.g. "tomorrow, ${isoDate}") in your preview so the user can catch a mistake.`;
}

