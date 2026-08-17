import "server-only";

/* ---------------------------------------------------------------------------
   Validation for a letter payload. Shared by POST and PUT so a field that is
   rejected on create cannot slip in on edit.

   Two levels:
     · errors   — the save is refused. Wrong here means an unusable document.
     · warnings — saved, but surfaced. These are the real-world traps found in
                  the owner's existing manual letters and the consular rules
                  that letters get refused over. Judgement stays with the
                  operator; the system just refuses to let them be silent.
   --------------------------------------------------------------------------- */

import { durationDays, countryNeedsChinese, positionNeedsChinese } from "./types";

export type LetterPayload = {
  contactId?: string | null;
  visitor: {
    name?: unknown; gender?: unknown; dob?: unknown;
    nationality?: unknown; nationalityCode?: unknown;
    passportNo?: unknown; passportIssue?: unknown; passportExpiry?: unknown;
    company?: unknown; position?: unknown; country?: unknown; countryCode?: unknown;
  };
  visit: {
    purpose?: unknown; exhibitionName?: unknown; extraNote?: unknown;
    arrivalCity?: unknown; arrivalDate?: unknown; departureDate?: unknown;
    cities?: unknown; visaType?: unknown;
  };
  letterDate?: unknown;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PURPOSES = new Set(["exhibition", "meeting", "factory", "training"]);
const VISA_TYPES = new Set(["single", "multi"]);

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function isoOrNull(v: unknown): string | null {
  const s = str(v);
  return s && ISO_DATE.test(s) ? s : null;
}

/** Days between two ISO dates, positive when `later` is after `earlier`. */
function daysBetween(earlier: string, later: string): number {
  return durationDays(earlier, later) - 1;
}

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

export function validateLetter(p: LetterPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const v = p.visitor ?? {};
  const visit = p.visit ?? {};

  /* ── errors ─────────────────────────────────────────────────────────── */

  const name = str(v.name);
  if (!name) errors.push("The visitor's name is required — it must match the passport exactly.");

  const arrival = isoOrNull(visit.arrivalDate);
  const departure = isoOrNull(visit.departureDate);
  if (!arrival) errors.push("Arrival date is required (YYYY-MM-DD).");
  if (!departure) errors.push("Departure date is required (YYYY-MM-DD).");
  if (arrival && departure && daysBetween(arrival, departure) < 0) {
    errors.push("Departure date cannot be before the arrival date.");
  }

  const purpose = str(visit.purpose);
  if (!purpose || !PURPOSES.has(purpose)) {
    errors.push("Choose a reason for the visit.");
  }

  const visaType = str(visit.visaType);
  if (visaType && !VISA_TYPES.has(visaType)) {
    errors.push("Visa type must be single or multi.");
  }

  for (const [label, value] of [
    ["Date of birth", v.dob],
    ["Passport issue date", v.passportIssue],
    ["Passport expiry date", v.passportExpiry],
    ["Letter date", p.letterDate],
  ] as const) {
    const s = str(value);
    if (s && !ISO_DATE.test(s)) errors.push(`${label} must be a date in YYYY-MM-DD form.`);
  }

  const gender = str(v.gender);
  if (gender && gender !== "male" && gender !== "female") {
    errors.push("Gender must be male or female.");
  }

  if (visit.cities !== undefined && visit.cities !== null && !Array.isArray(visit.cities)) {
    errors.push("Cities must be a list.");
  }

  /* ── warnings ───────────────────────────────────────────────────────── */

  /* 1. Six-month passport rule. Chinese missions routinely refuse a passport
        with under six months left at the time of travel — not at the time
        the letter is written, which is why this measures from arrival. */
  const expiry = isoOrNull(v.passportExpiry);
  if (expiry && arrival) {
    const left = daysBetween(arrival, expiry);
    if (left < 0) {
      errors.push("The passport expires before the arrival date.");
    } else if (left < 180) {
      warnings.push(
        `The passport has ${left} days left on the arrival date. Chinese consulates ` +
          `usually require at least six months — the visa may be refused.`,
      );
    }
  }

  /* 2. Passport issue date after expiry — a transcription slip, easy to miss
        because both fields look plausible on their own. */
  const issue = isoOrNull(v.passportIssue);
  if (issue && expiry && daysBetween(issue, expiry) <= 0) {
    errors.push("The passport issue date is not before its expiry date — check the scan.");
  }

  /* 3. Stay length. A consulate reads "30 days" against the dates beside it;
        the duration is derived, so this can only fire when the DATES look
        unreasonable, not when the number disagrees with them. */
  if (arrival && departure) {
    const days = durationDays(arrival, departure);
    if (days > 90) {
      warnings.push(
        `The stay is ${days} days. A business (M) visa is normally granted for up ` +
          `to 30 or 60 days per entry — consider a multiple-entry visa or a shorter stay.`,
      );
    }
  }

  /* 4. Untranslated country. The Chinese page would print the English name
        mid-sentence — the half-translated letter problem. */
  const nationalityCode = str(v.nationalityCode);
  if (str(v.nationality) && countryNeedsChinese(nationalityCode)) {
    warnings.push(
      "There is no Chinese name on file for this nationality, so the Chinese page " +
        "will print the English one. Check it before sending.",
    );
  }

  /* 4b. Untranslated job title — the Chinese page would carry an English
         position mid-sentence. Spaced rather than glued, so it is readable,
         but still visibly a half-translated letter. */
  if (positionNeedsChinese(str(v.position))) {
    warnings.push(
      `There is no Chinese wording on file for the position "${str(v.position)}", ` +
        `so the Chinese page will print it in English. Leave the position empty if ` +
        `you would rather the letter simply say the visitor is our customer.`,
    );
  }

  /* 5. Missing passport number. The letter can still be produced — the owner
        sometimes writes ahead of receiving the scan — but a consulate cannot
        match it to an application. */
  if (!str(v.passportNo)) {
    warnings.push("No passport number. The consulate cannot match the letter to an application.");
  }

  /* 6. Exhibition chosen with no exhibition named — the letter would say
        "an exhibition", which reads as a placeholder. */
  if (purpose === "exhibition" && !str(visit.exhibitionName)) {
    warnings.push(
      "No exhibition name. The letter will read \"an exhibition\" instead of naming it.",
    );
  }

  /* 7. No cities. The visit paragraph then states no destination at all. */
  if (Array.isArray(visit.cities) && visit.cities.length === 0) {
    warnings.push("No cities listed — the letter will not say where the visitor is going.");
  }

  return { errors, warnings };
}
