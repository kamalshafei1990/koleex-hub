/* ---------------------------------------------------------------------------
   mail/encryption — AES-256-GCM helpers for storing IMAP/SMTP passwords
   at rest.

   Why we need this:
     External mailbox passwords (or Zoho/Gmail app passwords) end up in
     the `mail_connections.password_encrypted` column in Supabase. We
     can't store them in plaintext because:
       1. Anyone with read access to the row would see the password
       2. Database backups / accidental logs would leak them
       3. Users reuse passwords across services so one leak cascades

   The key lives ONLY in the server-side env var MAIL_ENCRYPTION_KEY
   (32 raw bytes, base64-encoded). It must NEVER ship to the browser
   bundle — every consumer of this module has to be inside an API route
   or server action.

   Format written to the DB:
     base64( iv(12 bytes) || ciphertext || authTag(16 bytes) )

   That format is self-contained: decryption only needs the key and the
   blob, no side-channel metadata to track. AES-GCM is authenticated so
   if anyone tampers with the ciphertext we'll throw on decrypt instead
   of silently returning garbage.

   Rotation plan (future):
     Add a 1-byte version prefix so we can support MAIL_ENCRYPTION_KEY_V2
     without breaking existing rows. Not needed for v1 — kept simple.
   --------------------------------------------------------------------------- */

import crypto from "node:crypto";

/* Mark this module as server-only so any accidental client-side import
   crashes the build. Next.js ships a dedicated 'server-only' package
   that exports a single throwing line — we can't depend on it here
   without adding a dep, so we use the env-var guard trick: key access
   fails on the client since process.env is sanitized. */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, GCM standard
const KEY_LENGTH = 32; // 256-bit key
const AUTH_TAG_LENGTH = 16;

/** Resolve the raw encryption key. Throws a clear error if the env var
 *  is missing or malformed so setup mistakes surface loudly at first
 *  call rather than producing undecryptable blobs later. */
function getKey(): Buffer {
  const raw = process.env.MAIL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "[mail/encryption] MAIL_ENCRYPTION_KEY is not set. " +
        "Generate one with: `openssl rand -base64 32` and add it to " +
        "Vercel env vars (Production + Preview + Development).",
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error(
      "[mail/encryption] MAIL_ENCRYPTION_KEY is not valid base64.",
    );
  }
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `[mail/encryption] MAIL_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes ` +
        `(got ${key.length}). Use \`openssl rand -base64 32\` to generate one.`,
    );
  }
  return key;
}

/** Encrypt a plaintext string (e.g. an IMAP password) and return a
 *  base64 blob safe to store in a TEXT column. */
export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("[mail/encryption] encryptSecret requires a non-empty string");
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      "[mail/encryption] unexpected auth tag length — Node crypto broken?",
    );
  }
  return Buffer.concat([iv, ciphertext, authTag]).toString("base64");
}

/** Decrypt a blob produced by encryptSecret(). Throws if the key is
 *  wrong or the blob was tampered with — callers should let the error
 *  propagate so the sync service marks the connection as errored. */
export function decryptSecret(blob: string): string {
  if (typeof blob !== "string" || blob.length === 0) {
    throw new Error("[mail/encryption] decryptSecret requires a non-empty string");
  }
  const key = getKey();
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("[mail/encryption] encrypted blob is too short to be valid");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Convenience helper to verify the env var is correctly set at
 *  startup. Used by the Settings UI test-connection flow so the user
 *  gets a clear error before they bother entering credentials. */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
