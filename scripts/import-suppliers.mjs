/* One-off importer: reads ~/Desktop/Companies by Claude search/* supplier folders,
   parses each "Company Info.txt", embeds Logo.png as a base64 data-URI, and inserts
   a supplier row into `contacts` (contact_type='supplier') for the Koleex tenant.
   Skips folders whose company already exists (by company_name_en). */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const TENANT = "490fbd4d-f3e8-44fa-83e6-ee26f961d5ca";
const ROOT = join(homedir(), "Desktop", "Companies by Claude search");

// --- env ---
const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const supa = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const val = (txt, label) => {
  const m = txt.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "mi"));
  return m ? m[1].trim() : "";
};
const firstUrl = (s) => (s.match(/https?:\/\/[^\s)]+/) || [])[0] || "";
const looksReal = (s) => s && !/^via\b/i.test(s) && !/contact form/i.test(s);

function parseCategories(txt) {
  const idx = txt.search(/CATEGORIES \(Koleex classification\)/i);
  if (idx < 0) return [];
  const tail = txt.slice(idx);
  return tail
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

const folders = readdirSync(ROOT)
  .filter((f) => /^\d+\s*-\s*/.test(f) && statSync(join(ROOT, f)).isDirectory())
  .sort();

// Existing supplier names (dedupe).
const { data: existing } = await supa
  .from("contacts").select("company_name_en").eq("tenant_id", TENANT).eq("contact_type", "supplier");
const have = new Set((existing || []).map((r) => (r.company_name_en || "").trim().toLowerCase()));

let inserted = 0, skipped = 0;
for (const folder of folders) {
  const dir = join(ROOT, folder);
  const txtPath = join(dir, "Company Info.txt");
  if (!existsSync(txtPath)) { console.log("skip (no txt):", folder); continue; }
  const txt = readFileSync(txtPath, "utf8");

  const nameEn = val(txt, "Company Name \\(English\\)").replace(/\s*\(formerly[^)]*\)/i, "").trim();
  const nameCn = val(txt, "Company Name \\(Chinese\\)");
  const brands = val(txt, "Brands");
  const phone = val(txt, "Phone");
  const email = val(txt, "Email");
  const website = firstUrl(val(txt, "Website"));
  const address = val(txt, "Address");
  const cats = parseCategories(txt);

  if (!nameEn) { console.log("skip (no name):", folder); skipped++; continue; }
  if (have.has(nameEn.toLowerCase())) { console.log("skip (exists):", nameEn); skipped++; continue; }

  // logo → data URI
  let logo = null;
  const logoPath = join(dir, "Logo.png");
  if (existsSync(logoPath)) logo = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;

  const row = {
    tenant_id: TENANT,
    contact_type: "supplier",
    entity_type: "company",
    supplier_type: "manufacturer",
    company_name_en: nameEn,
    company_name_cn: nameCn || null,
    display_name: nameEn,
    company_name: nameEn,
    full_name: nameEn,
    brand_names: brands || null,
    logo_url: logo,
    category: cats[0] || null,
    categories: cats.length ? cats : null,
    supplier_tel: looksReal(phone) ? phone : null,
    supplier_email: looksReal(email) ? email : null,
    supplier_website: website || null,
    supplier_address: address || null,
  };

  const { error } = await supa.from("contacts").insert(row);
  if (error) { console.log("ERROR", nameEn, "→", error.message); skipped++; continue; }
  inserted++;
  console.log(`✓ ${nameEn}  [${cats.join(", ")}]  ${logo ? "logo" : "no-logo"}`);
}
console.log(`\nDONE — inserted ${inserted}, skipped ${skipped}, of ${folders.length} folders.`);
