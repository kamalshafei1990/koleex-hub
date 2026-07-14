import "server-only";

/* ---------------------------------------------------------------------------
   notifySuperAdmins — fan out a Super-Admin alert into inbox_messages.

   Reuses the existing notification center + NotificationBell + realtime
   (category 'alert'); no parallel notification UI. Best-effort: a notification
   write must never block the action that triggered it.

   Respects notification_preferences per recipient: prefs[kind].inapp === false
   suppresses the in-app alert for that admin. Default = on.

   metadata shape: { sam: true, kind, severity, actor, ...extra } so the bell /
   inbox can recognise Super-Admin security alerts.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";

export type AlertKind =
  | "login"
  | "new_device"
  | "new_ip"
  | "failed_login_threshold"
  | "data_delete"
  | "price_cost_change"
  | "sensitive_export"
  | "admin_role_change"
  | "settings_change"
  | "file_change"
  | "suspicious";

export interface SaAlert {
  kind: AlertKind;
  subject: string;
  body?: string | null;
  severity?: "info" | "warning" | "critical";
  link?: string | null;
  /** The account that triggered the alert (becomes sender; excluded as recipient). */
  actorAccountId?: string | null;
  /** Display name of the actor → used as the push notification's bold title
   *  ("Koleex Hub" › actor name › action). Resolved from actorAccountId if omitted. */
  actorName?: string | null;
  /** Short human action for the push body, e.g. "Signed in", "Deleted a product".
   *  Falls back to `subject` when omitted. */
  action?: string | null;
  /** Where it happened, e.g. "Singapore" or "Belgrade, Serbia". Appended to the
   *  push body as "… · from {location}". */
  location?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
}

/* The mobile push reads as three lines on the iPhone lock screen, matching the
   Wix-style format Kamal asked for:
     Koleex Hub            ← the PWA name (supplied automatically by iOS)
     {actor name}          ← push title (bold)
     {action} · from {loc} ← push body
   so we deliberately DON'T set title to "Koleex Hub" (that would duplicate the
   app-name line); the actor's name goes in the title instead. */
function buildPushPayload(alert: SaAlert, actorName: string | null) {
  const actionText = alert.action || alert.subject;
  const body = alert.location ? `${actionText} · from ${alert.location}` : actionText;
  return {
    title: actorName || "Koleex Hub",
    body,
    url: alert.link ?? "/super-admin/activity",
    tag: alert.kind,
    kind: alert.kind,
  };
}

/** Resolve an account's display name (people.full_name › username › email). */
async function resolveActorName(id?: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    const { data } = await supabaseServer
      .from("accounts")
      .select("username, login_email, person_id")
      .eq("id", id)
      .maybeSingle();
    const acc = data as
      | { username: string | null; login_email: string | null; person_id: string | null }
      | null;
    if (!acc) return null;
    if (acc.person_id) {
      const { data: p } = await supabaseServer
        .from("people")
        .select("full_name")
        .eq("id", acc.person_id)
        .maybeSingle();
      const full = (p as { full_name: string | null } | null)?.full_name;
      if (full) return full;
    }
    return acc.username || acc.login_email || null;
  } catch {
    return null;
  }
}

/** Send a Web Push to every Super Admin's devices (no in-app row). The actor is
 *  excluded. Thin convenience wrapper around sendPushToAccounts() — note that
 *  notifySuperAdmins() already does both in-app + push with per-recipient
 *  preference filtering; use this only when you want push-only delivery. */
export async function sendPushToSuperAdmins(alert: SaAlert): Promise<void> {
  try {
    const admins = await superAdminAccountIds(alert.tenantId);
    const targets = admins.filter((id) => id !== alert.actorAccountId);
    if (targets.length === 0) return;
    const actorName = alert.actorName ?? (await resolveActorName(alert.actorAccountId));
    await sendPushToAccounts(targets, buildPushPayload(alert, actorName), {
      actorAccountId: alert.actorAccountId,
    });
  } catch (e) {
    console.error("[sa-notify.sendPushToSuperAdmins]", e instanceof Error ? e.message : e);
  }
}

/** Effective Super-Admin account ids in a tenant (account flag OR role flag). */
export async function superAdminAccountIds(tenantId?: string | null): Promise<string[]> {
  let q = supabaseServer
    .from("accounts")
    .select("id, is_super_admin, status, role:role_id ( is_super_admin )")
    .eq("status", "active");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) {
    console.error("[sa-notify.superAdminAccountIds]", error.message);
    return [];
  }
  type Row = {
    id: string;
    is_super_admin: boolean | null;
    role: { is_super_admin: boolean | null } | Array<{ is_super_admin: boolean | null }> | null;
  };
  return ((data ?? []) as Row[])
    .filter((r) => {
      const role = Array.isArray(r.role) ? r.role[0] : r.role;
      return (r.is_super_admin ?? false) || (role?.is_super_admin ?? false);
    })
    .map((r) => r.id);
}

/** Per-account preference lookup: returns the set of account ids that have
 *  explicitly DISABLED in-app alerts for this kind (everyone else = on). */
async function suppressedRecipients(ids: string[], kind: AlertKind): Promise<Set<string>> {
  const off = new Set<string>();
  if (ids.length === 0) return off;
  const { data } = await supabaseServer
    .from("notification_preferences")
    .select("account_id, prefs")
    .in("account_id", ids);
  for (const row of (data ?? []) as Array<{ account_id: string; prefs: Record<string, unknown> }>) {
    const pref = row.prefs?.[kind] as { inapp?: boolean } | undefined;
    if (pref && pref.inapp === false) off.add(row.account_id);
  }
  return off;
}

export async function notifySuperAdmins(alert: SaAlert): Promise<void> {
  try {
    const admins = await superAdminAccountIds(alert.tenantId);
    const recipients = admins.filter((id) => id !== alert.actorAccountId);
    if (recipients.length === 0) return;

    const off = await suppressedRecipients(recipients, alert.kind);
    const rows = recipients
      .filter((id) => !off.has(id))
      .map((id) => ({
        recipient_account_id: id,
        sender_account_id: alert.actorAccountId ?? null,
        category: "alert" as const,
        subject: alert.subject,
        body: alert.body ?? null,
        link: alert.link ?? "/super-admin/activity",
        metadata: {
          sam: true,
          kind: alert.kind,
          severity: alert.severity ?? "info",
          actor: alert.actorAccountId ?? null,
          ...(alert.metadata ?? {}),
        },
      }));
    if (rows.length === 0) return;
    await supabaseServer.from("inbox_messages").insert(rows);
    await emitPings(rows.map((r) => ({ topic: rtTopic.inbox((r as { recipient_account_id: string }).recipient_account_id) })));

    // Also deliver as a Web Push to those recipients' devices (iPhone lock
    // screen / Notification Center, even when the app is closed). Best-effort;
    // no-op if VAPID keys aren't configured. Recipients = same in-app set.
    const pushTargets = recipients.filter((id) => !off.has(id));
    if (pushTargets.length) {
      const actorName = alert.actorName ?? (await resolveActorName(alert.actorAccountId));
      await sendPushToAccounts(pushTargets, buildPushPayload(alert, actorName), {
        actorAccountId: alert.actorAccountId,
      });
    }
  } catch (e) {
    console.error("[sa-notify.notifySuperAdmins]", e instanceof Error ? e.message : e);
  }
}
