/* ---------------------------------------------------------------------------
   seed-general-icons.mjs — Phase 2A: seed the General Icons Registry.

   Builds the canonical KOLEEX general-system visual vocabulary (structured
   entities across the 20 categories) and curate-matches each against the
   uploaded icon pack. Matched icons are normalized (fill=currentColor, strip
   width/height) + uploaded to Storage and linked. Unmatched entities are
   registered as "Missing" placeholders (no file) — exactly the registry
   behaviour: the entity exists, the file can be added later.

   Idempotent: re-running skips entities that already exist (by slug), and only
   attaches a matched file to an existing entity that is still Missing. It never
   overwrites a file you uploaded manually.

   Run:  node scripts/seed-general-icons.mjs
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ── env ──
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT = "490fbd4d-f3e8-44fa-83e6-ee26f961d5ca";
const PACK_ROOT = "/tmp/icon_full/General Icons/svg";
const BUCKET = "media";

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase env"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── category code map (mirror src/lib/visual-library/taxonomy.ts) ──
const CAT_CODE = {
  navigation: "NAV", actions: "ACT", status: "STAT", communication: "COMM", users: "USR",
  finance: "FIN", inventory: "INV", analytics: "ANL", ai: "AI", files: "FILE", security: "SEC",
  business: "BIZ", commerce: "COM", manufacturing: "MFG", time: "TIME", devices: "DEV",
  database: "SYS", maps: "MAP", documents: "DOC", misc: "MISC",
};

// ── build a filename index of the pack: "name" (no fi-rr- prefix) -> {path, folder} ──
function indexPack() {
  const idx = new Map();
  if (!existsSync(PACK_ROOT)) { console.error("Pack not found at", PACK_ROOT); process.exit(1); }
  for (const folder of readdirSync(PACK_ROOT)) {
    const dir = join(PACK_ROOT, folder);
    let files;
    try { files = readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith(".svg")) continue;
      const name = f.replace(/^fi-rr-/, "").replace(/\.svg$/, "").toLowerCase();
      if (!idx.has(name)) idx.set(name, { path: join(dir, f), folder, file: f });
    }
  }
  return idx;
}

function normalizeSvg(raw) {
  let s = raw.replace(/<\?xml[^>]*\?>/i, "").trim();
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  if (!/<svg\b[^>]*\sfill=/i.test(s)) s = s.replace(/<svg\b/i, '<svg fill="currentColor"');
  return s;
}
const viewboxOf = (raw) => { const m = raw.match(/viewBox="([^"]+)"/i); return m ? m[1] : "0 0 24 24"; };
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const codeName = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 20) || "ASSET";

// ── canonical vocabulary: [name, category, subcategory, [candidate fi-rr names], [keywords]] ──
const V = [
  // Navigation
  ["Home", "navigation", "Home", ["home"], ["dashboard", "start"]],
  ["Menu", "navigation", "Menu", ["menu-burger", "menu-dots"], ["hamburger", "nav"]],
  ["Apps", "navigation", "Menu", ["apps", "grid"], ["modules", "launcher"]],
  ["Search", "navigation", "Menu", ["search"], ["find", "lookup", "query"]],
  ["Back", "navigation", "Arrows", ["angle-left", "arrow-left"], ["previous", "return"]],
  ["Forward", "navigation", "Arrows", ["angle-right", "arrow-right"], ["next"]],
  ["Expand", "navigation", "Arrows", ["angle-down", "caret-down"], ["open", "more"]],
  ["External link", "navigation", "Menu", ["arrow-up-right-from-square", "link-alt"], ["open new tab"]],
  // Actions
  ["Add", "actions", "Create", ["plus", "add"], ["create", "new"]],
  ["Edit", "actions", "Edit", ["edit", "pencil"], ["modify", "change"]],
  ["Delete", "actions", "Delete", ["trash", "trash-xmark"], ["remove", "bin"]],
  ["Save", "actions", "Save", ["disk", "check"], ["store", "keep"]],
  ["Duplicate", "actions", "Create", ["copy", "duplicate"], ["clone", "copy"]],
  ["Share", "actions", "Share", ["share", "share-square"], ["send", "distribute"]],
  ["Filter", "actions", "Import/Export", ["filter", "settings-sliders"], ["refine", "sort"]],
  ["Upload", "actions", "Import/Export", ["upload", "cloud-upload-alt"], ["import", "add file"]],
  ["Download", "actions", "Import/Export", ["download", "cloud-download-alt"], ["export", "save file"]],
  ["Import", "actions", "Import/Export", ["file-import", "download"], ["bring in"]],
  ["Export", "actions", "Import/Export", ["file-export", "upload"], ["send out"]],
  ["Print", "actions", "Edit", ["print", "printer"], ["paper"]],
  ["Refresh", "actions", "Edit", ["refresh", "rotate-right"], ["reload", "sync"]],
  ["Archive", "actions", "Delete", ["archive", "box-open"], ["store away"]],
  // Status & Alerts
  ["Success", "status", "Success", ["check-circle", "check"], ["done", "complete", "ok"]],
  ["Warning", "status", "Warning", ["triangle-warning", "exclamation"], ["caution", "alert"]],
  ["Error", "status", "Error", ["cross-circle", "ban"], ["fail", "danger"]],
  ["Info", "status", "Pending", ["info", "interrogation"], ["information", "help"]],
  ["Pending", "status", "Pending", ["clock", "hourglass-end"], ["waiting", "in progress"]],
  ["Approved", "status", "Approved", ["badge-check", "check-double"], ["verified", "accepted"]],
  ["Rejected", "status", "Rejected", ["cross", "ban"], ["declined", "denied"]],
  ["Verified", "status", "Approved", ["shield-check", "badge-check"], ["trusted", "confirmed"]],
  ["Alert", "status", "Warning", ["bell-ring", "bell"], ["notify", "notification"]],
  ["Star", "status", "Approved", ["star", "starfighter"], ["favorite", "rate"]],
  // Communication
  ["Chat", "communication", "Chat", ["comment", "comments"], ["message", "talk"]],
  ["Message", "communication", "Chat", ["comment-alt", "comment"], ["dm", "text"]],
  ["Email", "communication", "Email", ["envelope", "envelope-open"], ["mail", "inbox"]],
  ["Phone", "communication", "Phone", ["phone-call", "phone-flip"], ["call", "telephone"]],
  ["Notification", "communication", "Notification", ["bell", "bell-ring"], ["alert", "ping"]],
  ["Send", "communication", "Chat", ["paper-plane", "paper-plane-top"], ["submit", "deliver"]],
  ["Video call", "communication", "Video call", ["video-camera", "video-camera-alt"], ["meeting", "conference"]],
  ["Announcement", "communication", "Notification", ["megaphone", "bullhorn"], ["broadcast", "news"]],
  // Users & Identity
  ["User", "users", "User", ["user", "circle-user"], ["person", "account"]],
  ["Users", "users", "Users", ["users", "users-alt"], ["people", "group", "team"]],
  ["Profile", "users", "Profile", ["id-badge", "address-card"], ["identity", "card"]],
  ["Team", "users", "Team", ["users-alt", "people-group"], ["group", "members"]],
  ["Add user", "users", "User", ["user-add", "user-plus"], ["invite", "new member"]],
  ["Contact", "users", "Contact", ["address-book", "contact"], ["directory"]],
  // Finance
  ["Invoice", "finance", "Invoice", ["file-invoice", "file-invoice-dollar"], ["bill", "statement"]],
  ["Payment", "finance", "Payment", ["credit-card", "money-check"], ["pay", "transaction"]],
  ["Wallet", "finance", "Wallet", ["wallet", "wallet-arrow"], ["balance", "funds"]],
  ["Money", "finance", "Currency", ["money", "money-bill-wave"], ["cash", "revenue"]],
  ["Coins", "finance", "Currency", ["coins", "dollar"], ["money", "price"]],
  ["Tax", "finance", "Tax", ["calculator", "receipt"], ["vat", "duty"]],
  ["Bank", "finance", "Bank", ["bank", "building-columns"], ["account"]],
  ["Receipt", "finance", "Invoice", ["receipt"], ["proof", "bill"]],
  ["Piggy bank", "finance", "Wallet", ["piggy-bank"], ["savings", "budget"]],
  // Inventory & Logistics
  ["Warehouse", "inventory", "Warehouse", ["warehouse-alt", "warehouse"], ["storage", "depot"]],
  ["Box", "inventory", "Box", ["box", "box-open"], ["package", "carton"]],
  ["Boxes", "inventory", "Box", ["boxes", "box-up"], ["stock", "packages"]],
  ["Shipping", "inventory", "Shipping", ["shipping-fast", "truck-side"], ["delivery", "freight"]],
  ["Truck", "inventory", "Shipping", ["truck-side", "delivery-truck"], ["transport", "haul"]],
  ["Tracking", "inventory", "Tracking", ["route", "marker"], ["trace", "track"]],
  ["Pallet", "inventory", "Pallet", ["pallet", "pallet-alt"], ["stock", "load"]],
  ["Barcode", "inventory", "Barcode", ["barcode", "barcode-read"], ["scan", "sku"]],
  ["QR Code", "inventory", "Barcode", ["qr", "qrcode"], ["scan", "code"]],
  ["Container", "inventory", "Shipping", ["truck-container", "container-storage"], ["sea freight"]],
  // Analytics & Dashboard
  ["Dashboard", "analytics", "Dashboard", ["dashboard-monitor", "apps"], ["overview", "panel"]],
  ["Chart", "analytics", "Chart", ["chart-histogram", "stats"], ["bar chart", "graph"]],
  ["Pie chart", "analytics", "Chart", ["chart-pie", "chart-pie-alt"], ["distribution"]],
  ["Line graph", "analytics", "Graph", ["chart-line-up", "stats"], ["trend"]],
  ["Growth", "analytics", "Growth", ["arrow-trend-up", "chart-line-up"], ["increase", "up"]],
  ["Report", "analytics", "KPI", ["document", "file-chart-line"], ["analysis"]],
  ["Target", "analytics", "KPI", ["bullseye-arrow", "target"], ["goal", "objective"]],
  // AI & Automation
  ["AI", "ai", "AI", ["brain", "microchip-ai"], ["artificial intelligence", "smart"]],
  ["Automation", "ai", "Automation", ["settings", "gears"], ["workflow", "auto"]],
  ["Workflow", "ai", "Workflow", ["diagram-project", "route"], ["pipeline", "flow"]],
  ["Magic", "ai", "Magic", ["wand-magic-sparkles", "sparkles"], ["generate", "auto"]],
  ["Bot", "ai", "Bot", ["robot", "user-robot"], ["assistant", "agent"]],
  // Files & Media
  ["File", "files", "File", ["file", "document"], ["doc"]],
  ["Folder", "files", "Folder", ["folder", "folder-open"], ["directory"]],
  ["Image", "files", "Image", ["picture", "images"], ["photo", "img"]],
  ["Video", "files", "Video", ["video-camera", "film"], ["movie", "clip"]],
  ["Audio", "files", "Audio", ["volume", "music"], ["sound", "voice"]],
  ["PDF", "files", "PDF", ["file-pdf", "document"], ["acrobat"]],
  ["Attachment", "files", "File", ["clip", "paperclip-vertical"], ["attach", "clip"]],
  // Security & Permissions
  ["Lock", "security", "Lock", ["lock", "lock-alt"], ["secure", "private"]],
  ["Unlock", "security", "Lock", ["unlock", "lock-open-alt"], ["open access"]],
  ["Key", "security", "Key", ["key", "key-skeleton-left-right"], ["access", "password"]],
  ["Shield", "security", "Shield", ["shield-check", "shield"], ["protect", "secure"]],
  ["Permissions", "security", "Permissions", ["user-lock", "user-shield"], ["access control", "roles"]],
  ["Eye", "security", "Permissions", ["eye", "eye-crossed"], ["view", "visibility"]],
  // Business & Companies
  ["Company", "business", "Company", ["building", "city"], ["organization", "firm"]],
  ["Supplier", "business", "Supplier", ["truck-side", "industry-windows"], ["vendor", "factory"]],
  ["Customer", "business", "Customer", ["users", "user"], ["client", "buyer"]],
  ["Building", "business", "Building", ["building", "bank"], ["office", "hq"]],
  ["Handshake", "business", "Handshake", ["handshake", "handshake-angle"], ["deal", "partner"]],
  ["Briefcase", "business", "Company", ["briefcase", "suitcase-alt"], ["business", "work"]],
  // Commerce & Orders
  ["Cart", "commerce", "Cart", ["shopping-cart", "shopping-cart-add"], ["basket", "buy"]],
  ["Bag", "commerce", "Cart", ["shopping-bag", "shopping-bag-add"], ["purchase"]],
  ["Order", "commerce", "Order", ["box-check", "receipt"], ["purchase order", "po"]],
  ["Tag", "commerce", "Tag", ["tags", "tag"], ["label", "price"]],
  ["Discount", "commerce", "Discount", ["badge-percent", "tags"], ["sale", "offer"]],
  ["Store", "commerce", "Order", ["shop", "store-alt"], ["shop", "market"]],
  // Manufacturing
  ["Factory", "manufacturing", "Factory", ["industry-windows", "industry-alt"], ["plant", "production"]],
  ["Gear", "manufacturing", "Gear", ["settings", "gears"], ["cog", "mechanism"]],
  ["Tools", "manufacturing", "Tools", ["tools", "screwdriver"], ["wrench", "maintenance"]],
  ["Production", "manufacturing", "Production", ["conveyor-belt", "boxes"], ["assembly", "line"]],
  ["Quality", "manufacturing", "Quality", ["badge-check", "shield-check"], ["qc", "inspection"]],
  ["Hammer", "manufacturing", "Tools", ["hammer", "hammer-crash"], ["build", "fix"]],
  // Time & Scheduling
  ["Calendar", "time", "Calendar", ["calendar", "calendar-days"], ["date", "schedule"]],
  ["Clock", "time", "Clock", ["clock", "time-fast"], ["time", "hour"]],
  ["Timer", "time", "Timer", ["stopwatch", "timer"], ["countdown", "duration"]],
  ["Schedule", "time", "Schedule", ["calendar-clock", "calendar"], ["agenda", "plan"]],
  ["History", "time", "History", ["time-past", "rotate-left"], ["log", "past"]],
  // Devices & Technology
  ["Laptop", "devices", "Laptop", ["laptop", "computer"], ["pc", "computer"]],
  ["Mobile", "devices", "Mobile", ["mobile-button", "mobile-notch"], ["phone", "smartphone"]],
  ["Cloud", "devices", "Cloud", ["cloud", "cloud-check"], ["server", "hosting"]],
  ["Wifi", "devices", "Wifi", ["wifi", "wifi-alt"], ["network", "wireless"]],
  ["Server", "devices", "Server", ["database", "disk"], ["host", "storage"]],
  // Database & Systems
  ["Database", "database", "Database", ["database", "disk"], ["data", "storage", "table"]],
  ["Storage", "database", "Storage", ["disk", "memory"], ["disk", "drive"]],
  ["Sync", "database", "Sync", ["refresh", "rotate-right"], ["synchronize", "update"]],
  ["Settings", "database", "Settings", ["settings", "settings-sliders"], ["config", "preferences", "gear"]],
  ["Integration", "database", "Integration", ["plug", "share"], ["connect", "api"]],
  // Maps & Location
  ["Location pin", "maps", "Pin", ["marker", "location-alt"], ["place", "pin", "address"]],
  ["Map", "maps", "Map", ["map", "map-marker"], ["geography", "atlas"]],
  ["Globe", "maps", "Globe", ["globe", "earth-americas"], ["world", "international"]],
  ["Route", "maps", "Route", ["route", "road"], ["path", "directions"]],
  // Documents & Reports
  ["Document", "documents", "Document", ["document", "file"], ["paper", "doc"]],
  ["Contract", "documents", "Contract", ["contract", "file-signature"], ["agreement", "terms"]],
  ["Clipboard", "documents", "Clipboard", ["clipboard", "clipboard-list"], ["checklist", "tasks"]],
  ["Signature", "documents", "Signature", ["signature", "file-signature"], ["sign", "approve"]],
  ["Task", "documents", "Clipboard", ["list-check", "checkbox"], ["todo", "action"]],
];

async function run() {
  const idx = indexPack();
  console.log(`Pack indexed: ${idx.size} unique icon names`);

  // existing slugs for idempotency
  const { data: existing } = await supabase.from("visual_assets").select("id, slug, svg_path").eq("tenant_id", TENANT);
  const bySlug = new Map((existing ?? []).map((r) => [r.slug, r]));

  const seqByCat = {};
  let inserted = 0, attached = 0, missing = 0, skipped = 0, matched = 0;

  for (const [name, category, subcategory, candidates, keywords] of V) {
    const slug = slugify(name);
    const cat = CAT_CODE[category] ?? "MISC";
    seqByCat[cat] = (seqByCat[cat] ?? 0) + 1;
    const code = `ICO-${cat}-${codeName(name)}-${String(seqByCat[cat]).padStart(3, "0")}`;

    // find a matching pack file
    let hit = null;
    for (const cand of candidates) { const f = idx.get(cand.toLowerCase()); if (f) { hit = f; break; } }

    // upload matched file (normalized)
    let svgPath = null, viewbox = null, fileSize = null, flaticonFolder = null, sourceName = null;
    if (hit) {
      matched++;
      const raw = readFileSync(hit.path, "utf8");
      const norm = normalizeSvg(raw);
      viewbox = viewboxOf(raw);
      flaticonFolder = hit.folder;
      sourceName = hit.file.replace(/\.svg$/, "");
      const path = `visual-library/general/${category}/${slug}.svg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(norm, "utf8"), {
        contentType: "image/svg+xml", upsert: true,
      });
      if (upErr) { console.warn(`  upload failed ${slug}: ${upErr.message}`); }
      else { svgPath = path; fileSize = Buffer.byteLength(norm); }
    }

    const existingRow = bySlug.get(slug);
    if (existingRow) {
      // attach a file only if the entity is still Missing and we found one now
      if (!existingRow.svg_path && svgPath) {
        await supabase.from("visual_assets").update({
          svg_path: svgPath, viewbox, file_size: fileSize, file_type: "svg", mime_type: "image/svg+xml",
          flaticon_folder: flaticonFolder, source_name: sourceName, source: "flaticon-general",
        }).eq("id", existingRow.id);
        attached++;
      } else { skipped++; }
      continue;
    }

    // insert new entity
    const row = {
      tenant_id: TENANT,
      visual_asset_code: code,
      slug,
      title: name,
      asset_type: "icon",
      category,
      subcategory,
      keywords: [...new Set(keywords.map((k) => k.toLowerCase()))],
      synonyms: [],
      search_aliases: [slug, ...candidates.map((c) => c.toLowerCase())],
      tags: [category, ...keywords.map((k) => k.toLowerCase())].slice(0, 8),
      style: "outline",
      file_type: svgPath ? "svg" : null,
      storage_bucket: BUCKET,
      svg_path: svgPath,
      viewbox,
      file_size: fileSize,
      mime_type: svgPath ? "image/svg+xml" : null,
      flaticon_folder: flaticonFolder,
      source_name: sourceName,
      source: svgPath ? "flaticon-general" : "vocabulary",
      approval_status: "draft",
    };
    const { error } = await supabase.from("visual_assets").insert(row);
    if (error) { console.warn(`  insert failed ${slug}: ${error.message}`); continue; }
    inserted++;
    if (svgPath) {} else missing++;
  }

  console.log(`\nDone. entities=${V.length} matched-files=${matched} inserted=${inserted} attached=${attached} missing-placeholders=${missing} skipped=${skipped}`);
  const { count } = await supabase.from("visual_assets").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT);
  console.log(`Total rows in visual_assets: ${count}`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
