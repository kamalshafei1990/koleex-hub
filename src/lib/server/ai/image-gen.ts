import "server-only";

/* ---------------------------------------------------------------------------
   image-gen — Koleex AI makes a picture, when asked to.

   Option 3 of the photos plan. The user asks for something that does not
   exist yet — "draw me a poster for the Canton Fair stand", "an illustration
   of a spreading table for the training deck" — and the answer is a picture
   rather than a description of one.

   THE VENDOR IS CONFIGURATION, NOT CODE, for the same reason the chat
   fallback and the voice endpoint are: this environment cannot reach any
   image vendor to verify a constant, and the standing rule is that no one AI
   provider is hard-coded into the architecture. Any service that speaks the
   OpenAI-shaped `POST {base}/images/generations` contract works — that is
   the shape most vendors expose today — and switching vendors is four
   variables and a redeploy:

     AI_IMAGE_BASE_URL     e.g. https://<host>/v1   (the adapter appends /images/generations)
     AI_IMAGE_API_KEY
     AI_IMAGE_MODEL        the vendor's model id
     AI_IMAGE_SIZE         optional; default 1024x1024
     AI_IMAGE_EXTRA_BODY   optional JSON merged into every request (a vendor's own switches)

   INERT UNTIL CONFIGURED. With the variables unset the tool reports plainly
   that image creation is not set up on this deployment. It never pretends.

   THE PICTURE IS SERVED FROM OUR OWN STORAGE, NEVER FROM THE VENDOR. The
   vendor's response (base64 bytes, or a short-lived URL the adapter fetches
   once, server-side) is written into the Hub's public `media` bucket and the
   user's browser loads it from there. Two reasons, both load-bearing:
     · MAINLAND CHINA. The Hub's storage is reachable there because the Hub
       is; a vendor's CDN usually is not. A picture the user cannot see is
       not a feature.
     · PERMANENCE. Vendor URLs expire in an hour; a chat message lives for
       years.
   The vendor call itself leaves Vercel (Tokyo), not the user's browser, so
   the vendor's reachability from China does not matter — exactly as with
   web search.

   WHAT LEAVES OUR NETWORK is the prompt text, and only that. No user id, no
   tenant id, no session. The tool that calls this runs the same egress
   scanner web search does, so a prompt carrying a customer name or a price
   is refused before it reaches here.

   WHAT IS NEVER LOGGED: the prompt, the key, the bytes. The log line is
   numbers and a cause.
   --------------------------------------------------------------------------- */

export interface ImageGenConfig {
  readonly url: string;
  readonly model: string;
  readonly size: string;
  readonly label: string;
}

export interface ImageGenEnv {
  AI_IMAGE_BASE_URL?: string;
  AI_IMAGE_API_KEY?: string;
  AI_IMAGE_MODEL?: string;
  AI_IMAGE_SIZE?: string;
  AI_IMAGE_EXTRA_BODY?: string;
}

/* A generation is slow — tens of seconds is normal — but it must still end
   inside the chat turn that asked for it. */
export const IMAGE_TIMEOUT_MS = 45_000;
/* A generated picture is a few hundred KB; this is the ceiling on what the
   adapter will accept or fetch, so a misbehaving vendor cannot fill the
   function's memory. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/* Long enough for a scene, short enough that a pasted document cannot ride
   along as a "prompt". */
export const MAX_PROMPT_CHARS = 1_000;
const DEFAULT_SIZE = "1024x1024";
/* WxH, both sides 256..2048 — the range every vendor accepts some of. A
   typo here would otherwise become a 400 on every call with nothing
   pointing at the variable. */
const SIZE_RE = /^(\d{3,4})x(\d{3,4})$/;

/* The request itself. An operator's JSON must not be able to swap the
   model, replace the prompt, ask for ten pictures, or change the response
   shape the parser expects. */
const PROTECTED_BODY_KEYS = new Set(["model", "prompt", "n", "response_format"]);

