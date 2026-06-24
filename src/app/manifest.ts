import type { MetadataRoute } from "next";

/* Web App Manifest (served at /manifest.webmanifest).

   Makes Koleex Hub an installable, standalone PWA — a hard prerequisite for
   iOS 16.4+ Web Push (the app must be added to the Home Screen and open in
   standalone mode). Icons reuse the existing public/ assets. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koleex Hub",
    short_name: "Koleex",
    description: "Koleex ERP — products, operations, finance, and more",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
