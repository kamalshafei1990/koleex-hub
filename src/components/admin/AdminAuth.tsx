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

   Membership requests POST to /api/support/membership-request. Fields beyond
   the four first-class columns ride inside the row's `metadata` JSONB, so the
   form can grow without a migration every time.

   The route owns the fan-out to Koleex Mail. A DB trigger used to do it too,
   which meant every request was announced twice — and the trigger's copy was
   the worse one: it matched role names with ILIKE '%super admin%' so it missed
   Admins entirely, it dropped every field except the message, and it linked to
   /admin/requests/<id>, a page that does not exist. Dropped 2026-08-10.
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import SignInIcon from "@/components/icons/ui/SignInIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import BrandLoading from "@/components/ui/BrandLoading";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import HelpCircleIcon from "@/components/icons/ui/HelpCircleIcon";
import SelectChevron from "@/components/admin/SelectChevron";
import { setCurrentAccountId } from "@/lib/identity";
import { countriesFor, countryName, dialOf, flagOf } from "@/lib/countries-dial";
import SignInHelpDialog from "./SignInHelpDialog";
import { useTranslation, type Lang } from "@/lib/i18n";
import { signInT } from "@/lib/translations/signin";

/* The header's language switcher does not exist yet on this screen — it is
   part of the shell you only reach AFTER signing in. So the sign-in screen
   carries its own, writing to the same `koleex-lang` key and firing the same
   `langchange` event, which means the choice someone makes at the door is
   still theirs once they are inside. */
const SIGNIN_LANGS: { code: Lang; short: string }[] = [
  { code: "en", short: "EN" },
  { code: "zh", short: "中文" },
  { code: "ar", short: "عربي" },
];

