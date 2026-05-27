/* ---------------------------------------------------------------------------
   data.ts — single-source data for the Product Coding System knowledge
   document. Everything the page renders comes from here. Future
   subcategories (XSC, XSD, …) plug in by adding a row.
   --------------------------------------------------------------------------- */

export interface ConfigRow {
  code: string;
  meaning: string;
}

export interface ConfigTable {
  segmentNumber: number;
  title: string;
  /** Bilingual subtitle shown in the table header — mirrors the printed
   *  reference cards' Chinese / English bilingual layout. */
  sub?: string;
  rows: ConfigRow[];
}

export interface SegmentDef {
  /** 1-based axis index displayed inside the number bubble. */
  index: number;
  /** Default example value (renders inside the box). */
  value: string;
  /** True for axes that may legitimately be omitted in a real SKU. */
  empty?: boolean;
  /** Insert a visual dash BEFORE this segment (the printed cards use
   *  dashes to group three logical clusters together). */
  sep?: "before";
  header: string;
  /** Chinese label paired with the English header. */
  sub?: string;
}

export interface CodingBreakdownDef {
  /** URL-safe id used by anchors and tests. */
  id: string;
  title: string;
  subtitle: string;
  /** Top-right monospace example, e.g. "XSL-Q10-5-E-560-M". */
  example: string;
  prefix: string;
  segments: SegmentDef[];
  tables: ConfigTable[];
}

/* ── Main category taxonomy ────────────────────────────────────────────── */

export const MAIN_CATEGORIES: Array<{ code: string; label: string }> = [
  { code: "XPR", label: "Fabric Preparation" },
  { code: "XC", label: "Cutting Equipment" },
  { code: "XS", label: "Industrial Sewing Machines" },
  { code: "XA", label: "Automatic Sewing Systems" },
  { code: "XSE", label: "Leather & Footwear" },
  { code: "XE", label: "Embroidery" },
  { code: "XP", label: "Printing & Heat Press" },
  { code: "XF", label: "Finishing Equipment" },
  { code: "XPC", label: "Packing & Inspection" },
  { code: "XD", label: "Domestic Sewing" },
  { code: "XSP", label: "Spare Parts & Accessories" },
];

/* ── XS family (industrial sewing subcategories) ───────────────────────── */

export const SEWING_CATEGORIES: Array<{ code: string; label: string }> = [
  { code: "XSL", label: "Lockstitch" },
  { code: "XSO", label: "Overlock" },
  { code: "XSI", label: "Interlock" },
  { code: "XSC", label: "Chainstitch" },
  { code: "XSD", label: "Double-needle" },
  { code: "XSM", label: "Multi-needle" },
  { code: "XPA", label: "Pattern sewing" },
  { code: "XSH", label: "Heavy duty" },
  { code: "XSS", label: "Special machines" },
];

/* ── Lockstitch coding breakdown ───────────────────────────────────────── */

