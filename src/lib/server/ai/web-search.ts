import "server-only";

/* ---------------------------------------------------------------------------
   web-search — the one place Koleex AI reaches the public internet.

   Until now the composer's globe button set a `webSearch` flag that no server
   code ever read, so the model answered "what's the weather in Cairo?" with
   an apology while a control sat there implying otherwise. This module is the
   real thing behind that control.

   TWO PROVIDERS, whichever key is configured:
     · TAVILY_API_KEY        — built for LLM grounding; returns clean extracts
     · BRAVE_SEARCH_API_KEY  — independent index, generous free tier
   Tavily wins if both are set. With NEITHER set the module reports
   `configured: false` and the caller degrades honestly — it must never
   pretend to have searched.

   The request leaves Vercel (hnd1, Tokyo), not the user's browser, so a
   provider that is unreachable from mainland China is still fine for staff
   there — and no user IP, account id or session ever reaches the provider.
   Only the query text does, which is why the tool that calls this is
   documented as PUBLIC-INFORMATION-ONLY: never send it customer names,
   prices, or anything from the tenant's own records.
   --------------------------------------------------------------------------- */

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  /** ISO date when the provider knows one — lets the model say how fresh a
   *  claim is instead of stating a stale number as current. */
  published?: string;
}

/** A picture the search found, for a user who asked to SEE something. https
 *  only: it will be loaded by the user's browser straight from its host. */
export interface WebImage {
  url: string;
  /** The provider's caption when it offers one; otherwise the query. */
  description: string;
}

export interface WebSearchOutcome {
  configured: boolean;
  provider: "tavily" | "brave" | null;
  results: WebResult[];
  /** Empty for a provider that returns none (Brave, today). */
  images: WebImage[];
  /** Tavily's own one-line synthesis, when it offers one. */
  answer?: string;
  error?: string;
}

const TIMEOUT_MS = 8_000;
/* THE RETRY WITHOUT PICTURES. Two real lookups — "Cairo International
   Stadium", "Zamalek SC jersey" — died at the 8s ceiling with pictures asked
   for, and the caller was told there was nothing. A search that has already
   spent the ceiling gets one more, shorter chance for the TEXT alone: a
   picture is a nicety, an answer is the product. */
const RETRY_TIMEOUT_MS = 6_000;
const MAX_RESULTS = 6;
const MAX_QUERY = 300;
const MAX_SNIPPET = 500;
/* Pictures are for a person who asked to see something, not a gallery. The
   answer shows at most two; the model chooses from these. */
const MAX_IMAGES = 4;

