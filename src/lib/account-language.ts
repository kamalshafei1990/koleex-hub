/* ---------------------------------------------------------------------------
   account-language — the account knows which language its person reads.

   The interface language lives on the device (localStorage "koleex-lang"),
   so the server never saw it, and a push notification could only ever be
   English. Each device now tells the account the language it reads in —
   `preferences.language`, until now a dead admin-only field — and web-push
   writes every templated notification in it.

   Cheap by construction: one PATCH per device per change, after the network
   is quiet, merged server-side into that one key (account_prefs_merge). It
   is re-affirmed every few days, because a settings screen that still saves
   the whole preferences bag from an older copy can put a stale value back.
   Never during view-as (the account on screen is not the one on the device)
   and never before the session is known.
   --------------------------------------------------------------------------- */
import type { Lang } from "@/lib/i18n";
import { getCurrentAccountIdSync } from "@/lib/identity";
import { currentScopeKey } from "@/lib/me-bootstrap";
import { whenNetworkQuiet } from "@/lib/net-idle";

const MARK = "kx:acct-lang";
const REAFFIRM_MS = 3 * 24 * 60 * 60 * 1000;

type Mark = { id: string; lang: Lang; at: number };

export async function syncAccountLanguage(lang: Lang): Promise<void> {
  try {
    await whenNetworkQuiet({ quietMs: 800, maxWaitMs: 10_000 });
    const id = getCurrentAccountIdSync();
    if (!id || !currentScopeKey().endsWith(":self")) return;
    let mark: Mark | null = null;
    try { mark = JSON.parse(localStorage.getItem(MARK) ?? "null") as Mark | null; } catch { /* unreadable = unsynced */ }
    if (mark && mark.id === id && mark.lang === lang && Date.now() - mark.at < REAFFIRM_MS) return;
    const res = await fetch(`/api/accounts/${id}/preferences`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { language: lang } }),
    });
    if (!res.ok) return;
    try { localStorage.setItem(MARK, JSON.stringify({ id, lang, at: Date.now() } satisfies Mark)); } catch { /* full or private: re-sync next time */ }
  } catch {
    /* best effort: the next load tries again */
  }
}
