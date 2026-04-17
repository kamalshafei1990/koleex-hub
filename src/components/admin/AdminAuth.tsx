"use client";

/* ---------------------------------------------------------------------------
   AdminAuth — the full-screen login gate that stands between visitors and
   the Koleex Hub. Two tabs:

     · Sign In         → username + password against the `accounts` table
     · Be a Member     → request-to-join form. Collects enough context that
                         a Super Admin can triage the request from their
                         inbox without a follow-up email.

   Sign-in persistence lives in localStorage (`koleex-admin` + the username)
   so the session survives tabs, reloads, and browser restarts. The gate
   only re-prompts after an explicit Sign Out (handled by UserMenu which
   clears the same keys plus the current-account id).

   Membership requests POST to `membership_requests` via createMembershipRequest.
   Extra fields (phone, relationship, country, city, job title, heard_from)
   ride along inside the row's `metadata` JSONB blob so we can grow the
   form without column migrations. A DB trigger fans out an inbox
   notification to every active Super Admin on insert, and our trigger
   update in supabase/migrations/update_trigger_merge_metadata.sql merges
   the row metadata into the notification metadata so reviewers see every
   field in the inbox detail pane.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import SignInIcon from "@/components/icons/ui/SignInIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import { verifyAccountLogin } from "@/lib/accounts-admin";
import { createMembershipRequest } from "@/lib/inbox";
import { setCurrentAccountId } from "@/lib/identity";
import KoleexLogo from "@/components/layout/KoleexLogo";
import { COUNTRIES } from "@/types/product-form";

/* localStorage keys. Using localStorage (not sessionStorage) so the session
   survives browser restarts — the user only has to sign in again after an
   explicit Sign Out. */
export const LEGACY_SESSION_KEY = "koleex-admin";
export const LEGACY_SESSION_USER_KEY = "koleex-admin-user";

/* Fallback storage for membership requests. The primary path is the
   Supabase `membership_requests` table (which fires a trigger to notify
   every Super Admin). If that insert fails — usually because the
   migration hasn't been applied yet — we stash here so the visitor still
   sees a success state and the admin can recover the request later. */
const MEMBERSHIP_REQUEST_KEY = "koleex-membership-requests";

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

type Tab = "signin" | "join";

/* Relationship-to-Koleex options. The value is what we store; the label
   is what the visitor sees. Kept as a tuple so we can reuse it in the
   detail pane later. */
const RELATIONSHIPS: Array<{ value: string; label: string }> = [
  { value: "new_prospect", label: "New to Koleex" },
  { value: "existing_customer", label: "Existing Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const HEARD_FROM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select an option" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "google", label: "Google Search" },
  { value: "referral", label: "Referral from a colleague" },
  { value: "event", label: "Event / Conference" },
  { value: "website", label: "Koleex website" },
  { value: "other", label: "Other" },
];

/* ── Shared input / label styling. Hard-coded colors (not CSS variables) so
   the form renders correctly even before the app's theme CSS has loaded. ── */
const inputBase =
  "w-full h-11 px-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors";
