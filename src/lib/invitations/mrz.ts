/* ---------------------------------------------------------------------------
   MRZ — the machine-readable zone at the foot of a passport data page.

   Pure code, no dependencies: parsing and check-digit verification only. The
   OCR that produces the two lines lives in passport-ocr.ts and is loaded on
   demand, so nothing here costs the bundle anything.

   TD3 (the passport format, ICAO 9303): two lines of 44 characters.

     line 1  P<ISSUING<SURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<
     line 2  PASSPORTNO C NAT DOB C S EXPIRY C PERSONALNO C C
             123456789  0 123 123456 0 1 123456 0 ...

   Every field carries a CHECK DIGIT, which is why reading the MRZ beats
   reading the printed page above it: a mis-OCR'd character fails arithmetic
   instead of quietly becoming a wrong passport number on a consular document.

   NOTE: the MRZ does NOT contain the date of issue. That field stays manual.
   --------------------------------------------------------------------------- */

export type MrzResult = {
  surname: string;
  givenNames: string;
  /** Full name in passport order, as the letter should print it. */
  name: string;
  passportNo: string;
  /** ISO-3166 alpha-3 from the MRZ (e.g. EGY). */
  nationalityAlpha3: string;
  /** alpha-2, derived — that is what contacts stores. */
  nationalityCode: string | null;
  dob: string | null;          // ISO yyyy-mm-dd
  sex: "male" | "female" | null;
  expiry: string | null;       // ISO yyyy-mm-dd
  /** Which check digits verified. A false here means: re-read that field. */
  checks: {
    passportNo: boolean;
    dob: boolean;
    expiry: boolean;
    /** The composite digit covering the whole of line 2. */
    composite: boolean;
  };
};

/** Character value for the ICAO check-digit algorithm. */
function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55; // A=10 … Z=35
  return 0; // "<" and anything unexpected
}

/** ICAO 9303 check digit: weights cycle 7, 3, 1. */
export function checkDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    sum += charValue(input[i]!) * weights[i % 3]!;
  }
  return sum % 10;
}

function verify(field: string, digit: string): boolean {
  if (!/^\d$/.test(digit)) return false;
  return checkDigit(field) === Number(digit);
}

/** MRZ dates are YYMMDD with no century.
 *
 *  The window matters: a date of birth is in the past, an expiry is in the
 *  future. Using one rule for both turns a 1955 birth into 2055. */
function toIsoDate(yymmdd: string, kind: "past" | "future"): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  /* Reference year is passed in by the caller in practice; using the current
     one here is safe because both windows are 100 years wide. */
  const nowYY = new Date().getFullYear() % 100;
  let century: number;
  if (kind === "past") {
    /* A birth year cannot be in the future: 55 today (2026) means 1955. */
    century = yy > nowYY ? 1900 : 2000;
  } else {
    /* Expiry is always this century for any passport in circulation: the
       longest validity issued is ten years, so a two-digit year can only
       mean 20yy until 2090-ish. An expiry in the past is a genuine result
       (an expired passport) and the caller warns about it separately —
       it must NOT be pushed into 2100 to look plausible, which is what an
       earlier "not in the distant past" rule did to the 2012 specimen. */
    century = 2000;
  }
  const y = century + yy;
  return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Names use "<" as a space and "<<" between surname and given names. */
function cleanName(part: string): string {
  return part.replace(/</g, " ").replace(/\s+/g, " ").trim();
}

/* ICAO alpha-3 → ISO alpha-2 for the countries Koleex actually deals with.
   Unmapped codes return null and the operator picks the country by hand —
   better than a wrong two-letter code silently reaching the letter. */
