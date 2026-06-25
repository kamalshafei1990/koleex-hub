"use client";

/**
 * Download Center (Super-Admin) — product-style download page. Platform groups
 * (Desktop / Mobile / China app stores), each option shown with its real
 * platform logo (from the Database → "Operation Systems" collection) and a
 * clear Download button. Smart OS detection highlights the recommended build.
 * Reuses the canonical PageHeader + AuthGate + design tokens. Additive.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
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
  DOWNLOAD_GROUPS,
  RELEASE_NOTES,
  INSTALL_GUIDES,
  CURRENT_RELEASE_URL,
  LATEST_DESKTOP_VERSION,
  KOLEEX_APP_ICON,
  detectPlatform,
  type DownloadTarget,
  type DownloadGroup,
  type DetectedPlatform,
  type InstallGuide,
} from "@/lib/software-center";

export default function SoftwareCenterPage() {
  return (
    <AuthGate
      title="Download Center"
      subtitle="Download apps, updates, drivers and installers"
    >
      <DownloadCenterView />
    </AuthGate>
  );
}

/* ── SA gate ────────────────────────────────────────────────────────────── */
function DownloadCenterView() {
  const { data: boot } = useMeBootstrap();
  const isSuperAdmin = !!boot?.isSuperAdmin;

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
          <Link href="/" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }
  return <DownloadCenterContent />;
}

/* SSR-safe client platform detection (no setState-in-effect). */
let cachedPlatform: DetectedPlatform | null = null;
const getPlatformSnapshot = (): DetectedPlatform => {
  if (!cachedPlatform) cachedPlatform = detectPlatform();
  return cachedPlatform;
};
const emptySubscribe = () => () => {};

