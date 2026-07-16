import type { NextConfig } from "next";

/* China R3: the exact Supabase project host, derived from the build env so
   previews keep working. Only PUBLIC storage paths are ever allowed below.

   This previously defaulted to the production host when NEXT_PUBLIC_SUPABASE_URL
   was absent or unparseable. That silently allowed the image optimizer to proxy
   PRODUCTION storage from a Preview build pointed at a different Supabase
   project — the environment leak this whole staging split exists to prevent, and
   invisible because the fallback made it look like it worked.

   Fail closed instead: a build without the variable is misconfigured, and a
   loud build failure is the correct outcome. */
const SUPABASE_HOST = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required at build time (image remotePatterns). " +
        "Set it for this environment — it must never default to production.",
    );
  }
  try {
    return new URL(raw).hostname;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* China remediation R3 (stage 1): first-party image delivery. The browser
     requests /_next/image on OUR origin (proven ~99% reachable from mainland
     China); Vercel fetches the original from Supabase server-side (hnd1 <->
     Tokyo, ~ms), resizes, and edge-caches. remotePatterns is narrowly scoped
     to this project's PUBLIC storage paths only — the optimizer cannot proxy
     arbitrary hosts or private buckets. Widths/qualities are an allowlist the
     cdnImage() helper snaps to. */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: SUPABASE_HOST, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: SUPABASE_HOST, pathname: "/storage/v1/render/image/public/**" },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 160, 256, 384, 480],
    qualities: [75, 78],
    /* Most uploads use unique timestamped paths (effectively immutable); a
       replaced-in-place image converges within 4h. */
    minimumCacheTTL: 14400,
  },
  /* Native N-API module (Argon2id password hashing, Phase 2A S0). Keep it
     OUT of the server bundle so the prebuilt .node binary is require()'d at
     runtime instead of being mangled by the bundler. Server (Node) runtime
     only — never imported into client/edge code. */
  serverExternalPackages: ["@node-rs/argon2"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  /* Perf: smaller production bundles + faster client navigations. */
  productionBrowserSourceMaps: false, // no 2–3 MB maps shipped to users
  compress: true,                     // brotli/gzip on the edge
  poweredByHeader: false,             // one fewer header
  experimental: {
    optimizeCss: true,
    /* Tree-shake the heaviest peer deps — each has dozens of
       sub-modules where `import { X } from "pkg"` otherwise drags
       the whole barrel into the bundle. Next.js rewrites these
       imports so only the referenced modules get pulled in. */
    optimizePackageImports: [
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-link",
      "@tiptap/extension-image",
      "@tiptap/extension-placeholder",
      "@tiptap/extension-highlight",
      "@tiptap/extension-task-list",
      "@tiptap/extension-task-item",
      "@tiptap/extension-underline",
      "@supabase/supabase-js",
      "react-markdown",
      "remark-gfm",
    ],
  },
};

export default nextConfig;
