import "server-only";

/* ---------------------------------------------------------------------------
   ai/vision — turn an image into words, so the rest of Koleex AI can carry on
   treating a conversation as text.

   WHY IT LOOKS LIKE THIS. The attachment pipeline's whole job is "extract
   readable text so it can ride along with the chat turn". An image has no
   text to extract, so this module makes some: the picture goes to a
   vision model once, and its description enters the conversation exactly
   where a PDF's text layer would. Every tool, permission check and audit
   entry downstream keeps working unchanged, and a follow-up question lands
   on the description that is already in the thread.

   The alternative — carrying the image through the whole pipeline to the
   model on every turn — would mean touching the router, the orchestrator and
   every provider adapter, and would re-upload the picture on each message.
   This is the smaller, honest fit.

   THREE THINGS MEASURED AGAINST THE LIVE API (2026-08-22) THAT SHAPE IT:

   · The default vision model is a REASONING model. Its first reply came back
     with `content: ""` and the entire answer sitting in `reasoning_content` —
     wired naively, the user would see an empty message and conclude the
     feature is broken. Both fields are read, content first.

   · It therefore needs headroom. A trivial test image (two shapes and two
     words) spent 637 tokens, most of them thinking. A real photograph needs
     more, so the budget is generous and the timeout long.

   · The model id ends in `-exp`. It can change or vanish without notice, so
     a failure here must degrade to "I couldn't read that image" and never
     take the chat turn down with it. Every path returns null instead of
     throwing.

   TEST ROUND, 2026-09-04 — "the AI takes a long time until it understands
   the photo". Two things made it slow, and both are addressed here:

   · The reading was a free-standing essay: three paragraphs for a screenshot,
     because the prompt asked for everything. The user's own question now
     rides with the picture, the reading answers THAT first, and the full
     transcription is asked for only where a document or table needs it.
     Fewer output tokens is the single biggest lever on a model's latency.

   · The provider was fixed. A second, OpenAI-compatible vision provider can
     now be configured in the environment (AI_VISION_BASE_URL / _API_KEY /
     _MODEL) and is tried FIRST when set — a non-reasoning vision model
     answers in a fraction of the time, and a mainland-hosted one sits closer
     to the users. The default provider stays as the fallback, so an unset
     deployment behaves exactly as before. The vendor is configuration, not
     code, per the standing rule against hard-coding one provider.
   --------------------------------------------------------------------------- */

const DEFAULT_MODEL = process.env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp";
const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";
/* Generous, because the reasoning tokens are spent before the answer starts. */
const MAX_TOKENS = 2000;
/* Long, for the same reason — and because a phone photo is a big upload. */
const TIMEOUT_MS = 60_000;
/** The user's question travels into the prompt: their own words, capped. */
const QUESTION_MAX = 300;

/* ── The configured provider ──────────────────────────────────────────────── */

export interface VisionEnv {
  AI_VISION_BASE_URL?: string;
  AI_VISION_API_KEY?: string;
  AI_VISION_MODEL?: string;
}

export interface VisionProvider {
  /** Full chat-completions URL. */
  url: string;
  model: string;
  /** Host name only — for logs, never for the conversation. */
  label: string;
}

/** null means not configured — the normal state, not an error. The key is
 *  checked for PRESENCE only and never carried in the returned config. The
 *  base URL is the OpenAI-compatible root (…/v1); this appends the path.
 *  HTTPS is required: the key travels in a header. Pure. */
export function parseVisionConfig(env: VisionEnv): VisionProvider | null {
  const base = env.AI_VISION_BASE_URL?.trim();
  const model = env.AI_VISION_MODEL?.trim();
  const hasKey = Boolean(env.AI_VISION_API_KEY?.trim());
  if (!base || !model || !hasKey) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const root = base.replace(/\/+$/, "");
  return {
    url: /\/chat\/completions$/.test(root) ? root : `${root}/chat/completions`,
    model,
    label: url.hostname,
  };
}

function readVisionEnv(): VisionEnv {
  return {
    AI_VISION_BASE_URL: process.env.AI_VISION_BASE_URL,
    AI_VISION_API_KEY: process.env.AI_VISION_API_KEY,
    AI_VISION_MODEL: process.env.AI_VISION_MODEL,
  };
}

/* ── The prompt ───────────────────────────────────────────────────────────── */

/** One line of the user's own words, for the prompt: newlines collapsed,
 *  capped, quotes kept as text. Pure. */
