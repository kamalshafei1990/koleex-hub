/* ---------------------------------------------------------------------------
   marketing/linkedin — Share on LinkedIn (self-serve), for the CEO's own
   profile (owner, 29/09/2026). Checked against LinkedIn's docs the same day:
     · sign-in: www.linkedin.com/oauth/v2/authorization with openid + profile
       (Sign In with LinkedIn using OpenID Connect: the member's id is
       /v2/userinfo's "sub") and w_member_social (Share on LinkedIn);
     · the key lives 60 days and self-serve apps get NO refresh: the member
       signs in again, and the Accounts tab says when it has run out;
     · posting: POST api.linkedin.com/v2/ugcPosts (X-Restli-Protocol-Version
       2.0.0); pictures are registered (/v2/assets?action=registerUpload,
       feedshare-image), uploaded, then attached; the new post's URN comes
       back in the X-RestLi-Id header; 150 requests a member a day.
   LinkedIn shares no member's posts, comments or numbers with self-serve
   apps: the account is for PUBLISHING only.
   --------------------------------------------------------------------------- */

export const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"] as const;
/** A post's words (LinkedIn's own limit). */
export const LI_TEXT_MAX = 3000;
/** Pictures in one post. Videos from the Hub come later. */
export const LI_IMAGES_MAX = 9;
