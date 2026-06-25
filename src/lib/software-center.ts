/**
 * Software Center — local data source (Super-Admin module).
 *
 * Central catalog of downloadable Koleex software: desktop installers, future
 * mobile apps, drivers/utilities, release notes and install guides. Data is
 * kept LOCAL for now (direct GitHub Release URLs); later this migrates to
 * Supabase behind an API without changing the page contract.
 *
 * Everything here is additive and presentational — no business logic.
 */

/* ── Core type (per spec) ───────────────────────────────────────────────── */
export interface SoftwareRelease {
  id: string;
  name: string;
  version: string;
  platform: "windows" | "macos" | "linux";
  architecture?: "arm64" | "x64";
  fileSize: string;
  releaseDate: string; // ISO yyyy-mm-dd
  downloadUrl: string;
  releaseNotesUrl?: string;
  status: "stable" | "beta";
  recommended?: boolean;
  /** True when the artifact isn't published yet (renders as a disabled card). */
  comingSoon?: boolean;
  /** Short human label for the platform/arch, e.g. "macOS · Apple Silicon". */
  platformLabel?: string;
}

/* The GitHub release these artifacts come from (first real build). */
export const GITHUB_RELEASE_TAG = "desktop-build-1";
export const GITHUB_RELEASES_URL =
  "https://github.com/kamalshafei1990/koleex-hub/releases";
export const CURRENT_RELEASE_URL = `${GITHUB_RELEASES_URL}/tag/${GITHUB_RELEASE_TAG}`;
const DL = `${GITHUB_RELEASES_URL}/download/${GITHUB_RELEASE_TAG}`;

/** Latest shipped desktop version (independent of the web app). */
export const LATEST_DESKTOP_VERSION = "1.0.0";

/* ── Stable releases ────────────────────────────────────────────────────── */
export const STABLE_RELEASES: SoftwareRelease[] = [
  {
    id: "macos-arm64",
    name: "Koleex Hub Desktop",
    version: LATEST_DESKTOP_VERSION,
    platform: "macos",
    architecture: "arm64",
    platformLabel: "macOS · Apple Silicon",
    fileSize: "94 MB",
    releaseDate: "2026-06-25",
    downloadUrl: `${DL}/Koleex.Hub-1.0.0.dmg`,
    releaseNotesUrl: CURRENT_RELEASE_URL,
    status: "stable",
  },
  {
    id: "windows-x64",
    name: "Koleex Hub Desktop",
    version: LATEST_DESKTOP_VERSION,
    platform: "windows",
    architecture: "x64",
    platformLabel: "Windows · 64-bit",
    fileSize: "78 MB",
    releaseDate: "2026-06-25",
    downloadUrl: `${DL}/Koleex.Hub-Setup-1.0.0.exe`,
    releaseNotesUrl: CURRENT_RELEASE_URL,
    status: "stable",
  },
  {
    id: "windows-portable",
    name: "Koleex Hub Portable",
    version: LATEST_DESKTOP_VERSION,
    platform: "windows",
    architecture: "x64",
    platformLabel: "Windows · No install",
    fileSize: "78 MB",
    releaseDate: "2026-06-25",
    downloadUrl: `${DL}/Koleex.Hub-Portable-1.0.0.exe`,
    releaseNotesUrl: CURRENT_RELEASE_URL,
    status: "stable",
  },
  {
    id: "linux",
    name: "Koleex Hub for Linux",
    version: LATEST_DESKTOP_VERSION,
    platform: "linux",
    architecture: "x64",
    platformLabel: "Linux · AppImage",
    fileSize: "—",
    releaseDate: "2026-06-25",
    downloadUrl: "",
    status: "stable",
    comingSoon: true,
  },
];

/* ── Beta releases ──────────────────────────────────────────────────────── */
export const BETA_RELEASES: SoftwareRelease[] = [];

