import "server-only";

/* ---------------------------------------------------------------------------
   password — central password hashing + verification (Phase 2A · S1a).

   Server-only. This module is the SINGLE source of truth for how a password
   becomes a stored hash and how a stored hash is verified. It is intentionally
   NOT wired into signin or any write site yet (that is S1b / S1c) — this stage
   only creates and unit-tests the primitives.

   Three hash shapes are recognised by PREFIX (never by a trusted `algo` arg):
     · legacy  "tmp$<base64(password)>"  — reversible; being phased out.
     · argon2id "$argon2id$…"            — the new secure default.
     · bcrypt   "$2a$/$2b$/$2y$…"        — recognised, but verification needs
                                            the bcryptjs dependency which is NOT
                                            installed (Argon2id is the chosen
                                            algorithm and works on the Vercel
                                            Node runtime). The bcrypt branch is
                                            therefore fail-closed until/unless a
                                            bcrypt verifier is added.

   Guarantees:
     · Argon2id is the default for hashPassword().
     · Legacy comparison uses crypto.timingSafeEqual (length-guarded).
     · A "dummy" Argon2 op runs when there is no stored hash, so timing does
       not reveal whether an account/hash exists.
     · Fail-closed: any verification error returns { ok: false }.
     · No password or hash is ever logged.
   --------------------------------------------------------------------------- */

import { timingSafeEqual } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

export type PasswordAlgo = "legacy" | "argon2id" | "bcrypt";

export interface VerifyResult {
  /** Whether the supplied password matched the stored hash. */
  ok: boolean;
  /** True when a successful match was against a legacy hash and the caller
   *  should opportunistically re-store the returned newHash/newAlgo. */
  needsRehash: boolean;
  /** Present only when needsRehash is true. */
  newHash?: string;
  newAlgo?: PasswordAlgo;
}

const LEGACY_PREFIX = "tmp$";

/* Argon2id tuning. Conservative but solid defaults (≈19 MiB, 2 passes). Kept
   here so a future tuning change is a one-line edit.
   NOTE: the `algorithm` field is intentionally omitted — Argon2id is the
   @node-rs/argon2 default, and importing the Algorithm const-enum breaks under
   `isolatedModules`. The "$argon2id$" output prefix is asserted by the unit
   tests, so a default-change would fail tests rather than silently downgrade. */
const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** True iff this is a legacy reversible "tmp$…" hash. Null-safe. */
export function isLegacyPasswordHash(hash: string | null | undefined): boolean {
  return typeof hash === "string" && hash.startsWith(LEGACY_PREFIX);
}

/** Recompute the legacy tag for a plaintext: "tmp$" + base64(password). */
function legacyTag(password: string): string {
  return `${LEGACY_PREFIX}${Buffer.from(password, "utf8").toString("base64")}`;
}

/** Constant-time string compare. Returns false on any length mismatch without
 *  leaking via early-out (still does a fixed-size compare). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Compare against self so the call still spends ~constant time, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Hash a plaintext password with the current default algorithm (Argon2id). */
export async function hashPassword(
  password: string,
): Promise<{ hash: string; algo: PasswordAlgo }> {
  const hash = await argon2Hash(password, ARGON2_OPTS);
  return { hash, algo: "argon2id" };
}

/**
 * Hash a password FOR STORAGE, honoring the S1b rollout flag.
 *
 *   default / AUTH_NEW_HASH_ON_WRITE unset or "on"  → Argon2id (secure).
 *   AUTH_NEW_HASH_ON_WRITE === "off"                → emergency rollback only:
 *       writes the legacy reversible tmp$ tag so account creation / reset keeps
 *       working WITHOUT a redeploy if Argon2 ever misbehaves in production.
 *
 * The tmp$ generator (`legacyTag`) is defined ONCE in this module and shared
 * with the verifier — no API route or admin lib duplicates it. Callers must
 * persist BOTH the returned hash and algo into accounts.password_hash /
 * accounts.password_algo (and stamp password_changed_at).
 */
export async function hashForWrite(
  password: string,
): Promise<{ hash: string; algo: PasswordAlgo }> {
  if (process.env.AUTH_NEW_HASH_ON_WRITE === "off") {
    return { hash: legacyTag(password), algo: "legacy" };
  }
  return hashPassword(password);
}

/* Burn ~one Argon2 op worth of time without revealing anything — used when
   there is no real hash to compare against, so "no such account / no password"
   costs about the same as a real verify. Errors are swallowed. */
async function dummyWork(password: string): Promise<void> {
  try {
    await argon2Hash(password, ARGON2_OPTS);
  } catch {
    /* ignore — timing equalizer only */
  }
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * @param password  the plaintext supplied by the user
 * @param storedHash the value from accounts.password_hash (may be null)
 * @param algo       accounts.password_algo (advisory only — detection is by
 *                   prefix so a stale/missing algo can't cause a wrong path)
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
  _algo?: string | null,
): Promise<VerifyResult> {
  // No stored hash → sign-in disabled. Run dummy work to equalize timing.
  if (!storedHash) {
    await dummyWork(password);
    return { ok: false, needsRehash: false };
  }

  // 1) Legacy reversible hash → constant-time compare; upgrade on success.
  if (isLegacyPasswordHash(storedHash)) {
    const matched = safeEqual(legacyTag(password), storedHash);
    if (!matched) return { ok: false, needsRehash: false };
    try {
      const { hash, algo } = await hashPassword(password);
      return { ok: true, needsRehash: true, newHash: hash, newAlgo: algo };
    } catch (e) {
      // Auth succeeded; the rehash just couldn't be produced. Still OK — the
      // caller treats needsRehash as best-effort. Never log the password/hash.
      console.error("[password] legacy rehash generation failed:", (e as Error)?.name);
      return { ok: true, needsRehash: false };
    }
  }

  // 2) Argon2 hash.
  if (storedHash.startsWith("$argon2")) {
    try {
      const ok = await argon2Verify(storedHash, password);
      return { ok, needsRehash: false };
    } catch (e) {
      console.error("[password] argon2 verify error:", (e as Error)?.name);
      return { ok: false, needsRehash: false }; // fail-closed
    }
  }

  // 3) bcrypt hash — recognised but no verifier installed (Argon2id is the
  //    chosen algorithm). Fail closed rather than silently allow.
  if (/^\$2[aby]\$/.test(storedHash)) {
    console.error("[password] bcrypt hash encountered but no bcrypt verifier is installed");
    return { ok: false, needsRehash: false };
  }

  // 4) Unknown format → fail closed.
  console.error("[password] unrecognised stored hash format");
  return { ok: false, needsRehash: false };
}
