/**
 * Generated social/share image for /products/preview/[slug].
 * ---------------------------------------------------------------------------
 * Always-branded KOLEEX card: black background, KOLEEX wordmark, product
 * name + primary model. Next wires this as the page's og:image / twitter
 * image automatically (file convention), so WhatsApp / WeChat / Facebook /
 * LinkedIn / X all show this consistent branded card when the link is shared.
 *
 * Rendered with next/og (Satori) — inline styles only, no Tailwind / CSS vars.
 */

import { ImageResponse } from "next/og";
import { loadPublicSchemaProduct } from "@/lib/server/product-detail";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "KOLEEX product";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  let name = "Product";
  let model = "";
  try {
    const { slug } = await params;
    const loaded = await loadPublicSchemaProduct(slug);
    if (loaded) {
      name = loaded.productName || name;
      model = loaded.preview.primaryModel || "";
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
          padding: "80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 20,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 44,
          }}
        >
          KOLEEX
        </div>
        <div
          style={{
            display: "flex",
            fontSize: name.length > 32 ? 56 : 72,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 1040,
          }}
        >
          {name}
        </div>
        {model ? (
          <div
            style={{
              fontSize: 30,
              letterSpacing: 3,
              color: "rgba(255,255,255,0.55)",
              marginTop: 30,
            }}
          >
            {model}
          </div>
        ) : null}
      </div>
    ),
    { ...size },
  );
}
