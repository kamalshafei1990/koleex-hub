/**
 * Download Center — local data source (Super-Admin module).
 *
 * Central catalog of Koleex software downloads, organised the way real product
 * download pages are: by platform group (Desktop / Mobile / China app stores),
 * each option carrying its real platform logo. Logos come from the Database
 * app → "Operation Systems" collection (public `media` bucket). Data is local
 * for now; later this can read the collection + releases live without changing
 * the page contract.
 */

/* ── GitHub release (real desktop installers) ───────────────────────────── */
export const GITHUB_RELEASE_TAG = "desktop-build-1";
export const GITHUB_RELEASES_URL =
  "https://github.com/kamalshafei1990/koleex-hub/releases";
export const CURRENT_RELEASE_URL = `${GITHUB_RELEASES_URL}/tag/${GITHUB_RELEASE_TAG}`;
const DL = `${GITHUB_RELEASES_URL}/download/${GITHUB_RELEASE_TAG}`;
export const LATEST_DESKTOP_VERSION = "1.0.0";

/** Koleex Hub app icon (public asset, served by the web app / desktop shell). */
export const KOLEEX_APP_ICON = "/icon-512.png";

/* ── Platform logos (Database → "Operation Systems" collection) ─────────── */
const MEDIA = "https://yxyizbnfjrwrnmwhkvme.supabase.co/storage/v1/object/public/media/";
const BIZ = `${MEDIA}visual-library/business/`;
export const OS_LOGOS = {
  apple: `${BIZ}apple-logo.svg`,
  windows: `${BIZ}windows-ivsvbw.svg`,
  linux: `${BIZ}linux-platform-oz2vao.svg`,
  appStore: `${BIZ}app-store-nhfezg.svg`,
  googlePlay: `${BIZ}google-play-7ih6vy.svg`,
  apk: `${MEDIA}visual-library/files/apk-jf5ar6.svg`,
  huaweiGallery: `${BIZ}huawei-app-gallery-m8du3b.svg`,
  huawei: `${BIZ}huawei-4yiva1.svg`,
  xiaomi: `${BIZ}xiaomi-hq7rvo.svg`,
  getApps: `${BIZ}get-apps-m9970t.svg`,
  oppo: `${BIZ}oppo-z98wzx.svg`,
  vivo: `${BIZ}vivo-1y8br4.svg`,
  tencent: `${BIZ}tencent-yi4ahb.svg`,
} as const;

/* ── Types ──────────────────────────────────────────────────────────────── */
export type DetectedOS = "windows" | "macos" | "linux" | "mobile" | "unknown";

export interface DownloadTarget {
  id: string;
  /** Platform / store name, e.g. "macOS", "Windows", "Google Play". */
  name: string;
  /** Short qualifier under the name, e.g. "Apple Silicon", "App Store". */
  sublabel: string;
  /** Logo image URL (empty → page renders a neutral fallback glyph). */
  logo: string;
  /** Download / store URL (omitted when coming soon). */
  url?: string;
  status: "available" | "coming-soon";
  /** OS this target satisfies — used for the smart recommendation. */
  matchOs?: DetectedOS;
  /** Right-aligned meta on the card, e.g. "94 MB · v1.0.0". */
  meta?: string;
  /** Optional secondary link, e.g. the Windows portable build. */
  secondary?: { label: string; url: string };
}

export interface DownloadGroup {
  id: string;
  title: string;
  subtitle: string;
  targets: DownloadTarget[];
}

/* ── Download groups ────────────────────────────────────────────────────── */
export const DOWNLOAD_GROUPS: DownloadGroup[] = [
  {
    id: "desktop",
    title: "Desktop",
    subtitle: "Full Koleex Hub experience on your computer",
    targets: [
      {
        id: "macos",
        name: "macOS",
        sublabel: "Apple Silicon",
        logo: OS_LOGOS.apple,
        url: `${DL}/Koleex.Hub-1.0.0.dmg`,
        status: "available",
        matchOs: "macos",
        meta: `94 MB · v${LATEST_DESKTOP_VERSION}`,
      },
      {
        id: "windows",
        name: "Windows",
        sublabel: "Windows 10 / 11 · 64-bit",
        logo: OS_LOGOS.windows,
        url: `${DL}/Koleex.Hub-Setup-1.0.0.exe`,
        status: "available",
        matchOs: "windows",
        meta: `78 MB · v${LATEST_DESKTOP_VERSION}`,
        secondary: { label: "Portable (no install)", url: `${DL}/Koleex.Hub-Portable-1.0.0.exe` },
      },
      {
        id: "linux",
        name: "Linux",
        sublabel: "AppImage · 64-bit",
        logo: OS_LOGOS.linux,
        status: "coming-soon",
        matchOs: "linux",
        meta: `v${LATEST_DESKTOP_VERSION}`,
      },
    ],
  },
  {
    id: "mobile",
    title: "Mobile",
    subtitle: "Koleex Hub on your phone and tablet",
    targets: [
      {
        id: "ios",
        name: "iOS",
        sublabel: "iPhone & iPad",
        logo: OS_LOGOS.appStore,
        status: "coming-soon",
        matchOs: "mobile",
      },
      {
        id: "android-play",
        name: "Android",
        sublabel: "Google Play",
        logo: OS_LOGOS.googlePlay,
        status: "coming-soon",
        matchOs: "mobile",
      },
      { id: "huawei", name: "Huawei", sublabel: "AppGallery", logo: OS_LOGOS.huaweiGallery, status: "coming-soon", matchOs: "mobile" },
    ],
  },
  {
    id: "china",
    title: "China App Stores",
    subtitle: "Android distribution for Mainland China",
    targets: [
      { id: "xiaomi", name: "Xiaomi", sublabel: "GetApps", logo: OS_LOGOS.getApps, status: "coming-soon" },
      { id: "oppo", name: "OPPO", sublabel: "App Market", logo: OS_LOGOS.oppo, status: "coming-soon" },
      { id: "vivo", name: "vivo", sublabel: "V-AppStore", logo: OS_LOGOS.vivo, status: "coming-soon" },
      { id: "tencent", name: "Tencent", sublabel: "MyApp · 应用宝", logo: OS_LOGOS.tencent, status: "coming-soon" },
    ],
  },
  {
    id: "apk",
    title: "APK",
    subtitle: "Direct Android install — no store required",
    targets: [
      { id: "android-apk", name: "Android APK", sublabel: "Direct install (.apk)", logo: OS_LOGOS.apk, status: "coming-soon", matchOs: "mobile" },
    ],
  },
];

/** All targets flattened (search + recommendation lookup). */
export const ALL_TARGETS: DownloadTarget[] = DOWNLOAD_GROUPS.flatMap((g) => g.targets);

/* ── Release notes (timeline) ───────────────────────────────────────────── */
export interface ReleaseNote {
  version: string;
  date: string;
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

/* ── Installation guides (dialogs) ──────────────────────────────────────── */
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
export interface DetectedPlatform {
  os: DetectedOS;
  label: string;
  recommendedId: string | null;
}

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
    return { os: "windows", label: "Windows", recommendedId: "windows" };
  }
  if (/mac/i.test(plat) || /mac os x|macintosh/i.test(ua)) {
    return { os: "macos", label: "macOS · Apple Silicon", recommendedId: "macos" };
  }
  if (/linux|x11/i.test(plat) || /linux/i.test(ua)) {
    return { os: "linux", label: "Linux", recommendedId: "linux" };
  }
  return { os: "unknown", label: "your device", recommendedId: null };
}
