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

/** Each space's Comments tab. */
export const SPACE_COMMENTS: Record<MarketingSpace, string> = {
  company: "/social-marketing/comments",
  ceo: "/ceo-brand/comments",
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
export const PLATFORM_FLOW: Record<MarketingPlatform, "meta" | "soon" | "manual"> = {
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

/** What the connect flow tells the app page when it comes back (?connect=). */
export type ConnectResult = "ok" | "cancelled" | "expired" | "failed" | "setup" | "denied";
export const CONNECT_RESULTS: readonly ConnectResult[] = ["ok", "cancelled", "expired", "failed", "setup", "denied"];

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

/** Which of the server's settings are in place — booleans only. */
export interface MarketingSetup {
  tokenKey: boolean;
  meta: boolean;
  cron: boolean;
}
