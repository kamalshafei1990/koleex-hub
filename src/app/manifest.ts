import type { MetadataRoute } from "next";

/* Web App Manifest (served at /manifest.webmanifest).

   Makes Koleex Hub an installable, standalone PWA — a hard prerequisite for
   iOS 16.4+ Web Push (the app must be added to the Home Screen and open in
   standalone mode). Icons reuse the existing public/ assets. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koleex Hub",
    /* This is the label under the installed icon — iOS and Android both
       prefer short_name over name for the Home Screen, which is why the
       app installed as plain "Koleex". Ten characters, so it still fits
       the launcher without being truncated. */
    short_name: "Koleex Hub",
    description: "Koleex ERP — products, operations, finance, and more",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    /* ?v=3 matches layout.tsx's icon cache-buster — installed-PWA icon
       managers re-fetch when the manifest icon URLs change. */
    icons: [
      { src: "/icon-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
