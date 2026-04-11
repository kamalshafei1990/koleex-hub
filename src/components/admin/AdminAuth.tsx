"use client";

/* ---------------------------------------------------------------------------
   AdminAuth — legacy (pre-Supabase-Auth) sign-in gate.

   Ask username + password once and remember the signed-in user across
   tabs / browser restarts / days via localStorage. Re-prompts only after
   an explicit logout (handled by UserMenu → clears the storage key).

   This replaces the old shared-password gate. Every person now signs in
   with their own account row from the `accounts` table, so the header can
   show the real identity and audit logs can attribute actions correctly.

   The password check uses the same `tmp$<base64>` tag format that
   createAccount / resetAccountPassword write, via verifyAccountLogin.
   Not cryptographically secure — it's a bridge until Supabase Auth is
   flipped on; see verifyAccountLogin for the security note.
   --------------------------------------------------------------------------- */

import { useState, useEffect } from "react";
import { LogIn, Loader2, AlertCircle } from "lucide-react";
import { verifyAccountLogin } from "@/lib/accounts-admin";
import { setCurrentAccountId } from "@/lib/identity";

/* localStorage keys. Using localStorage (not sessionStorage) so the session
   survives browser restarts — the user only has to sign in again after an
   explicit Sign Out. */
export const LEGACY_SESSION_KEY = "koleex-admin";
export const LEGACY_SESSION_USER_KEY = "koleex-admin-user";

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function AdminAuth({ title, subtitle, children }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Rehydrate session state on mount. `authed === null` means we haven't
     checked yet, so we show a spinner instead of flashing the login form. */
  useEffect(() => {
    try {
      const ok = window.localStorage.getItem(LEGACY_SESSION_KEY) === "true";
      setAuthed(ok);
    } catch {
      setAuthed(false);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter a username and password.");
      return;
    }
    setBusy(true);
    const result = await verifyAccountLogin(username, password);
    setBusy(false);

    if (!result.ok) {
      if (result.reason === "not_found") {
        setError("No account with that username.");
      } else if (result.reason === "disabled") {
        setError("This account is suspended or archived.");
      } else {
        setError("Incorrect password.");
      }
      return;
    }

    /* Persist the session + the account id so the header / identity hook
       pick up the real user immediately. */
    try {
      window.localStorage.setItem(LEGACY_SESSION_KEY, "true");
      window.localStorage.setItem(
        LEGACY_SESSION_USER_KEY,
        result.account.username,
      );
    } catch {
      /* ignore — auth still works in-memory for this tab */
    }
    setCurrentAccountId(result.account.id);
    setAuthed(true);
  }

  /* Initial hydration: show nothing heavy so we don't flash the form. */
  if (authed === null) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[17px] font-bold text-[var(--text-primary)] leading-tight truncate">
                  {title}
                </h1>
                <p className="text-[12px] text-[var(--text-dim)] mt-0.5 truncate">
                  {subtitle}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="jane.cooper"
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white outline-none focus:border-white/30 transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px] flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !username || !password}
                className="w-full h-10 rounded-xl bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" /> Sign In
                  </>
                )}
              </button>
            </form>
          </div>
          <p className="text-[11px] text-[var(--text-ghost)] text-center mt-4">
            Koleex Group · Secure Hub
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
