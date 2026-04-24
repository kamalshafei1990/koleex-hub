/* ---------------------------------------------------------------------------
   Machine Specs — Shared Types

   The new three-tier spec model:

     Tier 1 — COMMON      (every sewing machine)
     Tier 2 — FAMILY      (lockstitch / overlock / interlock / ... )
     Tier 3 — KIND EXTRAS (walking-foot, long-arm, cylinder-bed, etc.)

   A resolver composes Common + Family + Kind-specific fields for the
   chosen Machine Kind and returns three SpecCard objects which the
   SewingMachineSection form renders as three stacked panels.

   Why three tiers instead of the old single-template model:
     · Templates forced every lockstitch kind to share the exact same
       fields, which is wrong — a Walking-Foot Lockstitch needs
       triple-feed specs a Standard Lockstitch doesn't.
     · Subcategories like Special / Heavy Duty / Pattern Sewing used
       to fall back to the single-needle-lockstitch template. Wrong.
     · Progressive disclosure (tiers) keeps the form approachable —
       essentials visible, advanced fields collapsed.
   --------------------------------------------------------------------------- */

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "boolean"
  | "range";

/** How prominently a field is surfaced in the form. Drives progressive
 *  disclosure so an admin doesn't see 40 inputs at once. */
export type SpecTier = "essential" | "recommended" | "advanced";

/** Which tier of the three-tier model a section came from. Used by
 *  the renderer to label the card ("Universal specs" /
 *  "Lockstitch Basics" / "Walking-Foot Mechanism"). */
export type SpecSource = "common" | "family" | "kind";

export interface FieldOption {
  value: string;
  label: string;
}

export interface SpecField {
  /** Stable key used in the JSON payload sent to Supabase. Namespace
   *  prefixes (ls_, wf_, etc.) prevent collisions between family /
   *  kind fields that happen to share a human-readable label. */
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  unit?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  helpText?: string;
  /** Visual sub-heading inside a card — groups related fields
   *  together (e.g. "Performance", "Automation", "Geometry"). */
  group?: string;
  /** Drives progressive disclosure. Essential + Recommended are
   *  always visible; Advanced starts hidden behind a "Show advanced"
   *  toggle so the form doesn't feel like a wall of inputs. */
  tier: SpecTier;
}

export interface SpecCard {
  /** Card title shown in the admin UI. Set per card by the
   *  Common / Family / Kind modules. */
  title: string;
  /** One-line caption shown under the title — explains what this
   *  card is for so the admin's mental model stays grounded. */
  subtitle?: string;
  /** Which tier of the three-tier model produced this card. */
  source: SpecSource;
  fields: SpecField[];
}

/** Accumulated resolver output. SewingMachineSection renders each
 *  card in order with its own collapsible Advanced zone. */
export interface ResolvedSpecs {
  /** Cards in the order they should render (Common → Family → Kind). */
  cards: SpecCard[];
  /** Flat lookup of every field across all cards, keyed by field.key.
   *  Useful for save-time validation ("which required fields are
   *  empty?") without re-walking the cards. */
  fieldIndex: Record<string, SpecField>;
}
