"use client";

/* ---------------------------------------------------------------------------
   ChosenOrb — the Koleex AI orb, drawn the way this user chose.

   THE ONE DOOR. Every surface that shows the assistant's orb renders this,
   never AIOrb or DottedOrb directly (the labs aside): KoleexGlowOrb — which
   Home, the chat, the welcome card, the app header, Discuss and the launcher
   icon all go through — and the call screen. validate:ai-orb pins that, so a
   new surface cannot quietly draw one style while the user chose the other.

   The choice is read from the orb-style store, so changing it in Settings
   changes every orb on the page at once, without a reload.
   --------------------------------------------------------------------------- */

import { lazy, Suspense } from "react";
import AIOrb from "./AIOrb";
import type { AIOrbProps } from "./ai-orb-types";
import { useOrbStyle, type OrbStyle } from "./orb-style";
import type { DottedOrbProps } from "./DottedOrb";

/* THE DOTS ARE LOADED ONLY FOR WHOEVER CHOSE THEM. A static import put
   DottedOrb and its engine (~16 KB) into the chunk every route with an orb
   shares, and validate:budgets failed on 19 routes the day after it shipped
   — paid by every user, most of whom keep the aura. Loaded on demand, the
   aura user downloads nothing new; the dots user downloads it once (then it
   is cached), and until it arrives sees an empty box of the orb's own size,
   so nothing around it moves.

   React's own `lazy`, not `next/dynamic`: the latter brought its loader
   runtime into the shell chunk every route shares, and that alone kept six
   routes 1–2 KB over budget after the dots themselves had left. `lazy` is
   part of React, already on every page. It never renders on the server —
   useOrbStyle's server snapshot is the aura — so there is nothing to bail
   out of. */
const DottedOrb = lazy<React.ComponentType<DottedOrbProps>>(() => import("./DottedOrb"));

export interface ChosenOrbProps extends AIOrbProps {
  /** "dark" for surfaces that are dark in both themes (the call screen). The
   *  aura orb draws its own light on any ground and ignores it. */
  surface?: "auto" | "dark";
  /** Draw this style regardless of the user's choice — for the previews in
   *  Settings, which must show each option as itself. */
  style?: OrbStyle;
}

export default function ChosenOrb({ surface, style, ...props }: ChosenOrbProps) {
  const chosen = useOrbStyle();
  const draw = style ?? chosen;
  if (draw === "dots") {
    const size = props.size ?? 72;
    return (
      <span className={`inline-flex shrink-0 ${props.className ?? ""}`} style={{ width: size, height: size }}>
        <Suspense fallback={null}>
          <DottedOrb {...props} className="" surface={surface} />
        </Suspense>
      </span>
    );
  }
  return <AIOrb {...props} />;
}