export function parseImageExtraBody(raw: string | undefined): Record<string, unknown> {
  const text = raw?.trim();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn("[ai.image] AI_IMAGE_EXTRA_BODY is not valid JSON — ignored");
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.warn("[ai.image] AI_IMAGE_EXTRA_BODY must be a JSON object — ignored");
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (PROTECTED_BODY_KEYS.has(k)) {
      console.warn(`[ai.image] AI_IMAGE_EXTRA_BODY may not set "${k}" — dropped`);
      continue;
    }
    out[k] = v;
  }
  return out;
}

function validSize(raw: string | undefined): string | null {
  const s = raw?.trim() || DEFAULT_SIZE;
  const m = SIZE_RE.exec(s);
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]);
  return w >= 256 && w <= 2048 && h >= 256 && h <= 2048 ? s : null;
}

/** null means not configured — the normal state, not an error. The key is
 *  checked for PRESENCE only and never carried in the returned config. */
export function parseImageConfig(env: ImageGenEnv): ImageGenConfig | null {
  const base = env.AI_IMAGE_BASE_URL?.trim();
  const model = env.AI_IMAGE_MODEL?.trim();
  const hasKey = Boolean(env.AI_IMAGE_API_KEY?.trim());
  if (!base || !model || !hasKey) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  /* The key travels in a header; plaintext would put it on the wire. */
  if (url.protocol !== "https:") return null;
  const size = validSize(env.AI_IMAGE_SIZE);
  if (!size) return null;
  return {
    url: `${base.replace(/\/+$/, "")}/images/generations`,
    model,
    size,
    label: url.hostname,
  };
}

/** WHY it did not configure, for an operator. Variable NAMES, never values. */
export function diagnoseImageConfig(env: ImageGenEnv): string[] {
  const problems: string[] = [];
  const base = env.AI_IMAGE_BASE_URL?.trim();
  if (!base) problems.push("AI_IMAGE_BASE_URL is not set");
  if (!env.AI_IMAGE_MODEL?.trim()) problems.push("AI_IMAGE_MODEL is not set");
  if (!env.AI_IMAGE_API_KEY?.trim()) problems.push("AI_IMAGE_API_KEY is not set");
  if (base) {
    let url: URL | null = null;
    try {
      url = new URL(base);
    } catch {
      problems.push("AI_IMAGE_BASE_URL is not a valid URL");
    }
    if (url && url.protocol !== "https:") {
      problems.push("AI_IMAGE_BASE_URL is not https — the adapter refuses to send a key over plaintext");
    }
    if (url && /\/images\/generations\/?$/.test(url.pathname)) {
      problems.push("AI_IMAGE_BASE_URL ends with /images/generations — the adapter appends that itself, so it is duplicated");
    }
  }
  if (env.AI_IMAGE_SIZE?.trim() && !validSize(env.AI_IMAGE_SIZE)) {
    problems.push("AI_IMAGE_SIZE must look like 1024x1024, each side 256–2048");
  }
  if (problems.length === 0) {
    problems.push(
      "All variables look well-formed. If image creation is still unconfigured, the running process started BEFORE they were set — redeploy.",
    );
  }
  return problems;
}

export function readImageEnv(): ImageGenEnv {
  return {
    AI_IMAGE_BASE_URL: process.env.AI_IMAGE_BASE_URL,
    AI_IMAGE_API_KEY: process.env.AI_IMAGE_API_KEY,
    AI_IMAGE_MODEL: process.env.AI_IMAGE_MODEL,
    AI_IMAGE_SIZE: process.env.AI_IMAGE_SIZE,
    AI_IMAGE_EXTRA_BODY: process.env.AI_IMAGE_EXTRA_BODY,
  };
}

export function imageGenConfigured(env: ImageGenEnv = readImageEnv()): boolean {
  return parseImageConfig(env) !== null;
}

/* ── The bytes ───────────────────────────────────────────────────────────── */

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

/** What the bytes SAY they are, from their first bytes — never from a
 *  content-type header or a file extension a vendor chose. Anything that is
 *  not one of the three web image formats is refused: the bytes go into a
 *  public bucket under our name. */
export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export const EXT_FOR: Record<ImageMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Where the bytes go. Injected so the adapter is proved with a fake store
 *  and the real one (Supabase Storage) lives in the tool, next to the
 *  tenant and account that name the path. */
export type ImageStore = (bytes: Uint8Array, mime: ImageMime) => Promise<string | null>;

