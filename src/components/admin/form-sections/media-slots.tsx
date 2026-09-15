/* ---------------------------------------------------------------------------
   The product's ELEVEN media slots — what each one is called, what it accepts,
   how big a file may be and how many items it wants.

   Its own module because both front-ends read it: the editor's MediaSection
   and the profile's in-place Media sheet. The record only needs the TABLE, and
   importing it from the 831-line editor component pulled that whole component
   into the page of anyone merely looking at a product.
   --------------------------------------------------------------------------- */

import type { ProductMediaType } from "@/types/supabase";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import FilmIcon from "@/components/icons/ui/FilmIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";

export interface MediaTypeDef {
  type: ProductMediaType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  multiple: boolean;
  accept: string;
  /* Upper bound on file size per upload. Keeps product pages fast,
     Supabase Storage costs bounded, and admins from dropping a 1GB
     raw camera file. Enforced client-side in addFiles(). */
  maxSizeMB: number;
  /* Regex used to verify File.type matches the intent of the slot.
     Admins occasionally drag a PDF into the Gallery drop zone and
     HTML's `accept=` only filters the picker, not drag-n-drop. */
  mimeCheck: RegExp;
  /* Soft target for the number of items in this slot. Not enforced —
     just drives the "still need X" caption that nudges admins to
     upload enough media for a strong product page. 0 = no guidance
     (for optional slots like AR/3D or Manual). */
  suggestedCount: number;
}



export const MEDIA_TYPES: MediaTypeDef[] = [
  {
    type: "main_image",
    label: "Main Image",
    description: "Primary product photo used in hero and lists",
    icon: <PictureIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: false,
    accept: "image/*",
    maxSizeMB: 8,
    mimeCheck: /^image\//,
    suggestedCount: 1,
  },
  {
    type: "gallery",
    label: "Gallery",
    description: "Additional product photos, angles and details",
    icon: <LayersIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: "image/*",
    maxSizeMB: 8,
    mimeCheck: /^image\//,
    suggestedCount: 4,
  },
  {
    type: "packing_photo",
    label: "Packing Photos",
    description: "Show crate, box, and packaging dimensions",
    icon: <BoxIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: "image/*",
    maxSizeMB: 8,
    mimeCheck: /^image\//,
    suggestedCount: 2,
  },
  {
    type: "label",
    label: "Labels & Logos",
    description: "Brand labels, origin stickers, certifications",
    icon: <TagsIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: "image/*",
    maxSizeMB: 5,
    mimeCheck: /^image\//,
    suggestedCount: 0,
  },
  {
    type: "manual",
    label: "User Manual",
    description: "PDF user manuals / operation guides",
    icon: <DocumentIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: ".pdf,.doc,.docx",
    maxSizeMB: 25,
    mimeCheck: /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument)/,
    suggestedCount: 1,
  },
  {
    type: "datasheet",
    label: "Datasheet",
    description: "Technical datasheet / spec sheet (PDF)",
    icon: <DocumentIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: ".pdf,.doc,.docx",
    maxSizeMB: 25,
    mimeCheck: /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument)/,
    suggestedCount: 0,
  },
  {
    type: "brochure",
    label: "Brochure / Catalog",
    description: "Marketing brochure or catalog page (PDF)",
    icon: <DocumentIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: ".pdf,.doc,.docx",
    maxSizeMB: 25,
    mimeCheck: /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument)/,
    suggestedCount: 0,
  },
  {
    type: "certificate",
    label: "Certificates",
    description: "CE / RoHS / ISO and other compliance certificates",
    icon: <DocumentIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: ".pdf,.jpg,.jpeg,.png",
    maxSizeMB: 15,
    mimeCheck: /^(application\/pdf|image\/)/,
    suggestedCount: 0,
  },
  {
    type: "parts_list",
    label: "Parts List",
    description: "Spare-parts list / exploded view (PDF)",
    icon: <DocumentIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: ".pdf,.doc,.docx,.xls,.xlsx",
    maxSizeMB: 25,
    mimeCheck: /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument|application\/vnd\.ms-excel)/,
    suggestedCount: 0,
  },
  {
    type: "ar_3d",
    label: "AR / 3D View",
    description: "GLB, GLTF, USDZ files for AR preview",
    icon: <BoxIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: ".glb,.gltf,.usdz",
    maxSizeMB: 50,
    /* 3D model mimetype varies wildly by browser. Fall back to
       filename extension check in addFiles() — see below. */
    mimeCheck: /.*/,
    suggestedCount: 0,
  },
  {
    type: "video",
    label: "Videos",
    description: "Product demo and operation videos",
    icon: <FilmIcon className="h-4 w-4" />,
    accentColor: "from-[var(--bg-surface)] to-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]",
    multiple: true,
    accept: "video/*",
    maxSizeMB: 100,
    mimeCheck: /^video\//,
    suggestedCount: 1,
  },
];
