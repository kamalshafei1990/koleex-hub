import "server-only";

/* ---------------------------------------------------------------------------
   notifySuperAdmins — fan out a Super-Admin alert into inbox_messages.

   Reuses the existing notification center + NotificationBell + realtime
   (category 'alert'); no parallel notification UI. Best-effort: a notification
   write must never block the action that triggered it.

   Two preference stores gate the in-app row, both default-on:
     · notification_preferences.prefs[kind].inapp === false — the per-kind
       switches in the Super-Admin "Alert preferences" modal.
     · accounts.preferences.notifications.security_alerts === false — the
       "Security alerts" switch in Settings → Notifications, which covers the
       sign-in noise family only (see suppressedRecipients).

   metadata shape: { sam: true, kind, severity, actor, ...extra, tpl? } so the
   bell / inbox can recognise Super-Admin security alerts (and, with `tpl`,
   show them in the reader's language).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { prepareTpl, type NotifTpl } from "@/lib/notification-templates";

/* Every kind here has a live emitter: new_device (activity heartbeat),
   failed_login_threshold (signin), the rest from audit.ts alertKindForAction.
   "login" and "new_ip" were declared for years and emitted by nothing. */
export type AlertKind =
  | "new_device"
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
  /** What happened, rendered in each reader's language (notification-
   *  templates; words in translations/notif-templates/admin.ts). The stored
   *  subject — and body, when the template has one — are its English, byte
   *  for byte the sentence callers wrote before, so the dedupe and the
   *  supersede below (both keyed on the subject) behave exactly as before.
   *  Pass `subject` only for an alert with no template. */
  tpl?: NotifTpl;
  subject?: string;
  /** The stored body when the template has none. */
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
   app-name line); the actor's name goes in the title instead.

   A reader whose Hub is in Chinese or Arabic gets the alert's template in
   their language instead (web-push renders `tpl`) — but only where that
   template still says WHO: the new-device and failed-sign-in sentences name
   the account. An audited action's sentence ("Delete — product: …") does
   not, and a security push that drops who did it is worse than one in
   English, so those keep the English three lines. */
const PUSH_TEMPLATED: ReadonlySet<AlertKind> = new Set(["new_device", "failed_login_threshold"]);

