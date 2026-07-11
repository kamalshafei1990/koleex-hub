"use client";

/* Settings → Password. Self-service change: current + new + confirm, posted
   to /api/me/password. The current password is verified server-side; the new
   one is re-hashed with Argon2id. */

import { useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

const MIN_LENGTH = 8;

export default function PasswordTab(_props: { account: AccountWithLinks }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const canSubmit =
    current.length > 0 && next.length >= MIN_LENGTH && confirm === next && next !== current && !busy;

  async function submit() {
    setError(null); setOk(false);
    if (next !== confirm) { setError("New passwords don't match."); return; }
    if (next.length < MIN_LENGTH) { setError(`New password must be at least ${MIN_LENGTH} characters.`); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) { setError(j.error || `Couldn't update password (${res.status})`); return; }
      setOk(true); setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
        <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Change password</h2>
        <p className="text-[12px] text-[var(--text-dim)] mt-0.5 mb-5">
          Enter your current password, then choose a new one (at least {MIN_LENGTH} characters).
        </p>

        <div className="space-y-4 max-w-sm">
          <Field label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
          <Field label="New password" value={next} onChange={setNext} autoComplete="new-password" />
          <Field label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {busy ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Updating…" : "Update password"}
          </button>
          {ok && (
            <span className="text-[12.5px] text-[#00CC66] inline-flex items-center gap-1.5">
              <CheckIcon size={13} /> Password updated
            </span>
          )}
          {error && <span className="text-[12.5px] text-[#FF6B6B]">{error}</span>}
        </div>
      </section>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        You&apos;ll stay signed in on this device after changing your password.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
      />
    </div>
  );
}
