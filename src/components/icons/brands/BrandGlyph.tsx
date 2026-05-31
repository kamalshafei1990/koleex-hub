"use client";

import React, { useState } from "react";
import {
  siWhatsapp, siWechat, siTelegram, siLine, siQq, siMessenger,
  siFacebook, siInstagram, siX, siYoutube, siTiktok, siPinterest, siReddit,
  siSnapchat, siThreads, siSinaweibo, siBilibili, siXiaohongshu, siAlibabadotcom,
  siAlipay,
} from "simple-icons";

/* ---------------------------------------------------------------------------
   BrandGlyph — real app icons for messaging + social platforms.

   Uses the official Simple Icons path data + brand color for every supported
   platform (accurate logos, real colors). Pure-black brands (X, TikTok,
   Threads) fall back to currentColor so they stay visible in dark mode.
   LinkedIn isn't shipped by Simple Icons (legal), so it keeps a hand-authored
   path. Niche B2B marketplaces with no public glyph (DingTalk, Douyin, 1688,
   Made-in-China, Global Sources) use brand-colored monogram chips.
   --------------------------------------------------------------------------- */

type Props = { name: string; size?: number; className?: string };
type SI = { path: string; hex: string };

/* ── Uploaded official icons (Supabase Storage) ───────────────────────────────
   Drop a file at:  media/brand-icons/<slug>.svg  (public bucket)
   and BrandGlyph uses it for that platform, falling back to the built-in glyph
   if the file is missing. Only slugs listed here are fetched (avoids 404 spam
   for the platforms already covered by accurate Simple Icons). Add a slug here
   when you upload a new override. */
const STORAGE_BASE =
  (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "") + "/storage/v1/object/public/media/brand-icons/";
const STORAGE_SLUGS = new Set([
  "qq", "bilibili", "dingtalk", "douyin", "1688", "made-in-china", "global-sources",
]);
/* File extension per uploaded slug (default svg). */
const STORAGE_EXT: Record<string, string> = { "made-in-china": "png" };
/* Bump when a file is re-uploaded, to bust the CDN cache. */
const STORAGE_VER: Record<string, number> = { qq: 2 };

