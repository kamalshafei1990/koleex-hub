"use client";

/* ---------------------------------------------------------------------------
   Reports — the first weeks' guide (staff readiness, owner's pick
   26/09/2026, «جاهزية الموظفين قبل 12 أكتوبر»). On the Reports home of
   someone who owes reports, once counting is set, for the first two weeks
   from their start, until they send their first report (the server decides:
   lib/reports/obligations reportGuide):

     · when they start, and what they owe — each on their OWN calendar (the
       end of their working day, their weekly's weekday)
     · when the reminder comes, and how to write it in two minutes
     · getting that reminder on this device: the same push helpers the
       bell's offer uses (lib/push-client) — never during view-as, and on an
       iPhone outside the Home Screen app it says how to add it first

   "Got it" hides it on this device (a per-viewer convenience: localStorage).
   It renders with the bundle, never after it; the notifications row keeps
   its height while this device is asked, so nothing moves.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import type { Lang } from "@/lib/i18n";
import type { ReportGuide } from "@/lib/reports/obligations";
import { currentScopeKey } from "@/lib/me-bootstrap";
import { isDesktopApp } from "@/lib/desktop-app";
import { isIosNeedsInstall, isPushConfigured, isPushSupported, permissionState, subscribeToPush } from "@/lib/push-client";
import { reportGuideT } from "@/lib/translations/report-ui/guide";
import { CARD, type T } from "./shared";

/* "check": allowed before — whether this device still holds a subscription
   is the one answer that has to be waited for. */
type Push = "offer" | "on" | "install" | "denied" | "desktop" | "none" | "check";
const KEY = "kx-reports-guide:";

/** What this device can do about the reminder, known from the first frame —
 *  the bell's own rules (lib/push-nudge), without its "closed for good". */
function pushNow(): Push {
  if (typeof window === "undefined" || !currentScopeKey().endsWith(":self")) return "none";
  if (isDesktopApp()) return "desktop";
  if (!isPushConfigured()) return "none";
  if (isIosNeedsInstall()) return "install";
  if (!isPushSupported()) return "none";
  const permission = permissionState();
  if (permission === "denied") return "denied";
  if (permission === "unsupported") return "none";
  return permission === "granted" ? "check" : "offer";
}

async function subscribed(): Promise<boolean> {
  try {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
    return !!reg && !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

export default function FirstWeekGuide({ t: shared, lang, guide, accountId, canWrite, busy, onWrite }: {
  t: T; lang: string; guide: ReportGuide; accountId: string; canWrite: boolean; busy: boolean; onWrite: () => void;
}) {
  const l = ((["en", "zh", "ar"] as const).find((x) => x === lang) ?? "en") as Lang;
  const t = useCallback<T>((key, fallback) => {
    const e = reportGuideT[key];
    return e ? (e[l] ?? e.en) : shared(key, fallback);
  }, [shared, l]);
  const dismissKey = `${KEY}${accountId}:${guide.start}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; } });
  const [push, setPush] = useState<Push>(pushNow);
  const [turning, setTurning] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (push !== "check") return;
    void subscribed().then((on) => setPush(on ? "on" : "offer"));
  }, [push]);
  if (hidden) return null;

  const loc = l === "ar" ? "ar-EG" : l === "zh" ? "zh-CN" : "en-GB";
  const weekday = (ymd: string) => new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));
  /* A weekday number (0 = Sunday) as its name: 2026-10-04 was a Sunday. */
  const dayName = (d: number) => weekday(`2026-10-${String(4 + d).padStart(2, "0")}`);
  const start = `${weekday(guide.start)} ${guide.start.slice(8, 10)}/${guide.start.slice(5, 7)}`;
  const lines = [
    guide.daily && t("guide.daily").replace("{time}", guide.workEnd),
    guide.weekly && guide.weeklyDay !== null && t("guide.weekly").replace("{day}", dayName(guide.weeklyDay)).replace("{time}", guide.workEnd),
    guide.monthly && t("guide.monthly"),
  ].filter((x): x is string => !!x);

  const turnOn = async () => {
    setTurning(true); setFailed(false);
    const r = await subscribeToPush();
    setTurning(false);
    if (r.ok) setPush("on"); else if (permissionState() === "denied") setPush("denied"); else setFailed(true);
  };
  const gotIt = () => {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* no storage: hidden for now */ }
    setHidden(true);
  };
  const pushLine = push === "on" ? t("guide.push.on") : push === "install" ? t("guide.push.install") : push === "denied" ? t("guide.push.denied")
    : push === "desktop" ? t("guide.push.desktop") : push === "offer" ? t("guide.push.offer") : "";

  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-rep-guide">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#567FB2]/12 text-[#9DBCE0]"><RrIcon name="calendar" size={16} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="kx-rep-guide" className="text-[14px] font-semibold text-[var(--text-primary)]">
            {guide.upcoming ? t("guide.title.soon").replace("{day}", start) : t("guide.title.now")}
          </h2>
          <ul className="mt-2 space-y-1">
            {lines.map((x) => (
              <li key={x} className="flex items-start gap-2 text-[12.5px] text-[var(--text-secondary)]">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-dim)]" aria-hidden />{x}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[var(--text-dim)]">{t("guide.remind").replace("{time}", guide.remindAt)}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-dim)]">{t("guide.how")}</p>

          {push !== "none" && (
            <div className="mt-3 flex min-h-[52px] flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-[var(--text-primary)]">{t("guide.push.title")}</span>
                <span aria-live="polite" className={`mt-0.5 block text-[11.5px] leading-snug ${push === "denied" || failed ? "text-red-500" : push === "on" ? "text-emerald-500" : "text-[var(--text-dim)]"}`}>
                  {failed ? t("guide.push.failed") : pushLine}
                </span>
              </span>
              {push === "offer" && (
                <button type="button" onClick={() => void turnOn()} disabled={turning}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#567FB2]/40 bg-[#567FB2]/15 px-3 text-[12px] font-semibold text-[var(--text-primary)] disabled:opacity-60">
                  {turning ? <SpinnerIcon size={11} /> : <RrIcon name="check" size={10} />}{t("guide.push.turnOn")}
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canWrite && guide.daily && (
              <button type="button" onClick={onWrite} disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--bg-inverted)] px-3 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
                {busy ? <SpinnerIcon size={12} /> : <RrIcon name="pencil" size={12} />}{t("guide.write")}
              </button>
            )}
            <button type="button" onClick={gotIt} className="inline-flex h-9 items-center rounded-xl border border-[var(--border-subtle)] px-3 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t("guide.gotIt")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
