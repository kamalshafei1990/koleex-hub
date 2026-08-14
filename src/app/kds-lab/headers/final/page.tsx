"use client";

/* ─────────────────────────────────────────────────────────────────
   APP HEADER — the pick, assembled, plus four back-button lengths.

   Owner, 2026-08-15: "which header you think is the most suitable one?
   and i think the back button can be little longer. show me first."

   NOTHING SHIPS. Ballot page, same as ../ and ../harmony.

   THE PICK: round-2 model M-1 (Continuity) wearing round-1 H-2's rail.
   Why A is in ../harmony; the short version is that only 23 files share
   a header today, so the migration is the work and the look is the
   smaller half — A is the shape closest to what ships, which is what
   makes moving eight big apps onto it realistic.

   THE BACK BUTTON is shown at four lengths IN PLACE, because a control
   this small cannot be judged on its own: what decides it is how it
   balances against the icon chip beside it and the tabs below it.
   ───────────────────────────────────────────────────────────────── */

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

const TABS = ["All", "Customers", "Suppliers", "Companies"];

/* ── the four candidates ─────────────────────────────────────────
   One component, one `kind` — so the only thing that differs between
   them is the geometry under test, never a drifted copy. */

type BackKind = "square" | "wide" | "labelled" | "named";

function Back({ kind, mobile }: { kind: BackKind; mobile?: boolean }) {
  const h = mobile ? "h-8" : "h-10";
  const base =
    "kx-hover-glow flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]";
  if (kind === "square") return <span aria-label="Back" className={`${base} ${h} ${mobile ? "w-8" : "w-10"}`}><ArrowLeftIcon className="h-3.5 w-3.5" /></span>;
  if (kind === "wide") return <span aria-label="Back" className={`${base} ${h} ${mobile ? "w-12" : "w-16"}`}><ArrowLeftIcon className="h-3.5 w-3.5" /></span>;
  if (kind === "labelled")
    return (
      <span className={`${base} ${h} px-3`}>
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        <span className="text-[12px] font-medium text-[var(--text-secondary)]">Back</span>
      </span>
    );
  /* Names the DESTINATION, not the gesture. On a phone the word is dropped and
     it falls back to the wide arrow, because the state line beside it is what
     must never be squeezed.

     ⚠️ THE DROP IS DRIVEN BY THE PROP, NOT BY `sm:`. These phone frames are
     375px-wide boxes inside a desktop viewport, so a Tailwind breakpoint reads
     the VIEWPORT and renders its desktop arm — the first version used
     `hidden sm:inline` and the word stayed on the phone sample, showing the
     opposite of what the note claimed. Any behaviour a sample is meant to
     demonstrate has to be expressed in JS here, or the page lies. */
  return (
    <span className={`${base} ${h} ${mobile ? "w-12" : "px-3"}`}>
      <ArrowLeftIcon className="h-3.5 w-3.5" />
      {!mobile && <span className="text-[12px] font-medium text-[var(--text-secondary)]">Hub</span>}
    </span>
  );
}

function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]" style={{ height: size, width: size }}>
      <UsersIcon className="h-[55%] w-[55%]" />
    </span>
  );
}

function Chrome({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span aria-label={label} className="kx-hover-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
      {children}
    </span>
  );
}

function SystemBar() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 md:px-5">
      <span className="flex shrink-0 items-baseline gap-1.5">
        <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">KOLEEX</span>
        <span className="text-[13px] italic text-[#7FA9D6]">hub</span>
      </span>
      <span className="h-4 w-px shrink-0 bg-[var(--border-subtle)]" />
      <span className="shrink-0 text-[13px] text-[var(--text-secondary)]">Contacts</span>
      <span className="ms-auto flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)]"><BellIcon className="h-3.5 w-3.5" /></span>
        <span className="h-7 w-7 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]" />
      </span>
    </div>
  );
}

