"use client";

/* ─────────────────────────────────────────────────────────────────
   APP HEADER — ROUND 2. Three answers to the owner's three worries
   (2026-08-15): the phone version, apps not sharing one header, and
   the app header not harmonising with the system header.

   NOTHING HERE SHIPS. Ballot page, same as ../ and /kds-lab/elements.

   Round 1 asked "which design". These three ask the harder question —
   WHAT IS THE APP HEADER FOR, given that a system header is already on
   screen — so each one is a different answer, not a different skin.
   ───────────────────────────────────────────────────────────────── */

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

const TABS = ["All", "Customers", "Suppliers", "Companies"];

/* ── the SYSTEM header, reproduced at its real size ───────────────
   56px (h-14), logo start, controls end — and, today, the app name
   sitting right next to the logo. Every sample below is drawn UNDER
   it, because a header cannot be judged alone when another one is
   permanently 20px above it. */
function SystemBar({ appName, compact }: { appName?: string; compact?: React.ReactNode }) {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 md:px-5">
      <span className="flex shrink-0 items-baseline gap-1.5">
        <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">KOLEEX</span>
        <span className="text-[13px] italic text-[#7FA9D6]">hub</span>
      </span>
      {appName && (
        <>
          <span className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
          <span className="shrink-0 text-[13px] text-[var(--text-secondary)]">{appName}</span>
        </>
      )}
      {compact}
      <span className="ms-auto flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)]"><BellIcon className="h-3.5 w-3.5" /></span>
        <span className="h-7 w-7 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
      </span>
    </div>
  );
}

