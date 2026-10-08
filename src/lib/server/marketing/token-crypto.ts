import "server-only";

/* ---------------------------------------------------------------------------
   marketing/token-crypto — the platforms' access keys (Facebook Page tokens,
   Instagram, and the others as they connect) are stored ENCRYPTED in
   marketing_accounts.token_encrypted: never in plain text, never in a log,
   never sent to a browser.

   AES-256-GCM, the same recipe as lib/mail/encryption. The key lives only in
   the server env var MARKETING_TOKEN_KEY (32 random bytes, base64 —
   `openssl rand -base64 32`). It is deliberately NOT Mail's
   MAIL_ENCRYPTION_KEY, so a leak of one does not open the other.

   Stored format: "v1:" + base64(iv(12) || ciphertext || tag(16)). The version
   prefix lets a future key rotate without breaking rows already stored. GCM
   is authenticated: a tampered value or the wrong key throws instead of
   returning garbage.
   --------------------------------------------------------------------------- */

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function key(): Buffer {
  const raw = (process.env.MARKETING_TOKEN_KEY ?? "").trim();
  if (!raw) {
    throw new Error("MARKETING_TOKEN_KEY is not set. Generate one with `openssl rand -base64 32` and add it to the Hub's Vercel env vars.");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LENGTH) throw new Error("MARKETING_TOKEN_KEY must be 32 bytes, base64-encoded.");
  return buf;
}

/** True when a valid key is configured — the connect flow checks this
 *  before it asks a platform for anything. */
export function isTokenCryptoConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const sep = stored.indexOf(":");
  const version = sep > 0 ? stored.slice(0, sep) : "";
  if (version !== VERSION) throw new Error("Unknown access key format.");
  const blob = Buffer.from(stored.slice(sep + 1), "base64");
  if (blob.length <= IV_LENGTH + TAG_LENGTH) throw new Error("The stored access key is truncated.");
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(blob.length - TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH, blob.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