function Tabs({ v, set, small }: { v: number; set: (i: number) => void; small?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {TABS.map((t, i) => (
        <button key={t} type="button" onClick={() => set(i)} data-kx-keep-hover=""
          className={`shrink-0 rounded-lg font-medium transition-colors ${small ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]"} ${
            i === v ? "kx-seg-on text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          }`}>
          {t}
        </button>
      ))}
    </div>
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

/* The pick, parameterised only by the back button under test. */
function Header({ kind, mobile }: { kind: BackKind; mobile?: boolean }) {
  const [v, setV] = useState(0);
  return (
    <>
      <SystemBar />
      <div className={`border-b border-[var(--border-subtle)] ${mobile ? "px-3 py-2" : "px-4 py-2.5"}`}>
        <div className={`flex items-center ${mobile ? "gap-2" : "gap-3"}`}>
          <Back kind={kind} mobile={mobile} />
          {!mobile && <AppIcon />}
          <span className="min-w-0 truncate text-[13px] text-[var(--text-secondary)]">344 contacts</span>
          {!mobile && (
            <>
              <span className="text-[12px] text-[var(--text-faint)]">·</span>
              <span className="shrink-0 text-[12px] text-[var(--text-dim)]">196 customers</span>
            </>
          )}
          <span className="ms-auto flex shrink-0 items-center gap-2">
            <Chrome label="Search"><SearchIcon className="h-3.5 w-3.5" /></Chrome>
            <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 text-[12px] font-semibold text-[var(--text-inverted)]">
              <PlusIcon className="h-3 w-3" />{!mobile && "New"}
            </span>
          </span>
        </div>
        <div className={mobile ? "mt-2" : "mt-2.5"}><Tabs v={v} set={setV} small={mobile} /></div>
      </div>
      <Body />
    </>
  );
}

function Candidate({ id, kind, name, note, rec }: { id: string; kind: BackKind; name: string; note: string; rec?: boolean }) {
  return (
    <section className={`mb-8 rounded-2xl border p-5 ${rec ? "border-[#7FA9D6]/45 bg-[#7FA9D6]/[0.04]" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"}`}>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13px] font-bold tracking-wide text-[#7FA9D6]">{id}</span>
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{name}</h2>
        {rec && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#7FA9D6]/40 bg-[#7FA9D6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7FA9D6]">
            <CheckIcon className="h-2.5 w-2.5" /> my pick
          </span>
        )}
      </div>
      <p className="mb-4 max-w-3xl text-[12px] leading-relaxed text-[var(--text-dim)]">{note}</p>
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">Desktop</p>
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]"><Header kind={kind} /></div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">
          Phone · 375px <span className="normal-case tracking-normal text-[var(--text-faint)]">— width only; open this page on a real phone to test the breakpoints</span>
        </p>
        <div className="w-[375px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]"><Header kind={kind} mobile /></div>
      </div>
    </section>
  );
}

export default function HeaderFinal() {
  const skin = useSkin();
  const aurora = skin === "aurora";
  return (
    <div className="kx-app kx-ground-host relative min-h-screen text-[var(--text-primary)]">
      {aurora && <div className="fixed inset-0 z-0"><WavyBackground /></div>}
      <div className="relative z-[1] mx-auto max-w-[1150px] px-6 py-10 md:px-10">
        <h1 className="mb-1 text-[26px] font-bold tracking-tight">The pick, and four back buttons</h1>
        <p className="mb-8 max-w-3xl text-[12px] leading-relaxed text-[var(--text-dim)]">
          The header is round-2 <span className="text-[var(--text-secondary)]">M-1 — Continuity</span>: the system bar
          keeps the app name, and the app header stops repeating it and carries live state instead. Below, the
          same header four times, changing only the back button — it is shown in place because what decides its
          length is how it balances against the icon chip beside it, not how it looks alone.
        </p>

        <Candidate id="BK-1" kind="square" name="Square — what ships today" note="40×40 desktop, 32×32 phone. It matches the icon chip beside it exactly, which is the problem: two identical boxes side by side, and only one of them does anything." />
        <Candidate id="BK-2" kind="wide" name="Wider — same shape, more room" note="64×40. The smallest change that answers the ask: the arrow gets a wider target and stops being a twin of the icon chip, with nothing new to translate. Phone goes to 48×32." />
        <Candidate id="BK-3" kind="labelled" name="Labelled — arrow + “Back”" note="Unmistakable, and the widest. But “Back” is a word in three languages, and on a phone it competes with the state line for the same row." />
        <Candidate id="BK-4" kind="named" name="Named — arrow + where it goes" rec note="Says the DESTINATION rather than the gesture: ← Hub, ← Products, ← Quotation #1042. It is the only one that answers “back to what?”, which is the actual question on a screen you can arrive at from three places. Drops the word on phones and becomes B-2, so the state line never gets squeezed." />

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
          <h2 className="mb-2 text-[15px] font-semibold tracking-tight">What I would take</h2>
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">Model M-1, back button BK-4.</span> You asked for
            longer and BK-4 is longer for a reason rather than for balance — it turns the control from a gesture into a
            destination, which is worth the extra width. If you would rather not carry a translated word in the
            chrome at all, <span className="font-semibold text-[var(--text-primary)]">BK-2</span> is the honest
            second: it answers the ask exactly, costs nothing, and is a one-line change.
          </p>
        </div>
      </div>
    </div>
  );
}
