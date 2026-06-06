"use client";

/* ---------------------------------------------------------------------------
   QA realtime subscriptions

   Live INSERT/UPDATE/DELETE feed for qa_issue_reports. Mirrors the pattern
   used in subscribeToInboxMessages (src/lib/inbox.ts): one channel per
   subscriber to avoid React strict-mode double-mounts colliding, with a
   reconnect timer on CHANNEL_ERROR / TIMED_OUT.

   The table is in the supabase_realtime publication via migration
   `qa_reports_to_realtime_publication`.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

type Channel = ReturnType<typeof supabase.channel>;

/** Subscribe to ANY change on qa_issue_reports. Useful for the admin list
 *  page, which wants to refresh whenever anything changes — direct DB writes
 *  (Koleex AI auto-fix via MCP), PATCH from another tab, anything. */
export function subscribeToQaReports(onChange: () => void): () => void {
  let currentChannel: Channel | null = null;
  let reconnectTimer: number | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const topic = `qa-reports:${suffix}`;
    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_issue_reports" },
        () => { try { onChange(); } catch { /* swallow consumer errors */ } },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!closed && reconnectTimer == null) {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              try { if (currentChannel) supabase.removeChannel(currentChannel); } catch { /* */ }
              connect();
            }, 1500);
          }
        }
      });
    currentChannel = ch;
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer != null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    try { if (currentChannel) supabase.removeChannel(currentChannel); } catch { /* */ }
    currentChannel = null;
  };
}

/** Subscribe to changes on a SINGLE issue. Used by the reporter view so the
 *  "Verify / Reopen" banner appears immediately when status flips to fixed,
 *  without the reporter having to refresh. */
export function subscribeToQaReport(
  issueId: string,
  onChange: () => void,
): () => void {
  let currentChannel: Channel | null = null;
  let reconnectTimer: number | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const topic = `qa-report:${issueId}:${suffix}`;
    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "qa_issue_reports", filter: `id=eq.${issueId}` },
        () => { try { onChange(); } catch { /* swallow */ } },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!closed && reconnectTimer == null) {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              try { if (currentChannel) supabase.removeChannel(currentChannel); } catch { /* */ }
              connect();
            }, 1500);
          }
        }
      });
    currentChannel = ch;
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer != null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    try { if (currentChannel) supabase.removeChannel(currentChannel); } catch { /* */ }
    currentChannel = null;
  };
}
