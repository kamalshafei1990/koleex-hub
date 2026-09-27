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

/** The app page each space returns to after connecting an account. */
export const SPACE_ROUTE: Record<MarketingSpace, string> = {
  company: "/social-marketing",
  ceo: "/ceo-brand",
};

export const asSpace = (v: string | null | undefined): MarketingSpace => (v === "ceo" ? "ceo" : "company");

export type MarketingPlatform = "facebook" | "instagram" | "linkedin" | "youtube" | "tiktok" | "x" | "wechat" | "whatsapp" | "douyin";

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
  updated_at: string;
}

/** Which of the server's settings are in place — booleans only. */
export interface MarketingSetup {
  tokenKey: boolean;
  meta: boolean;
  cron: boolean;
}
