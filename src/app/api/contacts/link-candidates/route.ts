import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/contacts/link-candidates
   Identity consolidation P4 — read-only. Surfaces likely contact ↔ person
   matches (same tenant) that are NOT yet linked, so an admin can review and
   link them (via POST /api/contacts/[id]/link-person). Matches on exact email
   or exact full name. Never merges or deletes anything — purely a suggestion
   list for human review. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const tenant = auth.tenant_id;
  if (!tenant) return NextResponse.json({ candidates: [] });

  const { data: contacts } = await supabaseServer
    .from("contacts")
    .select("id, full_name, email, contact_type, person_id")
    .eq("tenant_id", tenant)
    .is("person_id", null);
  const { data: people } = await supabaseServer
    .from("people")
    .select("id, full_name, email")
    .eq("tenant_id", tenant);

  const norm = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");
  const byEmail = new Map<string, { id: string; full_name: string | null }>();
  const byName = new Map<string, { id: string; full_name: string | null }>();
  for (const p of people ?? []) {
    const row = p as { id: string; full_name: string | null; email: string | null };
    if (norm(row.email)) byEmail.set(norm(row.email), row);
    if (norm(row.full_name)) byName.set(norm(row.full_name), row);
  }

  const candidates: Array<{
    contact_id: string; contact_name: string | null; contact_type: string | null;
    person_id: string; person_name: string | null; matched_on: "email" | "name";
  }> = [];
  for (const c of contacts ?? []) {
    const row = c as { id: string; full_name: string | null; email: string | null; contact_type: string | null };
    const emailHit = norm(row.email) ? byEmail.get(norm(row.email)) : undefined;
    const nameHit = !emailHit && norm(row.full_name) ? byName.get(norm(row.full_name)) : undefined;
    const hit = emailHit ?? nameHit;
    if (!hit) continue;
    candidates.push({
      contact_id: row.id, contact_name: row.full_name, contact_type: row.contact_type,
      person_id: hit.id, person_name: hit.full_name, matched_on: emailHit ? "email" : "name",
    });
  }

  return NextResponse.json({ candidates, count: candidates.length });
}
