import "server-only";

/* ---------------------------------------------------------------------------
   ai/voice/fetch-cause — turning a fetch failure into something worth logging.

   WHY THIS EXISTS, from an actual investigation that went wrong twice.

   `fetch` reports every transport failure as a bare `TypeError`. The name is
   identical whether the host did not resolve, the connection was refused, TLS
   was rejected, the socket was reset, or the TCP connection never opened at
   all. Those are five different problems with five different owners, and the
   voice handshake route was logging one word for all of them.

   What it cost: production showed both handshake attempts dying at ~10.4s
   against a 13s budget with `cause=TypeError`. Failing BELOW your own budget
   is not a timeout you set — it is something underneath giving up first — but
   with only the name to go on, that read as "the vendor is slow" and the fix
   applied was a retry. The retry could not have helped, because the real
   reason was one level down on `.cause`.

   THE CODE, NEVER THE MESSAGE, and this is the security half. A cause's
   `message` is free text that routinely embeds the hostname it failed to
   reach — "getaddrinfo ENOTFOUND <the vendor's endpoint>". The standing rule
   is that the endpoint is vendor identity and does not travel; a log an
   operator reads is still somewhere it did not need to go. So only the short
   machine code travels.

   AND IT IS FILTERED RATHER THAN TRUSTED. `cause` is a value from outside
   this codebase, produced by a runtime that is free to change its shape. The
   whole reason this function exists is that we were wrong about what it
   contained; assuming we are now right about its format would be the same
   mistake in a smaller box. So the code is length-capped and character-
   checked, and anything unexpected is reported as unreadable rather than
   printed. A log line nobody vetted is how a hostname escapes.
   --------------------------------------------------------------------------- */

/** Longest code worth printing. Real ones are well under this. */
const MAX_CODE_LEN = 40;

/**
 * A short, safe description of why a `fetch` threw.
 *
 * Returns the error name alone when there is no usable code, `name/CODE` when
 * there is one — e.g. `TypeError/UND_ERR_CONNECT_TIMEOUT`, which is the
 * difference between "the service is slow" and "the connection never opened".
 */
export function describeFetchFailure(e: unknown): string {
  if (!(e instanceof Error)) return "unknown";
  const inner = (e as { cause?: unknown }).cause;
  const raw =
    inner && typeof inner === "object" && "code" in inner
      ? String((inner as { code?: unknown }).code ?? "")
      : "";
  if (!raw) return e.name;
  const code = raw.slice(0, MAX_CODE_LEN);
  /* Underscores and alphanumerics only. Every real code is this shape, and a
     value that is not cannot be a hostname, a URL or a sentence. */
  return /^[A-Za-z0-9_]+$/.test(code) ? `${e.name}/${code}` : `${e.name}/unreadable`;
}