const ALPHA3_TO_2: Record<string, string> = {
  EGY: "EG", IND: "IN", BGD: "BD", PAK: "PK", LKA: "LK", TUR: "TR",
  IDN: "ID", VNM: "VN", THA: "TH", MYS: "MY", PHL: "PH", MMR: "MM",
  KHM: "KH", UZB: "UZ", KAZ: "KZ", NGA: "NG", MAR: "MA", DZA: "DZ",
  TUN: "TN", LBY: "LY", SDN: "SD", ETH: "ET", KEN: "KE", TZA: "TZ",
  UGA: "UG", GHA: "GH", ZAF: "ZA", SEN: "SN", CIV: "CI", SAU: "SA",
  ARE: "AE", JOR: "JO", SYR: "SY", IRQ: "IQ", LBN: "LB", YEM: "YE",
  OMN: "OM", KWT: "KW", QAT: "QA", BHR: "BH", IRN: "IR", RUS: "RU",
  UKR: "UA", BLR: "BY", POL: "PL", ROU: "RO", BRA: "BR", MEX: "MX",
  PER: "PE", COL: "CO", ARG: "AR", CHL: "CL", ECU: "EC", USA: "US",
  GBR: "GB", DEU: "DE", FRA: "FR", ITA: "IT", ESP: "ES", NLD: "NL",
  PRT: "PT", CHN: "CN",
};

/** Normalise an OCR'd line: uppercase, strip anything not A-Z 0-9 or "<". */
function normaliseLine(line: string): string {
  return line.toUpperCase().replace(/[^A-Z0-9<]/g, "");
}

/**
 * Parse a TD3 MRZ. Accepts the raw two lines in any whitespace arrangement.
 * Returns null when the input is not a plausible TD3 zone at all; returns a
 * result with failing `checks` when it parsed but the arithmetic disagrees.
 */
export function parseMrz(raw: string): MrzResult | null {
  const lines = raw
    .split(/[\r\n]+/)
    .map(normaliseLine)
    .filter((l) => l.length >= 30);

  /* Take the last two long lines: OCR often picks up printed text above the
     zone, and the MRZ is always at the very bottom of the page. */
  if (lines.length < 2) return null;
  const l1 = lines[lines.length - 2]!.padEnd(44, "<").slice(0, 44);
  const l2 = lines[lines.length - 1]!.padEnd(44, "<").slice(0, 44);

  if (!l1.startsWith("P")) return null;

  /* line 1: type(1) issuing(3 at 2..5) names(5..44) */
  const nameField = l1.slice(5);
  const [surnameRaw = "", givenRaw = ""] = nameField.split("<<");
  const surname = cleanName(surnameRaw);
  const givenNames = cleanName(givenRaw);

  /* line 2 */
  const passportNoField = l2.slice(0, 9);
  const passportCd = l2.slice(9, 10);
  const nationality = l2.slice(10, 13);
  const dobField = l2.slice(13, 19);
  const dobCd = l2.slice(19, 20);
  const sexChar = l2.slice(20, 21);
  const expiryField = l2.slice(21, 27);
  const expiryCd = l2.slice(27, 28);
  const personalField = l2.slice(28, 42);
  const personalCd = l2.slice(42, 43);
  const compositeCd = l2.slice(43, 44);

  /* The composite digit covers passport no + its digit, DOB + its digit,
     expiry + its digit, and the personal-number field + its digit. */
  const compositeInput =
    passportNoField + passportCd + dobField + dobCd + expiryField + expiryCd + personalField + personalCd;

  const passportNo = passportNoField.replace(/</g, "").trim();
  const nationalityAlpha3 = nationality.replace(/</g, "").trim();

  return {
    surname,
    givenNames,
    name: [givenNames, surname].filter(Boolean).join(" "),
    passportNo,
    nationalityAlpha3,
    nationalityCode: ALPHA3_TO_2[nationalityAlpha3] ?? null,
    dob: toIsoDate(dobField, "past"),
    sex: sexChar === "M" ? "male" : sexChar === "F" ? "female" : null,
    expiry: toIsoDate(expiryField, "future"),
    checks: {
      passportNo: verify(passportNoField, passportCd),
      dob: verify(dobField, dobCd),
      expiry: verify(expiryField, expiryCd),
      composite: verify(compositeInput, compositeCd),
    },
  };
}

/** Human-readable list of the fields whose check digit failed. */
export function failedChecks(r: MrzResult): string[] {
  const out: string[] = [];
  if (!r.checks.passportNo) out.push("passport number");
  if (!r.checks.dob) out.push("date of birth");
  if (!r.checks.expiry) out.push("expiry date");
  return out;
}
