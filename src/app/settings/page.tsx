"use client";

/* ---------------------------------------------------------------------------
   /settings — self-service account settings.

   Deliberately narrower than the admin Accounts app. Exposes only what
   a regular user can change about themselves:

     - Profile photo
     - Display name + personal phone + personal email
     - Preferences (language / theme / notifications / signature)
     - Calendar (timezone / working hours / default meeting length / OOO)

   Locked away on purpose (admin-only, in /accounts/[id]):
     - Username
     - Login email
     - Password       ← super-admin-only per policy
     - Role / permissions / access rights
     - Status, tenant, company, user_type
     - HR data (hire date, salary, bank, visa, passport, etc.)

   Everything writes through endpoints that already enforce
   "editingSelf OR super_admin", so there's no new privilege surface.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import AuthGate from "@/components/admin/AuthGate";
import { useSkin, SKINS } from "@/lib/appearance";
import { withDefaults } from "@/lib/access-control";
import type { NotificationPrefs } from "@/lib/access-control";
import PageHeader from "@/components/ui/PageHeader";
import SettingsIcon from "@/components/icons/SettingsIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import { WorkspaceSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";
import CalendarIcon from "@/components/icons/ui/CalendarRawIcon";
import BellIcon from "@/components/icons/ui/BellIcon";
import { useCurrentAccount, notifyIdentityChanged } from "@/lib/identity";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import Volume2Icon from "@/components/icons/ui/Volume2Icon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import WrenchIcon from "@/components/icons/ui/WrenchIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";
import { Chevron, RowValue } from "@/components/settings/tabs/ui";
import { useWallpaper } from "@/lib/useWallpaper";
import { PHOTO_ID, nameKeyFor } from "@/lib/wallpaper";

/* Aurora ground — loaded only under the skin (Core never pays for it). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

/* ── TABS LOAD ON DEMAND ───────────────────────────────────────────────────
   All twelve of these were static imports, and `dynamic` was sitting three
   lines above being used once, for the canvas. So opening Settings downloaded
   every tab's code to show exactly one of them — which is the whole reason
   this route measured 11 chunks / 980 KB, the heaviest of the Hub's 39
   budgeted routes despite the app being only ~2,400 lines.

   On production the cost of that is round-trips, not bytes: measured on
   hub.koleexgroup.com, file size barely predicts load time (correlation 0.42
   — a 2.4 KB file took 1357 ms, a 70.8 KB file 2280 ms). Eleven chunks is
   eleven waits.

   The `sections` array below builds a JSX element for every tab, but creating
   an element does not invoke its component — only `active.node` is ever
   mounted, and next/dynamic fires its loader on MOUNT. So exactly one tab's
   chunk is fetched, and it is fetched when the user opens that tab.

   `loading` matters here: without it the panel would be blank for the length
   of a round-trip. A quiet centred spinner, the same shape the modules use. */
const tabLoading = () => (
  <div className="h-full min-h-[200px] flex items-center justify-center text-[var(--text-dim)]">
    <SpinnerIcon size={20} />
  </div>
);
const ProfileTab        = dynamic(() => import("@/components/settings/tabs/ProfileTab"),        { loading: tabLoading });
const CalendarTab       = dynamic(() => import("@/components/admin/accounts/tabs/CalendarTab"), { loading: tabLoading });
const DisplayTab        = dynamic(() => import("@/components/settings/tabs/DisplayTab"),        { loading: tabLoading });
const SoundsTab         = dynamic(() => import("@/components/settings/tabs/SoundsTab"),         { loading: tabLoading });
const WallpaperTab      = dynamic(() => import("@/components/settings/tabs/WallpaperTab"),      { loading: tabLoading });
const RegionTab         = dynamic(() => import("@/components/settings/tabs/RegionTab"),         { loading: tabLoading });
const NotificationsTab  = dynamic(() => import("@/components/settings/tabs/NotificationsTab"),  { loading: tabLoading });
const PasswordTab       = dynamic(() => import("@/components/settings/tabs/PasswordTab"),       { loading: tabLoading });
const LoginHistoryTab   = dynamic(() => import("@/components/settings/tabs/LoginHistoryTab"),   { loading: tabLoading });
const PrivacyTab        = dynamic(() => import("@/components/settings/tabs/PrivacyTab"),        { loading: tabLoading });
const StampSignatureTab = dynamic(() => import("@/components/settings/tabs/StampSignatureTab"), { loading: tabLoading });
const AdminTab          = dynamic(() => import("@/components/settings/tabs/AdminTab"),          { loading: tabLoading });
const AboutTab          = dynamic(() => import("@/components/settings/tabs/AboutTab"),          { loading: tabLoading });

