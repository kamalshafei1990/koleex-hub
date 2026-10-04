/* ---------------------------------------------------------------------------
   PackingTypeIcon — one glyph per packing type, drawn in the library's own
   grammar: 24-grid, 2px round-capped stroke, minimal.

   Owner, 2026-09-14, on the Packing type list: "each item should have an
   icon, and if you can't find a suitable icon in our library you can create
   it yourself — but same style, same stroke size, rounded and minimal."
   The library had one box; a packing list needs eight different things to be
   eight different marks:

     wooden_case    closed case, horizontal planks
     plywood_crate  open crate, three slats
     wooden_pallet  two deck boards on three blocks
     pallet_film    a box on a pallet, wrapped
     carton         the cube every courier draws
     foam_carton    a box with the foam cavity inside
     metal_frame    a braced steel frame, open
     bulk_loose     a container with the goods loose in it
   --------------------------------------------------------------------------- */

import type { SVGProps } from "react";

export type PackingTypeKey =
  | "wooden_case" | "plywood_crate" | "wooden_pallet" | "pallet_film"
  | "carton" | "foam_carton" | "metal_frame" | "bulk_loose";

const PATHS: Record<PackingTypeKey, string> = {
  wooden_case:   "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M3 10h18 M3 14h18",
  plywood_crate: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M8 5v14 M12 5v14 M16 5v14",
  wooden_pallet: "M3 9h18 M3 17h18 M5 9v8 M12 9v8 M19 9v8",
  pallet_film:   "M3 19h18 M3 16h18 M6 16v3 M18 16v3 M8 4h8a2 2 0 0 1 2 2v10H6V6a2 2 0 0 1 2-2Z M6 8l12 3 M6 12l12 3",
  carton:        "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z M12 12l8-4.5 M12 12 4 7.5 M12 12v9",
  foam_carton:   "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M8.5 9h7a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 13.5v-3A1.5 1.5 0 0 1 8.5 9Z",
  metal_frame:   "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z M3 9l4-4 M21 9l-4-4 M3 15l4 4 M21 15l-4 4",
  bulk_loose:    "M3 8h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z M8 14h.01 M12 12h.01 M16 14h.01 M10 11h.01 M14 15h.01",
};

export function isPackingTypeKey(v: unknown): v is PackingTypeKey {
  return typeof v === "string" && v in PATHS;
}

export default function PackingTypeIcon({
  type, className = "h-4 w-4", ...rest
}: { type: PackingTypeKey; className?: string } & Omit<SVGProps<SVGSVGElement>, "type">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d={PATHS[type]} />
    </svg>
  );
}
