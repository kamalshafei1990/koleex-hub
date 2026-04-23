"use client";

/* ---------------------------------------------------------------------------
   /change-password — forced first-login password change.

   Rendered by RootShell whenever the signed-in account has
   force_password_change=true. Everything else in the app is blocked
   until the user picks their own password. Also accessible on demand
   from the user menu via "Change password".
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { useRouter } from "next/navigation";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/accounts/me/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      setDone(true);
      /* Hard reload so the bootstrap cache drops the stale
         force_password_change=true — otherwise RootShell would bounce
         us right back here. */
      setTimeout(() => { window.location.href = "/"; }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/10 mx-auto mb-4">
            <CheckIcon size={32} className="text-emerald-400" />
          </div>
          <p className="text-[14px] text-[var(--text-primary)] font-medium">Password updated</p>
          <p className="text-[12px] text-[var(--text-dim)] mt-1">Taking you to the hub…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <KeyIcon size={18} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-[var(--text-primary)]">Set a new password</h1>
            <p className="text-[12px] text-[var(--text-dim)]">
              Your administrator set a temporary password. Pick your own to continue.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">
              Current (temporary) password
            </label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
              placeholder="Temp password from your admin"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">
              New password
            </label>
            <div className="relative">
              <input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                className="w-full h-10 px-3 pr-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNext((s) => !s)}
                aria-label={showNext ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-dim)] transition-colors"
              >
                {showNext ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">
              Confirm new password
            </label>
            <input
              type={showNext ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
              placeholder="Type the new password again"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {busy ? <SpinnerIcon size={16} className="animate-spin" /> : <CheckIcon size={16} />}
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>

        <p className="text-[11px] text-[var(--text-faint)] mt-4 text-center">
          After updating, you&apos;ll be signed in and taken to the hub.
        </p>
      </div>
      {/*
        There's no back / skip button by design — this is a forced reset
        for first-login. The user menu has a "Sign out" option if they
        need to abandon the session.
      */}
    </div>
  );
}