export const LOCKSTITCH: CodingBreakdownDef = {
  id: "lockstitch",
  title: "Lockstitch · XSL",
  subtitle:
    "Eight configuration axes. Empty boxes mean the segment is optional and may be omitted from a real SKU.",
  example: "XSL-Q10-5-E-560-M",
  prefix: "XSL",
  segments: [
    { index: 1, value: "Q10", header: "Model code", sub: "型号代码" },
    { index: 2, value: "5", header: "Function", sub: "功能" },
    { index: 3, value: "", empty: true, header: "Seam table", sub: "缝台类型" },
    { index: 4, value: "E", header: "Motor", sub: "电机类型" },
    {
      index: 5,
      value: "560",
      header: "Length",
      sub: "操作空间长度",
      sep: "before",
    },
    {
      index: 6,
      value: "M",
      header: "Fabrics",
      sub: "适用布料",
      sep: "before",
    },
    { index: 7, value: "", empty: true, header: "Hook", sub: "旋梭类型" },
    { index: 8, value: "", empty: true, header: "Special", sub: "特殊配置" },
  ],
  tables: [
    {
      segmentNumber: 1,
      title: "Model code",
      sub: "型号代码",
      rows: [
        { code: "QXX", meaning: "New model single needle lockstitch" },
        { code: "AXX", meaning: "Variant series A" },
        { code: "BXX", meaning: "Variant series B" },
      ],
    },
    {
      segmentNumber: 2,
      title: "Function",
      sub: "功能",
      rows: [
        { code: "0", meaning: "Direct-drive" },
        { code: "1", meaning: "Only trimmer" },
        { code: "3", meaning: "3 automatic functions" },
        { code: "4", meaning: "4 automatic functions" },
        { code: "5", meaning: "Single stepper" },
        { code: "6", meaning: "Double stepper" },
        { code: "7", meaning: "Triple stepper" },
      ],
    },
    {
      segmentNumber: 3,
      title: "Seam table type",
      sub: "缝台类型",
      rows: [
        { code: "/", meaning: "Flat-bed" },
        { code: "1", meaning: "Cylinder-bed" },
      ],
    },
    {
      segmentNumber: 4,
      title: "Motor type",
      sub: "电机类型",
      rows: [
        { code: "/", meaning: "Simple motor" },
        { code: "E", meaning: "Servo motor" },
      ],
    },
    {
      segmentNumber: 5,
      title: "Operation length",
      sub: "操作空间长度",
      rows: [
        { code: "/", meaning: "270 mm" },
        { code: "360", meaning: "360 mm" },
        { code: "560", meaning: "560 mm" },
      ],
    },
    {
      segmentNumber: 6,
      title: "Applicable fabrics",
      sub: "适用布料",
      rows: [
        { code: "S", meaning: "Thin material" },
        { code: "M", meaning: "Medium material" },
        { code: "H", meaning: "Heavy material" },
      ],
    },
    {
      segmentNumber: 7,
      title: "Hook type",
      sub: "旋梭类型",
      rows: [
        { code: "/", meaning: "Domestic hook" },
        { code: "HJ", meaning: "DLC hook" },
        { code: "R", meaning: "Japanese hook" },
        { code: "G", meaning: "Huge hook" },
      ],
    },
    {
      segmentNumber: 8,
      title: "Special functions",
      sub: "特殊配置",
      rows: [
        { code: "Cd", meaning: "Differential" },
        { code: "Zs", meaning: "Needle feeding" },
        { code: "P", meaning: "Puller" },
        { code: "Lt", meaning: "Folder" },
        { code: "Sd", meaning: "Double-knife" },
        { code: "Mf", meaning: "Sealed oil pan" },
      ],
    },
  ],
};

/* ── Overlock ──────────────────────────────────────────────────────────── */

