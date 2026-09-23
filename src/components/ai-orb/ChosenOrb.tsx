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

import AIOrb from "./AIOrb";
import DottedOrb from "./DottedOrb";
import type { AIOrbProps } from "./ai-orb-types";
import { useOrbStyle, type OrbStyle } from "./orb-style";

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
  if (draw === "dots") return <DottedOrb {...props} surface={surface} />;
  return <AIOrb {...props} />;
}
