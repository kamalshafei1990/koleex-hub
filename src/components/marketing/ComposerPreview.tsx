"use client";

/* ComposerPreview — how the post will look on each account it goes to: a
   Facebook post (name, text, photo grid), an Instagram post (square
   picture, caption under it) or a LinkedIn post (name, three lines of text
   before "see more", pictures only), and a plain card for hand-shared
   accounts.
   A close likeness to judge text length and picture order — not the
   platforms' exact rendering. */

import { useState } from "react";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import type { MarketingAccountView } from "@/lib/marketing/spaces";
import type { PostMedia } from "@/lib/marketing/post-types";

type Tr = (key: string) => string;

function Avatar({ a, size = 32 }: { a: MarketingAccountView; size?: number }) {
  const [bad, setBad] = useState(false);
  return a.avatar_url && !bad ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} style={{ width: size, height: size }} className="shrink-0 rounded-full bg-[var(--bg-surface-subtle)] object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-subtle)]">
      <BrandGlyph name={a.platform} size={Math.round(size * 0.5)} />
    </span>
  );
}

function Tile({ m, className }: { m: PostMedia; className: string }) {
  return (
    <span className={`relative block overflow-hidden bg-[var(--bg-surface-subtle)] ${className}`}>
      {m.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[var(--text-dim)]"><PlayIcon size={22} /></span>
      )}
    </span>
  );
}

/* Up to four pictures as Facebook and LinkedIn lay them out: one wide, two
   side by side, or one on top of two with the rest counted. */
function PhotoGrid({ media }: { media: PostMedia[] }) {
  const shown = media.slice(0, 4);
  return (
    <>
      {shown.length === 1 && <Tile m={shown[0]} className="aspect-[4/3] w-full" />}
      {shown.length === 2 && (
        <div className="grid grid-cols-2 gap-0.5">{shown.map((m, i) => <Tile key={i} m={m} className="aspect-square" />)}</div>
      )}
      {shown.length >= 3 && (
        <div className="grid grid-cols-2 gap-0.5">
          <Tile m={shown[0]} className="col-span-2 aspect-[2/1]" />
          {shown.slice(1, 3).map((m, i) => (
            <span key={i} className="relative">
              <Tile m={m} className="aspect-square" />
              {i === 1 && media.length > 3 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[18px] font-semibold text-white">+{media.length - 3}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function FacebookPreview({ a, text, media, t }: { a: MarketingAccountView; text: string; media: PostMedia[]; t: Tr }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-2.5 p-3">
        <Avatar a={a} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{a.name}</div>
          <div className="text-[11px] text-[var(--text-dim)]">{t("pv.justNow")}</div>
        </div>
        <span className="ms-auto"><BrandGlyph name="facebook" size={14} /></span>
      </div>
      {text.trim() && <p dir="auto" className="line-clamp-6 whitespace-pre-wrap break-words px-3 pb-3 text-[13px] leading-5 text-[var(--text-primary)]">{text}</p>}
      <PhotoGrid media={media} />
    </div>
  );
}

/* LinkedIn shows three lines before "see more"; a video does not go from the
   Hub yet (the rules say so), so only the pictures are drawn. */
function LinkedInPreview({ a, text, media, t }: { a: MarketingAccountView; text: string; media: PostMedia[]; t: Tr }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-2.5 p-3">
        <Avatar a={a} size={36} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{a.name}</div>
          <div className="text-[11px] text-[var(--text-dim)]">{t("pv.justNow")}</div>
        </div>
        <span className="ms-auto"><BrandGlyph name="linkedin" size={14} /></span>
      </div>
      {text.trim() && <p dir="auto" className="line-clamp-3 whitespace-pre-wrap break-words px-3 pb-3 text-[13px] leading-5 text-[var(--text-primary)]">{text}</p>}
      <PhotoGrid media={media.filter((m) => m.kind === "image")} />
    </div>
  );
}

function InstagramPreview({ a, text, media, t }: { a: MarketingAccountView; text: string; media: PostMedia[]; t: Tr }) {
  const first = media[0];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-2.5 p-3">
        <Avatar a={a} size={28} />
        <div className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">{a.handle ?? a.name}</div>
        <span className="ms-auto"><BrandGlyph name="instagram" size={14} /></span>
      </div>
      {first ? (
        <span className="relative block">
          <Tile m={first} className="aspect-square w-full" />
          {media.length > 1 && (
            <span className="absolute bottom-2 start-1/2 flex -translate-x-1/2 gap-1 rtl:translate-x-1/2">
              {media.slice(0, 10).map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-white" : "bg-white/50"}`} />)}
            </span>
          )}
        </span>
      ) : (
        <span className="flex aspect-square w-full items-center justify-center bg-[var(--bg-surface-subtle)] px-6 text-center text-[12px] text-[var(--text-dim)]">{t("rule.ig_needs_media")}</span>
      )}
      <p className="line-clamp-3 whitespace-pre-wrap break-words p-3 text-[13px] leading-5 text-[var(--text-primary)]">
        <span className="font-semibold">{a.handle ?? a.name}</span> <span dir="auto">{text}</span>
      </p>
      <div className="px-3 pb-3 text-[11px] text-[var(--text-dim)]">{t("pv.justNow")}</div>
    </div>
  );
}

function HandPreview({ a, text, media, t }: { a: MarketingAccountView; text: string; media: PostMedia[]; t: Tr }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-center gap-2.5">
        <Avatar a={a} size={28} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{a.name}</div>
          <div className="text-[11px] text-[var(--text-dim)]">{t("pv.byHand").replace("{platform}", t(`pname.${a.platform}`))}</div>
        </div>
      </div>
      {text.trim() && <p dir="auto" className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-5 text-[var(--text-primary)]">{text}</p>}
      {media.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{media.slice(0, 6).map((m, i) => <Tile key={i} m={m} className="h-12 w-12 rounded-lg" />)}</div>
      )}
    </div>
  );
}

export default function ComposerPreview({ items, media, t }: {
  items: Array<{ account: MarketingAccountView; text: string }>;
  media: PostMedia[];
  t: Tr;
}) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-[12px] text-[var(--text-dim)]">{t("pv.empty")}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map(({ account, text }) =>
        account.connection === "assisted" ? <HandPreview key={account.id} a={account} text={text} media={media} t={t} />
          : account.platform === "instagram" ? <InstagramPreview key={account.id} a={account} text={text} media={media} t={t} />
            : account.platform === "linkedin" ? <LinkedInPreview key={account.id} a={account} text={text} media={media} t={t} />
              : <FacebookPreview key={account.id} a={account} text={text} media={media} t={t} />,
      )}
    </div>
  );
}