export const OVERLOCK: CodingBreakdownDef = {
  id: "overlock",
  title: "Overlock · XSO",
  subtitle:
    "Six configuration axes. Thread count and pneumatic features are the high-signal axes for buyers.",
  example: "XSO-981-1-E-S-4-Q",
  prefix: "XSO",
  segments: [
    { index: 1, value: "981", header: "Model code", sub: "型号代码" },
    { index: 2, value: "1", header: "Seam table", sub: "缝台类型" },
    { index: 3, value: "E", header: "Motor", sub: "电机类型" },
    {
      index: 4,
      value: "S",
      header: "Function",
      sub: "功能",
      sep: "before",
    },
    {
      index: 5,
      value: "4",
      header: "Threads",
      sub: "线数",
      sep: "before",
    },
    { index: 6, value: "Q", header: "Special", sub: "特殊配置" },
  ],
  tables: [
    {
      segmentNumber: 1,
      title: "Model code",
      sub: "型号代码",
      rows: [
        { code: "98X", meaning: "Direct-drive" },
        { code: "85X", meaning: "Mix type / M700" },
        { code: "7XX", meaning: "747F type" },
      ],
    },
    {
      segmentNumber: 2,
      title: "Seam table type",
      sub: "缝台类型",
      rows: [
        { code: "/", meaning: "Flat-bed" },
        { code: "1", meaning: "Cylinder-bed" },
      ],
    },
    {
      segmentNumber: 3,
      title: "Motor type",
      sub: "电机类型",
      rows: [
        { code: "/", meaning: "Simple motor" },
        { code: "E", meaning: "Servo motor" },
      ],
    },
    {
      segmentNumber: 4,
      title: "Function",
      sub: "功能",
      rows: [
        { code: "D", meaning: "Direct-drive" },
        { code: "A", meaning: "Normal automatic" },
        { code: "S", meaning: "Stepping automatic" },
        { code: "T", meaning: "Top and bottom feed" },
      ],
    },
    {
      segmentNumber: 5,
      title: "Thread quantity",
      sub: "线数",
      rows: [
        { code: "2", meaning: "2-thread" },
        { code: "3", meaning: "3-thread" },
        { code: "4", meaning: "4-thread" },
        { code: "5", meaning: "5-thread" },
        { code: "6", meaning: "6-thread" },
      ],
    },
    {
      segmentNumber: 6,
      title: "Special functions",
      sub: "特殊配置",
      rows: [
        { code: "Q", meaning: "Pneumatic type" },
        { code: "Bk", meaning: "Reverse seaming" },
        { code: "Dz", meaning: "Pleating" },
        { code: "Lt", meaning: "Folder" },
        { code: "Hb", meaning: "Lacework" },
        { code: "Cx", meaning: "Side suction trimmer" },
        { code: "Kd", meaning: "Pocket / double-chain cloth bound" },
        { code: "Mk", meaning: "Narrow bound" },
      ],
    },
  ],
};

/* ── Interlock ─────────────────────────────────────────────────────────── */

export const INTERLOCK: CodingBreakdownDef = {
  id: "interlock",
  title: "Interlock · XSI",
  subtitle:
    "Five configuration axes. The stitch-type catalog is the widest of any subcategory in the system.",
  example: "XSI-150-D-01-V",
  prefix: "XSI",
  segments: [
    { index: 1, value: "150", header: "Model code", sub: "型号代码" },
    { index: 2, value: "D", header: "Function", sub: "功能" },
    {
      index: 3,
      value: "01",
      header: "Stitch type",
      sub: "线迹类型",
      sep: "before",
    },
    { index: 4, value: "V", header: "Special", sub: "特殊配置" },
    {
      index: 5,
      value: "",
      empty: true,
      header: "Needle position",
      sub: "针位组",
      sep: "before",
    },
  ],
  tables: [
    {
      segmentNumber: 1,
      title: "Model code",
      sub: "型号代码",
      rows: [
        { code: "X50 / W500", meaning: "Flat-bed" },
        { code: "X60 / W600", meaning: "Cylinder-bed" },
      ],
    },
    {
      segmentNumber: 2,
      title: "Function",
      sub: "功能",
      rows: [
        { code: "D", meaning: "Direct-drive" },
        { code: "A", meaning: "Normal automatic" },
        { code: "S", meaning: "Stepping automatic" },
      ],
    },
    {
      segmentNumber: 3,
      title: "Stitch type",
      sub: "线迹类型",
      rows: [
        { code: "01", meaning: "Basic type" },
        { code: "02", meaning: "Sewing rolled-edge type" },
        { code: "03", meaning: "Cover seam type" },
        { code: "04", meaning: "4-needle 6-thread type" },
        { code: "05", meaning: "Elastic lace cord type" },
        { code: "06", meaning: "Double chain-stitch in 2-looper" },
        { code: "07", meaning: "Trouser seam type" },
        { code: "08", meaning: "Bottom folding seam type" },
        { code: "31", meaning: "All-in-one (01 + 02 + 03)" },
      ],
    },
    {
      segmentNumber: 4,
      title: "Special functions",
      sub: "特殊配置",
      rows: [
        { code: "V", meaning: "Upper trimmer" },
        { code: "W", meaning: "Wiper" },
        { code: "Q", meaning: "Pneumatic type" },
        { code: "35Zd", meaning: "Left cutter" },
        { code: "33Ac", meaning: "Right cutter" },
        { code: "P", meaning: "Puller" },
        { code: "Lt", meaning: "Folder" },
        { code: "Hb", meaning: "Lacework" },
        { code: "Tk", meaning: "Rolled-edge trimmer" },
      ],
    },
    {
      segmentNumber: 5,
      title: "Needle position",
      sub: "针位组",
      rows: [
        { code: "—", meaning: "Defined per model line; see spec sheet." },
      ],
    },
  ],
};