/* ── Release notes (timeline, data-driven) ──────────────────────────────── */
export interface ReleaseNote {
  version: string;
  date: string; // ISO yyyy-mm-dd
  channel: "stable" | "beta";
  highlights: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.0.0",
    date: "2026-06-25",
    channel: "stable",
    highlights: [
      "Native desktop shell wrapping the live Koleex Hub",
      "Native notifications",
      "Native downloads with system Save dialog",
      "Automatic reconnect when the connection drops",
      "Window size & position persistence",
      "Offline recovery screen with auto-retry",
      "Crash-safe error handling + local diagnostics logs",
      "Hardened security (context isolation, sandbox, allow-listed navigation)",
    ],
  },
];

/* ── Drivers & utilities (empty for now) ────────────────────────────────── */
export interface DriverItem {
  id: string;
  name: string;
  description: string;
  downloadUrl: string;
  platform: "windows" | "macos" | "linux" | "all";
}

export const DRIVERS: DriverItem[] = [];

/* ── Installation guides (placeholder dialogs) ──────────────────────────── */
export interface InstallGuide {
  id: string;
  title: string;
  summary: string;
  steps: string[];
}

export const INSTALL_GUIDES: InstallGuide[] = [
  {
    id: "macos",
    title: "macOS Installation Guide",
    summary: "Install Koleex Hub Desktop on a Mac (Apple Silicon).",
    steps: [
      "Download the .dmg for macOS.",
      "Open the .dmg and drag Koleex Hub into the Applications folder.",
      "First launch only: right-click the app → Open, then confirm (the build is not yet code-signed).",
      "Sign in once — your session persists across restarts.",
    ],
  },
  {
    id: "windows",
    title: "Windows Installation Guide",
    summary: "Install Koleex Hub Desktop on Windows 10/11.",
    steps: [
      "Download the Setup .exe (or the Portable build for no-install use).",
      "Run the installer. If SmartScreen appears, click More info → Run anyway (the build is not yet code-signed).",
      "Choose an install location and finish — a desktop + Start-menu shortcut are created.",
      "Launch Koleex Hub and sign in.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Common issues and how to resolve them.",
    steps: [
      "Blank window on launch: the app auto-retries; check Tools → Open Logs Folder for details.",
      "“App can't be opened” (macOS) / SmartScreen (Windows): expected for an unsigned build — use the right-click Open / Run anyway steps above.",
      "Login doesn't persist: ensure you reached the app over HTTPS and relaunch.",
      "Need diagnostics: Tools → Open Logs Folder (logs are local only — nothing is sent externally).",
    ],
  },
];

/* ── Smart platform detection (client-only) ─────────────────────────────── */
export type DetectedOS = "windows" | "macos" | "linux" | "mobile" | "unknown";

export interface DetectedPlatform {
  os: DetectedOS;
  /** Human label for the hero, e.g. "macOS · Apple Silicon". */
  label: string;
  /** Best stable release to recommend, or null if none applies. */
  recommendedId: string | null;
}

/**
 * Best-effort OS/arch detection from the browser. Reliable for OS; macOS
 * architecture can't be read synchronously, so we default the recommendation
 * to the Apple Silicon build (the only mac artifact today) and surface a note
 * in the UI for Intel users.
 */
export function detectPlatform(): DetectedPlatform {
  if (typeof navigator === "undefined") {
    return { os: "unknown", label: "your device", recommendedId: null };
  }
  const ua = navigator.userAgent || "";
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  const plat = (uaData?.platform || navigator.platform || "").toLowerCase();

  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) {
    return { os: "mobile", label: "a mobile device", recommendedId: null };
  }
  if (/win/i.test(plat) || /windows/i.test(ua)) {
    return { os: "windows", label: "Windows", recommendedId: "windows-x64" };
  }
  if (/mac/i.test(plat) || /mac os x|macintosh/i.test(ua)) {
    return { os: "macos", label: "macOS · Apple Silicon", recommendedId: "macos-arm64" };
  }
  if (/linux|x11/i.test(plat) || /linux/i.test(ua)) {
    return { os: "linux", label: "Linux", recommendedId: "linux" };
  }
  return { os: "unknown", label: "your device", recommendedId: null };
}
