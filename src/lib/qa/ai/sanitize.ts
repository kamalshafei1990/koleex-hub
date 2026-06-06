import "server-only";

/* ---------------------------------------------------------------------------
   sanitize — strip anything secret-shaped from the workspace prompt BEFORE it
   leaves our infrastructure for a provider. Defence-in-depth: the workspace
   prompt is built from issue data only (never env), but we scrub anyway so a
   leaked secret in a comment/title/log can't be exfiltrated to the model.

   Deterministic, allocation-light regex passes. Returns the cleaned text plus
   a redaction count so callers/tests can assert that scrubbing ran.
   --------------------------------------------------------------------------- */

export interface SanitizeResult {
  clean: string;
  redactions: number;
}

const REDACTED = "[REDACTED]";

/* Ordered most-specific → most-general. Each entry redacts the secret VALUE,
   keeping surrounding context so the AI still understands the structure. */
const RULES: Array<{ re: RegExp; replace: string }> = [
  // Provider / cloud API keys (specific prefixes first).
  { re: /\bsk-ant-[A-Za-z0-9_-]{10,}\b/g, replace: REDACTED },             // Anthropic
  { re: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}\b/g, replace: REDACTED },          // OpenAI
  { re: /\bgsk_[A-Za-z0-9]{20,}\b/g, replace: REDACTED },                   // Groq
  { re: /\bAIza[A-Za-z0-9_-]{20,}\b/g, replace: REDACTED },                 // Google
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, replace: REDACTED },           // Slack
  { re: /\bAKIA[0-9A-Z]{16}\b/g, replace: REDACTED },                       // AWS access key id
  { re: /\bgh[posru]_[A-Za-z0-9]{20,}\b/g, replace: REDACTED },             // GitHub tokens
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, replace: REDACTED }, // JWT

  // Bearer / Authorization headers.
  { re: /\b(authorization|bearer)\b\s*[:=]?\s*["']?[A-Za-z0-9._\-+/=]{12,}["']?/gi, replace: "$1 " + REDACTED },

  // Connection strings with embedded credentials (postgres://user:pass@host).
  { re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s:@/]+@/gi, replace: "$1" + REDACTED + "@" },

  // key=value / "key": "value" where the key name looks sensitive.
  { re: /\b((?:api[_-]?key|secret|password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|service[_-]?role[_-]?key|session[_-]?secret|cookie|set-cookie)["']?\s*[:=]\s*)["']?[^"'\s,}{]{6,}["']?/gi, replace: "$1" + REDACTED },

  // Env-style assignments: SOMETHING_SECRET=... / SUPABASE_SERVICE_ROLE_KEY=...
  { re: /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PWD|CREDENTIAL|DSN)[A-Z0-9_]*)\s*=\s*\S+/g, replace: "$1=" + REDACTED },

  // PEM private key blocks.
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, replace: REDACTED },
];

/**
 * Redact secret-shaped substrings from a prompt. Idempotent and side-effect free.
 */
export function sanitizeWorkspaceForAI(input: string): SanitizeResult {
  if (!input) return { clean: "", redactions: 0 };
  let out = input;
  let redactions = 0;
  for (const { re, replace } of RULES) {
    out = out.replace(re, (...args) => {
      redactions++;
      // Support $1 back-reference in replacement strings.
      if (replace.includes("$1") && typeof args[1] === "string") {
        return replace.replace("$1", args[1] as string);
      }
      return replace;
    });
  }
  // Hard cap: never ship an unbounded prompt to a provider.
  const MAX = 60_000;
  if (out.length > MAX) out = out.slice(0, MAX) + "\n\n[...truncated for length...]";
  return { clean: out, redactions };
}