function Tabs({ v, set, items = TABS, size = "md" }: { v: number; set: (i: number) => void; items?: string[]; size?: "sm" | "md" }) {
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {items.map((t, i) => (
        <button
          key={t}
          type="button"
          onClick={() => set(i)}
          data-kx-keep-hover=""
          className={`shrink-0 rounded-lg font-medium transition-colors ${size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]"} ${
            i === v ? "kx-seg-on text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function AppIcon({ size = 34, radius = "rounded-xl" }: { size?: number; radius?: string }) {
  return (
    <span className={`${radius} flex shrink-0 items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]`} style={{ height: size, width: size }}>
      <UsersIcon className="h-[55%] w-[55%]" />
    </span>
  );
}

function Chrome({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button type="button" aria-label={label} data-kx-keep-hover=""
      className="kx-hover-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
      {children}
    </button>
  );
}

function Primary({ compact }: { compact?: boolean }) {
  return (
    <button type="button" className={`flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] font-semibold text-[var(--text-inverted)] ${compact ? "h-8 w-8 justify-center" : "h-8 px-3 text-[12px]"}`}>
      <PlusIcon className="h-3 w-3" />{!compact && "New"}
    </button>
  );
}

function Body() {
  return (
    <div className="space-y-2.5 px-4 py-4">
      <div className="h-2 w-40 rounded-full bg-[var(--text-primary)] opacity-[0.07]" />
      <div className="h-2 w-56 rounded-full bg-[var(--text-primary)] opacity-[0.05]" />
      <div className="h-2 w-44 rounded-full bg-[var(--text-primary)] opacity-[0.05]" />
    </div>
  );
}

/* ═══════ A · CONTINUITY — the system header keeps the name ═══════ */

function A_Desktop() {
  const [v, setV] = useState(0);
  return (
    <>
      <SystemBar appName="Contacts" />
      <div className="border-b border-[var(--border-subtle)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Chrome label="Back"><ArrowLeftIcon className="h-3.5 w-3.5" /></Chrome>
          <AppIcon size={30} radius="rounded-lg" />
          {/* NO repeated app name. What replaces it is the thing the system
              header can never say: the state of what you are looking at. */}
          <span className="text-[13px] text-[var(--text-secondary)]">344 contacts</span>
          <span className="text-[12px] text-[var(--text-faint)]">·</span>
          <span className="text-[12px] text-[var(--text-dim)]">196 customers</span>
          <span className="ms-auto flex items-center gap-2">
            <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
            <Primary />
          </span>
        </div>
        <div className="mt-2.5"><Tabs v={v} set={setV} /></div>
      </div>
      <Body />
    </>
  );
}

function A_Mobile() {
  const [v, setV] = useState(0);
  return (
    <>
      <SystemBar appName="Contacts" />
      <div className="border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Chrome label="Back"><ArrowLeftIcon className="h-3.5 w-3.5" /></Chrome>
          <span className="text-[12px] text-[var(--text-secondary)]">344 contacts</span>
          <span className="ms-auto flex items-center gap-1.5">
            <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
            <Primary compact />
          </span>
        </div>
        <div className="mt-2"><Tabs v={v} set={setV} size="sm" /></div>
      </div>
      <Body />
    </>
  );
}

/* ═══════ B · SINGLE BAR — one 56px row, no second header ═══════ */

function B_Desktop() {
  const [v, setV] = useState(1);
  return (
    <>
      <SystemBar
        compact={
          <>
            <span className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
            <button type="button" data-kx-keep-hover="" className="flex shrink-0 items-center gap-1.5 rounded-lg px-1 text-[13px] font-semibold text-[var(--text-primary)]">
              <AppIcon size={22} radius="rounded-md" /> Contacts <AngleDownIcon className="h-2.5 w-2.5 text-[var(--text-faint)]" />
            </button>
            <span className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
            <Tabs v={v} set={setV} size="sm" />
            <span className="ms-2 flex shrink-0 items-center gap-1.5">
              <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
              <Primary />
            </span>
          </>
        }
      />
      <Body />
    </>
  );
}

function B_Mobile() {
  const [v, setV] = useState(1);
  return (
    <>
      <SystemBar
        compact={
          <>
            <span className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
            <button type="button" data-kx-keep-hover="" className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--text-primary)]">
              Contacts <AngleDownIcon className="h-2.5 w-2.5 text-[var(--text-faint)]" />
            </button>
          </>
        }
      />
      {/* On a phone the tabs cannot fit beside the logo — they get their own
          scrolling strip, which is the ONLY extra chrome this option costs. */}
      <div className="border-b border-[var(--border-subtle)] px-3 py-1.5">
        <Tabs v={v} set={setV} size="sm" />
      </div>
      <Body />
    </>
  );
}

/* ═══════ C · HANDOFF — identity at rest, name moves up on scroll ═══════ */

function C_Rest() {
  const [v, setV] = useState(0);
  return (
    <>
      {/* At rest the system header does NOT carry the name — the app owns it. */}
      <SystemBar />
      <div className="border-b border-[var(--border-subtle)] px-4 pb-2.5 pt-3">
        <div className="flex items-center gap-3">
          <AppIcon size={38} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[20px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">Contacts</span>
            <span className="mt-0.5 block text-[11px] text-[var(--text-dim)]">344 contacts · 196 customers</span>
          </span>
          <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
          <Primary />
        </div>
        <div className="mt-2.5"><Tabs v={v} set={setV} /></div>
      </div>
      <Body />
    </>
  );
}

function C_Scrolled() {
  const [v, setV] = useState(0);
  return (
    <>
      {/* Scrolled: the name has moved INTO the system header, and the app
          header keeps only what you still need — the sections. */}
      <SystemBar appName="Contacts" />
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-1.5">
        <Tabs v={v} set={setV} size="sm" />
        <span className="ms-auto flex items-center gap-1.5">
          <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
          <Chrome label="More"><MoreHorizontalIcon className="h-3.5 w-3.5" /></Chrome>
        </span>
      </div>
      <Body />
    </>
  );
}

/* ── ballot chrome ───────────────────────────────────────────────── */

function Option({ id, title, claim, costs, desktop, mobile, mobile2, rec }: {
  id: string; title: string; claim: string; costs: string;
  desktop: React.ReactNode; mobile: React.ReactNode; mobile2?: React.ReactNode; rec?: boolean;
}) {
  return (
    <section className={`mb-10 rounded-2xl border p-5 ${rec ? "border-[#7FA9D6]/45 bg-[#7FA9D6]/[0.04]" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"}`}>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13px] font-bold tracking-wide text-[#7FA9D6]">{id}</span>
        <h2 className="text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        {rec && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#7FA9D6]/40 bg-[#7FA9D6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7FA9D6]">
            <CheckIcon className="h-2.5 w-2.5" /> my pick
          </span>
        )}
      </div>
      <p className="mb-4 max-w-3xl text-[12px] leading-relaxed text-[var(--text-secondary)]">{claim}</p>
      {/* ⚠️ Desktop gets a FULL-WIDTH row of its own. The first version put it
          in a flex column beside the phones, which left it ~410px wide — and a
          crowded 410px frame made option B look like it fails on desktop when
          what actually failed was my frame. A comparison page that squeezes
          one candidate is not a comparison. */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">Desktop · full width</p>
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">{desktop}</div>
      </div>
      <div className="mt-5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">Phone · 375px{mobile2 ? " · at rest, then scrolled" : ""}</p>
        <div className="flex flex-wrap gap-4">
          <div className="w-[375px] shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">{mobile}</div>
          {mobile2 && <div className="w-[375px] shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]">{mobile2}</div>}
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-dim)]">
        <TriangleWarningIcon className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-faint)]" />
        <span><span className="text-[var(--text-secondary)]">What it costs:</span> {costs}</span>
      </p>
    </section>
  );
}

