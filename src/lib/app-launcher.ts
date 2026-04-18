"use client";

/* ---------------------------------------------------------------------------
   app-launcher — CRUD helpers for the App Launcher's per-user
   favorites and recent-apps tracking.

   Tables:
     koleex_app_favorites  (account_id, app_id, created_at)
     koleex_app_recent     (account_id, app_id, opened_at)

   All functions take an explicit accountId so the caller decides the
   identity source (getCurrentAccountIdSync, useCurrentAccount, etc.).
   --------------------------------------------------------------------------- */

import { supabaseAdmin } from "./supabase-admin";

/* ═══════════════════════════════════════════════════
   FAVORITES
   ═══════════════════════════════════════════════════ */

export async function fetchFavorites(accountId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_app_favorites")
    .select("app_id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[app-launcher] fetchFavorites error:", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => r.app_id);
}

export async function addFavorite(
  accountId: string,
  appId: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("koleex_app_favorites")
    .upsert(
      { account_id: accountId, app_id: appId },
      { onConflict: "account_id,app_id" },
    );

  if (error) {
    console.error("[app-launcher] addFavorite error:", error.message);
    return false;
  }
  return true;
}

export async function removeFavorite(
  accountId: string,
  appId: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("koleex_app_favorites")
    .delete()
    .eq("account_id", accountId)
    .eq("app_id", appId);

  if (error) {
    console.error("[app-launcher] removeFavorite error:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════
   RECENT APPS
   ═══════════════════════════════════════════════════ */

/** Fetch up to `limit` most-recently-opened app IDs. */
export async function fetchRecent(
  accountId: string,
  limit = 8,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("koleex_app_recent")
    .select("app_id")
    .eq("account_id", accountId)
    .order("opened_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[app-launcher] fetchRecent error:", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => r.app_id);
}

/** Record (or bump) an app open. Upserts so we keep only one row per app. */
export async function trackAppOpen(
  accountId: string,
  appId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("koleex_app_recent")
    .upsert(
      { account_id: accountId, app_id: appId, opened_at: new Date().toISOString() },
      { onConflict: "account_id,app_id" },
    );

  if (error) {
    console.error("[app-launcher] trackAppOpen error:", error.message);
  }
}