/** https only, and nothing a URL could smuggle into a markdown image. */
function imageUrl(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^https:\/\/[^\s"'<>()]+$/i.test(s) ? s : null;
}

/** Tavily returns `images` as bare URL strings, or as objects when
 *  descriptions were asked for. Both shapes are read; neither is trusted. */
function parseImages(raw: unknown, fallbackLabel: string): WebImage[] {
  if (!Array.isArray(raw)) return [];
  const out: WebImage[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const url = imageUrl(typeof item === "string" ? item : (item as { url?: unknown })?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const desc = typeof item === "object" && item ? trim((item as { description?: unknown }).description, 160) : "";
    out.push({ url, description: desc || fallbackLabel });
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/* A PICTURE THAT DOES NOT LOAD IS WORSE THAN NO PICTURE. Two of the stadium
   pictures a call showed were broken icons: a dead link and a host that
   refuses hot-linking. The provider does not check its image URLs, so we do
   — one HEAD per candidate, in parallel, a short deadline, and only a 2xx
   with an image content-type survives. The whole check is bounded so a slow
   host costs the answer at most this long, once. Injectable for the suite. */
export const IMAGE_CHECK_TIMEOUT_MS = 1_500;
export async function filterLoadableImages(
  images: WebImage[],
  fetchFn: (url: string, init: RequestInit) => Promise<{ ok: boolean; headers: { get(name: string): string | null } }> = fetch,
  timeoutMs = IMAGE_CHECK_TIMEOUT_MS,
): Promise<WebImage[]> {
  if (images.length === 0) return images;
  const checks = images.map(async (img) => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    /* THE DEADLINE IS RACED, NOT ONLY SIGNALLED. A fetch that ignores its
       abort signal (a proxy, a test double, an odd runtime) would otherwise
       hold the whole answer hostage; at the deadline the picture is simply
       dropped, whatever the request is still doing. */
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => { ctrl.abort(); resolve(null); }, timeoutMs);
    });
    try {
      const res = await Promise.race([
        fetchFn(img.url, { method: "HEAD", signal: ctrl.signal, redirect: "follow", cache: "no-store" }),
        deadline,
      ]);
      if (!res) return null;
      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      return res.ok && type.startsWith("image/") ? img : null;
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
  return (await Promise.all(checks)).filter((i): i is WebImage => i !== null);
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError" || /aborted/i.test(e.message));
}

function trim(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/* ---------------------------------------------------------------------------
   A MACHINE IS NEVER A WEB PICTURE. The owner asked a call for "a manual heat
   press machine photo" and got four pictures of other manufacturers'
   presses from the web — the one thing this product must never do, and a
   prompt rule had already said so. A rule the model follows only sometimes
   is not a rule; this is the deterministic one. A query that names a
   machine, a press, a cutter, a sewing or printing device — in any of the
   three languages — is a PRODUCT question: the text results may still come
   back as reference material, the pictures do not, and the note beside the
   result sends the model to the product tools, where Koleex's own photos
   are. Exported so the suite can prove the vocabulary. */
const MACHINE_QUERY =
  /(machine|machines|press|presses|printer|printers|cutter|cutters|spreader|spreaders|sewing|overlock|lockstitch|embroidery|laminat|sublimation|heat\s*transfer|dtf|dtg|plotter|fusing|fuser|loom|knitting|equipment|apparatus|ماكين|مكبس|مكابس|طابع|قطاعة|معدات|فرد|تطريز|خياطة|أوفرلوك|اوفرلوك|ترانسفر|ترانسفير|机|机器|压机|热转印|印花机|裁床|缝纫|刷线|绖花|设备)/i;

export function isMachineQuery(query: string): boolean {
  return MACHINE_QUERY.test(query ?? "");
}

/** A search must never hang a chat turn. */
async function fetchJson(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`search provider returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(key: string, query: string, withImages: boolean, timeoutMs: number): Promise<WebSearchOutcome> {
  const json = (await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS,
      search_depth: "basic",
      include_answer: true,
      /* Pictures ride along on the same call — no second provider, no
         second request, no second key. DESCRIPTIONS ARE NOT ASKED FOR:
         the provider generates them, and that is where the seconds went
         on the lookups that timed out. The query captions the picture. */
      include_images: withImages,
      include_image_descriptions: false,
    }),
  }, timeoutMs)) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
    images?: unknown;
  };

  return {
    configured: true,
    provider: "tavily",
    answer: trim(json.answer, MAX_SNIPPET) || undefined,
    images: await filterLoadableImages(parseImages(json.images, query)),
    results: (json.results ?? [])
      .filter((r) => typeof r.url === "string" && r.url)
      .slice(0, MAX_RESULTS)
      .map((r) => ({
        title: trim(r.title, 160) || r.url!,
        url: r.url!,
        snippet: trim(r.content, MAX_SNIPPET),
        published: trim(r.published_date, 40) || undefined,
      })),
  };
}

async function searchBrave(key: string, query: string): Promise<WebSearchOutcome> {
  const url =
    "https://api.search.brave.com/res/v1/web/search?count=" +
    MAX_RESULTS +
    "&q=" +
    encodeURIComponent(query);
  const json = (await fetchJson(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  })) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
  };

  return {
    configured: true,
    provider: "brave",
    /* Brave's web endpoint carries no pictures; its image endpoint is a
       second request and a second quota, deliberately not taken here. */
    images: [],
    results: (json.web?.results ?? [])
      .filter((r) => typeof r.url === "string" && r.url)
      .slice(0, MAX_RESULTS)
      .map((r) => ({
        title: trim(r.title, 160) || r.url!,
        url: r.url!,
        /* Brave marks up matched terms with <strong>; strip the tags so no
           markup reaches the prompt or the rendered source list. */
        snippet: trim(String(r.description ?? "").replace(/<[^>]*>/g, ""), MAX_SNIPPET),
        published: trim(r.age, 40) || undefined,
      })),
  };
}

/** True when the deployment has a search key at all. Lets the UI show the
 *  globe control as unavailable instead of silently doing nothing. */
export function webSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY);
}

export interface WebSearchOptions {
  /** Ask the provider for pictures. OFF unless the caller says the user asked
   *  to SEE something: "what is the date today" came back with two calendar
   *  pictures and a slower search, for a question words answer in one line. */
  images?: boolean;
}

export async function searchWeb(rawQuery: string, opts: WebSearchOptions = {}): Promise<WebSearchOutcome> {
  const query = trim(rawQuery, MAX_QUERY);
  if (!query) {
    return { configured: webSearchConfigured(), provider: null, results: [], images: [], error: "empty query" };
  }

  const tavily = process.env.TAVILY_API_KEY;
  const brave = process.env.BRAVE_SEARCH_API_KEY;
  if (!tavily && !brave) {
    return { configured: false, provider: null, results: [], images: [] };
  }

  try {
    if (!tavily) return await searchBrave(brave!, query);
    /* MACHINES GET NO PICTURES AT SOURCE — see isMachineQuery. Everything
       else asks for them once; if that attempt runs out the ceiling, the
       text is asked for again, alone, so the caller still gets an answer. */
    const withImages = opts.images === true && !isMachineQuery(query);
    try {
      return await searchTavily(tavily, query, withImages, TIMEOUT_MS);
    } catch (first) {
      if (!withImages || !isAbort(first)) throw first;
      console.warn("[ai.web-search] timed out with pictures — retrying for the text alone");
      return await searchTavily(tavily, query, false, RETRY_TIMEOUT_MS);
    }
  } catch (e) {
    /* A dead provider must degrade to "I couldn't check", never to a
       confident answer from stale model memory. The key is never logged. */
    const msg = e instanceof Error ? e.message : "search failed";
    console.warn("[ai.web-search]", msg);
    return {
      configured: true,
      provider: tavily ? "tavily" : "brave",
      results: [],
      images: [],
      error: msg,
    };
  }
}
