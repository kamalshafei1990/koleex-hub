/* ---------------------------------------------------------------------------
   marketing/instagram-login — Business Login for Instagram (the Instagram
   API with Instagram Login), for the CEO's own Instagram: a Creator account
   with no Facebook Page (owner, 29/09/2026). Checked 29/09/2026:
     · the dialog: www.instagram.com/oauth/authorize, the permissions below;
     · the code → a short-lived key (api.instagram.com/oauth/access_token)
       → a long-lived one, 60 days (graph.instagram.com/access_token), which
       is refreshed before it ends (graph.instagram.com/refresh_access_token,
       once it is a day old);
     · its keys are served by graph.instagram.com — the same paths as the
       Instagram calls the Hub makes through Facebook Login.
   Standard Access covers accounts the business owns or manages.
   --------------------------------------------------------------------------- */

export const INSTAGRAM_LOGIN_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
  "instagram_business_manage_insights",
] as const;

/** The signed-in Instagram account, as its /me answers. */
export interface InstagramLoginProfile { id: string; username: string | null; name: string | null; picture: string | null; followers: number | null; accountType: string | null }

/** An account connected with Instagram Login — its permissions are Instagram
 *  Login's own: Facebook Login never grants instagram_business_*. */
export const isInstagramLogin = (scopes: readonly string[]): boolean => scopes.includes("instagram_business_basic");
