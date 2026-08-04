/* ---------------------------------------------------------------------------
   Koleex AI project folders — the icon and colour vocabulary.

   Both the sidebar and the API import this file, which is the whole point:
   the server validates against exactly the list the picker offers, so a
   project can never carry an icon the client cannot draw or a colour the
   theme does not define.

   Icons and colours are stored as short TOKENS, never as markup, a class
   name or a raw hex value. Anything unrecognised — an old row, a hand-made
   API call, a token removed in a later release — falls back to the default
   folder in slate rather than rendering nothing or injecting a style.

   Data only: no React here, so route handlers can import it freely.
   --------------------------------------------------------------------------- */

export const PROJECT_ICONS = [
  "folder",
  "briefcase",
  "rocket",
  "sparkles",
  "target",
  "lightbulb",
  "chart",
  "box",
  "globe",
  "wrench",
  "shirt",
  "flask",
] as const;

export type ProjectIcon = (typeof PROJECT_ICONS)[number];

/* Colour is identification, not decoration — the one case the brand allows a
   hue: a folder you recognise at a glance in a list of twenty. Hub Blue leads
   the ramp and slate (plain neutral) is the default, so a project that never
   picks a colour still reads monochrome. Each token carries its own light and
   dark value because the sidebar is legible in both themes. */
export const PROJECT_COLORS = {
  slate:  { light: "#6B7280", dark: "#9CA3AF" },
  blue:   { light: "#567FB2", dark: "#8FB6DE" },
  teal:   { light: "#0F766E", dark: "#5EC8BC" },
  green:  { light: "#15803D", dark: "#6BC98B" },
  amber:  { light: "#B45309", dark: "#E0AB45" },
  rose:   { light: "#BE3455", dark: "#EE8AA1" },
  violet: { light: "#6D4AA8", dark: "#B295E4" },
} as const;

export type ProjectColor = keyof typeof PROJECT_COLORS;

export const PROJECT_COLOR_KEYS = Object.keys(PROJECT_COLORS) as ProjectColor[];

export const DEFAULT_PROJECT_ICON: ProjectIcon = "folder";
export const DEFAULT_PROJECT_COLOR: ProjectColor = "slate";

export const PROJECT_NAME_MAX = 60;

export function normalizeProjectIcon(value: unknown): ProjectIcon {
  return PROJECT_ICONS.includes(value as ProjectIcon)
    ? (value as ProjectIcon)
    : DEFAULT_PROJECT_ICON;
}

export function normalizeProjectColor(value: unknown): ProjectColor {
  return PROJECT_COLOR_KEYS.includes(value as ProjectColor)
    ? (value as ProjectColor)
    : DEFAULT_PROJECT_COLOR;
}

/** Trimmed, length-capped, and never empty — the table's name is NOT NULL. */
export function normalizeProjectName(value: unknown, fallback = "New project"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  return raw.slice(0, PROJECT_NAME_MAX);
}

export interface AiProject {
  id: string;
  name: string;
  icon: ProjectIcon;
  color: ProjectColor;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
