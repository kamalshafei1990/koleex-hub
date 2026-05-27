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

import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import ScissorsIcon from "@/components/icons/ui/ScissorsIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import WorkflowIcon from "@/components/icons/ui/WorkflowIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import HomeIcon from "@/components/icons/ui/HomeIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import CodeIcon from "@/components/icons/ui/CodeIcon";
import FileCode2Icon from "@/components/icons/ui/FileCode2Icon";
import FingerprintIcon from "@/components/icons/ui/FingerprintIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import NetworkIcon from "@/components/icons/ui/NetworkIcon";
import CpuIcon from "@/components/icons/ui/CpuIcon";
import Globe2Icon from "@/components/icons/ui/Globe2Icon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import SmartphoneIcon from "@/components/icons/ui/SmartphoneIcon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import CircleDotIcon from "@/components/icons/ui/CircleDotIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

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

const mainCategoryIcons: Record<string, IconComponent> = {
  XPR: LayersIcon,
  XC: ScissorsIcon,
  XS: FactoryIcon,
  XA: WorkflowIcon,
  XSE: PackageIcon,
  XE: SparklesIcon,
  XP: PrinterIcon,
  XF: Settings2Icon,
  XPC: PackageIcon,
  XD: HomeIcon,
  XSP: WrenchIcon,
};

const sewingCategoryIcons: Record<string, IconComponent> = {
  XSL: FactoryIcon,
  XSO: Settings2Icon,
  XSI: CogIcon,
  XSC: CircleDotIcon,
  XSD: BoxesIcon,
  XSM: LayersIcon,
  XPA: TargetIcon,
  XSH: Building2Icon,
  XSS: SparklesIcon,
};

const divisionIcons: Record<string, IconComponent> = {
  garment: FactoryIcon,
  "smart-devices": CpuIcon,
  "smart-home": HomeIcon,
  automation: WorkflowIcon,
  vehicles: TruckIcon,
  technology: SmartphoneIcon,
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
   iconFor(domain, key) returns the IconComponent or a safe fallback so
   a missing mapping renders a dot instead of a runtime crash. */

const FALLBACK: IconComponent = CircleDotIcon;

export type IconDomain =
  | "section"
  | "category"
  | "sewing"
  | "division"
  | "utility";

export function iconFor(domain: IconDomain, key: string): IconComponent {
  switch (domain) {
    case "section":
      return sectionIcons[key] ?? FALLBACK;
    case "category":
      return mainCategoryIcons[key] ?? FALLBACK;
    case "sewing":
      return sewingCategoryIcons[key] ?? FALLBACK;
    case "division":
      return divisionIcons[key] ?? FALLBACK;
    case "utility":
      return utilityIcons[key] ?? FALLBACK;
  }
}

/* Convenience: render a uniformly-styled small icon by domain+key. */
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
  return <Comp size={size} className={className} />;
}
