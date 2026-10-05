/* ---------------------------------------------------------------------------
   events/types — shared vocabulary and row shapes for the Events app.

   Client-safe (types + constants only, no "server-only"). The API routes
   hand these rows to the views; the forms read the same option lists, so a
   status can never mean one thing in the editor and another in the filter.

   Phase 1 scope (owner plan, 04 Oct 2026): the event, its guests with
   invitation state, its day agenda. Invitations sending, QR check-in and
   budget lines build on these tables in later phases.
   --------------------------------------------------------------------------- */

export const EVENT_TYPES = [
  "exhibition",
  "conference",
  "launch",
  "mission",
  "visit",
  "training",
  "workshop",
  "seminar",
  "gathering",
  "ceremony",
  "roadshow",
  "online",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/* The pipeline: idea → planning → confirmed → live → done → archived. */
export const EVENT_STATUSES = [
  "idea",
  "planning",
  "confirmed",
  "live",
  "done",
  "archived",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  exhibition: "Exhibition",
  conference: "Conference",
  launch: "Product Launch",
  mission: "Business Mission",
  visit: "Factory Visit",
  training: "Training",
  workshop: "Workshop",
  seminar: "Seminar",
  gathering: "Gathering",
  ceremony: "Ceremony",
  roadshow: "Roadshow",
  online: "Online / Webinar",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  idea: "Idea",
  planning: "Planning",
  confirmed: "Confirmed",
  live: "Live",
  done: "Done",
  archived: "Archived",
};

/* ── Guests ──────────────────────────────────────────────────────────────── */

export const GUEST_SOURCES = ["contact", "employee", "manual"] as const;
export type GuestSource = (typeof GUEST_SOURCES)[number];

export const GUEST_CATEGORIES = [
  "vip",
  "customer",
  "supplier",
  "partner",
  "media",
  "staff",
  "guest",
] as const;
export type GuestCategory = (typeof GUEST_CATEGORIES)[number];

export const GUEST_CATEGORY_LABEL: Record<GuestCategory, string> = {
  vip: "VIP",
  customer: "Customer",
  supplier: "Supplier",
  partner: "Partner",
  media: "Media",
  staff: "Staff",
  guest: "Guest",
};

/* The invitation funnel: listed → invited → viewed → accepted/declined/maybe
   → attended. "listed" = on the list, not sent yet (Phase 2 adds sending). */
export const GUEST_STATUSES = [
  "listed",
  "invited",
  "viewed",
  "accepted",
  "declined",
  "maybe",
  "attended",
] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

export const GUEST_STATUS_LABEL: Record<GuestStatus, string> = {
  listed: "Listed",
  invited: "Invited",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  maybe: "Maybe",
  attended: "Attended",
};

/* ── Rows (the API hands these to the views) ─────────────────────────────── */

export interface KxEventRow {
  id: string;
  tenant_id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  budget_total: number | null;
  expected_guests: number | null;
  booth: string | null;
  website: string | null;
  owner_account_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Invitations (phase 2) ───────────────────────────────────────────────── */

export const INVITE_STATUSES = ["draft", "sent", "viewed", "rsvped"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const INVITE_CHANNELS = ["link", "email"] as const;
export type InviteChannel = (typeof INVITE_CHANNELS)[number];

/** The invitation attached to a guest (embedded by the detail endpoint). */
export interface GuestInvitation {
  token: string;
  status: InviteStatus;
  sent_at: string | null;
  viewed_at: string | null;
  answered_at: string | null;
}

/* The public RSVP page payload — only what a guest holding the token may
 * see: the event's public facts and their own name/answer. Nothing else. */
export const RSVP_ANSWERS = ["accepted", "declined", "maybe"] as const;
export type RsvpAnswer = (typeof RSVP_ANSWERS)[number];

export interface PublicInvite {
  event: {
    title: string;
    type: EventType;
    start_at: string | null;
    end_at: string | null;
    location: string | null;
    city: string | null;
    country: string | null;
    description: string | null;
  };
  guestName: string;
  answer: GuestStatus | null;
  inviteStatus: InviteStatus;
  answeredAt: string | null;
}

export function isRsvpAnswer(v: unknown): v is RsvpAnswer {
  return typeof v === "string" && (RSVP_ANSWERS as readonly string[]).includes(v);
}

export interface EventGuestRow {
  id: string;
  event_id: string;
  source: GuestSource;
  contact_id: string | null;
  account_id: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  category: GuestCategory;
  status: GuestStatus;
  invited_at: string | null;
  responded_at: string | null;
  notes: string | null;
  checked_in_at: string | null;
  invitation?: GuestInvitation | null;
}

export interface EventAgendaItemRow {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  speaker: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}

/* ── Budget (phase 4) ────────────────────────────────────────────────────── */

export const BUDGET_CATEGORIES = [
  "booth",
  "travel",
  "hotels",
  "transport",
  "materials",
  "catering",
  "marketing",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export interface EventBudgetLineRow {
  id: string;
  event_id: string;
  label: string;
  category: BudgetCategory;
  planned: number;
  actual: number;
  sort_order: number;
  notes: string | null;
}

export interface EventOwner {
  username: string | null;
  person: { full_name: string | null; display_name: string | null } | null;
}

/* ── Formatting (viewer-local; events are instants, not visa-letter dates) ── */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "15 Oct 2026" in the viewer's own zone; "" for empty/invalid. */
export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "09:00" in the viewer's own zone; "" for empty/invalid. */
export function formatEventTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Display name for an owner embed: the person's name, falling back to the
 *  login username. Shared by the card and the overview so they can't drift. */
export function ownerDisplayName(owner: EventOwner | null | undefined): string {
  if (!owner) return "";
  return owner.person?.full_name ?? owner.person?.display_name ?? owner.username ?? "";
}

/** The list endpoint's row: the event plus its guest funnel counts. */
export interface EventListItem extends KxEventRow {
  owner: EventOwner | null;
  guest_counts: Partial<Record<GuestStatus, number>>;
}

/** The detail endpoint's payload: everything the workspace needs in ONE
 *  request (the China-latency rule — no per-tab waterfalls). */
export interface EventDetail extends KxEventRow {
  owner: EventOwner | null;
  guests: EventGuestRow[];
  agenda: EventAgendaItemRow[];
  budget: EventBudgetLineRow[];
}

/* ── Validation (shared by create/edit forms and the API) ────────────────── */

export const EVENT_TITLE_MAX = 160;
export const GUEST_NAME_MAX = 120;

/** YYYY-MM-DDTHH:mm (the <input type="datetime-local"> value) → ISO, or null. */
export function localToIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isEventType(v: unknown): v is EventType {
  return typeof v === "string" && (EVENT_TYPES as readonly string[]).includes(v);
}

export function isEventStatus(v: unknown): v is EventStatus {
  return typeof v === "string" && (EVENT_STATUSES as readonly string[]).includes(v);
}

export function isGuestCategory(v: unknown): v is GuestCategory {
  return typeof v === "string" && (GUEST_CATEGORIES as readonly string[]).includes(v);
}

export function isGuestStatus(v: unknown): v is GuestStatus {
  return typeof v === "string" && (GUEST_STATUSES as readonly string[]).includes(v);
}
