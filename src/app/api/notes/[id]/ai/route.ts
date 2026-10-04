import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/notes/[id]/ai — Koleex AI on one note. Body: { action }
     summary   a short summary of the note, in the note's language
     actions   the action items in the note, one per line
   Answers { text } (summary) or { items: string[] } (actions) — a PROPOSAL.
   Nothing is written: the Notes panel shows it and the user chooses
   "Insert into note".

   Same chain as the other one-shot AI surfaces (work-reports/[id]/ai):
   signed in, internal account (Koleex AI is internal-only), read access to
   the note, a budget (30 an hour per account), the provider registry with
   failover, the note FENCED as untrusted data, AI_PROVENANCE_RULE verbatim.
   Only { text | items } or { error } leaves — never model/provider details.
   Nothing of the note is logged: lengths, timings and outcomes only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { chatWithTools } from "@/lib/server/ai/provider/registry";
import { meterTurn } from "@/lib/server/ai/cost/meter";
import { consumeBudget, limitMode, subjectFor } from "@/lib/server/ai/security/rate-limit";
import { fenceUntrusted, newFenceId } from "@/lib/server/ai/security/untrusted";
import { AI_PROVENANCE_RULE } from "@/lib/server/ai/prompt-builder";
import { canRead, getNoteAccess } from "@/lib/notes-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEADLINE_MS = 45_000;
const MAX_INPUT_CHARS = 24_000;
const PER_HOUR = 30;

const SYSTEM =
  "You help a Koleex employee with one of their own notes." +
  " Use ONLY what the note says. Never invent facts, names, numbers, dates or owners." +
  " Keep every name, number, code, date and amount exactly as written." +
  " Answer in the same language the note is written in." +
  " No greeting, no preamble, no headings, no Markdown, no emojis." +
  AI_PROVENANCE_RULE;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const internal = requireInternalUser(auth);
  if (internal) return internal;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;
  const { id } = await params;

  const access = await getNoteAccess<{ title: string; body_plain: string }>(id, auth.account_id, "title, body_plain");
  if (!access.note || !canRead(access.role)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action === "actions" ? "actions" : body?.action === "summary" ? "summary" : null;
  if (!action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const text = `${access.note.title ?? ""}\n\n${access.note.body_plain ?? ""}`.trim().slice(0, MAX_INPUT_CHARS);
  if (text.length < 3) return NextResponse.json({ error: "empty" }, { status: 400 });

  if (limitMode() !== "off") {
    const hit = await consumeBudget(subjectFor.account(auth.account_id), { bucket: "notes_ai", windowSec: 3600, max: PER_HOUR });
    if (!hit.allowed) {
      console.warn(`[notes.ai] ratelimit count=${hit.count} max=${hit.max} mode=${limitMode()}`);
      if (limitMode() === "enforce") {
        return NextResponse.json({ error: "busy" }, { status: 429, headers: { "Retry-After": String(hit.retryAfterSec) } });
      }
    }
  }

  const fence = newFenceId();
  const instruction = action === "summary"
    ? "Summarise this note in 2 to 5 short sentences: what it is about, the key points, and any decisions." +
      " Answer with the summary only, as plain text." +
      fenceUntrusted(text, "document", "The user's note", fence)
    : "List the action items in this note: concrete things someone has to do." +
      " One item per line, each a short imperative sentence; keep an owner or a date only if the note states it." +
      " No bullets, no numbering. If there are none, answer with exactly: NONE" +
      fenceUntrusted(text, "document", "The user's note", fence);

  const started = Date.now();
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), DEADLINE_MS));
  const out = await Promise.race([
    chatWithTools({
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: instruction }],
      maxTokens: action === "summary" ? 500 : 700,
      temperature: 0.2,
      modelClass: "GENERAL",
    }),
    deadline,
  ]);
  const ms = Date.now() - started;
  if (!out) {
    console.error(`[notes.ai] action=${action} outcome=deadline ms=${ms}`);
    return NextResponse.json({ error: "failed" }, { status: 504 });
  }
  meterTurn(out, { tenantId: auth.tenant_id ?? null, accountId: auth.account_id, lane: "notes-ai", traceId: null });
  const answer = out.ok ? (out.response.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim() : "";
  const cut = out.ok && out.response.finishReason === "length";
  if (!out.ok || !answer || cut) {
    console.error(`[notes.ai] action=${action} outcome=${!out.ok ? `status_${out.status}` : cut ? "length" : "empty"} ms=${ms}`);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
  console.warn(`[notes.ai] action=${action} in=${text.length} out=${answer.length} ms=${ms}`);
  const headers = { "Cache-Control": "private, no-store" };

  if (action === "summary") {
    return NextResponse.json({ text: answer.replace(/[*#`]+/g, "").trim() }, { headers });
  }
  const items = /^none\.?$/i.test(answer)
    ? []
    : answer
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)]|\[[ xX]?\])\s*/, "").replace(/[*`]+/g, "").trim())
        .filter((l) => l && !/^none\.?$/i.test(l))
        .slice(0, 30);
  return NextResponse.json({ items }, { headers });
}