export type ImageGenOutcome =
  | { configured: false }
  | { configured: true; ok: true; url: string; mime: ImageMime; bytes: number; ms: number }
  | { configured: true; ok: false; error: string; ms: number };

interface ImagesResponse {
  data?: Array<{ b64_json?: unknown; url?: unknown; revised_prompt?: unknown }>;
  error?: { message?: unknown };
}

function decodeBase64(s: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(s, "base64"));
  } catch {
    return null;
  }
}

/** The vendor may answer with a URL instead of bytes. It is fetched ONCE,
 *  server-side, https only, size-capped — and only because the vendor we
 *  configured sent it; nothing from a user or a model reaches this. */
async function fetchVendorImage(url: string, fetchFn: typeof fetch, signal: AbortSignal): Promise<Uint8Array | null> {
  if (!/^https:\/\//i.test(url)) return null;
  const res = await fetchFn(url, { signal, cache: "no-store" });
  if (!res.ok) return null;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_IMAGE_BYTES) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf.byteLength > MAX_IMAGE_BYTES ? null : buf;
}

export interface ImageGenDeps {
  fetch: typeof fetch;
  store: ImageStore;
  env?: ImageGenEnv;
}

/**
 * One picture for one prompt. Never throws: a vendor that is down, slow,
 * out of credit or returning garbage is an `ok: false` with a cause the
 * tool can relay, and a chat turn that carries on.
 */
export async function generateImage(prompt: string, deps: ImageGenDeps): Promise<ImageGenOutcome> {
  const env = deps.env ?? readImageEnv();
  const cfg = parseImageConfig(env);
  const key = env.AI_IMAGE_API_KEY?.trim();
  if (!cfg || !key) return { configured: false };

  const text = prompt.replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT_CHARS);
  const startedAt = Date.now();
  const fail = (error: string): ImageGenOutcome => {
    const ms = Date.now() - startedAt;
    console.warn(`[ai.image] fail ms=${ms} cause=${error}`);
    return { configured: true, ok: false, error, ms };
  };
  if (!text) return fail("empty prompt");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), IMAGE_TIMEOUT_MS);
  try {
    /* The vendor's own switches first, the request second: nothing in
       AI_IMAGE_EXTRA_BODY can replace what this call is. */
    const body = {
      ...parseImageExtraBody(env.AI_IMAGE_EXTRA_BODY),
      model: cfg.model,
      prompt: text,
      n: 1,
      size: cfg.size,
      response_format: "b64_json",
    };
    let res: Response;
    try {
      res = await deps.fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: "no-store",
      });
    } catch {
      return fail(ctrl.signal.aborted ? `timeout after ${IMAGE_TIMEOUT_MS}ms` : "network");
    }
    if (!res.ok) {
      /* The status is the useful half: 401 bad key, 402 no credit, 404 wrong
         url or model. The body is not logged — it can echo the prompt. */
      return fail(`vendor returned ${res.status}`);
    }
    let json: ImagesResponse;
    try {
      json = (await res.json()) as ImagesResponse;
    } catch {
      return fail("vendor reply was not JSON");
    }
    const first = json.data?.[0];
    let bytes: Uint8Array | null = null;
    if (typeof first?.b64_json === "string" && first.b64_json) {
      bytes = decodeBase64(first.b64_json);
    } else if (typeof first?.url === "string" && first.url) {
      try {
        bytes = await fetchVendorImage(first.url, deps.fetch, ctrl.signal);
      } catch {
        bytes = null;
      }
    }
    if (!bytes || bytes.byteLength === 0) return fail("vendor reply carried no image");
    if (bytes.byteLength > MAX_IMAGE_BYTES) return fail("image too large");
    const mime = sniffImage(bytes);
    if (!mime) return fail("vendor bytes are not a png, jpeg or webp");

    const url = await deps.store(bytes, mime);
    if (!url || !/^https:\/\//i.test(url)) return fail("could not store the image");

    const ms = Date.now() - startedAt;
    console.log(`[ai.image] ok ms=${ms} bytes=${bytes.byteLength} mime=${mime}`);
    return { configured: true, ok: true, url, mime, bytes: bytes.byteLength, ms };
  } finally {
    clearTimeout(timer);
  }
}
