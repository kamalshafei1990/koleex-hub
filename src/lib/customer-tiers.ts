/* ═══════════════════════════════════════════════════════════════════════
   CUSTOMER TIER COLORS — single source of truth (system-wide)

   Every place that shows a customer's tier / level (Contacts directory +
   detail, Finance order party badges, dashboards, commercial-policy, etc.)
   should read its colors from here so the whole system stays in sync.

   The look: each precious-material tier (Diamond / Platinum / Gold / Silver)
   is a shiny multi-stop gradient tuned to the real material and clipped to
   the text (pair with the `.kx-tier-metal` utility in globals.css for the
   animated sheen). End User is a flat emerald (not a precious material).

   Gradients are intentionally on distinct hues so the four metals read
   apart at a glance: Diamond = icy blue/cyan, Platinum = warm champagne,
   Gold = gold, Silver = cool steel-gray.
   ═══════════════════════════════════════════════════════════════════════ */

import type { CSSProperties } from "react";

export type CanonicalTier = "end_user" | "silver" | "gold" | "platinum" | "diamond";

export interface TierColorMeta {
  value: CanonicalTier;
  label: string;
  /** CSS linear-gradient tuned to the real material. */
  gradient: string;
  /** A single representative hex — for dots, borders, bar fills, or any
   *  context that can't render a gradient. */
  solid: string;
  /** Low-alpha background tint for badge/pill chips. */
  tintBg: string;
  /** Metals (Diamond/Platinum/Gold/Silver) render as shiny gradient text.
   *  End User is a flat solid. */
  isMetal: boolean;
}

export const TIER_COLOR_META: Record<CanonicalTier, TierColorMeta> = {
  diamond: {
    value: "diamond",
    label: "Diamond",
    gradient:
      "linear-gradient(100deg, #22b8e6 0%, #9becff 18%, #ffffff 34%, #b39dff 52%, #38d6f5 70%, #d6f6ff 86%, #22b8e6 100%)",
    solid: "#38d6f5",
    tintBg: "rgba(56, 214, 245, 0.14)",
    isMetal: true,
  },
  platinum: {
    value: "platinum",
    label: "Platinum",
    gradient:
      "linear-gradient(100deg, #cdc7b4 0%, #fdfbf3 24%, #ece6d5 44%, #c7c0aa 62%, #fffdf6 82%, #ddd6c3 100%)",
    solid: "#d8cfb4",
    tintBg: "rgba(216, 207, 180, 0.16)",
    isMetal: true,
  },
  gold: {
    value: "gold",
    label: "Gold",
    gradient:
      "linear-gradient(100deg, #b8860b 0%, #f7c948 22%, #fff3b0 42%, #e6a817 60%, #fff6c2 80%, #d4930a 100%)",
    solid: "#e6a817",
    tintBg: "rgba(230, 168, 23, 0.15)",
    isMetal: true,
  },
  silver: {
    value: "silver",
    label: "Silver",
    gradient:
      "linear-gradient(100deg, #6b7480 0%, #cdd3da 24%, #9aa2ab 44%, #626a75 62%, #dde2e8 82%, #98a0a9 100%)",
    solid: "#aab2bb",
    tintBg: "rgba(170, 178, 187, 0.16)",
    isMetal: true,
  },
  end_user: {
    value: "end_user",
    label: "End User",
    /* Flat emerald — kept as a gradient string too so the bar fill can use
       one code path, but visually it's a single green. */
    gradient: "linear-gradient(100deg, #10b981 0%, #34d399 100%)",
    solid: "#34c759",
    tintBg: "rgba(52, 199, 89, 0.14)",
    isMetal: false,
  },
};

export const TIER_ORDER: CanonicalTier[] = [
  "diamond",
  "platinum",
  "gold",
  "silver",
  "end_user",
];

/** Collapse every tier synonym the system uses into the canonical enum.
 *  Accepts: contacts.customer_type, companies.customer_level,
 *  price_list_tier ("End User"/"Diamond"/…), and the pricing-engine alias
 *  "retail" (== end_user). Returns null for unknown / "custom". */
export function normalizeTier(
  value: string | null | undefined,
): CanonicalTier | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  switch (v) {
    case "diamond":
      return "diamond";
    case "platinum":
      return "platinum";
    case "gold":
      return "gold";
    case "silver":
      return "silver";
    case "end_user":
    case "enduser":
    case "retail":
    case "end_customer":
      return "end_user";
    default:
      return null;
  }
}

/** Resolve tier color metadata from any synonym. Null when unknown. */
export function getTierColor(
  value: string | null | undefined,
): TierColorMeta | null {
  const canon = normalizeTier(value);
  return canon ? TIER_COLOR_META[canon] : null;
}

/** Inline style that paints text with the tier's material gradient (clip to
 *  text). Add the `kx-tier-metal` className alongside for the animated
 *  sheen. Works for End User too (flat green). */
export function tierTextStyle(meta: TierColorMeta): CSSProperties {
  return {
    backgroundImage: meta.gradient,
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
    // Consumed by the .kx-tier-metal sheen animation.
    ["--kx-tier-grad" as string]: meta.gradient,
  } as CSSProperties;
}