function buildPushPayload(alert: SaAlert, subject: string, actorName: string | null, tpl: NotifTpl | null) {
  const actionText = alert.action || subject;
  const body = alert.location ? `${actionText} · from ${alert.location}` : actionText;
  const who = actorName || "Koleex Hub";
  return {
    title: who,
    body,
    url: alert.link ?? "/super-admin/activity",
    /* One lock-screen notification per kind, per person, per day: six
       deletions by one person fold into "Salt Leo — 6 alerts" (the device
       counts, public/sw.js), and a different person's alerts never overwrite
       them. The tag used to be the kind alone, so every deletion by anyone
       silently replaced the last one. */
    tag: `sa:${alert.kind}:${alert.actorAccountId ?? "-"}:${new Date().toISOString().slice(0, 10)}`,
    kind: alert.kind,
    tpl: PUSH_TEMPLATED.has(alert.kind) ? tpl : null,
    group: { tpl: { k: "push_group.alerts", p: { actor: who, n: "{n}" } } },
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
  /* The sign-in noise family answers to the "Security alerts" switch in
     Settings → Notifications (accounts.preferences), the same switch that
     already gates its push and chime — one switch, three channels. The
     sensitive admin kinds (data_delete, admin_role_change, sensitive_export,
     settings_change, file_change, price_cost_change) stay out of its reach
     on purpose: a super-admin silencing "someone deleted data" with a broad
     toggle is a hole, not a preference. They answer only to their own row
     in the Alert preferences modal (notification_preferences). */
  const UMBRELLA_KINDS: ReadonlySet<AlertKind> = new Set([
    "new_device", "failed_login_threshold", "suspicious",
  ]);
  const [{ data: kindRows }, { data: accountRows }] = await Promise.all([
    supabaseServer.from("notification_preferences").select("account_id, prefs").in("account_id", ids),
    UMBRELLA_KINDS.has(kind)
      ? supabaseServer.from("accounts").select("id, preferences").in("id", ids)
      : Promise.resolve({ data: [] as Array<{ id: string; preferences: unknown }> }),
  ]);
  for (const row of (kindRows ?? []) as Array<{ account_id: string; prefs: Record<string, unknown> | null }>) {
    const pref = row.prefs?.[kind] as { inapp?: boolean } | undefined;
    if (pref && pref.inapp === false) off.add(row.account_id);
  }
  for (const row of (accountRows ?? []) as Array<{ id: string; preferences: { notifications?: Record<string, unknown> } | null }>) {
    if (row.preferences?.notifications?.security_alerts === false) off.add(row.id);
  }
  return off;
}

export async function notifySuperAdmins(alert: SaAlert): Promise<void> {
  try {
    const admins = await superAdminAccountIds(alert.tenantId);
    const recipients = admins.filter((id) => id !== alert.actorAccountId);
    if (recipients.length === 0) return;

    const off = await suppressedRecipients(recipients, alert.kind);
    const text = alert.tpl ? prepareTpl(alert.tpl) : null;
    const subject = text?.subject ?? alert.subject ?? "";
    const body = text?.body ?? alert.body ?? null;
    const rows = recipients
      .filter((id) => !off.has(id))
      .map((id) => ({
        recipient_account_id: id,
        sender_account_id: alert.actorAccountId ?? null,
        category: "alert" as const,
        subject,
        body,
        link: alert.link ?? "/super-admin/activity",
        metadata: {
          sam: true,
          kind: alert.kind,
          severity: alert.severity ?? "info",
          actor: alert.actorAccountId ?? null,
          ...(alert.metadata ?? {}),
          ...(text?.tpl ? { tpl: text.tpl } : {}),
        },
      }));
    if (rows.length === 0) return;
    /* The SAME alert fired twice within seconds is one event, not two.
       Measured 26/09: 5 deletions raised their alert twice, 2 s apart. The
       supersede below already keeps only one unread row, but both calls
       still pushed — two phone notifications and two chimes for one delete.
       An identical subject to these recipients in the last minute ends it
       here, before the row and before the push. Best-effort: a failed check
       lets the alert through rather than risk losing it. */
    const since = new Date(Date.now() - 60_000).toISOString();
    let dupe = supabaseServer
      .from("inbox_messages")
      .select("id")
      .in("recipient_account_id", rows.map((r) => r.recipient_account_id))
      .eq("category", "alert")
      .eq("subject", subject)
      .gte("created_at", since);
    /* Same RECORD, not just the same words: two different products that
       share a name (the catalogue had duplicates) are two deletions. */
    const entityId = (alert.metadata as { entity_id?: unknown } | undefined)?.entity_id;
    if (entityId != null) dupe = dupe.eq("metadata->>entity_id", String(entityId));
    const { data: recent } = await dupe.limit(1);
    if (recent && recent.length > 0) return;
    /* Security alerts REPEAT ("xiang signed in" ×25 measured on the
       owner's inbox). The newest unread copy represents the series; the
       audit log keeps full history. Superseded by recipient+subject. */
    await supersedeUnread({
      recipients,
      category: "alert",
      subject,
    });
    await supabaseServer.from("inbox_messages").insert(rows);
    await emitPings(rows.map((r) => ({ topic: rtTopic.inbox((r as { recipient_account_id: string }).recipient_account_id) })));

    // Also deliver as a Web Push to those recipients' devices (iPhone lock
    // screen / Notification Center, even when the app is closed). Best-effort;
    // no-op if VAPID keys aren't configured. Recipients = same in-app set.
    const pushTargets = recipients.filter((id) => !off.has(id));
    if (pushTargets.length) {
      const actorName = alert.actorName ?? (await resolveActorName(alert.actorAccountId));
      await sendPushToAccounts(pushTargets, buildPushPayload(alert, subject, actorName, text?.tpl ?? null), {
        actorAccountId: alert.actorAccountId,
      });
    }
  } catch (e) {
    console.error("[sa-notify.notifySuperAdmins]", e instanceof Error ? e.message : e);
  }
}
