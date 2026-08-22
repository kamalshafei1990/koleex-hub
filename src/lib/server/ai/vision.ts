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

   · The vision model is a REASONING model. Its first reply came back with
     `content: ""` and the entire answer sitting in `reasoning_content` —
     wired naively, the user would see an empty message and conclude the
     feature is broken. Both fields are read, content first.

   · It therefore needs headroom. A trivial test image (two shapes and two
     words) spent 637 tokens, most of them thinking. A real photograph needs
     more, so the budget is generous and the timeout long.

   · The model id ends in `-exp`. It can change or vanish without notice, so
     a failure here must degrade to "I couldn't read that image" and never
     take the chat turn down with it. Every path returns null instead of
     throwing.
   --------------------------------------------------------------------------- */

const VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL || "deepseek-v4-flash-vision-exp";
const ENDPOINT = "https://api.deepseek.com/chat/completions";
/* Generous, because the reasoning tokens are spent before the answer starts. */
const MAX_TOKENS = 2000;
/* Long, for the same reason — and because a phone photo is a big upload. */
const TIMEOUT_MS = 60_000;

/* What we ask for. Deliberately CONCRETE: a free-form "describe this" invites
   a paragraph of impressions, and what the Hub needs is the things a person
   would have typed — the codes, the numbers, the plate text, the totals. */
const PROMPT = [
  "Describe this image for a colleague who cannot see it, so they can act on it.",
  "Be literal and complete. Transcribe EVERY piece of visible text exactly as written —",
  "model codes, serial numbers, part numbers, brand names, invoice numbers, dates,",
  "quantities, currencies and totals — and keep the original language of the text.",
  "If it is a machine, say what kind of machine it appears to be and describe its",
  "visible parts. If it is a document, invoice or table, reproduce its content in",
  "reading order, keeping rows and columns aligned as plain text.",
  "Do not guess at anything you cannot actually see, and say so where the image is",
  "unclear or cut off.",
].join(" ");

export interface VisionResult {
  text: string;
  model: string;
}

/**
 * Read an image and return a written description, or null when the image
 * cannot be read for any reason (no key, model gone, timeout, empty answer).
 * Never throws — the caller is inside a chat turn that must survive.
 */
export async function describeImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<VisionResult | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  /* Buffer.toString("base64") rather than a manual btoa dance: this runs on
     the server, and the manual route is where large images blow the stack. */
  const b64 = Buffer.from(bytes).toString("base64");
  const mime = /^image\/(png|jpeg|jpg|webp|gif)$/.test(mimeType) ? mimeType : "image/png";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.error("[ai.vision] http", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json = (await res.json()) as {
      model?: string;
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
      console.error("[ai.vision] empty answer", json.choices?.[0]?.finish_reason);
      return null;
    }
    return { text, model: json.model || VISION_MODEL };
  } catch (e) {
    console.error("[ai.vision] failed", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