/* ── Content ────────────────────────────────────────────────────────────── */
function DownloadCenterContent() {
  const platform = useSyncExternalStore<DetectedPlatform | null>(
    emptySubscribe,
    getPlatformSnapshot,
    () => null,
  );
  const [query, setQuery] = useState("");
  const [guide, setGuide] = useState<InstallGuide | null>(null);

  const desktopTargets =
    DOWNLOAD_GROUPS.find((g) => g.id === "desktop")?.targets ?? [];

  const groups = useMemo<DownloadGroup[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOWNLOAD_GROUPS;
    return DOWNLOAD_GROUPS.map((g) => ({
      ...g,
      targets: g.targets.filter((t) =>
        [t.name, t.sublabel, g.title].some((v) => v.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.targets.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 pt-5 md:pt-7 pb-16">
        <PageHeader
          title="Download Center"
          subtitle="Download apps, updates, drivers and installers"
          icon="download"
          backHref="/"
          searchPlaceholder="Search downloads…"
          onSearchSubmit={setQuery}
        />

        <Hero platform={platform} desktopTargets={desktopTargets} />

        {/* Platform groups */}
        {groups.map((g) => (
          <Section key={g.id} title={g.title} subtitle={g.subtitle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {g.targets.map((t) => (
                <DownloadCard key={t.id} target={t} />
              ))}
            </div>
          </Section>
        ))}

        {groups.length === 0 && (
          <div className="mt-10">
            <EmptyState
              title="No matching downloads"
              body={`Nothing matches “${query}”. Try a different search.`}
            />
          </div>
        )}

        {/* Release notes */}
        <Section title="Release Notes" subtitle="What changed in each version">
          <ol className="relative ml-1 border-l border-[var(--border-subtle)]">
            {RELEASE_NOTES.map((note) => (
              <li key={note.version} className="relative pl-6 pb-8 last:pb-0">
                <span className="absolute -left-[6px] top-1 h-3 w-3 rounded-full bg-[var(--bg-inverted)] ring-4 ring-[var(--bg-primary)]" />
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[15px] font-bold tracking-tight">Version {note.version}</span>
                  <Badge tone="success">{note.channel === "beta" ? "Beta" : "Stable"}</Badge>
                  <span className="text-[12px] text-[var(--text-dim)]">{formatDate(note.date)}</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {note.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckIcon size={15} className="mt-[2px] text-emerald-400 shrink-0" />
                      <span className="text-[13px] text-[var(--text-muted)] leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>

        {/* Installation guides */}
        <Section title="Installation Guides" subtitle="Step-by-step setup and troubleshooting">
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
                <p className="text-[12.5px] text-[var(--text-dim)] leading-relaxed">{g.summary}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)]">Read guide →</span>
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
  desktopTargets,
}: {
  platform: DetectedPlatform | null;
  desktopTargets: DownloadTarget[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] mt-4 md:mt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "var(--accent)" }}
      />
      <div className="relative p-5 md:p-10 flex flex-row md:items-center gap-4 md:gap-8">
        {/* Koleex Hub app icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={KOLEEX_APP_ICON}
          alt="Koleex Hub"
          className="h-12 w-12 md:h-20 md:w-20 rounded-2xl shrink-0 shadow-lg ring-1 ring-[var(--border-subtle)]"
        />
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Koleex Hub Desktop v{LATEST_DESKTOP_VERSION}
          </div>
          <h1 className="text-xl md:text-[34px] font-bold tracking-tight leading-[1.1] mb-1.5">
            Get Koleex Hub
          </h1>
          <p className="hidden sm:block text-[13.5px] md:text-[15px] text-[var(--text-muted)] max-w-xl leading-relaxed">
            One workspace, every device — choose your platform below. Desktop is
            live today; mobile and China app stores are on the way.
          </p>
          {platform && (
            <p className="mt-1.5 sm:mt-4 text-[12.5px] md:text-[13px] text-[var(--text-dim)]">
              You&apos;re using{" "}
              <span className="text-[var(--text-primary)] font-medium">{platform.label}</span>
            </p>
          )}
          {/* Explicit per-OS download buttons */}
          <div className="mt-3 md:mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3">
            {desktopTargets
              .filter((t) => t.status === "available" && t.url)
              .map((t) => (
                <HeroPlatformButton key={t.id} target={t} />
              ))}
            <a
              href={CURRENT_RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-11 md:h-12 w-full sm:w-auto px-5 rounded-2xl border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              All releases
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* One hero button per desktop OS, each with its platform logo. Available =
   solid download; coming-soon (Linux) = muted, non-clickable. */
function HeroPlatformButton({ target }: { target: DownloadTarget }) {
  const available = target.status === "available" && !!target.url;
  const label = available ? `Download for ${target.name}` : `${target.name} · Soon`;
  const inner = (
    <>
      {/* Monochrome: matches the button's inverted text colour in both themes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={target.logo}
        alt=""
        className="h-5 w-5 object-contain shrink-0 [filter:brightness(0)_invert(1)] dark:[filter:brightness(0)]"
      />
      {label}
    </>
  );
  if (available) {
    return (
      <a
        href={target.url}
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2.5 h-11 md:h-12 w-full sm:w-auto px-5 rounded-2xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[14px] font-semibold hover:opacity-90 transition-all shadow-lg"
      >
        {inner}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center justify-center gap-2.5 h-11 md:h-12 w-full sm:w-auto px-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] text-[14px] font-semibold">
      {inner}
    </span>
  );
}

/* ── Download card ──────────────────────────────────────────────────────── */
function DownloadCard({ target }: { target: DownloadTarget }) {
  const available = target.status === "available" && !!target.url;
  return (
    <div className="relative flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 transition-all hover:border-[var(--border-strong)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <PlatformLogo logo={target.logo} />
        {target.status === "coming-soon" && <Badge tone="neutral">Coming soon</Badge>}
      </div>

      <div className="text-[16px] font-semibold leading-tight">{target.name}</div>
      <div className="text-[12.5px] text-[var(--text-dim)] mt-0.5">{target.sublabel}</div>
      {target.meta && (
        <div className="mt-1 text-[11.5px] text-[var(--text-ghost)]">{target.meta}</div>
      )}

      <div className="mt-auto pt-4 flex flex-col gap-2">
        {available ? (
          <a
            href={target.url}
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13.5px] font-semibold hover:opacity-90 transition-all"
          >
            <DownloadIcon size={16} /> Download
          </a>
        ) : (
          <span className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] text-[13.5px] font-semibold cursor-not-allowed">
            Coming soon
          </span>
        )}
        {target.secondary && (
          <a
            href={target.secondary.url}
            rel="noopener noreferrer"
            className="text-center text-[12px] font-medium text-[var(--accent)] hover:underline"
          >
            {target.secondary.label}
          </a>
        )}
      </div>
    </div>
  );
}

/* White tile keeps brand logos (incl. black/colored) crisp in dark + light. */
function PlatformLogo({ logo }: { logo: string }) {
  if (!logo) {
    return (
      <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)]">
        <PackageIcon size={20} />
      </div>
    );
  }
  return (
    <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center p-2.5 shrink-0">
      {/* Monochrome: white logo on dark, black on light — matches the UI. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt=""
        loading="lazy"
        className="max-h-full max-w-full object-contain [filter:brightness(0)] dark:[filter:brightness(0)_invert(1)]"
      />
    </div>
  );
}

/* ── Building blocks ────────────────────────────────────────────────────── */
function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 md:mt-12">
      <div className="mb-3 md:mb-5">
        <h2 className="text-[18px] md:text-[20px] font-bold tracking-tight">{title}</h2>
        <p className="text-[12.5px] text-[var(--text-dim)] mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

type Tone = "neutral" | "success" | "accent";
function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const map: Record<Tone, string> = {
    neutral: "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)]",
    success: "bg-emerald-500/12 border-emerald-500/30 text-emerald-400",
    accent: "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10",
  };
  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wide " + map[tone]}>
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
      <div className="text-[14px] font-semibold text-[var(--text-secondary)]">{title}</div>
      <p className="text-[12.5px] text-[var(--text-dim)] mt-1 max-w-sm mx-auto leading-relaxed">{body}</p>
    </div>
  );
}

function GuideDialog({ guide, onClose }: { guide: InstallGuide; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-secondary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight">{guide.title}</h3>
            <p className="text-[12.5px] text-[var(--text-dim)] mt-0.5">{guide.summary}</p>
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
              <span className="text-[13px] text-[var(--text-muted)] leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────── */
function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
