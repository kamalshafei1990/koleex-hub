"use client";

/* ---------------------------------------------------------------------------
   SecurityTab — full security surface for an account.

   Sections:
     1. Password & Sign-in  — status of password, force-reset, 2FA placeholder
     2. API Keys            — list / create / revoke PATs
     3. Active Sessions     — list of device sessions with revoke
     4. Passkeys            — placeholder for WebAuthn (ships disabled)
     5. Login History       — audit log of recent auth / security events

   Everything here lives under the existing AdminAuth gate. Once real
   Supabase Auth is wired (see supabase/SUPABASE_AUTH_SETUP.md), the
   Password section will be joined by the actual 2FA enrollment flow.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  Shield,
  KeyRound,
  Monitor,
  Smartphone,
  Tablet,
  HardDrive,
  Fingerprint,
  History,
  Plus,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  ShieldOff,
  Ban,
  Clock,
} from "lucide-react";
import type {
  AccountWithLinks,
  ApiKeyRow,
  AccountSessionRow,
  LoginHistoryRow,
  LoginEventType,
} from "@/types/supabase";
import {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  fetchSessions,
  revokeSession,
  fetchLoginHistory,
} from "@/lib/account-security";
import {
  tabCardClass,
  tabSectionTitle,
  inputClass,
  primaryBtnClass,
  ghostBtnClass,
} from "./shared";
import ApiKeyRevealModal from "./ApiKeyRevealModal";

interface Props {
  account: AccountWithLinks;
}

export default function SecurityTab({ account }: Props) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [sessions, setSessions] = useState<AccountSessionRow[]>([]);
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-key form state
  const [newKeyName, setNewKeyName] = useState("");
  const [revealToken, setRevealToken] = useState<{
    token: string;
    name: string;
  } | null>(null);

  async function reload() {
    const [k, s, h] = await Promise.all([
      fetchApiKeys(account.id),
      fetchSessions(account.id),
      fetchLoginHistory(account.id, 50),
    ]);
    setKeys(k);
    setSessions(s);
    setHistory(h);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await reload();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleCreateKey() {
    const name = newKeyName.trim();
    if (!name) {
      setError("Give the key a name so you can recognise it later.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createApiKey(account.id, { name });
    setBusy(false);
    if (!res) {
      setError("Could not create the API key.");
      return;
    }
    setRevealToken({ token: res.token, name });
    setNewKeyName("");
    setToast("API key created. Copy it now — it will not be shown again.");
    await reload();
  }

  async function handleRevokeKey(id: string) {
    setBusy(true);
    const ok = await revokeApiKey(id);
    setBusy(false);
    if (!ok) {
      setError("Could not revoke the API key.");
      return;
    }
    setToast("API key revoked.");
    await reload();
  }

  async function handleDeleteKey(id: string) {
    setBusy(true);
    const ok = await deleteApiKey(id);
    setBusy(false);
    if (!ok) {
      setError("Could not delete the API key.");
      return;
    }
    setToast("API key removed.");
    await reload();
  }

  async function handleRevokeSession(id: string) {
    setBusy(true);
    const ok = await revokeSession(id);
    setBusy(false);
    if (!ok) {
      setError("Could not revoke the session.");
      return;
    }
    setToast("Session revoked.");
    await reload();
  }

  return (
    <div className="space-y-4">
      {/* ── Password & sign-in ── */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <Shield className="h-3.5 w-3.5" />
          Password &amp; Sign-in
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoTile
            icon={<KeyRound className="h-4 w-4" />}
            label="Password"
            value={
              account.password_hash
                ? "Set (temporary)"
                : "Not set — use Reset Password"
            }
            tone={account.password_hash ? "neutral" : "warn"}
          />
          <InfoTile
            icon={<RefreshCcw className="h-4 w-4" />}
            label="Force change on next login"
            value={account.force_password_change ? "Required" : "Not required"}
            tone={account.force_password_change ? "warn" : "ok"}
          />
          <InfoTile
            icon={<Fingerprint className="h-4 w-4" />}
            label="Two-factor auth"
            value="Not configured"
            tone="neutral"
          />
        </div>
        <p className="text-[11px] text-[var(--text-dim)] mt-4 leading-relaxed">
          Koleex Hub currently uses a lightweight admin gate. Once Supabase
          Auth is enabled (see{" "}
          <code className="text-[var(--text-muted)]">
            supabase/SUPABASE_AUTH_SETUP.md
          </code>
          ), two-factor and passkey enrolment will activate here automatically.
        </p>
      </section>

      {toast && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── API Keys ── */}
      <section className={tabCardClass}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className={tabSectionTitle + " mb-0"}>
            <KeyRound className="h-3.5 w-3.5" />
            API Keys
          </h2>
          <span className="text-[11px] text-[var(--text-dim)]">
            {keys.filter((k) => !k.revoked_at).length} active ·{" "}
            {keys.length} total
          </span>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            className={inputClass + " flex-1"}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. CI pipeline, Zapier integration)"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateKey();
            }}
          />
          <button
            type="button"
            onClick={handleCreateKey}
            disabled={busy || !newKeyName.trim()}
            className={primaryBtnClass}
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>

        {loading ? (
          <SkeletonRows count={2} />
        ) : keys.length === 0 ? (
          <EmptyRow
            icon={<KeyRound className="h-4 w-4" />}
            title="No API keys yet"
            description="Create one to authenticate programmatic access to Koleex."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {keys.map((k) => {
              const revoked = !!k.revoked_at;
              return (
                <div
                  key={k.id}
                  className="flex items-center gap-3 py-3 flex-wrap"
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      revoked
                        ? "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-dim)]"
                        : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    }`}
                  >
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                      {k.name}
                      {revoked && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                          Revoked
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[var(--text-dim)] font-mono truncate">
                      {k.key_prefix}…
                    </p>
                    <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                      Created {formatDate(k.created_at)}
                      {k.last_used_at && (
                        <> · Last used {formatDate(k.last_used_at)}</>
                      )}
                      {k.expires_at && (
                        <> · Expires {formatDate(k.expires_at)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!revoked && (
                      <button
                        type="button"
                        onClick={() => handleRevokeKey(k.id)}
                        disabled={busy}
                        className={ghostBtnClass}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteKey(k.id)}
                      disabled={busy}
                      className="h-10 px-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[12px] font-medium flex items-center gap-1.5 hover:bg-red-500/15 transition-all disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Active Sessions ── */}
      <section className={tabCardClass}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className={tabSectionTitle + " mb-0"}>
            <Monitor className="h-3.5 w-3.5" />
            Active Devices
          </h2>
          <span className="text-[11px] text-[var(--text-dim)]">
            {sessions.length} active
          </span>
        </div>

        {loading ? (
          <SkeletonRows count={2} />
        ) : sessions.length === 0 ? (
          <EmptyRow
            icon={<Monitor className="h-4 w-4" />}
            title="No active devices"
            description="Sessions will appear here once Supabase Auth is wired and a user signs in."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 py-3 flex-wrap"
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] flex items-center justify-center shrink-0">
                  <DeviceIcon type={s.device_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {s.device_name || "Unknown device"}
                  </p>
                  <p className="text-[11px] text-[var(--text-dim)] truncate">
                    {[s.os, s.browser, s.ip_address].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                    Last active {formatDate(s.last_active_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeSession(s.id)}
                  disabled={busy}
                  className="h-10 px-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[12px] font-medium flex items-center gap-1.5 hover:bg-red-500/15 transition-all disabled:opacity-60"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Passkeys placeholder ── */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <Fingerprint className="h-3.5 w-3.5" />
          Passkeys
        </h2>
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-5 text-center">
          <div className="inline-flex h-10 w-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] items-center justify-center mb-3">
            <Fingerprint className="h-4 w-4" />
          </div>
          <p className="text-[13px] font-semibold text-[var(--text-muted)]">
            Passkey enrolment coming with Supabase Auth
          </p>
          <p className="text-[11px] text-[var(--text-dim)] mt-1 max-w-md mx-auto">
            WebAuthn / passkey sign-in activates once Supabase Auth is enabled
            on this project. The database tables and audit events are already
            in place.
          </p>
        </div>
      </section>

      {/* ── Login history ── */}
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <History className="h-3.5 w-3.5" />
          Recent Activity
        </h2>

        {loading ? (
          <SkeletonRows count={3} />
        ) : history.length === 0 ? (
          <EmptyRow
            icon={<History className="h-4 w-4" />}
            title="No events yet"
            description="Password resets, forced resets, API key activity and logins will be listed here."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {history.map((h) => {
              const meta = eventMeta(h.event_type);
              const Icon = meta.icon;
              return (
                <div
                  key={h.id}
                  className="flex items-start gap-3 py-3 flex-wrap"
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${meta.toneClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {meta.label}
                    </p>
                    {metaSummary(h.metadata) && (
                      <p className="text-[11px] text-[var(--text-dim)] mt-0.5 font-mono truncate">
                        {metaSummary(h.metadata)}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--text-dim)] mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(h.created_at)}
                      {h.ip_address && <> · {h.ip_address}</>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reveal modal (shown once after key creation) */}
      {revealToken && (
        <ApiKeyRevealModal
          token={revealToken.token}
          keyName={revealToken.name}
          onClose={() => setRevealToken(null)}
        />
      )}
    </div>
  );
}

/* ============================================================================
   Small presentational helpers
   ============================================================================ */

function InfoTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : "text-[var(--text-muted)]";
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
      <div className="flex items-center gap-2 text-[var(--text-dim)] mb-1.5">
        <span className="h-6 w-6 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center">
          {icon}
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className={`text-[13px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function EmptyRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-5 text-center">
      <div className="inline-flex h-9 w-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] items-center justify-center mb-2">
        {icon}
      </div>
      <p className="text-[13px] font-semibold text-[var(--text-muted)]">
        {title}
      </p>
      <p className="text-[11px] text-[var(--text-dim)] mt-0.5 max-w-md mx-auto">
        {description}
      </p>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-14 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] animate-pulse"
        />
      ))}
    </div>
  );
}

