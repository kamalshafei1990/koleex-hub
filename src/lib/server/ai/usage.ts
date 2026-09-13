import "server-only";

/* ---------------------------------------------------------------------------
   ai/usage — how much Koleex AI is used, by day, with no content in it.

   Roadmap D3. The owner decides with numbers: how many people wrote or
   called, how many turns, how many calls ended with a summary, which tools
   ran and whether they succeeded. Everything here is a COUNT over rows the
   product already writes (messages, conversations, the tool-call audit);
   no message text, no arguments, no names of customers leave this module.
   Cost is not here: token usage is logged per turn (cost/meter.ts) and not
   stored, so a dollar figure would be a guess — said plainly in the UI.

   Pure: rows in, a report out. The route reads tenant-scoped for a super
   admin only.
   --------------------------------------------------------------------------- */

export const USAGE_DAYS_DEFAULT = 14;
export const USAGE_DAYS_MAX = 60;
export const USAGE_TOP_TOOLS = 10;

export function parseDays(raw: unknown): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return USAGE_DAYS_DEFAULT;
  return Math.min(n, USAGE_DAYS_MAX);
}

/** UTC day of a timestamp, YYYY-MM-DD; null for an unreadable one. */
export function dayOf(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

export type MessageRow = { created_at: string; role: string; source: string | null };
export type ConversationRow = { created_at: string; account_id: string | null };
export type ToolCallRow = { created_at: string; tool_name: string; ok: boolean | null; account_id: string | null };
export type CallRow = { created_at: string };

export type UsageDay = {
  day: string;
  /** Caller turns typed and spoken; Koleex AI's replies. */
  typed: number;
  spoken: number;
  replies: number;
  /** Conversations started; calls that ended with a summary; tool calls. */
  chats: number;
  calls: number;
  tools: number;
};

export type UsageReport = {
  since: string;
  days: UsageDay[];
  tools: Array<{ name: string; count: number; okRate: number }>;
  /** Distinct accounts that started a chat or ran a tool in the window. */
  people: number;
  totals: Omit<UsageDay, "day">;
};

/** The last `days` UTC days ending today, oldest first, every day present
 *  even when nothing happened on it — a gap is information too. */
export function dayKeys(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) out.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

export function aggregateUsage(input: {
  days: number;
  now?: Date;
  messages: readonly MessageRow[];
  conversations: readonly ConversationRow[];
  toolCalls: readonly ToolCallRow[];
  calls: readonly CallRow[];
}): UsageReport {
  const keys = dayKeys(input.days, input.now);
  const byDay = new Map<string, UsageDay>(keys.map((k) => [k, { day: k, typed: 0, spoken: 0, replies: 0, chats: 0, calls: 0, tools: 0 }]));
  const bump = (iso: string, field: keyof Omit<UsageDay, "day">) => {
    const k = dayOf(iso);
    const row = k ? byDay.get(k) : undefined;
    if (row) row[field] += 1;
  };
  for (const m of input.messages) {
    if (m.role === "user") bump(m.created_at, m.source === "voice" ? "spoken" : "typed");
    else if (m.role === "assistant") bump(m.created_at, "replies");
  }
  const people = new Set<string>();
  for (const c of input.conversations) {
    bump(c.created_at, "chats");
    if (c.account_id) people.add(c.account_id);
  }
  for (const c of input.calls) bump(c.created_at, "calls");
  const toolAgg = new Map<string, { count: number; ok: number }>();
  for (const t of input.toolCalls) {
    bump(t.created_at, "tools");
    if (t.account_id) people.add(t.account_id);
    const a = toolAgg.get(t.tool_name) ?? { count: 0, ok: 0 };
    a.count += 1;
    if (t.ok) a.ok += 1;
    toolAgg.set(t.tool_name, a);
  }
  const daysOut = keys.map((k) => byDay.get(k)!);
  const totals = daysOut.reduce(
    (acc, d) => ({ typed: acc.typed + d.typed, spoken: acc.spoken + d.spoken, replies: acc.replies + d.replies, chats: acc.chats + d.chats, calls: acc.calls + d.calls, tools: acc.tools + d.tools }),
    { typed: 0, spoken: 0, replies: 0, chats: 0, calls: 0, tools: 0 },
  );
  const tools = Array.from(toolAgg.entries())
    .map(([name, a]) => ({ name, count: a.count, okRate: a.count ? Math.round((a.ok / a.count) * 100) : 0 }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name))
    .slice(0, USAGE_TOP_TOOLS);
  return { since: `${keys[0]}T00:00:00.000Z`, days: daysOut, tools, people: people.size, totals };
}