/* Language names in their own script, the way the switcher shows them — a
   reader scanning for "العربية" should find the word they picked, not a
   translation of it. */
const LANG_LABEL: Record<string, string> = { en: "English", zh: "中文", ar: "العربية" };

type Tab = "profile" | "calendar" | "display" | "wallpaper" | "sounds" | "region" | "notifications" | "password" | "security" | "privacy" | "assets" | "admin" | "about";

type SectionDef = {
  id: Tab; label: string; subtitle: string;
  /** Current state for the master list — free to compute, never fetched. */
  value?: string;
  icon: React.ReactNode; node: React.ReactNode;
};

export default function SettingsPage() {
  return (
    <AuthGate>
      <SettingsContent />
    </AuthGate>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Push state for the master row, read straight from the browser.
 *
 *  Deliberately NOT a hook and not stateful: `Notification.permission` only
 *  changes when the user answers the prompt, which happens on the push page,
 *  and coming back here remounts this list. Subscribing to it would be a
 *  listener earning nothing.
 *
 *  Returns undefined where there is nothing true to say — no Notification API
 *  at all, or the value is still "default" on a browser that cannot support
 *  push anyway — so the row shows nothing rather than a state it does not
 *  have. */
function pushPermissionValue(t: (k: string) => string): string | undefined {
  if (typeof Notification === "undefined") return undefined;
  const p = Notification.permission;
  if (p === "granted") return t("push.on");
  if (p === "denied") return t("push.off");
  return undefined;   // "default" — never asked; say nothing, do not guess
}

/* ---------------------------------------------------------------------------
   Settings shell — iOS / iPadOS style.

     · iPad / desktop (md+): two-pane master-detail. A left "sidebar" with the
       account card + grouped disclosure rows, and a right detail pane that
       renders the selected section. The selected row stays highlighted.
     · iPhone / mobile: a single grouped list. Tapping a row "pushes" to the
       section (back chevron in the header returns to the list), mirroring the
       iOS Settings navigation.

   Sections are unchanged (Profile / Preferences / Calendar) — this is a
   layout-only reshape. Monochrome tiles per the Koleex brand; the accent is
   reserved for the active back control.
   --------------------------------------------------------------------------- */
function SettingsContent() {
  const { account, refresh } = useCurrentAccount();
  const { t, lang } = useTranslation(settingsT);
  const { data: boot } = useMeBootstrap();
  const skin = useSkin();
  const aurora = skin === "aurora";
  const isSA = !!boot?.isSuperAdmin;
  const [tab, setTab] = useState<Tab>("profile");
  /* Mobile only: false → show the list, true → show the pushed detail. */
  const [mobileDetail, setMobileDetail] = useState(false);
  /* ABOVE the `if (!account)` return below. A hook under an early return is
     what took out /projects with React #310 — the order changes the moment
     the account resolves. Every hook in this component stays up here. */
  const wallpaperPref = useWallpaper();

  if (!account) {
    return (
      <WorkspaceSkeleton label="Loading settings…" />
    );
  }

  const onChanged = () => { notifyIdentityChanged(); refresh(); };
  const openSection = (t: Tab) => { setTab(t); setMobileDetail(true); };

  const person = account.person;
  const avatarUrl = account.avatar_url || person?.avatar_url || null;
  const displayName = person?.full_name || account.username || "—";
  const initials = (person?.full_name || account.username || "")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLine = account.role?.name || capitalize(account.user_type);

  /* ROW VALUES — FREE OR NOT AT ALL.
     The point of a value is that the list can be read without opening
     anything; the trap is paying for that with a request per row, which would
     undo Phase 0 exactly. So every value here comes from state this page has
     already loaded — the skin from useSkin, the language from useTranslation,
     the formats from account.preferences, which arrives with the account.

     Deliberately left blank: Push notifications (needs the subscription
     state), Signature & stamp (needs the stored asset), Login history and
     Privacy (a log and a set of actions have no single state), Password. A
     blank is honest. Three true values beat eight with two guesses in them,
     and a wrong value is worse than none — it is read as fact. */
  const skinLabel = SKINS.find((s) => s.value === skin)?.[lang] ?? "";
  const langLabel = LANG_LABEL[lang] ?? "";
  /* Free, and live. The hook is already the ground's subscription, so this
     row's value follows a change made inside the tab without a reload —
     the same property Phase 3's other values have. lib/wallpaper adds nothing
     to this route: WavyBackground below already pulls it in. */
  const wallpaperLabel = wallpaperPref.id === PHOTO_ID && wallpaperPref.photoUrl
    ? t("wp.yourPhoto")
    : t(nameKeyFor(wallpaperPref));
  /* Notifications reports what is SILENCED, not what is on. Per-activity
     toggles default to on and stay undefined until touched, so a count of the
     enabled ones would read "17" for a user who has never opened the screen —
     technically true, and useless. What a reader wants to know is whether
     anything is being held back, so the row is blank when nothing is. */
  /* PUSH IS FREE; THE STAMP IS NOT — the difference is worth stating, because
     it is the whole test for whether a row earns a value.

     Push permission is `Notification.permission`, a synchronous local read,
     so this row can report itself for nothing. Signature & stamp would need
     GET /api/quotations/saved-assets, a server round-trip on every Settings
     open to fill one row that only Super Admins can see — which is exactly
     the trade Phase 0 was undone to avoid. It stays blank.

     "Off" also covers "never asked", and that is honest: from the reader's
     side a permission never granted and one denied are the same state — no
     alerts arrive. The screen behind the row is where the difference matters,
     and it says so there. */
  const pushValue = pushPermissionValue(t);
  const notifPrefs = withDefaults(account.preferences).notifications as NotificationPrefs;
  const mutedCount = Object.entries(notifPrefs).filter(
    ([k, v]) => k !== "email" && k !== "in_app" && v === false,
  ).length;

  const sections: SectionDef[] = [
    {
      id: "profile", label: t("nav.profile"), subtitle: t("nav.profile.sub"),
      icon: <UserIcon size={15} />,
      node: <ProfileTab account={account} onChanged={onChanged} />,
    },
    {
      id: "calendar", label: t("nav.calendar"), subtitle: t("nav.calendar.sub"),
      icon: <CalendarIcon className="h-3.5 w-3.5" />,
      node: <CalendarTab account={account} onChanged={onChanged} />,
    },
    {
      id: "display", label: t("nav.display"), subtitle: t("nav.display.sub"),
      value: skinLabel,
      icon: <PaletteIcon className="h-3.5 w-3.5" />,
      node: <DisplayTab account={account} onChanged={onChanged} />,
    },
    {
      /* Next to Display rather than in a group of its own: both answer "how
         does the Hub look to me", and the reference keeps Wallpaper adjacent
         to Appearance for the same reason. */
      id: "wallpaper", label: t("nav.wallpaper"), subtitle: t("nav.wallpaper.sub"),
      value: wallpaperLabel,
      icon: <PictureIcon className="h-3.5 w-3.5" />,
      node: <WallpaperTab account={account} onChanged={onChanged} />,
    },
    {
      id: "sounds", label: t("nav.sounds"), subtitle: t("nav.sounds.sub"),
      icon: <Volume2Icon className="h-3.5 w-3.5" />,
      node: <SoundsTab />,
    },
    {
      id: "region", label: t("nav.region"), subtitle: t("nav.region.sub"),
      value: langLabel,
      icon: <GlobeIcon className="h-3.5 w-3.5" />,
      node: <RegionTab account={account} onChanged={onChanged} />,
    },
    {
      id: "notifications", label: t("nav.notifications"), subtitle: t("nav.notifications.sub"),
      value: mutedCount > 0 ? t("nav.notifications.muted").replace("{n}", String(mutedCount)) : undefined,
      icon: <BellIcon className="h-3.5 w-3.5" />,
      node: <NotificationsTab account={account} onChanged={onChanged} />,
    },
    {
      id: "password", label: t("nav.password"), subtitle: t("nav.password.sub"),
      icon: <KeyIcon className="h-3.5 w-3.5" />,
      node: <PasswordTab account={account} />,
    },
    {
      /* The id is "security" for historical reasons; the section is a LIST OF
         SIGN-INS, so the glyph is the Hub's history/timeline mark, not a lock.
         A lock here also read as a third security padlock next to Key and
         Shield, which said "protected" three times and "when" not once. */
      id: "security", label: t("nav.history"), subtitle: t("nav.history.sub"),
      icon: <HistoryIcon className="h-3.5 w-3.5" />,
      node: <LoginHistoryTab account={account} />,
    },
    {
      id: "privacy", label: t("nav.privacy"), subtitle: t("nav.privacy.sub"),
      icon: <ShieldIcon className="h-3.5 w-3.5" />,
      node: <PrivacyTab account={account} />,
    },
    /* Super-admin-only sections. */
    ...(isSA ? [
      {
        id: "assets" as Tab, label: t("nav.assets"), subtitle: t("nav.assets.sub"),
        icon: <FileBadge2Icon className="h-3.5 w-3.5" />,
        node: <StampSignatureTab account={account} />,
      },
      {
        /* Shield stays with Privacy & data, which is the one of the two that
           is actually about protection. This row is literally "Admin tools" —
           QA reporter, activity, roles, accounts — so it takes the toolbox. */
        id: "admin" as Tab, label: t("nav.admin"), subtitle: t("nav.admin.sub"),
        icon: <WrenchIcon className="h-3.5 w-3.5" />,
        node: <AdminTab account={account} />,
      },
    ] : []),
    {
      id: "about", label: t("nav.about"), subtitle: t("nav.about.sub"),
      icon: <InfoIcon className="h-3.5 w-3.5" />,
      node: <AboutTab account={account} />,
    },
  ];
  const active = sections.find((s) => s.id === tab) ?? sections[0];
  const byId = (id: Tab) => sections.find((s) => s.id === id)!;
  /* "Preferences" was removed on purpose: every control in it was a
     duplicate with a DIFFERENT store — Language (en/ar only, wrote a dead
     prefs.language while the real 3-language picker lives in Language &
     region), Theme (dead prefs.theme; the real switch is in Display), and
     the notification channel toggles (superseded by Notifications, and
     saving them wiped the per-activity switches). The admin Accounts app
     keeps its own copy for account administration. */
  /* GROUPED BY WHAT THE READER IS TRYING TO DO. Two moves, both of them the
     point of the regrouping rather than tidying:

     · Calendar joins Display / Sounds / Region. Working hours and timezone are
       not "personal details" like a photo and a phone number — they are part
       of how the Hub behaves for you, which is the question that group answers.

     · Signature & stamp leaves its own "Workspace" group and joins
       Administration. The plan had it under Me; reading it corrected that —
       its own copy says "Applied tenant-wide to quotations, invoices, and
       packing lists". It is the COMPANY seal, not the user's, which is also
       why it was already Super-Admin-only. A group of one called "Workspace"
       was hiding that. */
  const personalItems = (["profile"] as Tab[]).map(byId);
  const displayItems = (["display", "wallpaper", "sounds", "region", "calendar"] as Tab[]).map(byId);
  const notificationsItem = byId("notifications");
  const securityItems = (["password", "security", "privacy"] as Tab[]).map(byId);
  const adminItems = isSA ? (["assets", "admin"] as Tab[]).map(byId) : [];
  const aboutItems = (["about"] as Tab[]).map(byId);

  return (
    /* h-full, NOT 100vh maths: the shell already resolves the per-mode
       viewport unit (svh in browser / vh standalone) — a child re-measuring
       100vh here is exactly the old bottom-crop bug. kx-app = the Aurora
       var-remap scope (globals); Core reads the same vars, solid. */
    <div className="kx-app relative h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full max-w-[100vw]">
      {/* Aurora: the Hub ground behind the whole app — the root goes
          transparent under the skin and every glass surface frosts this
          canvas, exactly like Home. Core keeps the solid page. */}
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {/* Canonical Koleex app header — identical to every other app.
          Shares the body's max-width + padding so the title aligns with the
          master list below and the whole page fills the desktop viewport. */}
      <div className="relative z-[1] shrink-0 w-full mx-auto max-w-[1600px] px-4 md:px-6 pt-4 sm:pt-5">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          icon={<SettingsIcon className="h-5 w-5" />}
          backHref="/"
        />
      </div>

      {/* Body */}
      <div className="relative z-[1] flex-1 min-h-0">
        <div className="mx-auto max-w-[1600px] h-full px-4 md:px-6 py-5 md:grid md:grid-cols-[320px_minmax(0,1fr)] md:gap-8">

          {/* Master list — sidebar on iPad, full screen on iPhone. */}
          <aside className={`${mobileDetail ? "hidden" : "block"} md:block h-full overflow-y-auto no-scrollbar space-y-4`}>
            {/* Account card (Apple-ID style) */}
            <button
              type="button"
              onClick={() => openSection("profile")}
              className="kx-glass kx-hover-glow w-full flex items-center gap-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 text-start hover:border-[var(--border-focus)] transition-colors"
            >
              <span className="h-12 w-12 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[15px] font-semibold text-[var(--text-dim)]">{initials || "·"}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[var(--text-primary)] truncate">{displayName}</span>
                <span className="block text-[11px] text-[var(--text-dim)] truncate">{roleLine} · @{account.username}</span>
              </span>
              <Chevron className="text-[var(--text-faint)] shrink-0" />
            </button>

            {/* Personal */}
            <MasterGroup label={t("group.personal")} items={personalItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />

            {/* Display */}
            <MasterGroup label={t("group.display")} items={displayItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />

            {/* Notifications — preferences (in-pane) + link to the push page. */}
            <div>
              <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider px-3 mb-1.5">{t("group.notifications")}</p>
              <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
                <SettingsRow
                  active={!mobileDetail && tab === "notifications"}
                  onClick={() => openSection("notifications")}
                  icon={notificationsItem.icon}
                  label={notificationsItem.label}
                  subtitle={notificationsItem.subtitle}
                  isLast={!isSA}
                />
                {/* The push-management page is Super-Admin-only; showing the
                    row to everyone sent regular users into a lock screen.

                    Not a second bell. This row sat directly under the
                    preferences row, so two identical bells stacked and the
                    pair read as one thing listed twice. The page it opens is a
                    list of REGISTERED DEVICES, drawn there with this same
                    MonitorIcon — so the row borrows its destination's own
                    vocabulary: bell = which alerts, device = which screens. */}
                {isSA && (
                  <SettingsRow
                    href="/settings/notifications"
                    icon={<MonitorIcon className="h-3.5 w-3.5" />}
                    label={t("nav.push")}
                    subtitle={t("nav.push.sub")}
                    value={pushValue}
                    isLast
                  />
                )}
              </div>
            </div>

            {/* Security */}
            <MasterGroup label={t("group.security")} items={securityItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />

            {/* Administration (super-admin) — Signature & stamp folded in
                here from the old one-item "Workspace" group; it is the
                tenant's seal, not the user's. */}
            {adminItems.length > 0 && (
              <MasterGroup label={t("group.admin")} items={adminItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />
            )}

            {/* About */}
            <MasterGroup label={t("group.about")} items={aboutItems} activeTab={tab} mobileDetail={mobileDetail} onOpen={openSection} />
          </aside>

          {/* Detail pane */}
          <main className={`${mobileDetail ? "block" : "hidden"} md:block h-full overflow-y-auto no-scrollbar`}>
            {/* Mobile-only back to the settings list (iOS push nav). */}
            <button
              type="button"
              onClick={() => setMobileDetail(false)}
              className="md:hidden mb-3 -ml-1 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--text-primary)]"
            >
              <Chevron back /> {t("allSettings")}
            </button>
            {/* Fill the detail pane on desktop; cap only so ultra-wide
                monitors don't stretch forms to unreadable line lengths.
                key + kx-tab-in: switching sections must RIDE in, never
                appear suddenly (owner rule, learned on the AI tabs). */}
            <div key={tab} className="kx-tab-in-soft max-w-[1040px] pb-8">
              {active.node}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Grouped master-list block ─────────────── */

function MasterGroup({
  label, items, activeTab, mobileDetail, onOpen,
}: {
  label: string; items: SectionDef[]; activeTab: Tab;
  mobileDetail: boolean; onOpen: (t: Tab) => void;
}) {
  return (
    <div>
      <p className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider px-3 mb-1.5">{label}</p>
      {/* kx-glass: the master-list groups are floating leaf tiles over the
          Aurora canvas (true frost, like Home's tiles). Core: solid card. */}
      <div className="kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
        {items.map((s, i) => (
          <SettingsRow
            key={s.id}
            active={!mobileDetail && activeTab === s.id}
            onClick={() => onOpen(s.id)}
            icon={s.icon}
            label={s.label}
            subtitle={s.subtitle}
            value={s.value}
            isLast={i === items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────── iOS-style disclosure row ─────────────── */

function SettingsRow({
  active, onClick, href, icon, label, subtitle, value, isLast,
}: {
  active?: boolean; onClick?: () => void; href?: string;
  icon: React.ReactNode; label: string; subtitle?: string;
  /** Current state, shown at the inline end. Omit when the row has none. */
  value?: string; isLast?: boolean;
}) {
  const aurora = useSkin() === "aurora";
  const inner = (
    <>
      {/* Selected tile: Aurora marks selection with the Hub-Blue ring
          (kx-seg-on) — a solid inverted block is the loudest flat shape on a
          glass surface. Core keeps the inverted tile. */}
      <span
        className={`h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0 border transition-colors ${
          active
            ? aurora
              ? "kx-seg-on text-[var(--text-primary)] border-transparent"
              : "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
            : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[var(--text-primary)] truncate">{label}</span>
        {subtitle && <span className="block text-[11px] text-[var(--text-dim)] truncate">{subtitle}</span>}
      </span>
      {/* Shared with the settings rows in tabs/ui.tsx — one definition, because
          this is the part that must look the same in both lists and had
          already drifted (12px vs 12.5px, truncate vs tabular-nums) within a
          day. The rows themselves stay separate: that one is a setting, this
          is a navigation item with a selected state. */}
      <RowValue value={value} />
      <Chevron className="text-[var(--text-faint)] shrink-0" />
    </>
  );
  /* KDS-1 §2a — a full-bleed nav row. Hover and selection are painted by
     `.kx-row-hl` as an inset rounded layer instead of a background on the row
     itself: this row spans the card edge to edge and carries the divider, so
     filling it can only be a hard-edged band, and rounding the row would round
     the divider with it. One shape for both states, selected simply stronger.
     `data-kx-keep-hover` keeps the Aurora control-hover rule off it — without
     it, hover recolours this divider Hub Blue and adds a 3% white fill with
     `!important`, which is the square box the owner reported on Contacts. */
  const cls = `kx-row-hl w-full flex items-center gap-3 px-3 py-2.5 text-start ${
    !isLast ? "border-b border-[var(--border-faint)]" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={cls} data-selected={active} data-kx-keep-hover="">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} data-selected={active} data-kx-keep-hover="">
      {inner}
    </button>
  );
}

