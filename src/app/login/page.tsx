"use client";

/* ---------------------------------------------------------------------------
   /login — Supabase Auth sign-in page (Project C Phase 2).

   Flow:
     1. User enters email + password → signInWithPassword
     2. If the account has MFA enabled, we get { mfaRequired: true, factorId }
        → swap to the code-entry form and call verifyMfaChallenge
     3. On success, redirect to the original target (?next=...) or /.

   If NEXT_PUBLIC_USE_SUPABASE_AUTH is not "true" this page renders a
   read-only notice instead of the form, so stray navigation can't lock the
   user into a broken flow. The legacy AdminAuth gate on /, /accounts, etc.
   keeps working in that mode.
   --------------------------------------------------------------------------- */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SignInIcon from "@/components/icons/ui/SignInIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import {
  isSupabaseAuthEnabled,
  signInWithPassword,
  verifyMfaChallenge,
  getCurrentSession,
} from "@/lib/auth-client";
import { setCurrentAccountId } from "@/lib/identity";
import { LEGACY_SESSION_KEY, LEGACY_SESSION_USER_KEY } from "@/components/admin/AdminAuth";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // If already signed in, skip the form.
  useEffect(() => {
    (async () => {
      if (!isSupabaseAuthEnabled()) {
        setHydrated(true);
        return;
      }
      const session = await getCurrentSession();
      if (session) {
        router.replace(next);
        return;
      }
      setHydrated(true);
    })();
  }, [router, next]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    // Legacy path: POST to the server-side /api/auth/signin endpoint.
    // The server verifies the password using the service-role Supabase
    // client (the anon key never touches password_hash anymore) and sets
    // an HttpOnly signed session cookie on the response. The browser
    // never sees — and cannot forge — session credentials.
    if (!isSupabaseAuthEnabled()) {
      try {
        const resp = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });
        const json = (await resp.json()) as
          | { ok: true; account: { id: string; username: string } }
          | { ok: false; error: string };
        setBusy(false);
        if (!resp.ok || !("ok" in json) || !json.ok) {
          setError(
            "ok" in json && !json.ok
              ? json.error
              : "Sign-in failed — please try again.",
          );
          return;
        }
        // Legacy session bookkeeping so AdminAuth skips the redundant
        // "Welcome back" prompt on the destination page. Still using
        // localStorage here for the UI flag — actual auth is now the
        // server-verified cookie.
        try {
          window.localStorage.setItem(LEGACY_SESSION_KEY, "true");
          window.localStorage.setItem(
            LEGACY_SESSION_USER_KEY,
            json.account.username,
          );
        } catch {
          /* ignore */
        }
        setCurrentAccountId(json.account.id);
        // Hard reload so every cached hook (sidebar, scope ctx,
        // permission gates) re-fires with the new identity.
        window.location.href = next;
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
      return;
    }

    // Real Supabase Auth path (only when NEXT_PUBLIC_USE_SUPABASE_AUTH=true)
    const res = await signInWithPassword(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.mfaRequired) {
      setFactorId(res.factorId);
      return;
    }
    router.replace(next);
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setBusy(true);
    const res = await verifyMfaChallenge(factorId, code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.replace(next);
  }

  // Legacy mode renders the same form — we wire handlePasswordSubmit to
  // the legacy verifyAccountLogin path when Supabase Auth is disabled.
  // The old "not yet enabled" placeholder blocked real testing of roles
  // and tenancy by locking users out of /login entirely.

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  const showingMfa = factorId !== null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-7 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center">
              {showingMfa ? (
                <ShieldCheckIcon className="h-5 w-5" />
              ) : (
                <SignInIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-bold text-[var(--text-primary)] leading-tight">
                {showingMfa ? "Verify it's you" : "Koleex HUB"}
              </h1>
              <p className="text-[12px] text-[var(--text-dim)] mt-0.5">
                {showingMfa
                  ? "Enter the 6-digit code from your authenticator"
                  : "Sign in to continue"}
              </p>
            </div>
          </div>

          {!showingMfa ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@koleexgroup.com"
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px] flex items-start gap-2">
                  <ExclamationIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !email || !password}
                className="w-full h-10 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <SignInIcon className="h-4 w-4" /> Sign In
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider">
                  6-digit code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="123456"
                  className="w-full h-11 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-center text-[18px] font-mono tracking-[0.4em] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors"
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px] flex items-start gap-2">
                  <ExclamationIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full h-10 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="h-4 w-4" /> Verify &amp; continue
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFactorId(null);
                  setCode("");
                  setError(null);
                }}
                className="w-full h-9 rounded-lg bg-transparent text-[12px] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
              >
                ← Use a different account
              </button>
            </form>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-ghost)] text-center mt-4">
          Koleex Group · Secure Hub
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
