"use client";

/* ---------------------------------------------------------------------------
   icon-registry — single source of truth for the icon-by-key lookup used
   across the Product Coding System knowledge document.

   Why a registry: the page MUST NOT hard-code SVGs inline. If the Hub's
   shared icon set ever changes, this is the only file we touch and the
   whole document re-renders with the new visual. The page imports
   `iconFor("category", "XSL")` and gets back the right Hub icon
   component — semantic, not literal.
   --------------------------------------------------------------------------- */

import type { ComponentType, SVGProps } from "react";

/* CANONICAL division icons — same component instances that
   /products and /product-data render. If those ever change, this
   page picks the change up automatically. */
import { getDivisionIcon } from "@/components/icons/divisions";

/* Section + utility icons (small UI helpers, not product taxonomy). */
import CodeIcon from "@/components/icons/ui/CodeIcon";
import FileCode2Icon from "@/components/icons/ui/FileCode2Icon";
import FingerprintIcon from "@/components/icons/ui/FingerprintIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import NetworkIcon from "@/components/icons/ui/NetworkIcon";
import CpuIcon from "@/components/icons/ui/CpuIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import CircleDotIcon from "@/components/icons/ui/CircleDotIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import WorkflowIcon from "@/components/icons/ui/WorkflowIcon";
import Globe2Icon from "@/components/icons/ui/Globe2Icon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/* ── Domain → key → component mapping ──────────────────────────────────── */

const sectionIcons: Record<string, IconComponent> = {
  identity: FingerprintIcon,
  categories: LayoutGridIcon,
  sewing: FactoryIcon,
  breakdown: CodeIcon,
  builder: FileCode2Icon,
  erp: NetworkIcon,
  ai: CpuIcon,
  future: Globe2Icon,
  status: GaugeIcon,
};

const utilityIcons: Record<string, IconComponent> = {
  copy: CopyIcon,
  check: CheckIcon,
  share: Share2Icon,
  book: BookOpenIcon,
  workflow: WorkflowIcon,
  sparkles: SparklesIcon,
  cpu: CpuIcon,
  network: NetworkIcon,
  globe: Globe2Icon,
};

/* ── Public API ─────────────────────────────────────────────────────────
   iconFor(domain, key) returns the IconComponent or null when no
   canonical icon exists (e.g. category / subcategory). The renderer
   should treat null as "show the code as the visual instead." */

const FALLBACK: IconComponent = CircleDotIcon;

export type IconDomain =
  | "section"
  | "category"
  | "sewing"
  | "division"
  | "utility";

export function iconFor(domain: IconDomain, key: string): IconComponent | null {
  switch (domain) {
    case "section":
      return sectionIcons[key] ?? FALLBACK;
    case "division":
      /* Canonical: pulled from src/components/icons/divisions/. */
      return (getDivisionIcon(key) as IconComponent | null) ?? null;
    case "category":
    case "sewing":
      /* Intentionally null — categories and subcategories don't have
         canonical icons in the KOLEEX system. The page promotes the
         CODE itself as the visual anchor instead. */
      return null;
    case "utility":
      return utilityIcons[key] ?? FALLBACK;
  }
}

/* Convenience: render a uniformly-styled small icon by domain+key.
   Returns null when no canonical icon exists, so callers can show a
   fallback (typically the code itself). */
export function HubIcon({
  domain,
  k,
  size = 16,
  className,
}: {
  domain: IconDomain;
  k: string;
  size?: number;
  className?: string;
}) {
  const Comp = iconFor(domain, k);
  if (!Comp) return null;
  return <Comp size={size} className={className} />;
}