function LangSwitch({ lang }: { lang: Lang }) {
  const pick = (next: Lang) => {
    try { localStorage.setItem("koleex-lang", next); } catch { /* storage blocked */ }
    window.dispatchEvent(new CustomEvent("langchange", { detail: next }));
  };
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.07] p-1">
      {SIGNIN_LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => pick(l.code)}
          aria-pressed={lang === l.code}
          className={`h-7 px-3 rounded-lg text-[11.5px] font-semibold transition-colors ${
            lang === l.code
              ? "bg-white/90 text-black"
              : "text-white/50 hover:text-white/85 hover:bg-white/[0.06]"
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

/* useLayoutEffect on the server is a no-op and warns; fall back to useEffect.
   It has to be the layout variant in the browser: both the tab indicator and
   the card height are measured from the DOM, and measuring after paint would
   show one frame of the wrong geometry every single switch. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* One easing and one duration for everything the tab switch moves — card
   width, card height, indicator. Three transitions of different lengths read
   as three separate events rather than one. Matches .kx-tab-in in globals.css,
   which is the Hub's existing tab-entrance curve. */
const SWITCH_MOTION =
  "motion-safe:transition-[height,transform,width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]";

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

type Tab = "signin" | "join";

/* Relationship-to-Koleex options. The value is what we store; the label
   is what the visitor sees. Kept as a tuple so we can reuse it in the
   detail pane later. */
/* Every icon comes from the Koleex library — src/components/icons/ui.
   Nothing on this screen is hand-drawn or borrowed from a third-party set. */
const RELATIONSHIPS: Array<{
  value: string;
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
}> = [
  { value: "new_prospect", Icon: SparklesIcon },
  { value: "existing_customer", Icon: UserCheckIcon },
  { value: "supplier", Icon: TruckIcon },
  { value: "partner", Icon: HandshakeIcon },
  { value: "other", Icon: HelpCircleIcon },
];

/* Kept in step with PARTNER_TYPES in the membership-request route — the route
   allow-lists them, so adding one here alone files it as "distributor". */
const PARTNER_TYPES = ["distributor", "agent", "service", "other"] as const;

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
/* `appearance-none` removes the browser's own chevron — and nothing was drawn
   in its place, so every dropdown on the join form looked like a plain text
   box with no hint you could open it. Room is reserved at the inline end
   (logical, so Arabic flips) and SelectChevron paints the arrow.
   pe-10, not pe-9: the arrow now sits 16px in, so 36px left the longest option
   ending under it. */
const selectBase =
  "w-full h-11 ps-3 pe-10 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer truncate";
const textareaBase =
  "w-full min-h-[86px] px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors resize-none";
const labelBase =
  "block text-[10px] font-semibold text-white/55 mb-1.5 uppercase tracking-[0.08em]";

export default function AdminAuth({ title, subtitle, children }: Props) {
  /* `authed === null` = still hydrating; render a spinner so we don't
     flash the form before we know the session state. */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { t, lang } = useTranslation(signInT);
  /* "Having trouble?" — mounted only while the gate is showing, so the dialog
     never ships with the authenticated shell. */
  const [helpOpen, setHelpOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("signin");

  /* ── Tab switch motion ──────────────────────────────────────────────
     Switching tabs used to change three things at once with no motion at
     all: the card jumped from 372px tall to 980px, the card widened, and
     the white rule under the active tab teleported across. Each of the
     three is measured rather than guessed, because none of them is a
     value we can know in CSS — the join form's height depends on which
     relationship is picked, and the label widths change with language. */
  const stripRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null);
  const [bodyH, setBodyH] = useState<number | null>(null);

  /* The indicator. One bar that slides, not one per tab that blinks.
     The maths is in PHYSICAL pixels on purpose: getBoundingClientRect and
     translateX are both physical, and the bar is pinned with `left-0`, so
     this is already correct in Arabic. Rewriting it to `start-0` would
     apply the RTL flip a second time and send the bar off the card. */
  useIsoLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const sync = () => {
      const label = strip.querySelector<HTMLElement>('[data-tab-active="true"] > span');
      if (!label) return;
      const s = strip.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      setInk({ x: Math.round(l.left - s.left) - 8, w: Math.round(l.width) + 16 });
    };
    sync();
    /* Re-measure on width changes; the deps cover tab and language. Font
       swap moves the label too, so re-run once the webfont has landed. */
    const ro = new ResizeObserver(sync);
    ro.observe(strip);
    document.fonts?.ready.then(sync).catch(() => {});
    return () => ro.disconnect();
    /* `authed` is a dependency because the gate does not exist while the
       session is still being checked: the first run finds a null ref, bails,
       and without this it would never run again once the card mounts. */
  }, [tab, lang, authed]);

  /* The height. An explicit pixel height on the clipping wrapper is the
     only way to transition it — `height: auto` is not interpolable. The
     observer means this also covers the join form growing and shrinking
     when the relationship changes, which jumped just as hard. */
  useIsoLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const sync = () => setBodyH(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
    /* Same reason as the indicator: mounted only after `authed` resolves. */
  }, [authed]);

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
  /* Customer code replaces City: the admin needs to identify the account, not
     the town — and Country already says where they are. */
  const [joinCustomerCode, setJoinCustomerCode] = useState("");
  /* Asked only of the relationship that needs them. Every one of these had to
     pass the same test: if it were blank, would the reviewer have to write
     back before deciding? */
  const [joinKoleexContact, setJoinKoleexContact] = useState("");
  const [joinPartnerType, setJoinPartnerType] = useState("distributor");
  const [joinTerritory, setJoinTerritory] = useState("");
  const [joinSupplies, setJoinSupplies] = useState("");
  const [joinWebsite, setJoinWebsite] = useState("");
  const [joinRef, setJoinRef] = useState("");
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
    /* Lazy: accounts-admin pulls the supabase client — only needed at the
       moment of a sign-in attempt, never for the authed shell. */
    const { verifyAccountLogin } = await import("@/lib/accounts-admin");
    const result = await verifyAccountLogin(username, password);
    setSignInBusy(false);

    if (!result.ok) {
      if (result.reason === "disabled") {
        setSignInError("This account is suspended or archived.");
      } else if (result.reason === "network") {
        setSignInError("Sign-in service is unreachable — check your connection and try again.");
      } else {
        // Deliberately neutral — covers both "username not found" and
        // "wrong password" so attackers can't probe for valid usernames.
        setSignInError("Invalid username or password.");
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
    setJoinRef("");
    setJoinCustomerCode("");
    setJoinName("");
    setJoinEmail("");
    setJoinPhone("");
    setJoinRelationship("new_prospect");
    setJoinCompany("");
    setJoinJobTitle("");
    setJoinCountry("");
    setJoinKoleexContact("");
    setJoinPartnerType("distributor");
    setJoinTerritory("");
    setJoinSupplies("");
    setJoinWebsite("");
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

    setJoinBusy(true);

    /* Through the server. The old path inserted into `membership_requests`
       from the browser; that table is service_role-only, so every submit since
       the RLS lockdown was rejected — and the failure branch stashed the
       request in the visitor's OWN localStorage and showed the success panel
       anyway. People were told a Super Admin would review a request nobody
       ever received. */
    try {
      const res = await fetch("/api/support/membership-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationship: joinRelationship,
          full_name: name,
          email,
          phone: joinPhone.trim(),
          phone_code: dialOf(joinCountry),
          country_code: joinCountry || "",
          company: joinCompany.trim(),
          job_title: joinJobTitle.trim(),
          heard_from: joinHeardFrom,
          customer_code: joinCustomerCode.trim(),
          koleex_contact: joinKoleexContact.trim(),
          partner_type: joinPartnerType,
          territory: joinTerritory.trim(),
          supplies: joinSupplies.trim(),
          website: joinWebsite.trim(),
          message: joinMessage.trim(),
          language: lang,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; ref?: string; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setJoinBusy(false);
        setJoinError(json?.error ?? "Could not send the request. Please try again.");
        return;
      }
      setJoinRef(json.ref ?? "");
    } catch {
      setJoinBusy(false);
      setJoinError("Network problem. Please try again.");
      return;
    }

    setJoinBusy(false);
    setJoinDone(true);
  }

  /* Hydration spinner — nothing heavy so we don't flash the form. */
  if (authed === null) {
    return (
      <BrandLoading className="h-[100dvh] overflow-hidden" />
    );
  }

  if (!authed) {
    /* When we're on the wider Join tab, use a roomier card so the
       2-column field grids don't feel cramped. */
    const isWide = tab === "join";

    return (
      <div
        /* Arabic reads right-to-left, so the whole gate flips — labels,
           helper text, the icon beside each field. Translating the words
           without turning the layout round leaves a screen that is technically
           Arabic and still reads wrong. */
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="h-[100dvh] bg-[#0A0A0A] flex justify-center overflow-y-auto overflow-x-hidden p-4 py-10 relative"
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
          /* Same curve and length as the height and the indicator — the card
             widening on a different easing read as a second, later event. */
          className={`relative w-full my-auto motion-safe:transition-[max-width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isWide ? "max-w-[560px]" : "max-w-md"
          }`}
        >
          {/* Brand header — tight, centered, a single statement. */}
          <div className="flex flex-col items-center mb-6">
            {/* Hub logo v2 — login screen is always dark, so the for-dark
                composite (untouched KOLEEX wordmark + gradient hub script). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/hub-logo/koleex-hub-logo-for-dark.webp"
              alt="Koleex Hub"
              /* Same reason as the header: a double-click on an image selects
                 it, and a blue selection box across the wordmark is the first
                 thing a new user would see on the sign-in screen. */
              draggable={false}
              className="h-8 w-auto select-none [-webkit-user-drag:none] drop-shadow-[0_0_28px_rgba(255,255,255,0.12)]"
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="h-px w-6 bg-white/15" aria-hidden />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/45 font-semibold">
                {t("tagline")}
              </span>
              <span className="h-px w-6 bg-white/15" aria-hidden />
            </div>

          </div>

          {/* Card */}
          <div className="bg-[#121212] rounded-2xl border border-white/[0.06] shadow-2xl overflow-hidden backdrop-blur">
            {/* Tab bar.

                flex, NOT grid-cols-2. Two equal halves gave "Sign In" — seven
                characters — the same 171px as a label three times its length,
                and measured at 375px "Become Koleex Member" plus its icon came
                to 169px inside that 171px: one pixel of air on each side.
                Sizing each tab to its own content puts the slack where the
                long label needs it, and it keeps working when the label
                changes length in Chinese and Arabic, which fixed fractions
                would not.

                flex-auto, not flex-1: flex-1 is basis-0, which is the equal
                halves all over again. flex-auto sizes each tab to its content
                and then splits the LEFTOVER evenly, so both labels end up with
                identical breathing room at every width — 27px each at 375,
                53px each at 1280.

                The padding tightens below 360px: at 320 the two tabs came to
                297px inside a 286px strip and the row overflowed.

                The underline lives on a span around the label, not on the
                cell: at 1280 the join cell is 275px wide and a cell-width rule
                drew 243px of white under a 169px label. */}
            <div
              ref={stripRef}
              className="relative flex border-b border-white/[0.06] bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => {
                  setTab("signin");
                  setJoinError(null);
                }}
                className={`relative h-12 flex-auto px-3 min-[360px]:px-4 sm:px-5 text-[12px] font-semibold tracking-wide whitespace-nowrap transition-colors flex items-center justify-center gap-2 ${
                  tab === "signin"
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
                aria-pressed={tab === "signin"}
                data-tab-active={tab === "signin"}
              >
                <span className="flex h-full items-center gap-2">
                  <SignInIcon className="h-3.5 w-3.5 shrink-0" />
                  {t("tab.signIn")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("join");
                  setSignInError(null);
                }}
                className={`relative h-12 flex-auto px-3 min-[360px]:px-4 sm:px-5 text-[12px] font-semibold tracking-wide whitespace-nowrap transition-colors flex items-center justify-center gap-2 ${
                  tab === "join"
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
                aria-pressed={tab === "join"}
                data-tab-active={tab === "join"}
              >
                <span className="flex h-full items-center gap-2">
                  <UserPlusIcon className="h-3.5 w-3.5 shrink-0" />
                  {t("tab.join")}
                </span>
              </button>

              {/* The one indicator. Rendered only once measured, so it never
                  appears at the wrong tab for a frame. */}
              {ink && (
                <span
                  aria-hidden
                  className={`absolute bottom-0 left-0 h-[2px] rounded-full bg-white ${SWITCH_MOTION}`}
                  style={{ transform: `translateX(${ink.x}px)`, width: ink.w }}
                />
              )}
            </div>

            {/* Card body.

                THREE nested wrappers, and each one earns its place. The outer
                carries the animated pixel height and clips. The middle is what
                gets measured — it has to be unconstrained, or the observer
                would read back the height we just imposed and the card would
                never grow again, and it must NOT carry the key, or remounting
                would detach the very node the ResizeObserver is watching. The
                inner is keyed on the panel, so React remounts it and
                .kx-tab-in — the Hub's existing tab-entrance curve, the same one
                Product Data uses — replays on every switch instead of the
                content simply being swapped under your eyes. */}
            <div
              className={`overflow-hidden ${SWITCH_MOTION}`}
              style={bodyH != null ? { height: bodyH } : undefined}
            >
              <div ref={bodyRef}>
                <div
                  key={tab === "signin" ? "signin" : joinDone ? "done" : "join"}
                  className="kx-tab-in px-6 py-6 md:px-7 md:py-7"
                >
              {/* Tab-contextual heading. Gives the form a human-readable
                  title without the clunky outer "Koleex Hub" label. */}
              <div className="mb-5">
                <h2 className="text-[17px] font-bold text-white tracking-tight leading-none">
                  {tab === "signin"
                    ? t("welcome")
                    : joinDone
                      ? t("join.doneTitle")
                      : t("join.title")}
                </h2>
                <p className="text-[12px] text-white/50 mt-1.5">
                  {tab === "signin"
                    ? t("welcomeSub")
                    : joinDone
                      ? t("join.doneSub")
                      : t("join.sub")}
                </p>
              </div>

              {tab === "signin" ? (
                <SignInPanel
                  onNeedHelp={() => setHelpOpen(true)}
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
                <JoinSuccessPanel name={joinName} reference={joinRef} onReset={resetJoinForm} />
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
                    customerCode: joinCustomerCode,
                    koleexContact: joinKoleexContact,
                    partnerType: joinPartnerType,
                    territory: joinTerritory,
                    supplies: joinSupplies,
                    website: joinWebsite,
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
                    setCustomerCode: setJoinCustomerCode,
                    setKoleexContact: setJoinKoleexContact,
                    setPartnerType: setJoinPartnerType,
                    setTerritory: setJoinTerritory,
                    setSupplies: setJoinSupplies,
                    setWebsite: setJoinWebsite,
                    setHeardFrom: setJoinHeardFrom,
                    setMessage: setJoinMessage,
                  }}
                  onSubmit={handleJoin}
                  onGoSignIn={() => {
                    setTab("signin");
                    setJoinError(null);
                  }}
                />
              )}
                </div>
              </div>
            </div>
          </div>

          {/* Under the card, below the sign-in button: a person who cannot
              read the form scans it top to bottom first, and this is where
              they end up. Above the logo it competed with the wordmark for the
              first thing you look at. */}
          <div className="mt-5 flex justify-center">
            <LangSwitch lang={lang} />
          </div>

          <p className="text-[11px] text-white/30 text-center mt-4 tracking-wide">
            {t("footer")}
          </p>
        </div>

        <SignInHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
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
  /** Opens the help dialog. Someone who cannot sign in has no other way to
      reach an administrator from this screen. */
  onNeedHelp: () => void;
}

function SignInPanel({
  username,
  password,
  busy,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onNeedHelp,
}: SignInPanelProps) {
  const { t } = useTranslation(signInT);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelBase}>{t("username")}</label>
        <div className="relative">
          <UserIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="jane.cooper"
            className={`${inputBase} ps-9`}
          />
        </div>
      </div>

      <div>
        <label className={labelBase}>{t("password")}</label>
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
            <SpinnerIcon className="h-4 w-4 animate-spin" /> {t("signingIn")}
          </>
        ) : (
          <>
            <SignInIcon className="h-4 w-4" /> {t("signIn")}
          </>
        )}
      </button>

      <p className="text-[11px] text-white/35 text-center pt-1">
        {/* Reads as a control, not a sentence: it lifts to the Hub Blue
            accent, the underline sharpens and it takes a faint pill on hover,
            so it is obvious before you click that something will happen. */}
        <button
          type="button"
          onClick={onNeedHelp}
          className="inline-flex items-center rounded-lg px-2 py-1 -mx-2 text-white/45 underline decoration-white/15 underline-offset-4
                     hover:text-[#8FB6E0] hover:decoration-[#8FB6E0]/60 hover:bg-white/[0.05]
                     focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#567FB2]/60
                     transition-colors"
        >
          {t("help.link")}
        </button>
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
  customerCode: string;
  koleexContact: string;
  partnerType: string;
  territory: string;
  supplies: string;
  website: string;
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
  setCustomerCode: (v: string) => void;
  setKoleexContact: (v: string) => void;
  setPartnerType: (v: string) => void;
  setTerritory: (v: string) => void;
  setSupplies: (v: string) => void;
  setWebsite: (v: string) => void;
  setHeardFrom: (v: string) => void;
  setMessage: (v: string) => void;
}

interface JoinPanelProps {
  state: JoinState;
  setters: JoinSetters;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  /* Someone who already has an account is told to sign in instead — the link
     has to actually take them there, not just say so. */
  onGoSignIn: () => void;
}

function JoinPanel({
  state,
  setters,
  busy,
  error,
  onSubmit,
  onGoSignIn,
}: JoinPanelProps) {
  const { t, lang } = useTranslation(signInT);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Relationship — pill buttons. First thing the admin wants to
          know, so we ask it first and use a visual control so visitors
          don't miss it. */}
      <div>
        <label className={labelBase}>{t("join.relationship")}</label>
        {/* A dropdown, like the reason picker on the help dialog — the same
            screen should not ask two questions two different ways.

            It replaced a grid of five cards. Those were the loudest thing on a
            screen whose whole job is to be quiet: 300px of boxes-inside-boxes,
            centred text against a left-aligned form, and a 2+2+1 grid where
            the least important option got the widest card. One 44px row says
            the same thing, and the helper line under it carries the meaning
            the card subtitles were there for. */}
        <div className="relative">
          {(() => {
            const Current = (RELATIONSHIPS.find((r) => r.value === state.relationship)
              ?? RELATIONSHIPS[0]).Icon;
            return (
              <Current
                size={15}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
              />
            );
          })()}
          <select
            value={state.relationship}
            onChange={(e) => setters.setRelationship(e.target.value)}
            className={`${selectBase.replace('ps-3', '')} ps-9`}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value} className="bg-[#121212]">
                {t(`rel.${r.value}`)}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
        <p className="mt-1.5 text-[11px] text-white/35">
          {t(`rel.${state.relationship}.d`)}
        </p>
      </div>

      {/* Two people should not be filling this in, and both used to have no
          idea where else to go. A Koleex employee picking any option here
          creates a request HR was always going to handle; and someone who
          already has an account is far safer asking for extra users from
          inside a signed-in session, where the company is already proven. */}
      <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2.5 space-y-1.5">
        <p className="text-[11px] text-white/40 leading-relaxed">{t("join.employeeNote")}</p>
        <p className="text-[11px] text-white/40 leading-relaxed">
          {t("join.moreUsersNote")}{" "}
          <button
            type="button"
            onClick={onGoSignIn}
            className="text-white/70 underline underline-offset-2 hover:text-white transition-colors"
          >
            {t("join.signInHere")}
          </button>
        </p>
      </div>

      <div className="h-px bg-white/[0.05]" aria-hidden />

      {/* Name — always full width, required */}
      <div>
        <label className={labelBase}>{t("join.name")}</label>
        <div className="relative">
          <UserIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            required
            autoComplete="name"
            value={state.name}
            onChange={(e) => setters.setName(e.target.value)}
            placeholder="Jane Cooper"
            className={`${inputBase} ps-9`}
          />
        </div>
      </div>

      {/* Email + Phone row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>{t("join.email")}</label>
          <div className="relative">
            <EnvelopeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="email"
              required
              autoComplete="email"
              value={state.email}
              onChange={(e) => setters.setEmail(e.target.value)}
              placeholder="jane@company.com"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
        <div>
          <label className={labelBase}>{t("join.phone")}</label>
          <div className="relative">
            <PhoneIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="tel"
              autoComplete="tel"
              value={state.phone}
              onChange={(e) => setters.setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      </div>

      {/* Company + Job title row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>{t("join.company")}</label>
          <div className="relative">
            <Building2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              autoComplete="organization"
              value={state.company}
              onChange={(e) => setters.setCompany(e.target.value)}
              placeholder="Acme Inc."
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
        <div>
          <label className={labelBase}>{t("join.jobTitle")}</label>
          <div className="relative">
            <BriefcaseIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              autoComplete="organization-title"
              value={state.jobTitle}
              onChange={(e) => setters.setJobTitle(e.target.value)}
              placeholder="Procurement Manager"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      </div>

      {/* Country + City row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>{t("join.country")}</label>
          <div className="relative">
            <GlobeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <select
              value={state.country}
              onChange={(e) => setters.setCountry(e.target.value)}
              className={`${selectBase.replace('ps-3', '')} ps-9`}
            >
              <option value="" className="bg-[#121212]">
                {t("join.selectCountry")}
              </option>
              {/* Every country, in the reader's own alphabet. The 29-market
                  pricing list used to be here, so a visitor from Spain or
                  Japan had no row to pick. */}
              {countriesFor(lang).map((c) => (
                <option key={c.code} value={c.code} className="bg-[#121212]">
                  {flagOf(c.code)}  {countryName(c, lang)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>
        {/* Only an existing customer has a code. Everyone else was being asked
            for a city the admin was never going to use. */}
        {state.relationship === "existing_customer" ? (
          <div>
            <label className={labelBase}>{t("join.customerCode")}</label>
            <div className="relative">
              <Building2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input
                type="text"
                value={state.customerCode}
                onChange={(e) => setters.setCustomerCode(e.target.value)}
                placeholder="KX-1042"
                className={`${inputBase} ps-9`}
              />
            </div>
          </div>
        ) : null}
      </div>


      {/* ── The one question each relationship turns on ──────────────────
          Every field here had to answer: if it were blank, would the
          reviewer have to write back before deciding? Anything that failed
          is not on the form. The most valuable of them is the Koleex
          contact — one internal message to a named colleague settles an
          application faster than reading any document. */}
      {state.relationship === "existing_customer" ||
      state.relationship === "partner" ||
      state.relationship === "supplier" ? (
        <div>
          <label className={labelBase}>{t("join.koleexContact")}</label>
          <div className="relative">
            <UserCheckIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={state.koleexContact}
              onChange={(e) => setters.setKoleexContact(e.target.value)}
              placeholder="Mohamed Adel"
              className={`${inputBase} ps-9`}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-white/35">{t("join.koleexContactHint")}</p>
        </div>
      ) : null}

      {state.relationship === "partner" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className={labelBase}>{t("join.partnerType")}</label>
            <div className="relative">
              <HandshakeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              <select
                value={state.partnerType}
                onChange={(e) => setters.setPartnerType(e.target.value)}
                className={`${selectBase.replace('ps-3', '')} ps-9`}
              >
                {PARTNER_TYPES.map((v) => (
                  <option key={v} value={v} className="bg-[#121212]">
                    {t(`ptype.${v}`)}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
          <div>
            <label className={labelBase}>{t("join.territory")}</label>
            <div className="relative">
              <GlobeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={state.territory}
                onChange={(e) => setters.setTerritory(e.target.value)}
                placeholder="Upper Egypt"
                className={`${inputBase} ps-9`}
              />
            </div>
          </div>
        </div>
      ) : null}

      {state.relationship === "supplier" ? (
        <div>
          <label className={labelBase}>{t("join.supplies")}</label>
          <div className="relative">
            <TruckIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={state.supplies}
              onChange={(e) => setters.setSupplies(e.target.value)}
              placeholder="Spare parts"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      ) : null}

      {state.relationship === "new_prospect" ? (
        <div>
          <label className={labelBase}>{t("join.website")}</label>
          <div className="relative">
            <Link2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              inputMode="url"
              value={state.website}
              onChange={(e) => setters.setWebsite(e.target.value)}
              placeholder="company.com"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      ) : null}

      {/* How did you hear — only asked of someone who has just found us. An
          existing customer or supplier already knows who we are. */}
      {(state.relationship === "new_prospect" || state.relationship === "other") ? (
      <div>
        <label className={labelBase}>{t("join.heardFrom")}</label>
        <div className="relative">
          <Link2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
          <select
            value={state.heardFrom}
            onChange={(e) => setters.setHeardFrom(e.target.value)}
            className={`${selectBase.replace('ps-3', '')} ps-9`}
          >
            {HEARD_FROM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#121212]">
                {o.label}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
      </div>
      ) : null}

      {/* The last question follows the relationship. "Which parts of the Hub
          would you like access to" is unanswerable for someone who has never
          seen the Hub — which is exactly who ticks "New to Koleex". */}
      <div>
        <label className={labelBase}>{t(`join.q.${state.relationship}`)}</label>
        <div className="relative">
          <MessageSquareIcon className="absolute start-3 top-3 h-3.5 w-3.5 text-white/30" />
          <textarea
            value={state.message}
            onChange={(e) => setters.setMessage(e.target.value)}
            placeholder={t(`join.qh.${state.relationship}`)}
            className={`${textareaBase} ps-9`}
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
            <UserPlusIcon className="h-4 w-4" /> {t("join.submit")}
          </>
        )}
      </button>

      <p className="text-[11px] text-white/30 text-center pt-1">
        {t("join.privacy")}
      </p>
    </form>
  );
}

/* ── Success panel shown after a membership request is submitted. ─────── */

interface JoinSuccessPanelProps {
  name: string;
  reference: string;
  onReset: () => void;
}

function JoinSuccessPanel({ name, reference, onReset }: JoinSuccessPanelProps) {
  const { t } = useTranslation(signInT);
  void onReset; /* see below — the "send another" affordance was removed */
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
      {/* A reference the person can quote when someone calls them back. The
          panel used to say "a Super Admin will review your request" and hand
          over nothing at all. */}
      {reference ? (
        <>
          <p className="text-[11px] text-white/40 mt-5">{t("join.reference")}</p>
          <p className="text-[15px] text-white font-semibold tabular-nums tracking-wide mt-1">
            {reference}
          </p>
        </>
      ) : null}

      {/* "Submit another request" was here. It invited the same person to file
          a duplicate, which is work for a Super Admin and no help to anyone. */}
    </div>
  );
}
