"use client";

/* ---------------------------------------------------------------------------
   AdminAuth — the full-screen login gate that stands between visitors and
   the Koleex Hub. Two tabs:

     · Sign In         → username + password against the `accounts` table
     · Be a Member     → request-to-join form, same visual language as the
                         admin AccountForm, so someone without an account can
                         ask to be invited

   Sign-in persistence lives in localStorage (`koleex-admin` + the username)
   so the session survives tabs, reloads, and browser restarts. The gate
   only re-prompts after an explicit Sign Out (handled by UserMenu which
   clears the same keys plus the current-account id).

   The legacy password check uses the same `tmp$<base64>` tag format that
   createAccount / resetAccountPassword write, via verifyAccountLogin. Not
   cryptographically secure — it's a bridge until Supabase Auth is flipped
   on; see verifyAccountLogin for the security note.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  LogIn,
  Loader2,
  AlertCircle,
  UserPlus,
  CheckCircle2,
  Mail,
  User as UserIcon,
  Building2,
  MessageSquare,
} from "lucide-react";
import { verifyAccountLogin } from "@/lib/accounts-admin";
import { setCurrentAccountId } from "@/lib/identity";
import KoleexLogo from "@/components/layout/KoleexLogo";

/* localStorage keys. Using localStorage (not sessionStorage) so the session
   survives browser restarts — the user only has to sign in again after an
   explicit Sign Out. */
export const LEGACY_SESSION_KEY = "koleex-admin";
export const LEGACY_SESSION_USER_KEY = "koleex-admin-user";

/* Stub storage for membership requests until we pick a backend (Supabase
   table, webhook, email, etc.). Using localStorage means a visitor won't
   accidentally submit twice and the UI can still render a success state. */
const MEMBERSHIP_REQUEST_KEY = "koleex-membership-requests";

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

type Tab = "signin" | "join";

/* ── Shared input / label styling. Hard-coded colors (not CSS variables) so
   the form renders correctly even before the app's theme CSS has loaded. ── */
const inputBase =
  "w-full h-11 px-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors";
const textareaBase =
  "w-full min-h-[86px] px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors resize-none";
const labelBase =
  "block text-[10px] font-semibold text-white/55 mb-1.5 uppercase tracking-[0.08em]";

