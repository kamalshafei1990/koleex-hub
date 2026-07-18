import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RootShell from "@/components/layout/RootShell";
import DialogHost from "@/lib/ui-dialog";
import SmartCreateDrawer from "@/components/ui/create/SmartCreateDrawer";
import Providers from "./providers";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon.png",
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
