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

export interface WebSearchOutcome {
  configured: boolean;
  provider: "tavily" | "brave" | null;
  results: WebResult[];
  /** Tavily's own one-line synthesis, when it offers one. */
  answer?: string;
  error?: string;
}

const TIMEOUT_MS = 8_000;
const MAX_RESULTS = 6;
const MAX_QUERY = 300;
const MAX_SNIPPET = 500;

function trim(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** A search must never hang a chat turn. */
async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`search provider returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(key: string, query: string): Promise<WebSearchOutcome> {
  const json = (await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS,
      search_depth: "basic",
      include_answer: true,
    }),
  })) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
  };

  return {
    configured: true,
    provider: "tavily",
    answer: trim(json.answer, MAX_SNIPPET) || undefined,
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

export async function searchWeb(rawQuery: string): Promise<WebSearchOutcome> {
  const query = trim(rawQuery, MAX_QUERY);
  if (!query) {
    return { configured: webSearchConfigured(), provider: null, results: [], error: "empty query" };
  }

  const tavily = process.env.TAVILY_API_KEY;
  const brave = process.env.BRAVE_SEARCH_API_KEY;
  if (!tavily && !brave) {
    return { configured: false, provider: null, results: [] };
  }

  try {
    return tavily ? await searchTavily(tavily, query) : await searchBrave(brave!, query);
  } catch (e) {
    /* A dead provider must degrade to "I couldn't check", never to a
       confident answer from stale model memory. The key is never logged. */
    const msg = e instanceof Error ? e.message : "search failed";
    console.warn("[ai.web-search]", msg);
    return {
      configured: true,
      provider: tavily ? "tavily" : "brave",
      results: [],
      error: msg,
    };
  }
}