function DeviceIcon({ type }: { type: AccountSessionRow["device_type"] }) {
  if (type === "mobile") return <Smartphone className="h-4 w-4" />;
  if (type === "tablet") return <Tablet className="h-4 w-4" />;
  if (type === "other") return <HardDrive className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* ── Event metadata table (label + icon + tone per event type) ── */

type Tone = "ok" | "warn" | "danger" | "neutral";

const toneClassMap: Record<Tone, string> = {
  ok: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
  warn: "bg-amber-500/10 border-amber-500/25 text-amber-300",
  danger: "bg-red-500/10 border-red-500/25 text-red-300",
  neutral:
    "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]",
};

function eventMeta(ev: LoginEventType): {
  label: string;
  icon: React.ElementType;
  toneClass: string;
} {
  const table: Record<
    LoginEventType,
    { label: string; icon: React.ElementType; tone: Tone }
  > = {
    login_success: { label: "Login successful", icon: LogIn, tone: "ok" },
    login_failed: { label: "Failed login attempt", icon: XCircle, tone: "danger" },
    logout: { label: "Logged out", icon: LogOut, tone: "neutral" },
    password_reset: { label: "Password reset", icon: KeyRound, tone: "warn" },
    force_reset_enabled: {
      label: "Forced password change enabled",
      icon: RefreshCcw,
      tone: "warn",
    },
    force_reset_cleared: {
      label: "Forced password change cleared",
      icon: RefreshCcw,
      tone: "neutral",
    },
    two_factor_enabled: {
      label: "Two-factor enabled",
      icon: ShieldCheck,
      tone: "ok",
    },
    two_factor_disabled: {
      label: "Two-factor disabled",
      icon: ShieldOff,
      tone: "warn",
    },
    api_key_created: { label: "API key created", icon: KeyRound, tone: "ok" },
    api_key_revoked: { label: "API key revoked", icon: Ban, tone: "warn" },
    session_revoked: {
      label: "Session revoked",
      icon: XCircle,
      tone: "warn",
    },
    passkey_enrolled: {
      label: "Passkey enrolled",
      icon: Fingerprint,
      tone: "ok",
    },
    passkey_revoked: {
      label: "Passkey revoked",
      icon: Fingerprint,
      tone: "warn",
    },
  };
  const entry = table[ev];
  return {
    label: entry.label,
    icon: entry.icon,
    toneClass: toneClassMap[entry.tone],
  };
}

/** Short preview of the metadata object for display under an event row. */
function metaSummary(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "";
  // Prefer human-meaningful fields if present.
  if (typeof metadata.key_prefix === "string") {
    return `key: ${metadata.key_prefix}…`;
  }
  if (typeof metadata.device_name === "string") {
    return String(metadata.device_name);
  }
  if (typeof metadata.status === "string") {
    return `status: ${metadata.status}`;
  }
  // Fallback: stringify with a length cap.
  try {
    const s = JSON.stringify(metadata);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  } catch {
    return "";
  }
}
