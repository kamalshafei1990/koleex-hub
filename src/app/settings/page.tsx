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
import { useSkin } from "@/lib/appearance";
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
import Volume2Icon from "@/components/icons/ui/Volume2Icon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";
import { Chevron } from "@/components/settings/tabs/ui";
import type { AccountWithLinks } from "@/types/supabase";

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
const RegionTab         = dynamic(() => import("@/components/settings/tabs/RegionTab"),         { loading: tabLoading });
const NotificationsTab  = dynamic(() => import("@/components/settings/tabs/NotificationsTab"),  { loading: tabLoading });
const PasswordTab       = dynamic(() => import("@/components/settings/tabs/PasswordTab"),       { loading: tabLoading });
const LoginHistoryTab   = dynamic(() => import("@/components/settings/tabs/LoginHistoryTab"),   { loading: tabLoading });
const PrivacyTab        = dynamic(() => import("@/components/settings/tabs/PrivacyTab"),        { loading: tabLoading });
const StampSignatureTab = dynamic(() => import("@/components/settings/tabs/StampSignatureTab"), { loading: tabLoading });
const AdminTab          = dynamic(() => import("@/components/settings/tabs/AdminTab"),          { loading: tabLoading });
const AboutTab          = dynamic(() => import("@/components/settings/tabs/AboutTab"),          { loading: tabLoading });

type Tab = "profile" | "calendar" | "display" | "sounds" | "region" | "notifications" | "password" | "security" | "privacy" | "assets" | "admin" | "about";

type SectionDef = {
  id: Tab; label: string; subtitle: string;
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
  const { t } = useTranslation(settingsT);
  const { data: boot } = useMeBootstrap();
  const aurora = useSkin() === "aurora";
  const isSA = !!boot?.isSuperAdmin;
  const [tab, setTab] = useState<Tab>("profile");
  /* Mobile only: false → show the list, true → show the pushed detail. */
  const [mobileDetail, setMobileDetail] = useState(false);

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
      icon: <PaletteIcon className="h-3.5 w-3.5" />,
      node: <DisplayTab account={account} onChanged={onChanged} />,
    },
    {
      id: "sounds", label: t("nav.sounds"), subtitle: t("nav.sounds.sub"),
      icon: <Volume2Icon className="h-3.5 w-3.5" />,
      node: <SoundsTab />,
    },
    {
      id: "region", label: t("nav.region"), subtitle: t("nav.region.sub"),
      icon: <GlobeIcon className="h-3.5 w-3.5" />,
      node: <RegionTab account={account} onChanged={onChanged} />,
    },
    {
      id: "notifications", label: t("nav.notifications"), subtitle: t("nav.notifications.sub"),
      icon: <BellIcon className="h-3.5 w-3.5" />,
      node: <NotificationsTab account={account} onChanged={onChanged} />,
    },
    {
      id: "password", label: t("nav.password"), subtitle: t("nav.password.sub"),
      icon: <KeyIcon className="h-3.5 w-3.5" />,
      node: <PasswordTab account={account} />,
    },
    {
      id: "security", label: t("nav.history"), subtitle: t("nav.history.sub"),
      icon: <LockIcon className="h-3.5 w-3.5" />,
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
        id: "admin" as Tab, label: t("nav.admin"), subtitle: t("nav.admin.sub"),
        icon: <ShieldIcon className="h-3.5 w-3.5" />,
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
  const displayItems = (["display", "sounds", "region", "calendar"] as Tab[]).map(byId);
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
                    row to everyone sent regular users into a lock screen. */}
                {isSA && (
                  <SettingsRow
                    href="/settings/notifications"
                    icon={<BellIcon className="h-3.5 w-3.5" />}
                    label={t("nav.push")}
                    subtitle={t("nav.push.sub")}
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
            isLast={i === items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────── iOS-style disclosure row ─────────────── */

function SettingsRow({
  active, onClick, href, icon, label, subtitle, isLast,
}: {
  active?: boolean; onClick?: () => void; href?: string;
  icon: React.ReactNode; label: string; subtitle?: string; isLast?: boolean;
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
      <Chevron className="text-[var(--text-faint)] shrink-0" />
    </>
  );
  const cls = `w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors ${
    active ? "bg-[var(--bg-surface-subtle)]" : "hover:bg-[var(--bg-surface-subtle)]"
  } ${!isLast ? "border-b border-[var(--border-faint)]" : ""}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