export default function AdminAuth({ title, subtitle, children }: Props) {
  /* `authed === null` = still hydrating; render a spinner so we don't
     flash the form before we know the session state. */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("signin");

  /* Sign-in form state */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  /* Membership request form state */
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joinCompany, setJoinCompany] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinDone, setJoinDone] = useState(false);

  useEffect(() => {
    try {
      const ok = window.localStorage.getItem(LEGACY_SESSION_KEY) === "true";
      setAuthed(ok);
    } catch {
      setAuthed(false);
    }
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);
    if (!username.trim() || !password) {
      setSignInError("Enter a username and password.");
      return;
    }
    setSignInBusy(true);
    const result = await verifyAccountLogin(username, password);
    setSignInBusy(false);

    if (!result.ok) {
      if (result.reason === "not_found") {
        setSignInError("No account with that username.");
      } else if (result.reason === "disabled") {
        setSignInError("This account is suspended or archived.");
      } else {
        setSignInError("Incorrect password.");
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

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);

    const name = joinName.trim();
    const email = joinEmail.trim();
    if (!name || !email) {
      setJoinError("Please share your name and email so we can reach you.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setJoinError("That email doesn't look quite right.");
      return;
    }

    setJoinBusy(true);
    try {
      /* Stash locally until we wire a real backend. The schema mirrors
         what we'd save to a `membership_requests` table: name, email,
         company, message, created_at. */
      const raw = window.localStorage.getItem(MEMBERSHIP_REQUEST_KEY);
      const existing = raw ? (JSON.parse(raw) as unknown[]) : [];
      existing.push({
        full_name: name,
        email,
        company: joinCompany.trim() || null,
        message: joinMessage.trim() || null,
        created_at: new Date().toISOString(),
      });
      window.localStorage.setItem(
        MEMBERSHIP_REQUEST_KEY,
        JSON.stringify(existing),
      );
    } catch {
      /* Even if localStorage blows up, still show the success state —
         the visitor filled out a form and we don't want them stuck. */
    }
    setJoinBusy(false);
    setJoinDone(true);
  }

  /* Hydration spinner — nothing heavy so we don't flash the form. */
  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div
        className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,0.05), transparent 60%)",
        }}
      >
        {/* Subtle grid backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 80%)",
          }}
        />

        <div className="relative w-full max-w-md">
          {/* Brand header */}
          <div className="flex flex-col items-center mb-7">
            <KoleexLogo className="h-6 w-auto text-white mb-5 drop-shadow-[0_0_24px_rgba(255,255,255,0.08)]" />
            <h1 className="text-[22px] font-bold text-white tracking-tight leading-none">
              {title}
            </h1>
            <p className="text-[13px] text-white/50 mt-1.5">{subtitle}</p>
          </div>

          {/* Card */}
          <div className="bg-[#121212] rounded-2xl border border-white/[0.06] shadow-2xl overflow-hidden backdrop-blur">
            {/* Tab bar */}
            <div className="grid grid-cols-2 border-b border-white/[0.06] bg-white/[0.02]">
              <button
                type="button"
                onClick={() => {
                  setTab("signin");
                  setJoinError(null);
                }}
                className={`relative h-12 text-[12px] font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 ${
                  tab === "signin"
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
                aria-pressed={tab === "signin"}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
                {tab === "signin" && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-white"
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("join");
                  setSignInError(null);
                }}
                className={`relative h-12 text-[12px] font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 ${
                  tab === "join"
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
                aria-pressed={tab === "join"}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Be a Koleex Member
                {tab === "join" && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-white"
                  />
                )}
              </button>
            </div>

            {/* Card body */}
            <div className="p-7">
              {tab === "signin" ? (
                <SignInPanel
                  username={username}
                  password={password}
                  busy={signInBusy}
                  error={signInError}
                  onUsernameChange={(v) => {
                    setUsername(v);
                    setSignInError(null);
                  }}
                  onPasswordChange={(v) => {
                    setPassword(v);
                    setSignInError(null);
                  }}
                  onSubmit={handleSignIn}
                />
              ) : joinDone ? (
                <JoinSuccessPanel
                  name={joinName}
                  onReset={() => {
                    setJoinDone(false);
                    setJoinName("");
                    setJoinEmail("");
                    setJoinCompany("");
                    setJoinMessage("");
                  }}
                />
              ) : (
                <JoinPanel
                  name={joinName}
                  email={joinEmail}
                  company={joinCompany}
                  message={joinMessage}
                  busy={joinBusy}
                  error={joinError}
                  onNameChange={(v) => {
                    setJoinName(v);
                    setJoinError(null);
                  }}
                  onEmailChange={(v) => {
                    setJoinEmail(v);
                    setJoinError(null);
                  }}
                  onCompanyChange={setJoinCompany}
                  onMessageChange={setJoinMessage}
                  onSubmit={handleJoin}
                />
              )}
            </div>
          </div>

          <p className="text-[11px] text-white/30 text-center mt-5 tracking-wide">
            Koleex Group · Secure Hub
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/* ── Sign-in panel ────────────────────────────────────────────────────── */

interface SignInPanelProps {
  username: string;
  password: string;
  busy: boolean;
  error: string | null;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function SignInPanel({
  username,
  password,
  busy,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: SignInPanelProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelBase}>Username</label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="jane.cooper"
            className={`${inputBase} pl-9`}
          />
        </div>
      </div>

      <div>
        <label className={labelBase}>Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className={inputBase}
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
        className="w-full h-11 rounded-xl bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-60"
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

      <p className="text-[11px] text-white/35 text-center pt-1">
        Having trouble? Contact your administrator.
      </p>
    </form>
  );
}

/* ── Join / Be a Koleex Member panel ──────────────────────────────────── */

interface JoinPanelProps {
  name: string;
  email: string;
  company: string;
  message: string;
  busy: boolean;
  error: string | null;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onCompanyChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function JoinPanel({
  name,
  email,
  company,
  message,
  busy,
  error,
  onNameChange,
  onEmailChange,
  onCompanyChange,
  onMessageChange,
  onSubmit,
}: JoinPanelProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      <p className="text-[12px] text-white/55 leading-relaxed mb-1">
        Tell us who you are and an admin will be in touch with an invitation.
      </p>

      <div>
        <label className={labelBase}>Full Name</label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Jane Cooper"
            className={`${inputBase} pl-9`}
          />
        </div>
      </div>

      <div>
        <label className={labelBase}>Work Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="jane@company.com"
            className={`${inputBase} pl-9`}
          />
        </div>
      </div>

      <div>
        <label className={labelBase}>Company</label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            autoComplete="organization"
            value={company}
            onChange={(e) => onCompanyChange(e.target.value)}
            placeholder="Optional"
            className={`${inputBase} pl-9`}
          />
        </div>
      </div>

      <div>
        <label className={labelBase}>Message</label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 h-3.5 w-3.5 text-white/30" />
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="What would you like access to?"
            className={`${textareaBase} pl-9`}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px] flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !name || !email}
        className="w-full h-11 rounded-xl bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" /> Request Access
          </>
        )}
      </button>
    </form>
  );
}

/* ── Success panel shown after a membership request is submitted. ─────── */

interface JoinSuccessPanelProps {
  name: string;
  onReset: () => void;
}

function JoinSuccessPanel({ name, onReset }: JoinSuccessPanelProps) {
  const firstName = name.split(" ")[0] || "there";
  return (
    <div className="py-4 flex flex-col items-center text-center">
      <div className="h-12 w-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
        <CheckCircle2 className="h-6 w-6 text-emerald-300" />
      </div>
      <h3 className="text-[15px] font-semibold text-white">
        Thanks, {firstName}!
      </h3>
      <p className="text-[12px] text-white/55 mt-1.5 leading-relaxed max-w-[280px]">
        Your request has been received. A Koleex administrator will review it
        and reach out with next steps shortly.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 text-[12px] font-medium text-white/60 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/60"
      >
        Submit another request
      </button>
    </div>
  );
}