export function questionForPrompt(raw: string | undefined | null): string {
  const q = (raw ?? "").replace(/\s+/g, " ").trim();
  return q.length > QUESTION_MAX ? `${q.slice(0, QUESTION_MAX)}…` : q;
}

/* What we ask for. Deliberately CONCRETE: a free-form "describe this" invites
   a paragraph of impressions, and what the Hub needs is the things a person
   would have typed — the codes, the numbers, the plate text, the totals.
   With the user's question in hand, the reading answers it FIRST and stays
   short; the full reading-order transcription is reserved for documents,
   invoices and tables, where every line is the point. Pure. */
export function buildVisionPrompt(question: string): string {
  const lead = question
    ? `A colleague who cannot see this image asked: "${question}". Describe what they need in order to answer that, first and briefly.`
    : "Describe this image for a colleague who cannot see it, so they can act on it.";
  return [
    lead,
    "Be literal. Transcribe the visible text that matters exactly as written —",
    "model codes, serial numbers, part numbers, brand names, invoice numbers, dates,",
    "quantities, currencies and totals — and keep the original language of the text.",
    "If it is a machine, say what kind of machine it appears to be and name its visible parts.",
    "If it is a document, invoice or table, reproduce its content in reading order,",
    "keeping rows and columns aligned as plain text; otherwise keep the whole reading",
    "under 150 words. Do not guess at anything you cannot actually see, and say so",
    "where the image is unclear or cut off.",
  ].join(" ");
}

/* No model id on the way out. It was here so the caller could label the
   reading, and the label went straight into the conversation — which is a
   leak of exactly the kind the standing identity rule forbids. The provider
   stays inside this file; callers get words. */
export interface VisionResult {
  text: string;
}

async function askProvider(
  provider: VisionProvider,
  key: string,
  prompt: string,
  dataUrl: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(provider.url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: MAX_TOKENS,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.error("[ai.vision] http", provider.label, res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json = (await res.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string | null; reasoning_content?: string | null };
      }>;
    };
    const msg = json.choices?.[0]?.message;
    /* content FIRST — reasoning_content is the model thinking aloud, and is
       only worth showing when the budget ran out before the real answer
       started. Better a partial reading than a blank reply. */
    const text = (msg?.content || "").trim() || (msg?.reasoning_content || "").trim();
    if (!text) {
      console.error("[ai.vision] empty answer", provider.label, json.choices?.[0]?.finish_reason);
      return null;
    }
    /* Counts only: how long, how much. Never the reading itself. */
    console.log(`[ai.vision] ok via=${provider.label} ms=${Date.now() - t0} chars=${text.length}`);
    return text;
  } catch (e) {
    console.error("[ai.vision] failed", provider.label, `ms=${Date.now() - t0}`, e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read an image and return a written description, or null when the image
 * cannot be read for any reason (no key, model gone, timeout, empty answer).
 * Never throws — the caller is inside a chat turn that must survive.
 *
 * The configured provider (AI_VISION_*) is tried first when set; the default
 * provider answers when there is none, or when the configured one fails.
 */
export async function describeImage(
  bytes: Uint8Array,
  mimeType: string,
  opts?: { question?: string | null },
): Promise<VisionResult | null> {
  const configured = parseVisionConfig(readVisionEnv());
  const configuredKey = process.env.AI_VISION_API_KEY?.trim() || "";
  const defaultKey = process.env.DEEPSEEK_API_KEY;
  if (!configured && !defaultKey) return null;

  /* Buffer.toString("base64") rather than a manual btoa dance: this runs on
     the server, and the manual route is where large images blow the stack. */
  const b64 = Buffer.from(bytes).toString("base64");
  const mime = /^image\/(png|jpeg|jpg|webp|gif)$/.test(mimeType) ? mimeType : "image/png";
  const dataUrl = `data:${mime};base64,${b64}`;
  const prompt = buildVisionPrompt(questionForPrompt(opts?.question));

  if (configured) {
    const text = await askProvider(configured, configuredKey, prompt, dataUrl);
    if (text) return { text };
  }
  if (defaultKey) {
    const text = await askProvider(
      { url: DEFAULT_ENDPOINT, model: DEFAULT_MODEL, label: "default" },
      defaultKey,
      prompt,
      dataUrl,
    );
    if (text) return { text };
  }
  return null;
}
