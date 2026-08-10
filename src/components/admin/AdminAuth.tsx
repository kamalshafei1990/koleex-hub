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
import dynamic from "next/dynamic";
import SignInIcon from "@/components/icons/ui/SignInIcon";
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
import CopyIcon from "@/components/icons/ui/CopyIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SelectChevron from "@/components/admin/SelectChevron";
import { inputBase, labelBase } from "@/components/admin/signin/field-styles";
import type { JoinState, JoinSetters } from "@/components/admin/signin/JoinPanel";
import { setCurrentAccountId } from "@/lib/identity";
/* Both are gate-only. AdminAuth wraps every route, so a static import here is
   a download for every signed-in user of a screen they will never open —
   measured at 71 KB of a 1083 KB boot before this split. */
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
const JoinPanel = dynamic(() => import("@/components/admin/signin/JoinPanel"), {
  ssr: false,
  loading: () => <div className="h-[420px]" aria-hidden />,
});
const SignInHelpDialog = dynamic(() => import("./SignInHelpDialog"), { ssr: false });
/* Canvas + a draw loop must never sit in the boot chunk, and must never mount
   for somebody who is already signed in. ssr:false because it measures the
   element before it can paint. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });
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
    <div
      /* dir="ltr" AGAINST the page. Picking Arabic flips the whole gate to
         rtl, which mirrored this row and moved every button to a new place —
         so the control you had just used was no longer where you left it, and
         going back meant hunting for EN on the opposite side.

         A language picker is a list of names, not prose. Its order carries no
         reading direction, exactly like the Latin lockup the highlight sweeps
         across, so it is pinned in one order in all three languages. */
      dir="ltr"
      className="flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.07] p-1"
    >
      {SIGNIN_LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => pick(l.code)}
          aria-pressed={lang === l.code}
          /* Fixed segment width. Pinning dir stopped the buttons REORDERING,
             but the row was still 4.7px wider in Arabic — the labels are
             always drawn in their own script and those glyphs measure
             differently — and a centred row that changes width moves every
             button in it by half the difference. Equal segments make the row
             a constant size, which is what a segmented control should be
             anyway. Measured, not guessed: 149.7px in English, 154.4px in
             Arabic, card identical in both. */
          className={`h-7 min-w-[52px] px-3 rounded-lg text-[11.5px] font-semibold transition-colors ${
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

/* BrandGlyph carries the simple-icons dataset, and this file is the auth gate
   — it is loaded on EVERY route. A static import put those bytes in the shared
   chunk and pushed eleven routes over their budget at once. Lazily loaded, the
   logos are fetched only when somebody actually opens the join form. */
const BrandGlyph = dynamic(() => import("@/components/icons/brands/BrandGlyph"), {
  ssr: false,
  loading: () => <span className="inline-block h-[15px] w-[15px] shrink-0" />,
});

/* useLayoutEffect on the server is a no-op and warns; fall back to useEffect.
   It has to be the layout variant in the browser: both the tab indicator and
   the card height are measured from the DOM, and measuring after paint would
   show one frame of the wrong geometry every single switch. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* One easing and one duration for everything the tab switch moves — card
   width, card height, indicator. Three transitions of different lengths read
   as three separate events rather than one. Matches .kx-tab-in in globals.css,
   which is the Hub's existing tab-entrance curve. */
/* ONE curve and ONE length for everything that moves on a tab switch — the
   card height, the card width, the underline and the content entrance — so the
   switch reads as a single movement instead of four things that happen to
   start at the same time.

   This was 300ms on cubic-bezier(0.22, 1, 0.36, 1), easeOutQuint. That curve
   leaves the start line at almost full speed, so a 700px height change flew
   open and then crawled the last few pixels — the abrupt part sits at the very
   beginning, which is where the eye is. Replaced with the standard in-out: it
   builds up, holds, and settles long and soft at both ends. 440ms rather than
   300 because the taller the travel the longer it needs in order not to look
   rushed, and the Join form is more than twice the height of Sign In. */
const SWITCH_MOTION =
  "motion-safe:transition-[height,transform,width] motion-safe:duration-[440ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)]";

/* The underline is deliberately NOT on SWITCH_MOTION. Same curve, shorter
   clock, because equal DURATION is not equal SPEED: the card travels about
   860px while the bar slides roughly 200px, so at a shared 440ms the bar
   crawls at a quarter of the card's velocity and visibly trails it. Worse, an
   ease-in-out spends its first quarter barely moving — on something as small
   as a 2px rule that reads as stuck-then-slide. 240ms puts the bar back at the
   card's apparent speed and lands it while the card is still settling, which
   is the order the eye expects: the label commits, then the panel follows. */
const INK_MOTION =
  "motion-safe:transition-transform motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)]";

/* Floor for the scrolling body. Below this the card stops being a card, so on
   a viewport too short even for that we let the outer area scroll instead —
   the tab strip scrolling away is the lesser evil at 300px of height. */
const MIN_BODY_H = 160;

/* localStorage keys. Using localStorage (not sessionStorage) so the session
   survives browser restarts — the user only has to sign in again after an
   explicit Sign Out. */
export const LEGACY_SESSION_KEY = "koleex-admin";
export const LEGACY_SESSION_USER_KEY = "koleex-admin-user";
/* Survives sign-out — LEGACY_SESSION_USER_KEY does not. Who you are is worth
   remembering across a deliberate sign-out; that you were signed in is not. */
export const LAST_USER_KEY = "koleex-last-user";


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
  /* The three the cap is computed from: the space available, the column that
     has to fit inside it, and the box being sized. */
  const areaRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /* The indicator is TWO nodes and neither is React state — see the effect. */
  const trackRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const lastGeom = useRef<{ x: number; w: number } | null>(null);
  const lastTab = useRef<"signin" | "join" | null>(null);
  const [body, setBody] = useState<{ h: number; capped: boolean } | null>(null);

  /* The indicator. One bar that slides, not one per tab that blinks.
     The maths is in PHYSICAL pixels on purpose: getBoundingClientRect and
     translateX are both physical, and the bar is pinned with `left-0`, so
     this is already correct in Arabic. Rewriting it to `start-0` would
     apply the RTL flip a second time and send the bar off the card.

     IT IS TWO NODES, AND THAT IS THE WHOLE FIX. A single transitioned bar
     stuttered, and the cause was not the curve:

       one tab switch → 41 rewrites of the bar's inline style, target x
       creeping 216 → 217 → 218 → … → 300 across 412ms

     The card's max-width animates for 440ms, so the strip it is measured
     against is a different width on every frame, so the ResizeObserver fires
     on every frame — and every firing handed the transition a NEW target,
     restarting a 240ms ease from wherever the bar had got to. It chased a
     moving goal forty-one times and never once arrived; that is the glitch,
     and no amount of retiming would have touched it.

     So the two jobs are separated:

       tracker  positioned from the measurement every frame, NO transition.
                It is glued to the label through the whole widening.
       bar      inside it, and the ONLY thing that animates. On a tab change
                it is drawn back at the rect it just left and released once,
                undisturbed by anything the tracker does afterwards.

     That is FLIP, and the inversion is exact: with transform-origin at the
     left edge, scaleX(prevW/w) restores the old width and translateX(prevX−x)
     restores the old left edge, so frame zero is pixel-identical to where the
     bar already was. Both are transforms — composited, no layout per frame.

     Written straight to the DOM rather than through state on purpose: those
     41 measurements were 41 React renders of the whole gate per switch. */
  useIsoLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const sync = () => {
      const track = trackRef.current, bar = barRef.current;
      const label = strip.querySelector<HTMLElement>('[data-tab-active="true"] > span');
      if (!label || !track || !bar) return;
      const s = strip.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      const x = Math.round(l.left - s.left) - 8;
      const w = Math.round(l.width) + 16;

      const prev = lastGeom.current;
      const switched = lastTab.current !== null && lastTab.current !== tab;

      track.style.transform = `translateX(${x}px)`;
      track.style.width = `${w}px`;
      /* Revealed only once measured, so it never shows at the wrong tab for
         a frame — the old code got this by not rendering at all. */
      track.style.opacity = "1";

      if (switched && prev) {
        bar.style.transition = "none";
        bar.style.transform = `translateX(${prev.x - x}px) scaleX(${prev.w / w})`;
        /* Force the browser to accept that as the current value before the
           transition comes back, or both writes coalesce into one frame and
           there is nothing to animate FROM. */
        void bar.offsetWidth;
        bar.style.transition = "";
        bar.style.transform = "translateX(0px) scaleX(1)";
      }

      lastGeom.current = { x, w };
      lastTab.current = tab;
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
     when the relationship changes, which jumped just as hard.

     AND IT IS CAPPED, which is what keeps the tab strip on screen. The card
     used to grow to whatever the Join form needed — 1278px against a 792px
     viewport — and the overflow went to the page, so scrolling down to reach
     the submit button carried the tabs away with it. Now the body stops
     growing at the space that is left and scrolls inside itself instead: the
     strip, the card frame and the brand header are all fixed, and the form is
     the only thing that moves. It is also the owner's standing rule — the
     screen fits, and only what has to scroll scrolls.

     `chrome` is DERIVED, not listed: the column's height minus the body's is
     the tab strip plus the footer plus the gap plus the padding, whatever
     those happen to be today. Listing them would go stale the first time one
     of them changed. It survives being read mid-transition because both
     measurements contain the same animating number, which cancels.

     No feedback loop: the observed nodes are the UNCONSTRAINED content and
     the area, and neither changes size when the imposed height does. */
  useIsoLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const sync = () => {
      const content = el.offsetHeight;
      const area = areaRef.current, col = colRef.current, clip = clipRef.current;
      let cap = Infinity;
      if (area && col && clip) {
        /* Fractional rects, then floor — NOT offsetHeight. offsetHeight rounds
           each of the two to a whole pixel before they are subtracted, and the
           two roundings do not cancel: it left one pixel of overflow, which is
           one pixel the tab strip could be scrolled away by. Measured. */
        const chrome =
          col.getBoundingClientRect().height - clip.getBoundingClientRect().height;
        cap = Math.max(MIN_BODY_H, Math.floor(area.clientHeight - chrome));
      }
      const h = Math.min(content, cap);
      /* `capped` drives overflow. Left permanently on auto, the scrollbar
         would flash on every switch whose content is briefly taller than the
         animating box — which is every switch. */
      setBody({ h, capped: content > h + 1 });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    /* The area covers viewport resize, rotation, and the mobile URL bar. */
    if (areaRef.current) ro.observe(areaRef.current);
    return () => ro.disconnect();
    /* Same reason as the indicator: mounted only after `authed` resolves. */
  }, [authed]);

  /* CHANGING LANGUAGE USED TO BE ONE FRAME OF SNAP.

     Measured on production before touching anything, because "it flashes"
     could have meant a remount, a blanked panel or a layout jump, and it was
     none of them: EN→中文 is four DOM mutations, EN→عربي is six, no node is
     replaced, opacity never leaves 1, the card moves 2px. Nothing is broken.

     That IS the problem. Every string on the card changes in a single frame
     with no motion whatsoever — and in Arabic the whole layout mirrors in that
     same frame, every icon and label jumping to the other side at once. Next
     to the tab switch, which eases, it reads as a flash.

     So it borrows the tab switch's entrance. NOT by adding `lang` to the
     panel's key: React would remount the subtree, and JoinPanel's own UI state
     would be thrown away every time somebody changed language mid-form. The
     animation is replayed on the node that is already there — clear it, force
     the browser to accept that, put it back — which is the identical motion at
     no risk. The card height is already on the same 440ms curve, so the two
     move together.

     Skipped on first paint: `lang` is read from localStorage after mount, so
     without the guard every visitor whose language is not English would see
     the panel animate once for no reason. */
  const langPainted = useRef<string | null>(null);
  useIsoLayoutEffect(() => {
    const el = panelRef.current;
    const first = langPainted.current === null;
    langPainted.current = lang;
    if (!el || first) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }, [lang, authed]);

  /* Sign-in form state */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [sharedDevice, setSharedDevice] = useState(false);

  /* The username was already being saved on every sign-in and never read
     back, so the field started empty every time. It is a separate key from
     the session hint on purpose: signing out should forget that you are
     signed in, not who you are. Ticking "shared computer" clears it, because
     the next person at that desk should not be shown a colleague's username. */
  useEffect(() => {
    try {
      const last = window.localStorage.getItem(LAST_USER_KEY);
      if (last) setUsername(last);
    } catch { /* storage blocked */ }
  }, []);

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
  /* Proof documents live on the parent, not the panel, so switching
     relationship mid-form does not silently drop a file already attached. */
  const [joinDocs, setJoinDocs] = useState<File[]>([]);
  const [joinContactVia, setJoinContactVia] = useState("email");
  const [joinContactHandle, setJoinContactHandle] = useState("");
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
    const result = await verifyAccountLogin(username, password, sharedDevice);
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
      if (sharedDevice) window.localStorage.removeItem(LAST_USER_KEY);
      else window.localStorage.setItem(LAST_USER_KEY, result.account.username);
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
    setJoinDocs([]);
    setJoinContactVia("email");
    setJoinContactHandle("");
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
    /* From the chunk the join form has already loaded — free by the time
       anybody can press Submit. */
    const { dialOf } = await import("@/lib/countries-dial");
    const dialCode = dialOf(joinCountry);

    /* One request whether or not there are documents. FormData rather than
       two round-trips: an upload endpoint that runs first would leave orphan
       files behind every time somebody attaches a license and then closes the
       tab, and it would need its own rate limit. Content-Type is deliberately
       NOT set — the browser has to add the multipart boundary itself. */
    const fields: Record<string, string> = {
      relationship: joinRelationship,
      full_name: name,
      email,
      phone: joinPhone.trim(),
      phone_code: dialCode,
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
      contact_via: joinContactVia,
      contact_handle: joinContactHandle.trim(),
      message: joinMessage.trim(),
      language: lang,
    };
    const payload = new FormData();
    for (const [k, v] of Object.entries(fields)) payload.append(k, v);
    for (const f of joinDocs) payload.append("documents", f, f.name);

    try {
      const res = await fetch("/api/support/membership-request", {
        method: "POST",
        body: payload,
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
        /* THE FRAME DOES NOT SCROLL — overflow-hidden. The scrolling moved to
           an inner element, below.

           This element used to be the scroller, with the waves absolutely
           positioned inside it. An absolutely positioned child of a scroll
           container is laid against the container's PADDING BOX — the entire
           scrollable height, not the visible window — so on the Join tab the
           ground stretched to fifteen hundred pixels and slid away up the
           screen as you scrolled. inset-0 now resolves to exactly the
           viewport, so the waves stay centred and still however far down the
           form you are. */
        className="h-[100dvh] bg-[#05070C] relative overflow-hidden"
      >
        {/* The ground. Replaces the radial wash and the 64px grid — three
            backgrounds stacked would have been noise, and the waves already
            carry the depth those two were there to provide. */}
        {/* Pinned dark: this screen's card, type and lockup are all dark-only,
            so the ground must not follow the user's theme. */}
        <WavyBackground theme="dark" />

        <div className="relative h-full flex flex-col items-center px-4">

        {/* BRAND HEADER — PINNED. It sits outside the scroller entirely, so
            it does not move when the tab changes and does not move when the
            Join form is scrolled. It is the fixed point of the screen.

            It used to live inside a column centred with my-auto. Centring is
            computed from the column's own height, so the moment the card grew
            for the Join form the midpoint moved and the logo slid up with it.

            The offset is the one that centres the SIGN-IN state exactly:
            (100dvh − 665px) / 2, where 665px is that column measured. Floored
            at 40px so short screens keep some air, capped at 200px so a tall
            monitor does not park everything halfway down the glass. It depends
            only on the viewport — never on the content. */}
        <div className="shrink-0 flex flex-col items-center pt-[clamp(40px,calc((100dvh-665px)/2),200px)] pb-6">
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

          {/* THE ONLY THING THAT SCROLLS.

              min-h-0 is load-bearing: a flex child refuses to shrink below its
              own content, so without it this box grows to the height of the
              Join form and no scrollbar ever appears.

              scrollbar-gutter reserves the track on BOTH edges, so the card
              stays optically centred and the screen does not jump sideways the
              moment the form gets long enough to overflow. */}
          <div
            ref={areaRef}
            className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable_both-edges] flex justify-center"
          >
            <div
              ref={colRef}
              /* Same curve and length as the height and the underline — the
                 card widening on a different easing read as a second, later
                 event. */
              className={`relative w-full self-start pb-10 motion-safe:transition-[max-width] motion-safe:duration-[440ms] motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)] ${
                isWide ? "max-w-[560px]" : "max-w-md"
              }`}
            >

            {/* Card */}
            {/* Glass, not a solid panel. With a moving ground behind it an opaque card
                  just hides the thing you chose — the waves have to reach through. */}
              <div className="rounded-2xl border border-white/[0.10] shadow-2xl overflow-hidden bg-[#0B0E14]/60 backdrop-blur-2xl backdrop-saturate-150 [box-shadow:0_1px_0_rgba(255,255,255,.12)_inset,0_40px_80px_-30px_rgba(0,0,0,.9)]">
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

                {/* The one indicator: tracker outside, animated bar inside. */}
                <span
                  ref={trackRef}
                  aria-hidden
                  /* transition-none is not decoration. Unset, the computed
                     transition-property is `all`; it is inert only because the
                     duration happens to be 0s, and the entire fix rests on this
                     node never animating. Say it out loud. */
                  className="absolute bottom-0 left-0 h-[2px] opacity-0 transition-none"
                >
                  <span
                    ref={barRef}
                    className={`block h-full w-full origin-left rounded-full bg-white ${INK_MOTION}`}
                  />
                </span>
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
                ref={clipRef}
                /* overscroll-contain so flicking the form to its end does not
                   hand the gesture on to the page behind it. */
                className={`${body?.capped ? "overflow-y-auto overscroll-contain" : "overflow-hidden"} ${SWITCH_MOTION}`}
                style={body ? { height: body.h } : undefined}
              >
                <div ref={bodyRef}>
                  <div
                    ref={panelRef}
                    key={tab === "signin" ? "signin" : joinDone ? "done" : "join"}
                    /* kx-tab-in is the Hub-wide tab entrance and Product Data uses
                       the same class, so it is RETIMED HERE through the two
                       custom properties the class now reads, rather than being
                       changed in globals.css. This screen gets the softer curve;
                       every other tab in the Hub keeps the snappy one. */
                    className="kx-tab-in [--kx-tab-in-dur:0.44s] [--kx-tab-in-ease:cubic-bezier(0.4,0,0.2,1)] px-6 py-6 md:px-7 md:py-7"
                  >
                {/* Tab-contextual heading. Gives the form a human-readable
                    title without the clunky outer "Koleex Hub" label. */}
                <div className="mb-5">
                  <h2 className="text-[17px] font-bold text-white tracking-tight leading-none">
                    {tab === "signin"
                      ? t("welcome")
                      : joinDone
                        ? t("join.doneTitle").replace("{name}", joinName.trim().split(" ")[0] || "")
                            .replace(/[،,]\s*$/, "")
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
                    sharedDevice={sharedDevice}
                    onSharedDeviceChange={setSharedDevice}
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
                      docs: joinDocs,
                      contactVia: joinContactVia,
                      contactHandle: joinContactHandle,
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
                      setDocs: setJoinDocs,
                      setContactVia: setJoinContactVia,
                      setContactHandle: setJoinContactHandle,
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

              {/* Inside the card, not floating under it. It belongs to the form
                  it changes, and a control sitting alone on the background read
                  as a stray piece of the page.

                  Outside the height-animated body on purpose: in there it would
                  slide every time the tab changes, and a language switch that
                  moves when you switch tabs looks broken. */}
              <div className="px-6 md:px-7 pb-5 pt-1 flex justify-center border-t border-white/[0.06]">
                <div className="pt-4">
                  <LangSwitch lang={lang} />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-white/30 text-center mt-4 tracking-wide">
              {t("footer")}
            </p>
          </div>
          </div>
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
  sharedDevice: boolean;
  onSharedDeviceChange: (v: boolean) => void;
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
  sharedDevice,
  onSharedDeviceChange,
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

      {/* The inverse of the "remember me" box other sites carry. The Hub
          already remembers you for 30 days, so a "remember me" would either
          do nothing or force the default shorter for everyone who did not
          tick it. What was missing is a way to say the opposite. */}
      <label className="flex items-start gap-2.5 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={sharedDevice}
          onChange={(e) => onSharedDeviceChange(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-white/[0.06] accent-white cursor-pointer shrink-0"
        />
        <span className="min-w-0">
          <span className="block text-[12px] text-white/60 group-hover:text-white/80 transition-colors">
            {t("signIn.shared")}
          </span>
          <span className="block text-[11px] text-white/30 leading-relaxed">
            {t("signIn.sharedHint")}
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={busy || !username || !password}
        className="w-full h-11 rounded-xl bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-60"
      >
        {busy ? (
          <>
            <SpinnerIcon className="h-4 w-4" /> {t("signingIn")}
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

interface JoinSuccessPanelProps {
  name: string;
  reference: string;
  onReset: () => void;
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ width: 130, color: "#777" }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}

function JoinSuccessPanel({ name, reference, onReset }: JoinSuccessPanelProps) {
  const { t } = useTranslation(signInT);
  const [copied, setCopied] = useState(false);
  const refRef = useRef<HTMLSpanElement>(null);
  void onReset; /* see below — the "send another" affordance was removed */
  return (
    <div className="py-4 flex flex-col items-center text-center">
      <div className="h-12 w-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
        <CheckCircleIcon className="h-6 w-6 text-emerald-300" />
      </div>
      {/* States what happened; the thank-you moved up to the card heading
          where it is said by name. Same phrase the help dialog uses. */}
      <h3 className="text-[15px] font-semibold text-white">
        {t("join.thanks")}
      </h3>
      {/* Deliberately NOT a second "someone will review this within N days" —
          the card heading directly above says exactly that, translated. This
          line said "a Super Admin will reach out shortly", which contradicted
          it in both the rank and the timeframe, and was English only on a
          screen that reads in three languages. */}
      <p className="text-[12px] text-white/55 mt-1.5 leading-relaxed max-w-[320px]">
        {t("join.doneKeepRef")}
      </p>
      {/* A reference the person can quote when someone calls them back. The
          panel used to say "a Super Admin will review your request" and hand
          over nothing at all. */}
      {reference ? (
        <>
          <p className="text-[11px] text-white/40 mt-5">{t("join.reference")}</p>
          <div className="mt-1 flex items-center gap-2">
            <span ref={refRef} className="text-[15px] text-white font-semibold tabular-nums tracking-wide">
              {reference}
            </span>
            {/* A reference is only useful if it survives the walk to the email
                client. Asking somebody to retype MR-2026-0021 by hand is how
                it arrives wrong. */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(reference);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                } catch {
                  /* The Clipboard API rejects on an insecure origin, on older
                     Safari, and whenever the permission is denied. Doing
                     nothing would mean somebody presses Copy and gets no
                     answer at all, so select the reference instead — they can
                     still copy it with the keyboard, and the selection is the
                     feedback that the press registered. */
                  const el = refRef.current;
                  if (!el) return;
                  const range = document.createRange();
                  range.selectNodeContents(el);
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                }
              }}
              className="h-7 px-2.5 rounded-lg border border-white/[0.10] bg-white/[0.04] text-[11px] font-semibold text-white/60 inline-flex items-center gap-1.5 hover:text-white hover:border-white/25 transition-colors"
            >
              {copied ? <CheckCircleIcon className="h-3 w-3 text-emerald-300" /> : <CopyIcon className="h-3 w-3" />}
              {t(copied ? "join.copied" : "join.copy")}
            </button>
          </div>

          {/* window.print(), not a PDF library. A library would have been
              200-300 KB on the exact screen we spent today getting out of
              everybody's boot chunk; the browser already has a PDF writer and
              the receipt below is a print-only subtree costing nothing. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="mt-4 h-9 px-3.5 rounded-lg border border-white/[0.10] bg-white/[0.04] text-[12px] font-semibold text-white/70 inline-flex items-center gap-2 hover:text-white hover:border-white/25 transition-colors"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            {t("join.savePdf")}
          </button>
        </>
      ) : null}

      {/* "Submit another request" was here. It invited the same person to file
          a duplicate, which is work for a Super Admin and no help to anyone. */}

      {/* ── The printed sheet ──────────────────────────────────────────────
          Never visible on screen; the @media print rule in globals.css hides
          everything else and reveals this. White with black text on purpose:
          the Hub is a dark product, and a dark PDF is a page a printer floods
          with toner and nobody can photocopy. */}
      {reference ? (
        <div data-kx-receipt className="hidden text-start" aria-hidden>
          <div style={{ padding: "48px 56px", fontFamily: "inherit" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/hub-logo/koleex-hub-logo-for-light.webp"
              alt="Koleex Hub"
              style={{ height: 30, width: "auto" }}
            />
            <p style={{ marginTop: 28, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#666" }}>
              {t("join.receiptTitle")}
            </p>
            <p style={{ marginTop: 6, fontSize: 30, fontWeight: 700, letterSpacing: "0.02em" }}>
              {reference}
            </p>
            <div style={{ marginTop: 28, borderTop: "1px solid #ddd", paddingTop: 18 }}>
              <Line k={t("join.receiptName")} v={name} />
              <Line k={t("join.receiptDate")} v={new Date().toLocaleDateString()} />
            </div>
            <p style={{ marginTop: 22, fontSize: 12, lineHeight: 1.7, color: "#333", maxWidth: 460 }}>
              {t("join.doneSub").replace("{name}", name)}
            </p>
            <p style={{ marginTop: 10, fontSize: 12, lineHeight: 1.7, color: "#666", maxWidth: 460 }}>
              {t("join.receiptNote")}
            </p>
            <p style={{ marginTop: 40, fontSize: 10, color: "#999", borderTop: "1px solid #eee", paddingTop: 12 }}>
              {t("footer")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
