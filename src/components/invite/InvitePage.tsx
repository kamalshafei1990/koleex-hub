"use client";

/* ---------------------------------------------------------------------------
   InvitePage — the PUBLIC RSVP surface at /invite/<token>.

   A guest opens this from a message — phone-first, no Hub account, no
   chrome. Styled in the AURORA register (the owner's pick): the same
   translucent-glass language the apps speak — aurora wave ground, kx-glass
   card on design tokens, colored glass answers. The skin is pinned on the
   wrapper (data-kx-skin="aurora") so the classes resolve exactly as inside
   the Hub, whatever the visitor's device theme is.

   Language: the saved picker wins, otherwise the device's own language.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslation } from "@/lib/i18n";
import { inviteT } from "@/lib/translations/invite";
import { signInT } from "@/lib/translations/signin";
import type { PublicInvite, RsvpAnswer } from "@/lib/events/types";
import { formatEventDate } from "@/lib/events/types";

/* Canvas ground, client-only — the aurora waves are a canvas; Core renders
   zero canvases, this page is pinned to Aurora either way. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

type Phase = "loading" | "ready" | "invalid" | "error";

/* The apps' card recipe (travel/fields CARD) — kx-glass needs the aurora
   skin attribute the main wrapper carries. */
const CARD =
  "kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";

/* The three answers in the owner's colors, outline style per kds: resting =
   colored rim + text only; hover changes NOTHING but a translucent wash of
   the SAME color (the ConfirmDialog/SmartCreate convention — never a
   different hue, never a border swap). The current answer alone carries the
   solid fill. */
const ANSWER_STYLE: Record<RsvpAnswer, { solid: string; active: string; idle: string }> = {
  accepted: {
    solid:
      "border border-emerald-500/[0.35] text-emerald-300 hover:bg-emerald-500/[0.08] " +
      "hover:shadow-[0_0_14px_0_rgba(16,185,129,0.25),0_0_0_1px_rgba(16,185,129,0.22)]",
    active: "border border-emerald-500 bg-emerald-500 text-white",
    idle:
      "border border-emerald-500/[0.20] text-emerald-400 hover:bg-emerald-500/[0.08] " +
      "hover:shadow-[0_0_12px_-4px_rgba(16,185,129,0.22)]",
  },
  maybe: {
    solid:
      "border border-amber-500/[0.35] text-amber-300 hover:bg-amber-500/[0.08] " +
      "hover:shadow-[0_0_14px_0_rgba(245,158,11,0.25),0_0_0_1px_rgba(245,158,11,0.22)]",
    active: "border border-amber-500 bg-amber-500 text-white",
    idle:
      "border border-amber-500/[0.20] text-amber-400 hover:bg-amber-500/[0.08] " +
      "hover:shadow-[0_0_12px_-4px_rgba(245,158,11,0.22)]",
  },
  declined: {
    solid:
      "border border-rose-500/[0.35] text-rose-300 hover:bg-rose-500/[0.08] " +
      "hover:shadow-[0_0_14px_0_rgba(244,63,94,0.25),0_0_0_1px_rgba(244,63,94,0.22)]",
    active: "border border-rose-500 bg-rose-500 text-white",
    idle:
      "border border-rose-500/[0.20] text-rose-400 hover:bg-rose-500/[0.08] " +
      "hover:shadow-[0_0_12px_-4px_rgba(244,63,94,0.22)]",
  },
};

