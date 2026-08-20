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

/* ── Divisions (top of the KOLEEX universe) ────────────────────────────── */

export interface Division {
  id: string;
  prefix: string;
  name: string;
  description: string;
  status: "live" | "planned";
}

/* ── Category + subcategory model ──────────────────────────────────────── */

export interface Subcategory {
  code: string;
  label: string;
  /** Matches the filename in storage (media/subcategories/<slug>.svg). */
  slug?: string;
}

export interface Category {
  code: string;
  label: string;
  /** One-line description used on tiles + headers. */
  blurb: string;
  /** Matches the filename in storage (media/categories/<slug>.svg).
   *  Same source the Product Data UI reads. */
  slug: string;
  /** All subcategories under this category (in canonical order). */
  subcategories: Subcategory[];
  /** Url-safe id for scroll anchors. */
  anchor: string;
  /** True when this category has a documented technical breakdown in §5. */
  hasBreakdown?: boolean;
}

export const CATEGORIES: Category[] = [
  {
    code: "XPR",
    label: "Fabric Preparation",
    blurb: "Spreading, relaxing, inspecting, and rolling fabric before cutting.",
    slug: "fabric-preparation",
    anchor: "cat-xpr",
    subcategories: [
      { code: "XPRS", label: "Spreading Machines" },
      { code: "XPRR", label: "Fabric Relaxing Machines" },
      { code: "XPRI", label: "Fabric Inspection Machines" },
      { code: "XPRL", label: "Fabric Rolling Machines" },
      { code: "XPRT", label: "Fabric Cutting Tables" },
      { code: "XPRP", label: "Fabric Shrinking Machines" },
      { code: "XFFP", label: "Fusing Machines" },
    ],
  },
  {
    code: "XC",
    label: "Cutting Equipment",
    blurb: "Manual, mechanical, and CNC cutting across knife, laser, and drilling.",
    slug: "cutting-equipment",
    anchor: "cat-xc",
    subcategories: [
      { code: "XCS", label: "Straight Knife Cutting Machines" },
      { code: "XCR", label: "Round Knife Cutting Machines" },
      { code: "XCB", label: "Band Knife Cutting Machines" },
      { code: "XCE", label: "End Cutters" },
      { code: "XCT", label: "Strip Cutting Machines" },
      { code: "XCP", label: "Tape Cutting Machines" },
      { code: "XCC", label: "CNC Cutting Machines" },
      { code: "XCL", label: "Laser Cutting Machines" },
      { code: "XCD", label: "Fabric Drilling Machines" },
    ],
  },
  {
    code: "XS",
    label: "Industrial Sewing Machines",
    blurb:
      "The core of the garment line — lockstitch, overlock, interlock, and specialty stitch.",
    slug: "industrial-sewing-machines",
    anchor: "cat-xs",
    hasBreakdown: true,
    subcategories: [
      { code: "XSL", label: "Lockstitch Machines" },
      { code: "XSO", label: "Overlock Machines" },
      { code: "XSI", label: "Interlock Machines" },
      { code: "XSC", label: "Chainstitch Machines" },
      /* XSD "Double Needle" and XSM "Multi-Needle" were REMOVED by CL-0020 and
         must not come back as shelves. Needle count is an ATTRIBUTE on the
         two-axis model: a lockstitch with needle_count 2 is a lockstitch, not a
         separate class. Filing it as a type is what made one machine appear
         under two shelves (dn-heavy-duty vs hd-dnls). */
      { code: "XSPA", label: "Pattern Sewing Machines" },
      /* Still rows in the taxonomy, but RETIRED as types by CL-0020 — kept only
         because their tokens carry real product codes (XSS 82, XSH 20) and
         KOLEEX codes are never recycled. They are labelled so nobody files a
         new machine under them: duty is the fabric_weight_class attribute, and
         "special" was never a class at all. */
      { code: "XSH", label: "Heavy Duty Machines (retired — use duty attribute)" },
      { code: "XSS", label: "Special Machines (retired — code reservation only)" },
      { code: "XSZ", label: "Zigzag Machines" },
      { code: "XSBL", label: "Blindstitch Machines" },
      /* CL-0024/0025 (2026-08-20) — from the Lingrai/JOOKE catalogue reads.
         XSF executes a CL-0020-era approval (its relabel note said flat
         seamers do not belong under Interlock); XSRG is NOT overlock —
         different bed, purpose and thread system. */
      { code: "XSF", label: "Flatlock (Flat Seamer) Machines" },
      { code: "XSRG", label: "Carpet Overedging Machines" },
      { code: "XSUS", label: "Ultrasonic Sewing Machines" },
      { code: "XSEA", label: "Elastic Attaching Machines" },
    ],
  },
  {
    code: "XA",
    label: "Automatic Sewing Systems",
    blurb:
      "Single-purpose automation for pockets, plackets, collars, hems, and buttons.",
    slug: "automatic-sewing-systems",
    anchor: "cat-xa",
    subcategories: [
      { code: "XAPS", label: "Pocket Setter Machines" },
      { code: "XAPW", label: "Pocket Welting Machines" },
      { code: "XAPP", label: "Placket Sewing Units" },
      { code: "XASS", label: "Side Seam Units" },
      { code: "XACL", label: "Collar Machines" },
      { code: "XASL", label: "Sleeve Setting Machines" },
      { code: "XAHM", label: "Hemming Machines" },
      { code: "XABT", label: "Bartacking Machines" },
      { code: "XABA", label: "Button Attaching Machines" },
      { code: "XABH", label: "Buttonhole Machines" },
      { code: "XAPT", label: "Programmable / CNC Sewing" },
      /* CL-0024/0025/0026 (2026-08-20). XATA is tape ATTACHING (robotic
         multi-needle cells) — distinct from XALB labels and leather XSET.
         XAPK is the standalone pintuck CELL; the VPT pintuck device on a
         multi-needle machine stays a device. XAGD/XAGP close the JOOKE
         decision paper (D1-A, D3-A). */
      { code: "XATM", label: "Template Sewing Machines" },
      { code: "XATA", label: "Tape Attaching Units" },
      { code: "XAPK", label: "Pintuck Sewing Units" },
      { code: "XABL", label: "Belt Loop Attaching Units" },
      { code: "XADT", label: "Dart Sewing Units" },
      { code: "XAGD", label: "Glue Dispensing Machines" },
      { code: "XAGP", label: "Garment Prep Units" },
    ],
  },
  {
    code: "XSE",
    label: "Leather & Footwear Machinery",
    blurb: "Shoe, bag, and leather goods — including edge binding and tape attaching.",
    slug: "leather-footwear-machinery",
    anchor: "cat-xse",
    subcategories: [
      { code: "XSES", label: "Shoe Sewing Machines" },
      { code: "XSEB", label: "Bag Sewing Machines" },
      { code: "XSEL", label: "Leather Sewing Machines" },
      { code: "XSEE", label: "Edge Binding Machines" },
      { code: "XSET", label: "Tape Attaching Machines" },
      { code: "XSEK", label: "Skiving & Edge Trimming Machines" },
      /* CL-0024: fur/skin overseaming sits with the skin-goods family, not
         the garment stitch classes. */
      { code: "XSEF", label: "Fur Sewing Machines" },
    ],
  },
  {
    code: "XE",
    label: "Embroidery Equipment",
    blurb: "Single-head, multi-head, computerized, sequin, and cording machines.",
    slug: "embroidery-equipment",
    anchor: "cat-xe",
    subcategories: [
      { code: "XES", label: "Single Head Embroidery Machines" },
      { code: "XEM", label: "Multi Head Embroidery Machines" },
      { code: "XEC", label: "Computerized Embroidery Machines" },
      { code: "XEQ", label: "Sequin Embroidery Machines" },
      { code: "XEB", label: "Cording / Beading Machines" },
    ],
  },
  /* Three categories added 2026-08-13. They existed in the taxonomy tables but
     had never been mirrored here — the gap the "every new code goes into the
     Knowledge coding system" rule is meant to prevent. XFAS/XPSC came from
     CL-0020 step 3; XAS/XAT predate it. */
  {
    code: "XAST",
    label: "Stands & Tables",
    blurb: "Machine stands and work tables — the frame a head is mounted on, bought separately from it.",
    slug: "stands-tables",
    anchor: "cat-xast",
    subcategories: [
      { code: "XAS", label: "Stands" },
      { code: "XAT", label: "Tables" },
    ],
  },
  {
    code: "XFA",
    label: "Fastening & Press",
    blurb: "Mechanical fastening — snaps, rivets and eyelets set under press, not sewn.",
    slug: "fastening-press",
    anchor: "cat-xfa",
    subcategories: [
      { code: "XFAS", label: "Snap, Rivet & Eyelet Setters" },
      /* CL-0026 (D2-A): hardware onto garment = the XFA process class; the
         intimates workpiece earns its own shelf, not a new category. */
      { code: "XFAB", label: "Bra Hardware Machines" },
    ],
  },
  {
    code: "XPS",
    label: "Production Systems",
    blurb: "Cell-level automation that composes several machines into one production step.",
    slug: "production-systems",
    anchor: "cat-xps",
    subcategories: [
      { code: "XPSC", label: "Robotic Sewing Cells" },
    ],
  },
  {
    code: "XP",
    label: "Printing & Heat Press Equipment",
    blurb: "Heat presses, screen, DTG, sublimation, and pneumatic stations.",
    slug: "printing-heat-press-equipment",
    anchor: "cat-xp",
    subcategories: [
      { code: "XPH", label: "Heat Press Machines" },
      { code: "XPHR", label: "Rotary Heat Press Machines" },
      { code: "XPPH", label: "Pneumatic Heat Press Machines" },
      { code: "XPDH", label: "Double Station Heat Press Machines" },
      { code: "XPSP", label: "Screen Printing Machines" },
      { code: "XPDT", label: "Digital Textile Printers (DTG)" },
      { code: "XPSU", label: "Sublimation Printers" },
    ],
  },
  {
    code: "XF·IR",
    label: "Ironing Systems",
    blurb: "The complete ironing department — irons, boilers & generators, tables, presses and form finishers. XF tokens are grandfathered from Finishing (CL-0018).",
    slug: "ironing-systems",
    anchor: "cat-xfir",
    subcategories: [
      { code: "XFSI", label: "Steam Irons" },
      { code: "XFSB", label: "Steam Boilers" },
      { code: "XFSG", label: "Steam Generators" },
      { code: "XFIT", label: "Ironing Tables" },
      { code: "XFVT", label: "Vacuum Ironing Tables" },
      { code: "XFFF", label: "Form Finishing Machines" },
      { code: "XFCP", label: "Collar & Cuff Press Machines" },
      { code: "XFTT", label: "Trouser Pressing Machines" },
      { code: "XFSP", label: "Spotting Machines" },
    ],
  },
  {
    code: "XF",
    label: "Finishing Equipment",
    blurb: "Post-sewing finishing — fusing presses, thread sucking, garment reversing, washing lines.",
    slug: "finishing-equipment",
    anchor: "cat-xf",
    subcategories: [
      { code: "XFSS", label: "Seam Sealing & Bonding" },
      { code: "XFTS", label: "Thread Sucking Machines" },
      { code: "XFFP", label: "Fusing Press Machines" },
      { code: "XFGR", label: "Garment Reversing Machines" },
      { code: "XFWM", label: "Washing Machines" },
    ],
  },
  {
    code: "XPC",
    label: "Packing & Inspection",
    blurb:
      "Quality and packout — needle/metal/X-ray detectors, folders, sealers.",
    slug: "packing-inspection",
    anchor: "cat-xpc",
    subcategories: [
      { code: "XPCN", label: "Needle Detectors" },
      { code: "XPCM", label: "Metal Detectors" },
      { code: "XPCI", label: "Fabric Inspection Machines (Final)" },
      { code: "XPCX", label: "X-Ray Inspection Machines" },
      { code: "XPCF", label: "Folding Machines" },
      { code: "XPCT", label: "Packing Tables" },
      { code: "XPCC", label: "Carton Sealing Machines" },
      { code: "XPCH", label: "Garment Hanging Systems" },
    ],
  },
  {
    code: "XD",
    label: "Domestic Sewing Machines",
    blurb: "Household lockstitch, overlock, embroidery, and portable units.",
    slug: "domestic-sewing-machines",
    anchor: "cat-xd",
    subcategories: [
      { code: "XDL", label: "Household Lockstitch Machines" },
      { code: "XDO", label: "Household Overlock Machines" },
      { code: "XDE", label: "Household Embroidery Machines" },
      { code: "XDP", label: "Portable Sewing Machines" },
    ],
  },
  {
    code: "XSP",
    label: "Spare Parts & Accessories",
    blurb:
      "Motors, drives, control panels, attachments, and replaceable machine parts.",
    slug: "spare-parts-accessories",
    anchor: "cat-xsp",
    subcategories: [
      { code: "XSPS", label: "Servo Motors" },
      { code: "XSPD", label: "Direct Drive Motors" },
      { code: "XSPC", label: "Control Panels" },
      { code: "XSPT", label: "Touch Screens" },
      { code: "XSPP", label: "Machine Parts" },
      { code: "XSPA", label: "Attachments & Folders" },
    ],
  },
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
    /* Segment 5 (Needle position) has no documented value list yet —
       it still appears in the formula row but no value table is rendered
       until canonical codes are defined. */
  ],
};

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

