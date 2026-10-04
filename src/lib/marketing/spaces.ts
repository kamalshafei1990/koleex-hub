/* ---------------------------------------------------------------------------
   marketing/spaces — where a connected account lives, shared by the server
   and the screens.

   'company' = Koleex's own pages and profiles, run from Social Marketing.
   'ceo'     = the CEO's personal accounts, run from CEO Brand with its own
               Roles module (owner, 27/09/2026: only the CEO approves there).
   --------------------------------------------------------------------------- */

export type MarketingSpace = "company" | "ceo";

/** The Roles module that governs each space — the APP_REGISTRY name. */
export const SPACE_MODULE: Record<MarketingSpace, string> = {
  company: "Social Marketing",
  ceo: "CEO Brand",
};

/** Each space's Feed — the app's home. */
export const SPACE_HOME: Record<MarketingSpace, string> = {
  company: "/social-marketing",
  ceo: "/ceo-brand",
};

/** Each space's Posts tab (the composer lives under it). */
export const SPACE_POSTS: Record<MarketingSpace, string> = {
  company: "/social-marketing/posts",
  ceo: "/ceo-brand/posts",
};

/** Each space's Calendar tab. */
export const SPACE_CALENDAR: Record<MarketingSpace, string> = {
  company: "/social-marketing/calendar",
  ceo: "/ceo-brand/calendar",
};

/** Each space's Insights tab. */
export const SPACE_INSIGHTS: Record<MarketingSpace, string> = {
  company: "/social-marketing/insights",
  ceo: "/ceo-brand/insights",
};

/** Each space's Plan tab (the weekly plan). */
export const SPACE_PLAN: Record<MarketingSpace, string> = {
  company: "/social-marketing/plan",
  ceo: "/ceo-brand/plan",
};

/** Each space's Comments tab. */
export const SPACE_COMMENTS: Record<MarketingSpace, string> = {
  company: "/social-marketing/comments",
  ceo: "/ceo-brand/comments",
};

/** Each space's Messages tab (Messenger and Instagram Direct). */
export const SPACE_MESSAGES: Record<MarketingSpace, string> = {
  company: "/social-marketing/messages",
  ceo: "/ceo-brand/messages",
};

/** The accounts page each space returns to after connecting an account. */
export const SPACE_ROUTE: Record<MarketingSpace, string> = {
  company: "/social-marketing/accounts",
  ceo: "/ceo-brand/accounts",
};

export const asSpace = (v: string | null | undefined): MarketingSpace => (v === "ceo" ? "ceo" : "company");

export type MarketingPlatform = "facebook" | "instagram" | "linkedin" | "youtube" | "tiktok" | "x" | "wechat" | "whatsapp" | "douyin";

/* How each platform is added (owner, 27/09/2026: "connect any account by
   myself, add or remove freely; Koleex accounts too, the Odoo way"):
   · "meta"   — sign in with Facebook; the Pages chosen there and their
                Instagram business accounts are added;
   · "soon"   — needs Koleex's own app on that platform first (and, for some,
                the platform's approval), so the tile says what is missing;
   · "manual" — no API for posting (WeChat, WhatsApp, Douyin): the account is
                added by name and link, and posts go out with one-tap sharing. */
export type PlatformFlow = "meta" | "instagram" | "linkedin" | "soon" | "manual";
export const PLATFORM_FLOW: Record<MarketingPlatform, PlatformFlow> = {
  facebook: "meta",
  instagram: "meta",
  linkedin: "soon",
  youtube: "soon",
  tiktok: "soon",
  x: "soon",
  wechat: "manual",
  whatsapp: "manual",
  douyin: "manual",
};
export const PLATFORM_ORDER: readonly MarketingPlatform[] = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "x", "wechat", "whatsapp", "douyin"];
export const MANUAL_PLATFORMS = PLATFORM_ORDER.filter((p) => PLATFORM_FLOW[p] === "manual");
/** CEO Brand's own accounts (owner, 29/09/2026): Facebook = his Public
 *  Figure PAGE, signed in like Koleex's (a personal profile has had no
 *  posting API since 2018); Instagram signs in with Instagram Login (a
 *  Creator account, no Facebook Page); LinkedIn signs in with Share on
 *  LinkedIn (his profile, publishing only); WeChat and Douyin are shared by
 *  hand. */
export const CEO_PLATFORM_FLOW: Record<MarketingPlatform, PlatformFlow> = {
  facebook: "meta",
  instagram: "instagram",
  linkedin: "linkedin",
  youtube: "soon",
  tiktok: "soon",
  x: "soon",
  wechat: "manual",
  whatsapp: "manual",
  douyin: "manual",
};
export const platformFlow = (space: MarketingSpace, platform: MarketingPlatform): PlatformFlow =>
  (space === "ceo" ? CEO_PLATFORM_FLOW : PLATFORM_FLOW)[platform];

/** What the connect flow tells the app page when it comes back (?connect=). */
export type ConnectResult = "ok" | "cancelled" | "expired" | "failed" | "setup" | "denied";
export const CONNECT_RESULTS: readonly ConnectResult[] = ["ok", "cancelled", "expired", "failed", "setup", "denied"];
/** Which sign-in came back (&via=): LinkedIn's banner speaks of LinkedIn —
 *  publishing only, no Feed — where Meta's speaks of pages and the Feed. */
export type ConnectVia = "linkedin";

/** A connected account as the screens see it — never its access key. */
export interface MarketingAccountView {
  id: string;
  space: MarketingSpace;
  platform: MarketingPlatform;
  connection: "api" | "assisted";
  external_id: string | null;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  status: "connected" | "expired" | "revoked" | "error" | "disconnected";
  last_error: string | null;
  last_synced_at: string | null;
  /** Followers now, refreshed on every sync; null until the first one. */
  audience: number | null;
  updated_at: string;
}

/** How an account reads on a screen: an Instagram account by its @handle —
 *  its display name is often the Page's, and the two would read the same —
 *  every other account by its name. */
export const accountLabel = (a: Pick<MarketingAccountView, "platform" | "name" | "handle">): string =>
  a.platform === "instagram" && a.handle ? `@${a.handle}` : a.name;

/** Which of the server's settings are in place — booleans only. */
export interface MarketingSetup {
  tokenKey: boolean;
  meta: boolean;
  cron: boolean;
  /** The Meta app's Instagram product keys (Business Login for Instagram). */
  instagram: boolean;
  /** The LinkedIn app's keys (Share on LinkedIn). */
  linkedin: boolean;
}

/** Whether Meta's refusal means the account was taken away from the Hub —
 *  not a key that ran out. It happens when a later Facebook sign-in leaves a
 *  Page (or its Instagram account) unselected: Meta then refuses every call
 *  for it (seen 29/09/2026 — the CEO's Page connected alone, Koleex's Page
 *  stopped five minutes later). The cure is to sign in again with it
 *  selected, which the screens say. */
export function pageAccessRemoved(error: string | null | undefined): boolean {
  /* Meta breaks its message over lines; read it as one. */
  return /impersonat\w* a user's page|has not authorized application|permission\(s\) must be granted/i.test((error ?? "").replace(/\s+/g, " "));
}
