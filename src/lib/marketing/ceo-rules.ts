/* ---------------------------------------------------------------------------
   marketing/ceo-rules — CEO Brand's rules, from the Executive Assistant's JD
   (KX-CEO-JD-001 v2.0 §15 and §23; owner, 30/09/2026):
     · 3 posts a week — one post adapted for every platform;
     · nothing is published without the CEO's approval;
     · allowed and NOT allowed content: the author confirms, when sending a
       post to the CEO, that it shows none of the not-allowed list, and
       Koleex AI reads its words and pictures against that list — a warning
       for the CEO, never a block (lib/server/marketing/content-check);
     · the KPI: 12 approved posts a month.
   Weeks run Monday to Sunday and months by the calendar, Shanghai time.
   --------------------------------------------------------------------------- */

export const CEO_WEEKLY_POSTS = 3;
export const CEO_MONTHLY_APPROVED = 12;

/** The JD's allowed content, in its order. */
export const JD_ALLOWED = ["work", "travel", "events", "office", "products"] as const;
/** The JD's NOT allowed content, in its order — what the check looks for. */
export const JD_NOT_ALLOWED = ["smoking_alcohol", "private_places", "messy", "documents", "confidential", "third_parties"] as const;
export type JdFlag = (typeof JD_NOT_ALLOWED)[number];

/** A reading of one thing — the words, or one picture: what it may show of
 *  the not-allowed list, and Koleex AI's own few words about it. */
export interface CheckReading {
  flags: JdFlag[];
  note: string | null;
}

export interface ContentCheckAi {
  status: "queued" | "checking" | "done" | "failed";
  /** When the check was asked for, started or finished. */
  at: string;
  /** The words and pictures it read: a post whose sig differs changed since. */
  sig: string;
  /** null = the words could not be read. */
  words?: CheckReading | null;
  /** Each picture in the post's order; reading null = it could not be read. */
  pictures?: Array<{ index: number; reading: CheckReading | null; skipped?: "video" }>;
}

/** marketing_posts.content_check. */
export interface ContentCheck {
  confirmed_by: string | null;
  confirmed_at: string | null;
  ai: ContentCheckAi | null;
}

/** A check still "checking" after this long died with its function: the
 *  screens stop waiting for it and offer to check again. */
export const CHECK_STALE_MS = 3 * 60_000;

/** Where a post's check stands, told by the server with the post (the
 *  screen reads no clock while it draws): none yet; running; done or
 *  failed on the words and pictures the post holds; or read before the
 *  post changed. */
export type ContentState = "none" | "running" | "done" | "failed" | "changed";

export function contentState(check: ContentCheck | null | undefined, sig: string, now: number): ContentState {
  const ai = check?.ai;
  if (!ai) return "none";
  if (checkRunning(ai, now)) return "running";
  if (ai.status !== "done" && ai.status !== "failed") return "failed";
  return ai.sig === sig ? ai.status : "changed";
}

/** Only the flags the JD knows, each once, in the JD's order. */
export function cleanFlags(raw: unknown): JdFlag[] {
  if (!Array.isArray(raw)) return [];
  const said = new Set(raw.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()));
  return JD_NOT_ALLOWED.filter((f) => said.has(f));
}

/** Whether a check still runs (asked for or started, and not dead). */
export function checkRunning(ai: ContentCheckAi | null | undefined, now: number): boolean {
  return !!ai && (ai.status === "queued" || ai.status === "checking") && now - Date.parse(ai.at) < CHECK_STALE_MS;
}
