/**
 * Generated social/share image for /products/preview/[slug].
 * ---------------------------------------------------------------------------
 * Branded KOLEEX card: black background, real KOLEEX logo (top), the product
 * photo (centre), and the product name + primary model (bottom). Next wires
 * this as the page's og:image / twitter image automatically (file
 * convention), so WhatsApp / WeChat / Facebook / LinkedIn / X all show the
 * same branded card when the link is shared.
 *
 * Rendered with next/og (Satori) — inline styles only. The logo is inlined
 * from /public; the product photo is fetched + inlined defensively (skipped
 * if it can't be loaded, so the card never fails to render).
 */

import { ImageResponse } from "next/og";
import { loadPublicSchemaProduct } from "@/lib/server/product-detail";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "KOLEEX product";

/** Inline a remote image as a data URI; returns null on any failure. */
async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  let name = "Product";
  let model = "";
  let photo: string | null = null;
  try {
    const { slug } = await params;
    const loaded = await loadPublicSchemaProduct(slug);
    if (loaded) {
      name = loaded.productName || name;
      model = loaded.preview.primaryModel || "";
      photo = await toDataUri(loaded.preview.mainImageUrl);
    }
  } catch {
    /* fall back to the generic branded card below */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          background: "#000000",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left column — KOLEEX logo pinned to the top (small), product name
            + model number centred in the remaining space */}
        <div
          style={{
            width: "44%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "48px 52px",
          }}
        >
          <svg width={96} height={14} viewBox="0 0 719.83 107.57" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: 16 }}>
            <path d="M116.59,96.3v11.05h-10.6L14.66,62.47v44.88H0V1.58h14.66v43.53L105.99,1.58h10.6v11.05L28.42,53.9l88.18,42.4Z" />
            <path d="M242.65,71.04c0,20.07-14.21,36.54-34.28,36.54h-50.74c-20.52,0-35.18-16.01-35.18-36.54v-35.18C122.45,15.11,136.88.45,157.63.45h49.84c20.52,0,35.18,14.88,35.18,35.41v35.18ZM227.77,38.11c0-12.4-8.34-23.23-20.3-23.23h-49.84c-11.95,0-20.3,10.83-20.3,23.23v31.8c0,11.95,8.34,23,20.3,23h49.84c11.95,0,20.3-11.05,20.3-23v-31.8Z" />
            <path d="M363.07,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54l.23-71.04h14.66v69.91c0,11.95,8.34,23,20.3,23h68.56v14.66h-.01Z" />
            <path d="M473.8,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
            <path d="M585.42,107.57h-68.56c-20.52,0-35.18-16.01-35.18-36.54v-34.51c0-20.52,14.66-34.96,35.18-34.96h68.56v14.88h-68.56c-11.73,0-20.3,9.7-20.3,21.2v10.6l88.18.23v14.66l-88.18-.23v6.99c0,11.95,8.57,23,20.3,23h68.56v14.68Z" />
            <path d="M719.83,96.3v11.05h-10.6l-48.04-42.62-48.04,42.62h-10.37v-11.05l46.91-41.72-46.91-41.95V1.58h10.37l48.04,42.62L709.23,1.58h10.6v11.05l-47.13,41.95,47.13,41.72ZM661.19,71.04l40.59,36.31h-81.19l40.59-36.31h0Z" />
          </svg>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: name.length > 36 ? 42 : 54, fontWeight: 800, lineHeight: 1.1 }}>
              {name}
            </div>
            {model ? (
              <div style={{ fontSize: 30, letterSpacing: 2, color: "rgba(255,255,255,0.6)", marginTop: 18 }}>{model}</div>
            ) : null}
          </div>
        </div>

        {/* Right column — product photo (the bigger hero) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
          }}
        >
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo} alt="" style={{ maxWidth: "100%", maxHeight: 560, objectFit: "contain" }} width={620} height={560} />
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