export default function InvitePage({ token }: { token: string }) {
  const { t, lang } = useTranslation(inviteT);
  const { t: ts } = useTranslation(signInT);
  const [phase, setPhase] = useState<Phase>("loading");
  const [invite, setInvite] = useState<PublicInvite | null>(null);
  const [busy, setBusy] = useState<RsvpAnswer | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setFailed(false);
    try {
      const res = await fetch(`/api/invite/${token}`, { cache: "no-store" });
      if (res.status === 404) {
        setPhase("invalid");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { invite: PublicInvite };
      setInvite(body.invite);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = useCallback(
    async (a: RsvpAnswer) => {
      if (busy) return;
      setBusy(a);
      setFailed(false);
      try {
        const res = await fetch(`/api/invite/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: a }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { invite: PublicInvite };
        setInvite(body.invite);
      } catch {
        setFailed(true);
      } finally {
        setBusy(null);
      }
    },
    [busy, token],
  );

  const ev = invite?.event;
  const answered = invite?.answer != null;
  const attending = invite?.answer === "accepted" || invite?.answer === "maybe";
  const dir = lang === "ar" ? "rtl" : "ltr";

  /* The guest's entry QR — rendered once we know they are coming, from the
   *  same link the door scanner reads. */
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (attending) {
      QRCode.toDataURL(`${window.location.origin}/invite/${token}`, {
        margin: 1,
        width: 220,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then((url) => {
          if (alive) setQr(url);
        })
        .catch(() => {
          if (alive) setQr(null);
        });
    } else {
      setQr(null);
    }
    return () => {
      alive = false;
    };
  }, [attending, token]);

  return (
    /* No data-kx-skin/data-theme here on purpose: the bootstrap script pins
       them on <html> for every visitor (default aurora), and the CARD
       recipe degrades cleanly under core — the apps follow the same
       convention. Setting them per-element caused a hydration mismatch. */
    <main
      dir={dir}
      className="kx-app kx-ground-host relative h-[100dvh] overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]"
    >
      {/* The ground — fixed so it stays put while the card column scrolls. */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <WavyBackground topLight />
      </div>

      <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-4">
        {/* Brand header — the fixed point of the screen, as on the sign-in
            gate, but wearing the aurora tokens. */}
        <div className="flex shrink-0 flex-col items-center pb-6 pt-[clamp(32px,calc((100dvh-560px)/2),160px)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed brand file at its own ratio */}
          <img
            src="/brand/hub-logo/koleex-hub-logo-for-dark-e.webp"
            alt="Koleex Hub"
            draggable={false}
            className="h-6 w-auto select-none [-webkit-user-drag:none]"
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="h-px w-6 bg-[var(--border-subtle)]" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
              {ts("tagline")}
            </span>
            <span className="h-px w-6 bg-[var(--border-subtle)]" aria-hidden />
          </div>
        </div>

        <div className="w-full max-w-md pb-10">
          {phase === "loading" && (
            <div className={`${CARD} px-6 py-16 text-center`}>
              <p className="text-[14px] text-[var(--text-dim)]">{t("state.loading")}</p>
            </div>
          )}

          {phase === "invalid" && (
            <div className={`${CARD} px-6 py-16 text-center`}>
              <p className="text-[14px] text-[var(--text-secondary)]">{t("state.invalid")}</p>
            </div>
          )}

          {phase === "error" && (
            <div className={`${CARD} px-6 py-16 text-center`}>
              <p className="text-[14px] text-[var(--text-secondary)]">{t("state.error")}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {t("cta.retry")}
              </button>
            </div>
          )}

          {phase === "ready" && ev && invite && (
            <div className={`${CARD} px-6 py-7 md:px-8 md:py-8`}>
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
                {t("label.type")} · <span className="text-[var(--text-secondary)]">{ev.type.replace("_", " ")}</span>
              </p>
              <h1 className="mt-3 text-center text-[24px] font-bold leading-tight tracking-tight">
                {ev.title}
              </h1>

              <div className="mt-5 space-y-1.5 text-center text-[14px] text-[var(--text-primary)]">
                <p className="tabular-nums">
                  {formatEventDate(ev.start_at) || t("date.tba")}
                  {ev.end_at && formatEventDate(ev.end_at) !== formatEventDate(ev.start_at)
                    ? ` → ${formatEventDate(ev.end_at)}`
                    : ""}
                </p>
                {(ev.location || ev.city || ev.country) && (
                  <p className="text-[var(--text-secondary)]">
                    {[ev.location, ev.city, ev.country].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              {ev.description && (
                <p className="mt-5 border-t border-[var(--border-subtle)] pt-5 text-center text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {ev.description}
                </p>
              )}

              <p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]">
                {t("label.guest")} <span className="text-[var(--text-primary)]">{invite.guestName}</span>
              </p>

              {answered ? (
                <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-5 text-center">
                  <p className="text-[15px] font-bold tracking-tight">{t("ans.title")}</p>
                  <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
                    {invite.answer === "accepted"
                      ? t("ans.accepted")
                      : invite.answer === "declined"
                        ? t("ans.declined")
                        : t("ans.maybe")}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    {(["accepted", "maybe", "declined"] as RsvpAnswer[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={busy === a}
                        onClick={() => void answer(a)}
                        data-kx-keep-hover
                        className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                          invite.answer === a ? ANSWER_STYLE[a].active : ANSWER_STYLE[a].idle
                        }`}
                      >
                        {t(`cta.${a}`)}
                      </button>
                    ))}
                  </div>

                  {qr && (
                    <div className="mt-5 border-t border-[var(--border-subtle)] pt-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]">
                        {t("qr.title")}
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL generated at runtime, not a static asset */}
                      <img
                        src={qr}
                        alt={t("qr.title")}
                        className="mx-auto mt-3 h-36 w-36 rounded-xl bg-white p-2"
                      />
                      <p className="mt-2.5 text-[11px] text-[var(--text-dim)]">{t("qr.hint")}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {(["accepted", "maybe", "declined"] as RsvpAnswer[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void answer(a)}
                      data-kx-keep-hover
                      className={`h-11 rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-60 ${ANSWER_STYLE[a].solid}`}
                    >
                      {busy === a ? "…" : t(`cta.${a}`)}
                    </button>
                  ))}
                </div>
              )}

              {failed && (
                <p className="mt-3 text-center text-[12px] text-rose-300">{t("state.error")}</p>
              )}
            </div>
          )}

          <p className="mt-4 text-center text-[11px] tracking-wide text-[var(--text-dim)]">
            {t("foot.powered")}
          </p>
        </div>
      </div>
    </main>
  );
}