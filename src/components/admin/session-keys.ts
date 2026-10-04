/* localStorage keys of the legacy session. Using localStorage (not
   sessionStorage) so the session survives browser restarts — the user only
   has to sign in again after an explicit Sign Out.

   Their OWN tiny module on purpose: the header's user menu and the signed-in
   gate read these names on every page, and importing them from AdminAuth
   dragged the whole sign-in screen (form, join panel, its dictionary) into
   every page's first download for people who are already signed in. */
export const LEGACY_SESSION_KEY = "koleex-admin";
export const LEGACY_SESSION_USER_KEY = "koleex-admin-user";
/* Survives sign-out — LEGACY_SESSION_USER_KEY does not. Who you are is worth
   remembering across a deliberate sign-out; that you were signed in is not. */
export const LAST_USER_KEY = "koleex-last-user";
