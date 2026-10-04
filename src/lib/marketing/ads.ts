/* ---------------------------------------------------------------------------
   marketing/ads — comments on ADS (owner, 29/09/2026), shared by the server
   and the Accounts screen: which permissions each platform needs, and what
   the screen says about an account's ads.

   · Facebook: a Page's ad posts are listed with the Page key — Meta asks
     for pages_manage_ads and ads_management (and that the person who
     connected can ADVERTISE on the Page).
   · Instagram: an ad's Instagram media is known only to the ad account,
     read with the connecting person's key — ads_read or ads_management.
     That key lasts about 60 days: finding NEW Instagram ads then waits for
     a reconnect; comments on the ads already found keep coming.
   --------------------------------------------------------------------------- */

export const FACEBOOK_ADS_SCOPES = ["pages_manage_ads", "ads_management"] as const;
export const INSTAGRAM_ADS_SCOPES = ["ads_read", "ads_management"] as const;

export const facebookAdsGranted = (scopes: readonly string[]) => FACEBOOK_ADS_SCOPES.every((s) => scopes.includes(s));
export const instagramAdsGranted = (scopes: readonly string[]) => INSTAGRAM_ADS_SCOPES.some((s) => scopes.includes(s));

/** An account's ads, as the Accounts screen shows them. */
export interface AdsState {
  /** The permissions are granted (Instagram: and its key still works). */
  ready: boolean;
  /** What to add in Meta before reconnecting (none when ready). */
  missing: string[];
  /** Instagram: new ads are found until then (the key's end). */
  findUntil: string | null;
  /** The last scan's refusal from Meta, if any. */
  error: string | null;
}
