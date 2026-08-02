"use client";

/* KDS Avatar — ELECTED AV-3 by owner 2026-08-02 (header chip style):
   photo is always a round crop; the fallback is the inverted solid
   mono circle with initials. */

export default function Avatar({
  src,
  name,
  size = 36,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name || ""}
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={`rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.34)) }}
    >
      {initials || "•"}
    </span>
  );
}
