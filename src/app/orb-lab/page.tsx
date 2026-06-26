"use client";

/* Orb Lab — a dev/diagnostic page to preview every KoleexOrb reaction in
   isolation. Force each state and watch the animation, independent of the
   AI conversation. Useful to confirm which reactions the .riv actually has
   and whether they're visually distinct. */

import { useState } from "react";
import KoleexOrb, { type OrbState } from "@/components/ai/KoleexOrb";

const STATES: { key: OrbState; label: string }[] = [
  { key: "idle", label: "Idle" },
  { key: "loading", label: "Thinking (loading)" },
  { key: "typing", label: "Typing" },
  { key: "success", label: "Success (correct)" },
  { key: "error", label: "Error (wrong)" },
];

export default function OrbLab() {
  const [state, setState] = useState<OrbState>("idle");
  const [greet, setGreet] = useState(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[var(--bg-primary)] text-[var(--text-primary)] p-8">
      <h1 className="text-xl font-bold">Koleex Orb — Reaction Lab</h1>

      <div className="flex items-center justify-center h-[280px]">
        <KoleexOrb state={state} greetKey={greet} size={240} />
      </div>

      <div className="text-sm text-[var(--text-dim)]">
        current state: <span className="text-[var(--text-primary)] font-semibold">{state}</span>
      </div>

      <div className="flex flex-wrap gap-2 justify-center max-w-xl">
        {STATES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setState(s.key)}
            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
              state === s.key
                ? "border-[var(--border-focus)] bg-[var(--bg-surface)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-subtle)]"
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setGreet((g) => g + 1)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 text-sm hover:bg-[var(--bg-surface-subtle)]"
        >
          Fire Jump (greet)
        </button>
      </div>

      <p className="text-xs text-[var(--text-dim)] max-w-md text-center">
        Each button forces the orb into one reaction so you can compare them
        side-by-side. If two look identical, that reaction simply isn&apos;t
        very different in the source .riv file.
      </p>
    </div>
  );
}
