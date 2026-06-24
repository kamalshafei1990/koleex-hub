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
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
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
  } catch (e) {
    console.error("[sa-notify.notifySuperAdmins]", e instanceof Error ? e.message : e);
  }
}