function Fact({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="text-[22px] font-bold leading-none tracking-tight text-[var(--text-primary)]">{n}</div>
      <div className="mt-1.5 text-[11px] leading-snug text-[var(--text-dim)]">{label}</div>
    </div>
  );
}

export default function HeaderHarmony() {
  const skin = useSkin();
  const aurora = skin === "aurora";
  return (
    <div className="kx-app kx-ground-host relative min-h-screen text-[var(--text-primary)]">
      {aurora && <div className="fixed inset-0 z-0"><WavyBackground /></div>}
      <div className="relative z-[1] mx-auto max-w-[1150px] px-6 py-10 md:px-10">
        <h1 className="mb-1 text-[26px] font-bold tracking-tight">App header — round 2</h1>
        <p className="mb-6 max-w-3xl text-[12px] leading-relaxed text-[var(--text-dim)]">
          Round 1 asked which design. These three ask what the app header is FOR, given a system
          header is already on screen — so they are three answers, not three skins. Each is shown
          under the real 56px system bar, on desktop and at phone width.
        </p>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact n="23" label="files use the shared PageHeader" />
          <Fact n="8" label="of the biggest apps do NOT — Contacts, Products, Product Data, Employees, Calendar, Discuss, AI, To-do" />
          <Fact n="20px" label="between the app name in the system bar and the same name again below it" />
          <Fact n="118px" label="of chrome above the first row of content on a phone" />
        </div>

        <Option
          id="A" title="Continuity — the system bar owns the name" rec
          claim="The app header stops repeating the app name and says what the system bar cannot: the state of what you are looking at (344 contacts · 196 customers). Everything else stays where it is, so the 23 apps already on PageHeader move for free and the rest have a small target to hit."
          costs="Least ambitious of the three. It fixes the duplication and the drift, not the height — you still have two bars."
          desktop={<A_Desktop />} mobile={<A_Mobile />}
        />

        <Option
          id="B" title="Single bar — merge the two headers"
          claim="There is no app header at all. The app icon, name, sections and actions move INTO the 56px system bar. One bar, one name, and the most content of any option — on desktop it gives back roughly 70px of vertical space on every screen in the Hub."
          costs="The biggest change, and it breaks down on a phone: the sections cannot fit beside the logo, so they need their own strip and the saving is halved. Apps with many sections or long titles will crowd the bar."
          desktop={<B_Desktop />} mobile={<B_Mobile />}
        />

        <Option
          id="C" title="Handoff — the name moves up as you scroll"
          claim="At rest the app owns its identity: a real title block that tells you where you are when you arrive. As you scroll, the name hands off to the system bar and the app header shrinks to just the sections — so exactly one copy of the name is on screen at any moment."
          costs="The only option with moving parts: a scroll listener and a state the other two do not have. Two headers to keep in sync, and the handoff has to be exactly right or it reads as a glitch."
          desktop={<C_Rest />} mobile={<C_Rest />} mobile2={<C_Scrolled />}
        />

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <h2 className="mb-2 text-[15px] font-semibold tracking-tight">What I would do</h2>
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">A, and not because it is the prettiest.</span> The
            measurable problem is not the design — it is that only 23 files share a header while the
            apps you use most each built their own. A new design that lands only in those 23 leaves
            the Hub exactly as inconsistent as it is today. So the work is one component every app
            uses, and choosing its look is the smaller half of it. A is the shape closest to what
            already ships, which is what makes that migration realistic rather than a rewrite.
          </p>
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
            B is the better design in isolation and I would want it if the Hub were being started
            today — but it is the one that suffers most on a phone, which is the platform you said
            you are worried about. C is a real option if arriving in an app should feel like
            arriving somewhere; it is the only one that costs behaviour, not just markup.
          </p>
        </div>
      </div>
    </div>
  );
}