/* ── KOLEEX divisions ──────────────────────────────────────────────────
   Source of truth: the `divisions` table in Supabase. Order + slug
   match what /products and /product-data render. Each id maps to a
   canonical SVG in src/components/icons/divisions/. */

export const DIVISIONS: Division[] = [
  {
    id: "garment-machinery",
    prefix: "X",
    name: "Garment Machinery",
    description: "Sewing, cutting, finishing, embroidery — full apparel pipeline.",
    status: "live",
  },
  {
    id: "digital-devices",
    prefix: "D",
    name: "Digital Devices",
    description: "Compute, displays, peripherals, IoT controllers.",
    status: "planned",
  },
  {
    id: "smart-living",
    prefix: "S",
    name: "Smart Living",
    description: "Lighting, climate, kitchen, surveillance product lines.",
    status: "planned",
  },
  {
    id: "lifestyle",
    prefix: "L",
    name: "Lifestyle",
    description: "Personal care, wellness, leisure consumer goods.",
    status: "planned",
  },
  {
    id: "mobility",
    prefix: "M",
    name: "Mobility",
    description: "EV scooter, e-bike, drive systems — battery + motor axes.",
    status: "planned",
  },
  {
    id: "industrial-solutions",
    prefix: "I",
    name: "Industrial Solutions",
    description: "Automation, conveyors, robotic arms, vision systems.",
    status: "planned",
  },
  {
    id: "fabrics",
    prefix: "F",
    name: "Fabrics",
    description: "Textiles, non-wovens, technical fabrics, finishing chemistry.",
    status: "planned",
  },
  {
    id: "energy",
    prefix: "E",
    name: "Energy",
    description: "Power systems, storage, solar, industrial energy management.",
    status: "planned",
  },
  {
    id: "medical",
    prefix: "Md",
    name: "Medical",
    description: "Medical devices, diagnostics, healthcare equipment.",
    status: "planned",
  },
];
