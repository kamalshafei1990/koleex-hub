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

import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

  // KOLEEX wordmark (white on transparent) — inlined from /public.
  let logo: string | null = null;
  try {
    const file = await readFile(join(process.cwd(), "public", "koleex-hub-logo.png"));
    logo = `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    logo = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000000",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
          padding: "64px 72px 56px",
        }}
      >
        {/* KOLEEX logo header — clearly visible */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt="KOLEEX" width={300} height={54} style={{ opacity: 0.95 }} /> : (
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 18 }}>KOLEEX</div>
        )}

        {/* Product photo — the poster hero */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "24px 0",
          }}
        >
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo} alt="" style={{ maxWidth: 900, maxHeight: 340, objectFit: "contain" }} width={900} height={340} />
          ) : null}
        </div>

        {/* Caption — product name + model */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.16)",
          }}
        >
          <div style={{ display: "flex", fontSize: name.length > 40 ? 40 : 52, fontWeight: 800, lineHeight: 1.1, maxWidth: 1040 }}>
            {name}
          </div>
          {model ? (
            <div style={{ fontSize: 30, letterSpacing: 2, color: "rgba(255,255,255,0.6)", marginTop: 14 }}>Model: {model}</div>
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
