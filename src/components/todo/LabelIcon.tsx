"use client";

import { createElement, type ComponentType } from "react";
import AwardIcon from "@/components/icons/ui/AwardIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import CalculatorIcon from "@/components/icons/ui/CalculatorIcon";
import ContainerIcon from "@/components/icons/ui/ContainerIcon";
import ContractIcon from "@/components/icons/ui/ContractIcon";
import CpuIcon from "@/components/icons/ui/CpuIcon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import FlaskConicalIcon from "@/components/icons/ui/FlaskConicalIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import GraduationCapIcon from "@/components/icons/ui/GraduationCapIcon";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import HeadphonesIcon from "@/components/icons/ui/HeadphonesIcon";
import KeyboardIcon from "@/components/icons/ui/KeyboardIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import MegaphoneIcon from "@/components/icons/ui/MegaphoneIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import PercentIcon from "@/components/icons/ui/PercentIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import PlaneIcon from "@/components/icons/ui/PlaneIcon";
import ReceiptIcon from "@/components/icons/ui/ReceiptIcon";
import RepeatIcon from "@/components/icons/ui/RepeatIcon";
import RouteIcon from "@/components/icons/ui/RouteIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ShipIcon from "@/components/icons/ui/ShipIcon";
import ShoppingCartIcon from "@/components/icons/ui/ShoppingCartIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import UserCogIcon from "@/components/icons/ui/UserCogIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import WarehouseIcon from "@/components/icons/ui/WarehouseIcon";
import WorkflowIcon from "@/components/icons/ui/WorkflowIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import ZoomInIcon from "@/components/icons/ui/ZoomInIcon";

type Icon = ComponentType<{ size?: number; className?: string }>;

/* ── Label → icon. Labels are free text a tenant can add, so the match is by
   keyword, first hit wins (the more specific words come first: "customer
   service" before "customer", "container loading" before "loading").
   Anything unknown keeps the generic tag. All marks come from the shared
   icons/ui library. ── */
const RULES: [RegExp, Icon][] = [
  [/after.?sales|customer service|support|service/, HeadphonesIcon],
  [/report|analys/, BarChart3Icon],
  [/customs|clearance|compliance/, ShieldCheckIcon],
  [/container/, ContainerIcon],
  [/customer visit|visit|field/, MapPinIcon],
  [/account/, CalculatorIcon],
  [/catalog/, BookOpenIcon],
  [/certific/, AwardIcon],
  [/complain|issue|problem/, TriangleWarningIcon],
  [/contract|agreement/, ContractIcon],
  [/data entry|entry|typing/, KeyboardIcon],
  [/deliver/, TruckIcon],
  [/design/, PaletteIcon],
  [/document|paperwork/, DocumentIcon],
  [/e-?mail|mail/, EnvelopeIcon],
  [/exhibit|fair|expo|event/, GlobeIcon],
  [/financ|budget/, WalletIcon],
  [/follow/, RepeatIcon],
  [/\bhr\b|human|recruit|hiring/, UserCogIcon],
  [/inspect|audit|check/, ZoomInIcon],
  [/install|repair/, WrenchIcon],
  [/invoice|bill/, ReceiptIcon],
  [/\bit\b|tech|software|system/, CpuIcon],
  [/legal|law/, ScaleIcon],
  [/logistic|freight|route/, RouteIcon],
  [/shipping|shipment|\bship\b|vessel/, ShipIcon],
  [/test|lab|sample/, FlaskConicalIcon],
  [/mainten/, Settings2Icon],
  [/manage|admin/, BriefcaseIcon],
  [/market|promo|campaign/, MegaphoneIcon],
  [/meet/, UsersIcon],
  [/negotia|deal|partner/, HandshakeIcon],
  [/operat|process/, WorkflowIcon],
  [/packag|packing/, PackageIcon],
  [/payment|pay/, CreditCardIcon],
  [/phone|call/, PhoneIcon],
  [/price|pricing|discount/, PercentIcon],
  [/procure|purchas|buy/, ShoppingCartIcon],
  [/produc|manufactur/, FactoryIcon],
  [/quality|\bqc\b/, BadgeCheckIcon],
  [/sale/, TrendingUpIcon],
  [/stock|warehouse|inventory/, WarehouseIcon],
  [/train|learn/, GraduationCapIcon],
  [/travel|trip|flight/, PlaneIcon],
  [/chat|message|reply/, MessageSquareIcon],
];

const cache = new Map<string, Icon>();
export function labelIconFor(name: string | null | undefined): Icon {
  const key = (name ?? "").trim().toLowerCase();
  let hit = cache.get(key);
  if (!hit) {
    hit = RULES.find(([re]) => re.test(key))?.[1] ?? TagsIcon;
    cache.set(key, hit);
  }
  return hit;
}

/** The label's own mark, tinted with its colour when it has one. */
export default function LabelIcon({ name, color, size = 13, className = "" }: {
  name: string | null | undefined;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex shrink-0 ${color ? "" : "text-[var(--text-dim)]"} ${className}`} style={color ? { color } : undefined} aria-hidden>
      {createElement(labelIconFor(name), { size })}
    </span>
  );
}
