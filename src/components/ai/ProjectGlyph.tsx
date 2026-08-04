"use client";

/* ---------------------------------------------------------------------------
   The visual half of a Koleex AI project folder: token -> Hub SVG icon, and
   token -> theme-aware colour.

   The vocabulary itself lives in @/lib/ai-projects so the API can validate
   against the same list without importing React. This file only knows how to
   DRAW it, which is why the map is exhaustive over ProjectIcon — adding a
   token to the lib without adding it here is a type error, not a blank square
   discovered in production.

   Icons come from the Hub's own set (src/components/icons/ui) as the house
   rule requires; nothing here hand-authors an SVG path.
   --------------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";
import {
  PROJECT_COLORS,
  normalizeProjectColor,
  normalizeProjectIcon,
  type ProjectColor,
  type ProjectIcon,
} from "@/lib/ai-projects";

import FolderIcon from "@/components/icons/ui/FolderIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import RocketIcon from "@/components/icons/ui/RocketIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import LightbulbIcon from "@/components/icons/ui/LightbulbIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import ShirtIcon from "@/components/icons/ui/ShirtIcon";
import FlaskConicalIcon from "@/components/icons/ui/FlaskConicalIcon";

type GlyphComponent = React.ComponentType<{ size?: number | string; className?: string }>;

const ICON_MAP: Record<ProjectIcon, GlyphComponent> = {
  folder: FolderIcon,
  briefcase: BriefcaseIcon,
  rocket: RocketIcon,
  sparkles: SparklesIcon,
  target: TargetIcon,
  lightbulb: LightbulbIcon,
  chart: BarChart3Icon,
  box: BoxIcon,
  globe: GlobeIcon,
  wrench: WrenchIcon,
  shirt: ShirtIcon,
  flask: FlaskConicalIcon,
};

/* Which half of each colour pair to use. The Hub writes the active theme onto
   the document element, and the sidebar has to stay legible in both — a hue
   tuned for a black panel washes out on a white one.

   The theme is an EXTERNAL store (an attribute on <html> that something else
   owns), so it is subscribed to rather than mirrored into state: no effect
   writes state on mount, and a theme switch repaints the folder colours
   immediately. The server snapshot is the dark default, which matches the
   Hub's own first paint. */
function subscribeToTheme(onChange: () => void): () => void {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
  return () => obs.disconnect();
}

function readIsDark(): boolean {
  const root = document.documentElement;
  const explicit = root.getAttribute("data-theme");
  if (explicit === "light") return false;
  if (explicit === "dark") return true;
  return !root.classList.contains("light");
}

function useThemeIsDark(): boolean {
  return useSyncExternalStore(subscribeToTheme, readIsDark, () => true);
}

export function useProjectColorHex(): (color: unknown) => string {
  const dark = useThemeIsDark();
  return (color: unknown) => {
    const key = normalizeProjectColor(color) as ProjectColor;
    return dark ? PROJECT_COLORS[key].dark : PROJECT_COLORS[key].light;
  };
}

export default function ProjectGlyph({
  icon,
  color,
  size = 14,
  className,
}: {
  icon: unknown;
  color: unknown;
  size?: number;
  className?: string;
}) {
  const hex = useProjectColorHex();
  const Glyph = ICON_MAP[normalizeProjectIcon(icon)];
  return (
    <span
      className={className}
      style={{ color: hex(color), display: "inline-flex", lineHeight: 0 }}
      aria-hidden="true"
    >
      <Glyph size={size} />
    </span>
  );
}
