/* ---------------------------------------------------------------------------
   Description Quick-Start Templates
   ---------------------------------------------------------------------------

   When the admin clicks a Quick Start Block on the Description
   step, we don't want the same generic "industrial sewing machine"
   boilerplate for every kind — a Walking-Foot Lockstitch and a
   5-Thread Overlock need very different default copy.

   This module returns family-specific templates keyed on the
   product's subcategory slug. The admin's chosen Machine Kind
   name is interpolated into the Overview paragraph so the draft
   reads as though someone wrote it for that exact kind.

   Admins still edit the result — the goal is an 80%-there first
   draft, not final copy.
   --------------------------------------------------------------------------- */

export interface DescriptionTemplateSet {
  overview: string;
  keyFeatures: string;
  applications: string;
  whatsIncluded: string;
}

/* Map of subcategory slug → template family. Multiple subcategory
   slugs can map to the same family (e.g. every automatic sewing
   system → the `automatic` family). */
const SUBCATEGORY_TO_FAMILY: Record<string, string> = {
  "lockstitch-machines": "lockstitch",
  "overlock-machines": "overlock",
  "interlock-machines": "interlock",
  "chainstitch-machines": "chainstitch",
  "double-needle-machines": "double-needle",
  "multi-needle-machines": "multi-needle",
  "pattern-sewing-machines": "automatic",
  "heavy-duty-machines": "heavy-duty",
  "special-machines": "generic",
  // Automatic Sewing Systems category subcategories
  "bartacking-machines": "bartacking",
  "buttonhole-machines": "buttonhole",
  "button-attaching-machines": "button-attach",
  "collar-machines": "automatic",
  "hemming-machines": "hemming",
  "placket-sewing-units": "automatic",
  "pocket-setter-machines": "automatic",
  "pocket-welting-machines": "automatic",
  "side-seam-units": "automatic",
  "sleeve-setting-machines": "automatic",
};

/* Family-specific content. Each family supplies four fragments —
   the heading+paragraph (Overview) and three bulleted lists
   (KeyFeatures, Applications, WhatsIncluded). `{kind}` is
   replaced with the machine-kind name ("Walking-Foot Lockstitch")
   or a generic phrase ("industrial sewing machine") when no kind
   has been picked yet. */
