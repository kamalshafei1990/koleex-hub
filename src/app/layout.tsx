import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RootShell from "@/components/layout/RootShell";
import DialogHost from "@/lib/ui-dialog";
import SmartCreateDrawer from "@/components/ui/create/SmartCreateDrawer";
import Providers from "./providers";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SKIN_BOOTSTRAP } from "@/lib/appearance";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /* Build id baked into the HTML at build time so UpdateWatcher can compare
     the RUNNING bundle against /api/version without relying on NEXT_PUBLIC_*
     env exposure (which silently breaks the stale-tab detector when Vercel's
     system-env exposure is off). Renders as <meta name="kx-build" …>. */
  other: { "kx-build": process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev" },
  title: "KOLEEX — Enterprise Platform",
  description: "Koleex ERP — Manage products, operations, and more",
  /* Links /manifest.webmanifest → installable PWA (required for iOS Web Push). */
  manifest: "/manifest.webmanifest",
  applicationName: "Koleex Hub",
  /* iOS standalone mode: open from the Home Screen icon as a full-screen app
     (also a prerequisite for iOS 16.4+ Web Push). */
  appleWebApp: {
    capable: true,
    title: "Koleex Hub",
    statusBarStyle: "black-translucent",
  },
  icons: {
    /* ?v=3 busts browser/OS favicon caches after the hub-lockup icon
       refresh — without it Safari/Chrome kept serving the pre-logo-v2
       icons for tabs, Add-to-Home-Screen and Add-to-Dock. Bump the
       version whenever the icon artwork changes. v3 = 2026-08-08 icon
       (KOLEEX centred + AI-face gradient). */
    icon: [
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/icon.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png?v=3", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png?v=3", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon.png?v=3",
  },
};

/* Lock the viewport on mobile so iOS Safari doesn't auto-zoom into
   text inputs (which happens whenever an <input>/<textarea> has a
   font-size smaller than 16px). `maximumScale: 1` + `userScalable:
   false` are the belt-and-suspenders approach; the inputs themselves
   also get `font-size: 16px` via globals.css. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* data-scroll-behavior: our smooth scrolling (globals.css) is intentional —
       this silences Next.js's route-transition advisory warning hub-wide. */
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} h-full antialiased`}>
      {/* Skin + theme stamped on <html> BEFORE the first frame. Both used to
          be applied on mount by DisplayPreferencesApplier, which is one frame
          late: the theme flash was survivable, but a skin arriving late means
          the entire background appears after paint. Also sets the low-power
          flag, so glass surfaces never have to blur once and then stop. */}
      <script dangerouslySetInnerHTML={{ __html: SKIN_BOOTSTRAP }} />
      {/* Theme tokens (not hardcoded dark) so the base flips with light/dark —
          otherwise light mode showed a black body base behind gaps and any
          un-themed text inherited white → white-on-white. Dark mode is
          unchanged (--bg-primary #0A0A0A / --text-primary #fff). */}
      <body className="h-full overflow-hidden flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
        <Providers>
          <RootShell>{children}</RootShell>
          {/* Global themed replacement for window.confirm/alert/prompt.
              Mounted once so any component can call dialog.confirm()
              without each page wiring its own state. */}
          <DialogHost />
          {/* Global "+ Create" launcher — callable from header chips,
              mobile action bar, and openSmartCreate() helper. */}
          <SmartCreateDrawer />
          {/* Vercel Speed Insights — real-user Core Web Vitals (LCP/INP/CLS)
              with P75 percentiles per route. Sends only performance timings +
              normalized route names; no user content. Dashboard: Vercel →
              project → Speed Insights (enable once, owner-side). */}
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
