"use client";

/* The bell's offer to turn push on for this device (lib/push-nudge says
   when). One line of why, one button; ✕ closes it for good. The card never
   collapses on its own: after "on" it says so until the panel closes, and
   the next open doesn't show it — nothing jumps under the reader's finger. */

import { useState } from "react";
import BellIcon from "@/components/icons/ui/BellIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { closePushNudge, type PushNudge as Nudge } from "@/lib/push-nudge";
import { permissionState, subscribeToPush } from "@/lib/push-client";

type Phase = "idle" | "busy" | "on" | "denied" | "failed";

export default function PushNudge({ nudge, accountId, tUi, onClose }: {
  nudge: Exclude<Nudge, null>;
  accountId: string;
  tUi: (key: string) => string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  async function turnOn() {
    setPhase("busy");
    const r = await subscribeToPush();
    if (r.ok) {
      closePushNudge(accountId, false);
      setPhase("on");
    } else {
      setPhase(permissionState() === "denied" ? "denied" : "failed");
    }
  }

  function dismiss() {
    closePushNudge(accountId, true);
    onClose();
  }

  const line =
    phase === "on" ? tUi("push.on")
    : phase === "denied" ? tUi("push.denied")
    : phase === "failed" ? tUi("push.failed")
    : nudge === "install" ? tUi("push.install")
    : tUi("push.why");

  return (
    <div className="mx-3 mb-2 flex items-start gap-2.5 rounded-xl border border-[#567FB2]/25 bg-[#567FB2]/[0.07] px-3 py-2.5">
      <span aria-hidden className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#567FB2]/15 text-[#567FB2]">
        <BellIcon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-[var(--text-primary)]">{tUi("push.title")}</span>
        <span aria-live="polite" className={`mt-0.5 block text-[11px] leading-snug ${phase === "denied" || phase === "failed" ? "text-red-500" : "text-[var(--text-dim)]"}`}>
          {line}
        </span>
      </span>
      {nudge === "offer" && phase !== "on" && phase !== "denied" && (
        <button
          type="button"
          data-kx-keep-hover
          onClick={() => void turnOn()}
          disabled={phase === "busy"}
          className="mt-0.5 flex h-7 shrink-0 items-center rounded-lg border border-[#567FB2]/40 bg-[#567FB2]/15 px-3 text-[11.5px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[#567FB2]/25 disabled:opacity-60"
        >
          {phase === "busy" ? tUi("push.turningOn") : tUi("push.turnOn")}
        </button>
      )}
      {phase !== "on" && (
        <button
          type="button"
          data-kx-keep-hover
          onClick={dismiss}
          aria-label={tUi("push.dismiss")}
          title={tUi("push.dismiss")}
          className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
        >
          <CrossIcon size={9} />
        </button>
      )}
    </div>
  );
}