const FAMILY_TEMPLATES: Record<string, (kind: string) => DescriptionTemplateSet> = {
  lockstitch: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} is engineered for high-volume garment production where stitch consistency, seam strength, and throughput all matter. ` +
      `Built around a direct-drive servo motor and a precision-aligned rotating hook, it delivers balanced lockstitch seams at up to 5,000 SPM across light, medium, and heavy fabrics.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Direct-drive servo motor for silent, responsive operation</li>` +
      `<li>Automatic thread trimmer and wiper for clean seam endings</li>` +
      `<li>Needle-position detection (stop-up / stop-down) for precise pivoting</li>` +
      `<li>Auto backtack and presser-foot lift</li>` +
      `<li>Stitch length up to 5 mm, reverse-stitch lever</li>` +
      `<li>Integrated LED work light + energy-saving design</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<p>Built for a wide range of garment and textile production:</p>` +
      `<ul>` +
      `<li>Shirts, blouses, and dress trousers</li>` +
      `<li>Denim, workwear, and uniforms</li>` +
      `<li>Home textiles (curtains, bedding, upholstery covers)</li>` +
      `<li>Light leather goods and handbags</li>` +
      `<li>Technical textiles and car-interior trim</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Machine head with direct-drive servo motor</li>` +
      `<li>Industrial table with built-in LED worklight</li>` +
      `<li>Control panel + foot pedal</li>` +
      `<li>Standard needle plate, feed dog, and presser foot</li>` +
      `<li>Bobbins, needles, oil bottle, screwdriver kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  overlock: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} is a high-speed overlock machine that trims and wraps the fabric edge in a single pass, delivering a clean, stretch-resistant seam ideal for knits and wovens alike. ` +
      `Designed for continuous factory use with auto lubrication and low-noise direct drive.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>High-speed direct-drive motor — up to 7,000 SPM</li>` +
      `<li>Differential feed for pucker-free seams on stretch fabrics</li>` +
      `<li>Built-in trimming knife with adjustable cutting width</li>` +
      `<li>Automatic lubrication system (fully sealed)</li>` +
      `<li>Adjustable stitch length + overedge width</li>` +
      `<li>Low-noise, low-vibration operation</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>T-shirts, polo shirts, and knitwear</li>` +
      `<li>Athletic and activewear</li>` +
      `<li>Underwear, sleepwear, and lingerie</li>` +
      `<li>Woven garment edges and seam finishing</li>` +
      `<li>Children's wear and home textiles</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Overlock head with automatic oiling</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Motor control box + foot pedal</li>` +
      `<li>Upper and lower knives (installed + one spare set)</li>` +
      `<li>Needles, tweezers, screwdriver, oil</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  interlock: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} delivers flat, stretch-tolerant seams by combining multiple needle threads with a looper pass. ` +
      `The result is a smooth, low-profile join that lies flat against the body — essential for activewear, underwear, and knit garments.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>2- or 3-needle coverstitch with adjustable needle gauge</li>` +
      `<li>Top and bottom coverstitch (flatlock) capability</li>` +
      `<li>Differential feed for stretch and knit fabrics</li>` +
      `<li>Automatic thread trimmer and presser-foot lift</li>` +
      `<li>High-speed operation up to 6,500 SPM</li>` +
      `<li>Tubular cylinder bed for cuffs and neckbands</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>T-shirt and polo-shirt hemming</li>` +
      `<li>Activewear and compression garments</li>` +
      `<li>Underwear, swimwear, and lingerie</li>` +
      `<li>Rib and tape binding on neckbands + armholes</li>` +
      `<li>Decorative flatlock seams on athleisure</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Coverstitch head with direct-drive motor</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Motor control box + foot pedal</li>` +
      `<li>Standard needle plate, presser foot, and feed dogs</li>` +
      `<li>Needles, bobbins, oil, screwdriver kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  chainstitch: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} produces a stretchy, fast-forming chain stitch — ideal for seams that need to flex under load. ` +
      `Higher speeds than lockstitch and no bobbin to reload mean less downtime on production lines.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Single- or double-needle chainstitch configurations</li>` +
      `<li>No bobbin — uninterrupted sewing until the thread cone empties</li>` +
      `<li>Stretch-friendly stitch that won't snap under tension</li>` +
      `<li>High-speed operation (up to 6,000 SPM)</li>` +
      `<li>Automatic thread trimmer and backtack</li>` +
      `<li>Energy-saving direct-drive motor</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Jeans waistbands and side seams</li>` +
      `<li>Workwear, coveralls, and uniforms</li>` +
      `<li>Basting seams on tailored garments</li>` +
      `<li>Smocking, shirring, and decorative topstitching</li>` +
      `<li>Heavy-duty denim and canvas construction</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Chainstitch head with direct-drive motor</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Motor control box + foot pedal</li>` +
      `<li>Standard needle plate, feed dog, and presser foot</li>` +
      `<li>Needles, oil, screwdriver kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  "double-needle": (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} lays two perfectly parallel rows of stitching in a single pass, delivering the twin-needle topstitch seen on jeans, workwear, and heavy upholstery. ` +
      `Split-bar or fixed-bar configurations let operators turn corners cleanly and skip individual needles when required.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Two parallel stitch rows, user-configurable gauge</li>` +
      `<li>Split-needle bar option — individual needles disengage at corners</li>` +
      `<li>Direct-drive servo motor, up to 3,000 SPM</li>` +
      `<li>Auto thread trimmer and backtack</li>` +
      `<li>Heavy-duty rotating hooks for dense fabrics</li>` +
      `<li>Adjustable stitch length and presser-foot pressure</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Denim jeans (waistband, outseam topstitch)</li>` +
      `<li>Workwear, coveralls, and uniforms</li>` +
      `<li>Upholstered furniture and automotive interiors</li>` +
      `<li>Leather goods (bags, wallets, belts)</li>` +
      `<li>Tents, sails, and technical textiles</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Double-needle head with direct-drive motor</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Motor control box + foot pedal</li>` +
      `<li>Needle plate, feed dog, and twin presser foot</li>` +
      `<li>Needles, bobbins, oil, screwdriver kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  "multi-needle": (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} sews multiple parallel rows at once — perfect for high-volume waistband, smocking, and shirring work on jeans, trousers, and foundation garments.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>3 / 4 / 6 / 8 / 12 needle configurations</li>` +
      `<li>Elastic-feeding devices (optional) for waistbands</li>` +
      `<li>Direct-drive motor with electronic speed control</li>` +
      `<li>Automatic thread trimmer and chain cutter</li>` +
      `<li>Chainstitch construction — no bobbin reloading</li>` +
      `<li>Adjustable stitch length across all needles</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Elastic waistbands (trousers, underwear, sportswear)</li>` +
      `<li>Smocking and shirring on dresses + children's wear</li>` +
      `<li>Decorative pin-tuck stitching</li>` +
      `<li>Mattress pads and quilted panels</li>` +
      `<li>Bra bands and foundation-garment construction</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Multi-needle head with direct-drive motor</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Motor control box + foot pedal</li>` +
      `<li>Needle bar, needle plate, and pressure foot set</li>` +
      `<li>Needles, lubricant, tool kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  automatic: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} is a fully programmable automatic sewing unit — a CNC head traces a stored pattern while pneumatic clamps hold the fabric in place. ` +
      `Cycle times are deterministic, quality is consistent, and the operator loads and unloads rather than driving the stitch.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Programmable stitching patterns stored on-unit</li>` +
      `<li>Electronic XY table with precise servo drives</li>` +
      `<li>Pneumatic clamping system for repeatable registration</li>` +
      `<li>Touchscreen HMI for pattern selection and parameter tuning</li>` +
      `<li>Auto thread trim, wiper, and bobbin winder</li>` +
      `<li>Typical cycle time 3–10 s per part depending on pattern</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Pocket setting and welt-pocket construction</li>` +
      `<li>Label and patch attachment</li>` +
      `<li>Belt-loop and pleat sewing</li>` +
      `<li>Collar, cuff, and placket runstitching</li>` +
      `<li>Dart / tuck / decorative pattern work</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Automatic sewing head with XY servo table</li>` +
      `<li>Pneumatic clamp assembly + fixtures</li>` +
      `<li>HMI touchscreen + cycle foot pedal</li>` +
      `<li>Compressor connection kit</li>` +
      `<li>Sample patterns pre-loaded</li>` +
      `<li>Operator, maintenance, and programming manuals</li>` +
      `</ul>`,
  }),

  "heavy-duty": (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} is purpose-built for heavy-layer sewing — leather, upholstery, canvas, webbing, and technical textiles that a standard machine simply cannot handle. ` +
      `Reinforced frame, oversized hooks, and walking-foot feed deliver consistent penetration through the toughest materials.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Triple-feed (compound) walking foot — no layer shift</li>` +
      `<li>Oversized rotating hook for thick thread (up to T270)</li>` +
      `<li>Heavy-gauge needle system (DY x 3 or equivalent)</li>` +
      `<li>High presser-foot lift (up to 20 mm)</li>` +
      `<li>Extended-length stitch (up to 10 mm) for decorative topstitch</li>` +
      `<li>Heavy-duty cast-iron frame, industrial-grade components</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Leather goods (belts, bags, wallets, saddlery)</li>` +
      `<li>Upholstered furniture and automotive interiors</li>` +
      `<li>Sails, tents, and canvas products</li>` +
      `<li>Safety harnesses, webbing, and tactical gear</li>` +
      `<li>Mattress construction and industrial textiles</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Heavy-duty machine head + reinforced frame</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>High-torque motor + foot pedal</li>` +
      `<li>Walking-foot set, needle plate, feed dog</li>` +
      `<li>Heavy-duty needle and thread sample set, oil, tool kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  buttonhole: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} produces clean, reinforced buttonholes in seconds with a single cycle. ` +
      `Programmable patterns cover everything from a straight shirt buttonhole to eyelet / keyhole styles for jeans and tailored jackets.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Straight, eyelet, and keyhole buttonhole patterns</li>` +
      `<li>Adjustable buttonhole length and width</li>` +
      `<li>Gimp-thread reinforcement (programmable)</li>` +
      `<li>Automatic fabric clamp with pneumatic release</li>` +
      `<li>Cycle time ~1.5 s per buttonhole</li>` +
      `<li>Integrated trimming knife — no manual slitting</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Shirts, blouses, and dresses (straight buttonhole)</li>` +
      `<li>Jeans, trousers, and coats (eyelet / keyhole)</li>` +
      `<li>Tailored suits and jackets</li>` +
      `<li>Children's wear and uniforms</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Buttonhole machine with pneumatic clamp</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Control box + foot pedal</li>` +
      `<li>Standard needle plate, clamp foot, cutting knife</li>` +
      `<li>Needles, thread samples, tool kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  "button-attach": (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} sews buttons onto garments in a single cycle — flat 2-hole and 4-hole buttons, shank buttons, and snap fasteners depending on configuration. ` +
      `Programmable stitch patterns deliver consistent, secure attachment at high cycle rates.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>2-hole, 4-hole, and shank button support</li>` +
      `<li>Programmable stitch count (6 / 8 / 12 / 16)</li>` +
      `<li>Automatic button clamp with adjustable feed</li>` +
      `<li>Cycle time ~1.5 s per button</li>` +
      `<li>Automatic thread trimmer</li>` +
      `<li>Optional snap-fastener attachment kit</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Shirts, blouses, and polos</li>` +
      `<li>Jeans, trousers, and workwear</li>` +
      `<li>Coats, jackets, and tailored garments</li>` +
      `<li>Children&apos;s wear and uniforms</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Button-attaching machine with clamp</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Control box + foot pedal</li>` +
      `<li>Standard clamp plates and needle set</li>` +
      `<li>Needles, sample thread, tool kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  bartacking: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} lays down dense reinforcement stitching at seam stress points in one automatic cycle — belt loops, pocket corners, fly fronts, and zipper ends. ` +
      `Programmable patterns let operators switch between tack sizes and shapes without tooling changes.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Programmable stitch patterns stored on-unit</li>` +
      `<li>Bartack, box, and custom pattern support</li>` +
      `<li>High-torque servo drive for dense stitching</li>` +
      `<li>Automatic thread trimmer + wiper</li>` +
      `<li>Pneumatic foot clamp</li>` +
      `<li>Cycle time ~1 s per tack</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>Belt loops, pocket corners, fly ends</li>` +
      `<li>Zipper ends and plackets</li>` +
      `<li>Denim jeans, workwear, and uniforms</li>` +
      `<li>Bags, luggage, and military gear</li>` +
      `<li>Footwear and leather goods</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Bartacking machine with clamp assembly</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Control box + foot pedal</li>` +
      `<li>Standard needle plate, clamp foot, feed dogs</li>` +
      `<li>Needles, sample thread, tool kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  hemming: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} delivers clean, durable hems on garments at high production speeds. ` +
      `Folder attachments guide the fabric for consistent hem width while the direct-drive head keeps stitch quality even across thousands of pieces per shift.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>Direct-drive servo motor</li>` +
      `<li>Adjustable hem folder attachments</li>` +
      `<li>Automatic thread trimmer and backtack</li>` +
      `<li>Differential feed for stretch and knit fabrics</li>` +
      `<li>Cylinder-bed option for tubular hems</li>` +
      `<li>Quick-change folder guides</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<ul>` +
      `<li>T-shirt and polo-shirt bottom hems</li>` +
      `<li>Trouser and skirt hems</li>` +
      `<li>Sleeve cuffs and cuff bands</li>` +
      `<li>Home textiles (napkins, tablecloths, curtains)</li>` +
      `<li>Towels and kitchen linens</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Hemming machine head + folder attachment</li>` +
      `<li>Industrial table + LED worklight</li>` +
      `<li>Control box + foot pedal</li>` +
      `<li>Standard needle plate and presser foot set</li>` +
      `<li>Needles, sample thread, tool kit</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),

  /* Fallback family — deliberately generic but still sewing-industry-
     flavoured so non-sewing subcategories get something reasonable. */
  generic: (kind) => ({
    overview:
      `<h2>Overview</h2>` +
      `<p>The ${kind} is engineered for professional garment production, combining high-speed performance with operator-friendly controls. ` +
      `Built for continuous factory use, it delivers consistent stitch quality while keeping downtime and maintenance low.</p>`,
    keyFeatures:
      `<h3>Key Features</h3>` +
      `<ul>` +
      `<li>High-speed direct-drive servo motor</li>` +
      `<li>Automatic thread trimmer for clean seam endings</li>` +
      `<li>Needle-position detection (stop-up / stop-down)</li>` +
      `<li>Auto backtack and auto presser-foot lift</li>` +
      `<li>Energy-saving design with low-noise operation</li>` +
      `<li>LED workspace lighting for improved operator accuracy</li>` +
      `</ul>`,
    applications:
      `<h3>Applications</h3>` +
      `<p>Suitable for a wide range of garment and textile production:</p>` +
      `<ul>` +
      `<li>Ready-to-wear garment manufacturing</li>` +
      `<li>Denim, workwear, and uniforms</li>` +
      `<li>Home textiles and upholstery</li>` +
      `<li>Technical textiles and automotive interiors</li>` +
      `<li>Leather goods and footwear assembly</li>` +
      `</ul>`,
    whatsIncluded:
      `<h3>What's Included</h3>` +
      `<ul>` +
      `<li>Machine head with direct-drive servo motor</li>` +
      `<li>Industrial table with built-in LED worklight</li>` +
      `<li>Motor control box with foot pedal</li>` +
      `<li>Standard needle plate, feed dog, and presser foot</li>` +
      `<li>Basic accessories kit (bobbins, oil, needles, screwdriver)</li>` +
      `<li>Operator and maintenance manuals</li>` +
      `</ul>`,
  }),
};

/** Resolve the template set for a given subcategory slug + chosen
 *  machine-kind display name. Falls back to the generic family when
 *  the subcategory has no specific template, and to "industrial
 *  sewing machine" when no kind has been picked yet. */
export function getDescriptionTemplates(
  subcategorySlug: string | null | undefined,
  kindName: string | null | undefined,
): DescriptionTemplateSet {
  const family = subcategorySlug ? SUBCATEGORY_TO_FAMILY[subcategorySlug] || "generic" : "generic";
  const kind = kindName && kindName.trim() ? kindName.trim() : "industrial sewing machine";
  const fn = FAMILY_TEMPLATES[family] || FAMILY_TEMPLATES.generic;
  return fn(kind);
}