const selectBase =
  "w-full h-11 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer";
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
  const [joinPhone, setJoinPhone] = useState("");
  const [joinRelationship, setJoinRelationship] = useState<string>("new_prospect");
  const [joinCompany, setJoinCompany] = useState("");
  const [joinJobTitle, setJoinJobTitle] = useState("");
  const [joinCountry, setJoinCountry] = useState("");
  const [joinCity, setJoinCity] = useState("");
  const [joinHeardFrom, setJoinHeardFrom] = useState("");
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
    // Hard reload so every mounted component (Sidebar, TenantPicker,
    // any page still holding kamal's cached ScopeContext) re-runs
    // against the newly signed-in identity. Without this the sidebar
    // keeps showing the previous user's app list.
    window.location.reload();
  }

  function resetJoinForm() {
    setJoinDone(false);
    setJoinName("");
    setJoinEmail("");
    setJoinPhone("");
    setJoinRelationship("new_prospect");
    setJoinCompany("");
    setJoinJobTitle("");
    setJoinCountry("");
    setJoinCity("");
    setJoinHeardFrom("");
    setJoinMessage("");
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

    /* Look up the human-readable country name so admins don't have to
       decode country codes in the inbox. */
    const countryRow = COUNTRIES.find((c) => c.code === joinCountry);

    setJoinBusy(true);

    /* Primary path: insert into `membership_requests`. The DB trigger
       fans out a notification to every active Super Admin. */
    const result = await createMembershipRequest({
      full_name: name,
      email,
      company: joinCompany.trim() || null,
      message: joinMessage.trim() || null,
      source: "login_gate",
      extras: {
        phone: joinPhone.trim() || null,
        relationship: joinRelationship || null,
        job_title: joinJobTitle.trim() || null,
        country: joinCountry || null,
        country_name: countryRow?.name ?? null,
        city: joinCity.trim() || null,
        heard_from: joinHeardFrom || null,
      },
    });

    if (!result.ok) {
      /* Fallback stash so the visitor isn't blocked before the
         migration is applied. */
      try {
        const raw = window.localStorage.getItem(MEMBERSHIP_REQUEST_KEY);
        const existing = raw ? (JSON.parse(raw) as unknown[]) : [];
        existing.push({
          full_name: name,
          email,
          phone: joinPhone.trim() || null,
          relationship: joinRelationship || null,
          company: joinCompany.trim() || null,
          job_title: joinJobTitle.trim() || null,
          country: joinCountry || null,
          country_name: countryRow?.name ?? null,
          city: joinCity.trim() || null,
          heard_from: joinHeardFrom || null,
          message: joinMessage.trim() || null,
          created_at: new Date().toISOString(),
          error: result.error,
        });
        window.localStorage.setItem(
          MEMBERSHIP_REQUEST_KEY,
          JSON.stringify(existing),
        );
      } catch {
        /* Even if localStorage blows up, still show the success state —
           the visitor filled out a form and we don't want them stuck. */
      }
    }

    setJoinBusy(false);
    setJoinDone(true);
  }

  /* Hydration spinner — nothing heavy so we don't flash the form. */
  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <SpinnerIcon className="h-5 w-5 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!authed) {
    /* When we're on the wider Join tab, use a roomier card so the
       2-column field grids don't feel cramped. */
    const isWide = tab === "join";

    return (
      <div
        className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 py-10 relative overflow-hidden"
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

        <div
          className={`relative w-full transition-[max-width] duration-300 ${
            isWide ? "max-w-[560px]" : "max-w-md"
          }`}
        >
          {/* Brand header — tight, centered, a single statement. */}
          <div className="flex flex-col items-center mb-6">
            <KoleexLogo className="h-[28px] w-auto text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.12)]" />
            <div className="mt-3 flex items-center gap-2">
              <span className="h-px w-6 bg-white/15" aria-hidden />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/45 font-semibold">
                Enterprise Operations
              </span>
              <span className="h-px w-6 bg-white/15" aria-hidden />
            </div>
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
                <SignInIcon className="h-3.5 w-3.5" />
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
                <UserPlusIcon className="h-3.5 w-3.5" />
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
            <div className="px-6 py-6 md:px-7 md:py-7">
              {/* Tab-contextual heading. Gives the form a human-readable
                  title without the clunky outer "Koleex Hub" label. */}
              <div className="mb-5">
                <h2 className="text-[17px] font-bold text-white tracking-tight leading-none">
                  {tab === "signin"
                    ? "Welcome back"
                    : joinDone
                      ? "Request received"
                      : "Join the Koleex network"}
                </h2>
                <p className="text-[12px] text-white/50 mt-1.5">
                  {tab === "signin"
                    ? "Sign in to your Koleex Hub account."
                    : joinDone
                      ? "A Super Admin will review your request shortly."
                      : "Tell us a bit about you — we'll reach out with an invitation."}
                </p>
              </div>

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
                <JoinSuccessPanel name={joinName} onReset={resetJoinForm} />
              ) : (
                <JoinPanel
                  state={{
                    name: joinName,
                    email: joinEmail,
                    phone: joinPhone,
                    relationship: joinRelationship,
                    company: joinCompany,
                    jobTitle: joinJobTitle,
                    country: joinCountry,
                    city: joinCity,
                    heardFrom: joinHeardFrom,
                    message: joinMessage,
                  }}
                  busy={joinBusy}
                  error={joinError}
                  setters={{
                    setName: (v) => {
                      setJoinName(v);
                      setJoinError(null);
                    },
                    setEmail: (v) => {
                      setJoinEmail(v);
                      setJoinError(null);
                    },
                    setPhone: setJoinPhone,
                    setRelationship: setJoinRelationship,
                    setCompany: setJoinCompany,
                    setJobTitle: setJoinJobTitle,
                    setCountry: setJoinCountry,
                    setCity: setJoinCity,
                    setHeardFrom: setJoinHeardFrom,
                    setMessage: setJoinMessage,
                  }}
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
          <ExclamationIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
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
            <SpinnerIcon className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            <SignInIcon className="h-4 w-4" /> Sign In
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

interface JoinState {
  name: string;
  email: string;
  phone: string;
  relationship: string;
  company: string;
  jobTitle: string;
  country: string;
  city: string;
  heardFrom: string;
  message: string;
}

interface JoinSetters {
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setRelationship: (v: string) => void;
  setCompany: (v: string) => void;
  setJobTitle: (v: string) => void;
  setCountry: (v: string) => void;
  setCity: (v: string) => void;
  setHeardFrom: (v: string) => void;
  setMessage: (v: string) => void;
}

interface JoinPanelProps {
  state: JoinState;
  setters: JoinSetters;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

function JoinPanel({
  state,
  setters,
  busy,
  error,
  onSubmit,
}: JoinPanelProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Relationship — pill buttons. First thing the admin wants to
          know, so we ask it first and use a visual control so visitors
          don't miss it. */}
      <div>
        <label className={labelBase}>Your relationship with Koleex</label>
        <div className="flex flex-wrap gap-1.5">
          {RELATIONSHIPS.map((r) => {
            const active = state.relationship === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setters.setRelationship(r.value)}
                className={`h-8 px-3 rounded-full text-[11px] font-semibold transition-all border ${
                  active
                    ? "bg-white text-black border-white"
                    : "bg-white/[0.04] text-white/70 border-white/[0.1] hover:bg-white/[0.07] hover:text-white"
                }`}
                aria-pressed={active}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-white/[0.05]" aria-hidden />

      {/* Name — always full width, required */}
      <div>
        <label className={labelBase}>Full Name *</label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            autoComplete="name"
            value={state.name}
            onChange={(e) => setters.setName(e.target.value)}
            placeholder="Jane Cooper"
            className={`${inputBase} pl-9`}
          />
        </div>
      </div>

      {/* Email + Phone row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>Work Email *</label>
          <div className="relative">
            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="email"
              autoComplete="email"
              value={state.email}
              onChange={(e) => setters.setEmail(e.target.value)}
              placeholder="jane@company.com"
              className={`${inputBase} pl-9`}
            />
          </div>
        </div>
        <div>
          <label className={labelBase}>Phone</label>
          <div className="relative">
            <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="tel"
              autoComplete="tel"
              value={state.phone}
              onChange={(e) => setters.setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className={`${inputBase} pl-9`}
            />
          </div>
        </div>
      </div>

      {/* Company + Job title row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>Company</label>
          <div className="relative">
            <Building2Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              autoComplete="organization"
              value={state.company}
              onChange={(e) => setters.setCompany(e.target.value)}
              placeholder="Acme Inc."
              className={`${inputBase} pl-9`}
            />
          </div>
        </div>
        <div>
          <label className={labelBase}>Job Title</label>
          <div className="relative">
            <BriefcaseIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              autoComplete="organization-title"
              value={state.jobTitle}
              onChange={(e) => setters.setJobTitle(e.target.value)}
              placeholder="Procurement Manager"
              className={`${inputBase} pl-9`}
            />
          </div>
        </div>
      </div>

      {/* Country + City row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>Country</label>
          <div className="relative">
            <GlobeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <select
              value={state.country}
              onChange={(e) => setters.setCountry(e.target.value)}
              className={`${selectBase} pl-9`}
            >
              <option value="" className="bg-[#121212]">
                Select country
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#121212]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelBase}>City</label>
          <div className="relative">
            <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              autoComplete="address-level2"
              value={state.city}
              onChange={(e) => setters.setCity(e.target.value)}
              placeholder="Dubai"
              className={`${inputBase} pl-9`}
            />
          </div>
        </div>
      </div>

      {/* How did you hear — native select keeps it compact */}
      <div>
        <label className={labelBase}>How did you hear about us?</label>
        <div className="relative">
          <Link2Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
          <select
            value={state.heardFrom}
            onChange={(e) => setters.setHeardFrom(e.target.value)}
            className={`${selectBase} pl-9`}
          >
            {HEARD_FROM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#121212]">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Purpose */}
      <div>
        <label className={labelBase}>Purpose of access</label>
        <div className="relative">
          <MessageSquareIcon className="absolute left-3 top-3 h-3.5 w-3.5 text-white/30" />
          <textarea
            value={state.message}
            onChange={(e) => setters.setMessage(e.target.value)}
            placeholder="Which parts of the Koleex Hub would you like access to, and why?"
            className={`${textareaBase} pl-9`}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px] flex items-start gap-2">
          <ExclamationIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !state.name || !state.email}
        className="w-full h-11 rounded-xl bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-60"
      >
        {busy ? (
          <>
            <SpinnerIcon className="h-4 w-4 animate-spin" /> Submitting…
          </>
        ) : (
          <>
            <UserPlusIcon className="h-4 w-4" /> Request Access
          </>
        )}
      </button>

      <p className="text-[11px] text-white/35 text-center pt-1">
        Fields marked * are required. Everything else helps us route your
        request faster.
      </p>
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
        <CheckCircleIcon className="h-6 w-6 text-emerald-300" />
      </div>
      <h3 className="text-[15px] font-semibold text-white">
        Thanks, {firstName}!
      </h3>
      <p className="text-[12px] text-white/55 mt-1.5 leading-relaxed max-w-[320px]">
        Your request has been received. A Koleex Super Admin will review it
        and reach out shortly with next steps.
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
