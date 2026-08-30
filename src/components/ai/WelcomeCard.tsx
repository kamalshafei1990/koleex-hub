"use client";

/* ---------------------------------------------------------------------------
   components/ai/WelcomeCard — the empty-conversation landing.

   Phase 2J, sliced verbatim from KoleexAiApp.tsx. Takes its strings as a prop
   rather than importing COPY, so it renders identically for any caller and
   does not need to know how the host app resolves language.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import KoleexOrb from "@/components/ai/KoleexGlowOrb";
import { COPY } from "@/components/ai/copy";

/* ── Welcome landing ── */

export default function WelcomeCard({
  copy,
  onPick,
  firstName,
}: {
  copy: typeof COPY["en"];
  onPick: (prompt: string) => void;
  firstName: string;
}) {
  /* Hub-native welcome — same layout vocabulary as FinanceHome.
     Small icon mark in a Hub-themed tile, a tight h2 + caption pair,
     then suggestion tiles in a 2-column grid (matching the
     "What do you want to do?" pattern on /finance). No drop-shadow
     halos, no glass blur, no centered-pill chips. */
  const greeting = firstName ? `${copy.welcomeTitle}, ${firstName}.` : copy.welcomeTitle;
  /* One-shot "jump" greet shortly after the welcome screen mounts, so the
     orb waves hello when you open Koleex AI. greetKey starts at 0 (no fire
     on mount) then flips to 1 → fires the jump reaction once. */
  const [greet, setGreet] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setGreet(1), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-2 py-4 md:py-8">
      <KoleexOrb state="idle" greetKey={greet} size={104} className="mb-4 md:mb-6" />
      <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-[var(--text-primary)] mb-2.5 leading-tight">
        {greeting}
      </h2>
      <p className="text-[12.5px] text-[var(--text-dim)] mb-5 md:mb-9 max-w-md">
        {copy.welcomeSub}
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {copy.prompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(p)}
            /* Aurora: suggestion chips are mini app-tiles over the ground —
               tile glass (owner: "this also can have the glass effect").
               Solid var() bg stays for Core; hover keeps speaking in the
               border (the glass fill owns the background under Aurora). */
            className="kx-glass group flex min-h-[64px] items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-3 text-start text-[12.5px] text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            <span className="flex-1 leading-snug">{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
