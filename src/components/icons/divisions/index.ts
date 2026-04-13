import type { ComponentType } from "react";
import GarmentMachineryIcon from "./GarmentMachineryIcon";
import SmartHomeIcon from "./SmartHomeIcon";
import MobilityIcon from "./MobilityIcon";
import MedicalIcon from "./MedicalIcon";
import LifeStyleIcon from "./LifeStyleIcon";
import IndustrialSolutionsIcon from "./IndustrialSolutionsIcon";
import DigitalDevicesIcon from "./DigitalDevicesIcon";
import EnergyIcon from "./EnergyIcon";
import FabricsIcon from "./FabricsIcon";

export {
  GarmentMachineryIcon,
  SmartHomeIcon,
  MobilityIcon,
  MedicalIcon,
  LifeStyleIcon,
  IndustrialSolutionsIcon,
  DigitalDevicesIcon,
  EnergyIcon,
  FabricsIcon,
};

type IconProps = { size?: number | string; className?: string; style?: React.CSSProperties };

/**
 * Maps division slugs to their custom SVG icon component.
 * Slugs are normalised to lowercase so lookup is case-insensitive.
 */
export const divisionIconMap: Record<string, ComponentType<IconProps>> = {
  "garment-machinery": GarmentMachineryIcon,
  "smart-home": SmartHomeIcon,
  "mobility": MobilityIcon,
  "medical": MedicalIcon,
  "life-style": LifeStyleIcon,
  "lifestyle": LifeStyleIcon,
  "industrial-solutions": IndustrialSolutionsIcon,
  "digital-devices": DigitalDevicesIcon,
  "energy": EnergyIcon,
  "fabrics": FabricsIcon,
};

/**
 * Returns the division icon component for a given slug, or null if none exists.
 */
export function getDivisionIcon(slug: string): ComponentType<IconProps> | null {
  return divisionIconMap[slug.toLowerCase()] ?? null;
}
