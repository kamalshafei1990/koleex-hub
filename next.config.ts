import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
