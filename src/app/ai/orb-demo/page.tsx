"use client";

/* Dev harness for KoleexOrb — exercises every Rive state/trigger by hand.
   Not linked in nav; reachable at /ai/orb-demo for verification only. */

import { useState } from "react";
import KoleexOrb, { type OrbState } from "@/components/ai/KoleexOrb";

const STATES: OrbState[] = ["idle", "loading", "typing", "success", "error"];

export default function OrbDemoPage() {
  const [state, setState] = useState<OrbState>("idle");
  const [greetKey, setGreetKey] = useState(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <KoleexOrb state={state} greetKey={greetKey} size={220} />
      <div className="text-sm text-[var(--text-muted)]">
        state: <span className="text-[var(--text-primary)] font-medium">{state}</span>
      </div>
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`px-4 py-2 rounded-lg border text-sm ${
              state === s
                ? "bg-[var(--text-primary)] text-[var(--text-inverted)] border-transparent"
                : "border-[var(--border-color)] text-[var(--text-muted)]"
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={() => setGreetKey((k) => k + 1)}
          className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-muted)]"
        >
          greet (jump)
        </button>
      </div>
    </div>
  );
}
