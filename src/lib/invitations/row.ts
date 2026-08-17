import "server-only";

/* ---------------------------------------------------------------------------
   Row ⇄ API mapping for invitation letters, plus reference-number allocation.

   Lives apart from the routes so the list endpoint, the single-letter
   endpoint and the print page all reconstruct a letter identically — a
   printed document that disagrees with the list it came from is the exact
   class of bug this feature exists to remove.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  InvitationLetter,
  InvitationPurpose,
  VisaType,
  Gender,
  InvitationStatus,
} from "./types";

/** Every column the API returns. No blobs, no wildcards. */
export const LETTER_COLUMNS =
  "id, reference, contact_id, visitor_name, visitor_gender, visitor_dob, " +
  "visitor_nationality, visitor_nationality_code, visitor_passport_no, " +
  "visitor_passport_issue, visitor_passport_expiry, visitor_company, " +
  "visitor_position, visitor_country, visitor_country_code, purpose, " +
  "exhibition_name, extra_note, arrival_city, arrival_date, departure_date, " +
  "duration_days, cities, visa_type, letter_date, status, issued_at, pdf_url, " +
  "created_at, updated_at";

export function toLetter(row: Record<string, unknown>): InvitationLetter {
  const s = (k: string) => (typeof row[k] === "string" && row[k] ? (row[k] as string) : null);
  return {
    id: row.id as string,
    reference: row.reference as string,
    contactId: s("contact_id"),
    visitor: {
      name: (row.visitor_name as string) ?? "",
      gender: (s("visitor_gender") as Gender | null),
      dob: s("visitor_dob"),
      nationality: s("visitor_nationality"),
      nationalityCode: s("visitor_nationality_code"),
      passportNo: s("visitor_passport_no"),
      passportIssue: s("visitor_passport_issue"),
      passportExpiry: s("visitor_passport_expiry"),
      company: s("visitor_company"),
      position: s("visitor_position"),
      country: s("visitor_country"),
      countryCode: s("visitor_country_code"),
    },
    visit: {
      purpose: (row.purpose as InvitationPurpose) ?? "meeting",
      exhibitionName: s("exhibition_name"),
      extraNote: s("extra_note"),
      arrivalCity: s("arrival_city"),
      arrivalDate: (row.arrival_date as string) ?? "",
      departureDate: (row.departure_date as string) ?? "",
      cities: Array.isArray(row.cities) ? (row.cities as string[]) : [],
      visaType: (row.visa_type as VisaType) ?? "multi",
    },
    letterDate: (row.letter_date as string) ?? "",
    status: (row.status as InvitationStatus) ?? "draft",
    issuedAt: s("issued_at"),
    pdfUrl: s("pdf_url"),
    durationDays: typeof row.duration_days === "number" ? row.duration_days : 0,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  };
}

/* ── reference numbers ───────────────────────────────────────────────────── */

const REF_PREFIX = "KX-INV";

/** Next reference for the year, e.g. KX-INV-2026-0007.
 *
 *  Reads the highest existing number for this tenant + year and adds one.
 *  Two simultaneous saves can compute the same value; the unique index on
 *  (tenant_id, reference) then rejects the loser, and the caller retries.
 *  That is deliberate — a sequence per tenant per year would need its own
 *  DDL and a gap-free run of numbers is not worth it here. */
export async function nextReference(tenantId: string, year: number): Promise<string> {
  const prefix = `${REF_PREFIX}-${year}-`;
  const { data, error } = await supabaseServer
    .from("invitation_letters")
    .select("reference")
    .eq("tenant_id", tenantId)
    .like("reference", `${prefix}%`)
    .order("reference", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[invitations] nextReference:", error.message);
    throw new Error("Failed to allocate a reference number");
  }

  const last = data?.[0]?.reference as string | undefined;
  const lastNum = last ? Number.parseInt(last.slice(prefix.length), 10) : 0;
  const next = (Number.isFinite(lastNum) ? lastNum : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** True when a Postgres error is the unique-violation we retry on. */
export function isReferenceConflict(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /invitation_letters_ref_uniq/.test(error.message ?? "");
}