function slugFor(name: string): string {
  const n = (name || "").toLowerCase().trim();
  if (n.includes("xiaohongshu") || n === "red" || n.includes("(red)")) return "xiaohongshu";
  if (n.includes("made-in-china") || n.includes("made in china")) return "made-in-china";
  if (n.includes("global sources")) return "global-sources";
  if (n.includes("dingtalk")) return "dingtalk";
  if (n.includes("douyin")) return "douyin";
  if (n.includes("bilibili")) return "bilibili";
  if (n.includes("1688")) return "1688";
  if (n.includes("alibaba")) return "alibaba";
  if (n.includes("weibo")) return "weibo";
  if (n.includes("wechat")) return "wechat";
  if (n === "qq" || n.includes("qq")) return "qq";
  return n.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const ICONS: Record<string, SI> = {
  whatsapp: siWhatsapp,
  wechat: siWechat,
  telegram: siTelegram,
  line: siLine,
  qq: siQq,
  messenger: siMessenger,
  facebook: siFacebook,
  instagram: siInstagram,
  x: siX,
  youtube: siYoutube,
  tiktok: siTiktok,
  pinterest: siPinterest,
  reddit: siReddit,
  snapchat: siSnapchat,
  threads: siThreads,
  weibo: siSinaweibo,
  bilibili: siBilibili,
  xiaohongshu: siXiaohongshu,
  alibaba: siAlibabadotcom,
  alipay: siAlipay,
};

/* Not in Simple Icons — hand-authored. */
const EXTRA: Record<string, SI> = {
  linkedin: {
    hex: "0A66C2",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
};

/* Brand-colored monogram chips for platforms with no public glyph. */
const MONO: Record<string, { label: string; color: string }> = {
  dingtalk: { label: "DT", color: "#3296FA" },
  douyin: { label: "抖", color: "#FE2C55" },
  "1688": { label: "1688", color: "#FF6A00" },
  "made-in-china": { label: "MIC", color: "#E60012" },
  "global sources": { label: "GS", color: "#1F6FB2" },
};

function keyFor(name: string): string {
  const n = (name || "").toLowerCase().trim();
  if (n.includes("whatsapp")) return "whatsapp";
  if (n.includes("wechat") || n.includes("weixin")) return "wechat";
  if (n.includes("telegram")) return "telegram";
  if (n.includes("messenger")) return "messenger";
  if (n.includes("linkedin")) return "linkedin";
  if (n.includes("facebook")) return "facebook";
  if (n.includes("instagram")) return "instagram";
  if (n.includes("youtube")) return "youtube";
  if (n.includes("tiktok")) return "tiktok";
  if (n.includes("pinterest")) return "pinterest";
  if (n.includes("reddit")) return "reddit";
  if (n.includes("snapchat")) return "snapchat";
  if (n.includes("threads")) return "threads";
  if (n.includes("weibo")) return "weibo";
  if (n.includes("bilibili")) return "bilibili";
  if (n.includes("xiaohongshu") || n === "red" || n.includes("(red)")) return "xiaohongshu";
  if (n.includes("alipay")) return "alipay";
  if (n.includes("alibaba")) return "alibaba";
  if (n.includes("line")) return "line";
  if (n === "qq" || n.includes("qq")) return "qq";
  if (n === "twitter/x" || n === "x" || n.includes("twitter")) return "x";
  return "";
}

export default function BrandGlyph({ name, size = 16, className }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const slug = slugFor(name);

  // Prefer an uploaded official icon when one exists for this platform.
  if (!imgFailed && STORAGE_BASE.length > 45 && STORAGE_SLUGS.has(slug)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${STORAGE_BASE}${slug}.${STORAGE_EXT[slug] ?? "svg"}${STORAGE_VER[slug] ? `?v=${STORAGE_VER[slug]}` : ""}`}
        alt=""
        className={className}
        // Normalize by height so every uploaded logo matches the glyph height;
        // width is auto (capped) so wide wordmarks don't blow out the layout.
        style={{ height: size, width: "auto", maxWidth: size * 3, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }}
        onError={() => setImgFailed(true)}
        aria-hidden
      />
    );
  }

  const key = keyFor(name);
  const icon: SI | undefined = ICONS[key] ?? EXTRA[key];

  if (icon) {
    // Pure-black brands → currentColor so they survive dark mode.
    const fill = /^0{6}$/i.test(icon.hex) ? "currentColor" : `#${icon.hex}`;
    if (key === "instagram") {
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden focusable="false">
          <defs>
            <radialGradient id="ig-grad" cx="30%" cy="107%" r="135%">
              <stop offset="0%" stopColor="#FDF497" />
              <stop offset="5%" stopColor="#FDF497" />
              <stop offset="45%" stopColor="#FD5949" />
              <stop offset="60%" stopColor="#D6249F" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <path d={icon.path} fill="url(#ig-grad)" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} className={className} aria-hidden focusable="false">
        <path d={icon.path} />
      </svg>
    );
  }

  // Website / blog → globe glyph
  const n = (name || "").toLowerCase().trim();
  if (n.includes("website") || n.includes("blog")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
      </svg>
    );
  }

  // Brand-colored monogram chip (DingTalk, Douyin, 1688, …) or generic fallback.
  const m = MONO[n];
  const label = m?.label ?? ((name || "?").trim().charAt(0).toUpperCase() || "?");
  const color = m?.color ?? "currentColor";
  const fontSize = label.length >= 3 ? 6.5 : label.length === 2 ? 8.5 : 11;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden focusable="false">
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill={color} opacity={color === "currentColor" ? 0.14 : 0.16} />
      <text x="12" y="12.6" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight="700" fill={color} fontFamily="inherit">
        {label}
      </text>
    </svg>
  );
}
