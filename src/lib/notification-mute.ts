/* ---------------------------------------------------------------------------
   notification-mute — which notifications are about a TOPIC a reader can
   mute ("Stop notifications about this": this task, this issue, this
   quotation…), and which types that silences.

   A topic is the metadata key a type's lifecycle already names (todo_id,
   entity_id, quotation_id…): the same key that settles it. Never mutable:
   a request that waits on the reader (severity action — an approval, an
   assignment), a Super-Admin security alert, a type with no Settings switch,
   and a type whose key is not one thing (subject, type, a list).

   Pure, and light on purpose — the push sender reads it, and that module
   sits on the cold start of sign-in and every audited route: registry only,
   never the template dictionary (notification-view imports it).
   The database applies a mute to every writer at once (the
   inbox_apply_mutes trigger, 20260927_notification_mutes.sql).
   --------------------------------------------------------------------------- */
import { NOTIFICATION_TYPES, notificationTypeDef, type NotificationTypeDef } from "@/lib/notification-types";

/** The metadata key a type's notifications are about, when a reader may mute it. */
export function muteKeyOf(def: NotificationTypeDef | null): string | null {
  if (!def || def.severity === "action" || def.activity === null || def.app === "activity-monitor") return null;
  const key = (def.lifecycle as { key?: unknown }).key;
  return typeof key === "string" && /^[a-z_]+$/.test(key) && key !== "subject" && key !== "type" ? key : null;
}

/** Can the row's topic be muted? */
export function canMute(meta: unknown): boolean {
  const m = meta as { type?: unknown; kind?: unknown } | null | undefined;
  return muteKeyOf(notificationTypeDef(m?.type ?? m?.kind)) !== null;
}

/** Every type a mute of this app's `key` topic silences. */
export function muteTypes(app: string, key: string): string[] {
  return Object.entries(NOTIFICATION_TYPES as Record<string, NotificationTypeDef>)
    .filter(([, d]) => d.app === app && muteKeyOf(d) === key)
    .map(([t]) => t);
}