/* ── System status badges (rendered top of page) ───────────────────────── */

export const SYSTEM_STATUS: Array<{ label: string; value: string }> = [
  { label: "System", value: "Live" },
  { label: "Coverage", value: "9 sewing subcategories" },
  { label: "ERP", value: "Connected" },
  { label: "AI", value: "Parseable" },
  { label: "BOM engine", value: "Ready" },
  { label: "Quotation", value: "Auto-priced" },
];

/* ── ERP pipeline (vertical flow) ──────────────────────────────────────── */

export const PIPELINE: Array<{ label: string; detail: string; segment?: string }> = [
  {
    label: "Commercial identity",
    detail:
      "The short code on the label, the brochure, and the quotation header.",
  },
  {
    label: "Technical identity",
    detail:
      "The long code parsed segment-by-segment into a feature vector.",
  },
  {
    label: "ERP intelligence",
    detail:
      "Inventory, pricing, BOM, and packaging derive directly from the segments.",
  },
  {
    label: "AI understanding",
    detail:
      "The assistant reasons over the vector for recommendations and Q&A.",
  },
  {
    label: "Spare-parts matching",
    detail:
      "Hook type + needle system + bed type resolve to the correct parts BOM.",
  },
  {
    label: "Technical compatibility",
    detail:
      "Side-by-side comparison and quotation upsells use the same axes.",
  },
];

/* ── AI capability cards ───────────────────────────────────────────────── */

export const AI_CAPABILITIES: Array<{
  glyph: string;
  title: string;
  detail: string;
}> = [
  {
    glyph: "→",
    title: "Recommendation",
    detail: "Match fabric weight + production level + automation tier to a SKU.",
  },
  {
    glyph: "⌘",
    title: "Spare-parts matching",
    detail: "Resolve a service request to the exact parts BOM via hook + bed.",
  },
  {
    glyph: "≡",
    title: "Technical filtering",
    detail: "Catalog filter by any axis: motor type, thread count, hook, etc.",
  },
  {
    glyph: "↔",
    title: "Product comparison",
    detail: "Side-by-side diff because every product speaks the same grammar.",
  },
  {
    glyph: "$",
    title: "Smart quotation",
    detail: "Special-function codes drive automatic line-item surcharges.",
  },
  {
    glyph: "✓",
    title: "Machine compatibility",
    detail: "Same bed + same hook ⇒ shared accessories without manual lookup.",
  },
];

/* ── Ecosystem map nodes ───────────────────────────────────────────────── */

export const DIVISIONS: Array<{
  id: string;
  prefix: string;
  name: string;
  description: string;
  status: "live" | "planned";
}> = [
  {
    id: "garment",
    prefix: "X•",
    name: "Garment Machinery",
    description: "11 categories, 9 sewing subcategories, full coding live.",
    status: "live",
  },
  {
    id: "smart-devices",
    prefix: "S•",
    name: "Smart Devices",
    description: "Wearables, sensors, IoT controllers — same identity grammar.",
    status: "planned",
  },
  {
    id: "smart-home",
    prefix: "H•",
    name: "Smart Home",
    description: "Lighting, climate, surveillance product lines.",
    status: "planned",
  },
  {
    id: "automation",
    prefix: "A•",
    name: "Industrial Automation",
    description: "Conveyors, robotic arms, vision systems.",
    status: "planned",
  },
  {
    id: "vehicles",
    prefix: "V•",
    name: "Vehicles",
    description: "EV scooter / e-bike SKUs with battery + motor axes.",
    status: "planned",
  },
  {
    id: "technology",
    prefix: "T•",
    name: "Technology Products",
    description:
      "Compute, displays, peripherals — cross-division compatibility.",
    status: "planned",
  },
];
