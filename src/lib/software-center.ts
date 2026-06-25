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
export const GITHUB_RELEASE_TAG = "desktop-build-4";
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
  // Colorful brand SVGs served from /public (uploaded by Kamal).
  windows: "/os-logos/windows.svg",
  linux: "/os-logos/linux.svg",
  appStore: "/os-logos/app-store.svg",
  googlePlay: "/os-logos/google-play.svg",
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

/* ── Installation guides (detailed dialogs) ─────────────────────────────── */
export interface GuideStep {
  title: string;
  detail?: string;
}
export interface InstallGuide {
  id: string;
  title: string;
  summary: string;
  /** Card icon: a platform logo URL (Apple/Windows) — omit for a glyph. */
  logo?: string;
  /** Short framing paragraph at the top of the dialog. */
  intro: string;
  steps: GuideStep[];
  /** "Good to know" bullets shown under the steps. */
  notes: string[];
}
export const INSTALL_GUIDES: InstallGuide[] = [
  {
    id: "macos",
    title: "macOS Installation Guide",
    summary: "Install Koleex Hub Desktop on a Mac (Apple Silicon).",
    logo: OS_LOGOS.apple,
    intro:
      "Koleex Hub Desktop is a native window around the live Hub — you always get the latest web app, plus native notifications, downloads and offline recovery. Built for Apple Silicon (M1 and newer).",
    steps: [
      { title: "Download the .dmg", detail: "From the macOS card above, click Download (Koleex Hub-1.0.0.dmg, about 94 MB)." },
      { title: "Open and install", detail: "Double-click the downloaded .dmg, then drag the Koleex Hub icon into the Applications folder." },
      { title: "First launch — right-click → Open", detail: "This build isn't code-signed yet, so a normal double-click shows an “unidentified developer” warning. Instead, right-click (or Control-click) the app in Applications → Open → Open. You only do this the first time." },
      { title: "Sign in", detail: "Log in with your Koleex account. Your session is remembered across restarts." },
    ],
    notes: [
      "Requires macOS 12 or later on Apple Silicon. Intel Macs aren't supported yet.",
      "Updates are automatic — the app loads the live Hub, so you never need to reinstall for web updates.",
      "To remove it: drag Koleex Hub from Applications to the Trash.",
    ],
  },
  {
    id: "windows",
    title: "Windows Installation Guide",
    summary: "Install Koleex Hub Desktop on Windows 10 / 11.",
    logo: OS_LOGOS.windows,
    intro:
      "Koleex Hub Desktop runs the live Hub in a native window on Windows 10 and 11, with notifications, downloads and automatic reconnect.",
    steps: [
      { title: "Download the installer", detail: "From the Windows card above, click Download (Koleex Hub-Setup-1.0.0.exe, about 78 MB)." },
      { title: "Run Setup", detail: "Double-click the .exe. If Windows SmartScreen appears, click More info → Run anyway — this is expected for an unsigned build." },
      { title: "Choose location and finish", detail: "Pick an install folder and complete setup. Desktop and Start-menu shortcuts are created automatically." },
      { title: "Sign in", detail: "Launch Koleex Hub and log in with your account." },
    ],
    notes: [
      "Works on Windows 10 and 11 (64-bit).",
      "Updates are automatic — no reinstall needed for web updates.",
      "To remove it: uninstall from Settings → Apps → Installed apps.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Common issues and how to resolve them.",
    intro:
      "Most issues are quick to fix. Find the symptom below and follow the steps.",
    steps: [
      { title: "“App can't be opened” / SmartScreen warning", detail: "Expected for an unsigned build. macOS: right-click the app → Open. Windows: click More info → Run anyway. Signed builds will remove these prompts in future." },
      { title: "Blank or stuck window on launch", detail: "The app couldn't reach the server. It auto-retries and shows a countdown with a Retry button — check your internet connection and wait, or click Retry." },
      { title: "Login doesn't persist after restart", detail: "Make sure you opened the app over HTTPS, then quit and relaunch. Clearing the app data and signing in again also resolves it." },
      { title: "Need diagnostics or logs", detail: "In the desktop app menu choose Tools → Open Logs Folder. Logs are stored locally on your device only — nothing is sent anywhere." },
    ],
    notes: [
      "Still stuck? Share the log file with your administrator, or ask in the Discuss app.",
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
