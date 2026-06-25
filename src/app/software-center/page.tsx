"use client";

/**
 * Download Center (Super-Admin) — central place to download Koleex apps,
 * updates, drivers and installers. Premium, responsive, dark-mode native.
 * Data is local for now (src/lib/software-center.ts); page reuses the
 * canonical PageHeader + AuthGate + design tokens. Additive — no web app
 * behavior is touched.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import AuthGate from "@/components/admin/AuthGate";
import PageHeader from "@/components/ui/PageHeader";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import {
  STABLE_RELEASES,
  BETA_RELEASES,
  RELEASE_NOTES,
  DRIVERS,
  INSTALL_GUIDES,
  CURRENT_RELEASE_URL,
  LATEST_DESKTOP_VERSION,
  detectPlatform,
  type SoftwareRelease,
  type DetectedPlatform,
  type InstallGuide,
} from "@/lib/software-center";

export default function SoftwareCenterPage() {
  return (
    <AuthGate
      title="Download Center"
      subtitle="Download apps, updates, drivers and installers"
    >
      <SoftwareCenterView />
    </AuthGate>
  );
}

/* ── Authenticated + Super-Admin-gated view ─────────────────────────────── */
function SoftwareCenterView() {
  const { data: boot } = useMeBootstrap();
  const isSuperAdmin = !!boot?.isSuperAdmin;

  // Loading bootstrap
  if (boot === undefined) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-[var(--border-strong)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4 text-[var(--text-dim)]">
            <PackageIcon size={20} />
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            Access restricted
          </h2>
          <p className="text-[13px] text-[var(--text-dim)] leading-relaxed mb-5">
            Download Center is available to Super Admins only. Contact your
            administrator if you need access.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return <SoftwareCenterContent />;
}

/* Client-only platform detection via useSyncExternalStore — null on the server
   (avoids hydration mismatch), a cached snapshot on the client (stable so the
   store never loops). No effect / setState-in-effect. */
let cachedPlatform: DetectedPlatform | null = null;
const getPlatformSnapshot = (): DetectedPlatform => {
  if (!cachedPlatform) cachedPlatform = detectPlatform();
  return cachedPlatform;
};
const emptySubscribe = () => () => {};

/* ── Main content ───────────────────────────────────────────────────────── */
function SoftwareCenterContent() {
  const platform = useSyncExternalStore<DetectedPlatform | null>(
    emptySubscribe,
    getPlatformSnapshot,
    () => null,
  );
  const [query, setQuery] = useState("");
  const [guide, setGuide] = useState<InstallGuide | null>(null);

  const recommended = useMemo(
    () =>
      platform?.recommendedId
        ? STABLE_RELEASES.find((r) => r.id === platform.recommendedId) ?? null
        : null,
    [platform],
  );

  const filteredStable = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STABLE_RELEASES;
    return STABLE_RELEASES.filter((r) =>
      [r.name, r.platform, r.platformLabel, r.version, r.architecture]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 pt-5 md:pt-7 pb-16">
        <PageHeader
          title="Download Center"
          subtitle="Download apps, updates, drivers and installers"
          icon="download"
          backHref="/"
          searchPlaceholder="Search downloads…"
          onSearchSubmit={setQuery}
        />

        {/* ── HERO ── */}
        <Hero platform={platform} recommended={recommended} />

        {/* ── STABLE RELEASES ── */}
        <Section
          id="applications"
          title="Applications"
          subtitle="Stable releases — ready for everyday use"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
            {filteredStable.map((r) => (
              <ReleaseCard
                key={r.id}
                release={r}
                recommended={r.id === recommended?.id}
              />
            ))}
            {filteredStable.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  title="No matching downloads"
                  body={`Nothing matches “${query}”. Try a different search.`}
                />
              </div>
            )}
          </div>
        </Section>

        {/* ── BETA RELEASES ── */}
        <Section
          id="beta"
          title="Beta Releases"
          subtitle="Early builds for testing new features"
        >
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 mb-4 flex items-start gap-2.5">
            <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold shrink-0">
              !
            </span>
            <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">
              Beta versions may contain bugs and should not be used in production
              environments.
            </p>
          </div>
          {BETA_RELEASES.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {BETA_RELEASES.map((r) => (
                <ReleaseCard key={r.id} release={r} recommended={false} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No beta builds right now"
              body="When a beta channel opens, early builds will appear here for testing."
            />
          )}
        </Section>

        {/* ── RELEASE NOTES ── */}
        <Section
          id="release-notes"
          title="Release Notes"
          subtitle="What changed in each version"
        >
          <ol className="relative ml-1 border-l border-[var(--border-subtle)]">
            {RELEASE_NOTES.map((note) => (
              <li key={note.version} className="relative pl-6 pb-8 last:pb-0">
                <span className="absolute -left-[6px] top-1 h-3 w-3 rounded-full bg-[var(--bg-inverted)] ring-4 ring-[var(--bg-primary)]" />
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[15px] font-bold tracking-tight">
                    Version {note.version}
                  </span>
                  <Badge tone={note.channel === "beta" ? "warning" : "neutral"}>
                    {note.channel === "beta" ? "Beta" : "Stable"}
                  </Badge>
                  <span className="text-[12px] text-[var(--text-dim)]">
                    {formatDate(note.date)}
                  </span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {note.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckIcon
                        size={15}
                        className="mt-[2px] text-emerald-400 shrink-0"
                      />
                      <span className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                        {h}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── DRIVERS & UTILITIES ── */}
        <Section
          id="drivers"
          title="Drivers & Utilities"
          subtitle="Printer, scanner and device drivers"
        >
          {DRIVERS.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {/* future driver cards */}
            </div>
          ) : (
            <EmptyState
              title="No drivers or utilities yet"
              body="Printer, barcode-scanner, USB and camera utilities will be published here as they're added."
            />
          )}
        </Section>

        {/* ── INSTALLATION GUIDES ── */}
        <Section
          id="guides"
          title="Installation Guides"
          subtitle="Step-by-step setup and troubleshooting"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {INSTALL_GUIDES.map((g) => (
              <button
                key={g.id}
                onClick={() => setGuide(g)}
                className="group text-left rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-subtle)] transition-all"
              >
                <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] group-hover:text-[var(--text-primary)] transition-colors mb-3">
                  <MonitorIcon size={16} />
                </div>
                <div className="text-[14px] font-semibold mb-1">{g.title}</div>
                <p className="text-[12.5px] text-[var(--text-dim)] leading-relaxed">
                  {g.summary}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)]">
                  Read guide →
                </span>
              </button>
            ))}
          </div>
        </Section>
      </div>

      {guide && <GuideDialog guide={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────────── */
function Hero({
  platform,
  recommended,
}: {
  platform: DetectedPlatform | null;
  recommended: SoftwareRelease | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] my-6 md:my-8">
      {/* subtle accent wash, top-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "var(--accent)" }}
      />
      <div className="relative p-6 md:p-10 flex flex-col lg:flex-row lg:items-center gap-8">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Koleex Hub Desktop v{LATEST_DESKTOP_VERSION}
          </div>
          <h1 className="text-3xl md:text-[44px] font-bold tracking-tight leading-[1.05] mb-3">
            Download Center
          </h1>
          <p className="text-[14px] md:text-[15px] text-[var(--text-muted)] max-w-xl leading-relaxed">
            Download Koleex applications, updates, drivers and utilities — always
            the latest, signed and ready for your devices.
          </p>

          {platform && (
            <p className="mt-5 text-[13px] text-[var(--text-dim)]">
              You&apos;re using{" "}
              <span className="text-[var(--text-primary)] font-medium">
                {platform.label}
              </span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {recommended && !recommended.comingSoon ? (
              <a
                href={recommended.downloadUrl}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-2xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[14px] font-semibold hover:opacity-90 transition-all shadow-lg"
              >
                <DownloadIcon size={18} />
                Download for {osName(platform?.os)}
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 h-12 px-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] text-[14px] font-semibold">
                <DownloadIcon size={18} />
                {platform?.os === "mobile"
                  ? "Open on a computer to download"
                  : platform?.os === "linux"
                    ? "Linux build coming soon"
                    : "Choose a download below"}
              </div>
            )}
            <a
              href={CURRENT_RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-12 px-5 rounded-2xl border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              All releases
            </a>
          </div>

          {platform?.os === "macos" && (
            <p className="mt-3 text-[11.5px] text-[var(--text-ghost)]">
              Built for Apple Silicon. Intel Mac support is coming soon.
            </p>
          )}
        </div>

        {/* Recommended card */}
        {recommended && (
          <div className="lg:w-[300px] shrink-0">
            <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--bg-surface)] p-5">
              <div className="flex items-center justify-between mb-3">
                <Badge tone="accent">Recommended</Badge>
                <span className="text-[11px] text-[var(--text-dim)]">
                  {recommended.fileSize}
                </span>
              </div>
              <div className="h-11 w-11 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center mb-3">
                <PackageIcon size={20} />
              </div>
              <div className="text-[14px] font-semibold">{recommended.name}</div>
              <div className="text-[12px] text-[var(--text-dim)] mt-0.5">
                {recommended.platformLabel} · v{recommended.version}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Release card ───────────────────────────────────────────────────────── */
function ReleaseCard({
  release,
  recommended,
}: {
  release: SoftwareRelease;
  recommended: boolean;
}) {
  const disabled = !!release.comingSoon || !release.downloadUrl;
  return (
    <div
      className={
        "relative rounded-2xl border bg-[var(--bg-secondary)] p-5 transition-all " +
        (recommended
          ? "border-[var(--accent)]/45 shadow-[0_0_0_1px_var(--accent)]/10"
          : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]")
      }
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]">
          <PackageIcon size={18} />
        </div>
        <div className="flex items-center gap-1.5">
          {recommended && <Badge tone="accent">Recommended</Badge>}
          {release.comingSoon ? (
            <Badge tone="neutral">Coming soon</Badge>
          ) : (
            <Badge tone={release.status === "beta" ? "warning" : "success"}>
              {release.status === "beta" ? "Beta" : "Stable"}
            </Badge>
          )}
        </div>
      </div>

      <div className="text-[15px] font-semibold leading-tight">{release.name}</div>
      <div className="text-[12.5px] text-[var(--text-dim)] mt-1">
        {release.platformLabel}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Meta label="Version" value={`v${release.version}`} />
        <Meta label="Size" value={release.fileSize} />
        <Meta label="Released" value={formatDate(release.releaseDate, true)} />
      </dl>

      <div className="mt-4 flex items-center gap-2">
        {disabled ? (
          <span className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] text-[13px] font-semibold cursor-not-allowed">
            <DownloadIcon size={16} /> Coming soon
          </span>
        ) : (
          <a
            href={release.downloadUrl}
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"
          >
            <DownloadIcon size={16} /> Download
          </a>
        )}
        {release.releaseNotesUrl && (
          <a
            href={release.releaseNotesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-10 px-3.5 rounded-xl border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
          >
            Release Notes
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Small building blocks ──────────────────────────────────────────────── */
function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 mt-10 md:mt-14">
      <div className="mb-4 md:mb-5">
        <h2 className="text-[18px] md:text-[20px] font-bold tracking-tight">
          {title}
        </h2>
        <p className="text-[12.5px] text-[var(--text-dim)] mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] py-2">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
        {label}
      </dt>
      <dd className="text-[12px] font-semibold text-[var(--text-secondary)] mt-0.5">
        {value}
      </dd>
    </div>
  );
}

type Tone = "neutral" | "success" | "warning" | "accent";
function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const map: Record<Tone, string> = {
    neutral:
      "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]",
    success: "bg-emerald-500/12 border-emerald-500/30 text-emerald-400",
    warning: "bg-amber-500/12 border-amber-500/30 text-amber-400",
    accent: "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wide " +
        map[tone]
      }
    >
      {children}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-6 py-12 text-center">
      <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4 text-[var(--text-ghost)]">
        <PackageIcon size={20} />
      </div>
      <div className="text-[14px] font-semibold text-[var(--text-secondary)]">
        {title}
      </div>
      <p className="text-[12.5px] text-[var(--text-dim)] mt-1 max-w-sm mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function GuideDialog({
  guide,
  onClose,
}: {
  guide: InstallGuide;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight">{guide.title}</h3>
            <p className="text-[12.5px] text-[var(--text-dim)] mt-0.5">
              {guide.summary}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors shrink-0"
          >
            <CrossIcon size={16} />
          </button>
        </div>
        <ol className="p-5 space-y-3">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-[1px] h-5 w-5 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                {s}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────── */
function osName(os: DetectedPlatform["os"] | undefined): string {
  switch (os) {
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return "your device";
  }
}

function formatDate(iso: string, short = false): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: short ? "2-digit" : "numeric",
    month: "short",
    day: "numeric",
  });
}
