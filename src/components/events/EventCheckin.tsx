"use client";

/* ---------------------------------------------------------------------------
   EventCheckin — the day-of door screen. Two doors in, one truth:

     · SCAN — the guest's invitation QR (the /invite/<token> link) through
       the camera. Chromium's native BarcodeDetector does the decoding; if
       the camera is unavailable the search door still works alone.
     · SEARCH — type a name, Enter checks the top hit in. A checked-in guest
       cannot be stamped twice: the server answers 409 and the row already
       shows "Already in".

   Big targets, live counters — this runs on a tablet held by staff.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import type { EventGuestRow } from "@/lib/events/types";
import Button from "@/components/ui/Button";
import { CARD } from "@/components/events/fields";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ScanIcon from "@/components/icons/ui/ScanLineIcon";

/* BarcodeDetector is Chromium-native; declared minimally so TypeScript
   stays happy where the lib dom has no types for it. */
type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => Detector;
  }
}

/** Pull the invitation token out of whatever the QR carried — guests may
 *  print the bare link or a full /invite/<token> URL. */
function tokenOf(raw: string): string | null {
  const m = /\/invite\/([a-f0-9]{20,64})/i.exec(raw);
  return m ? m[1] : /^[a-f0-9]{20,64}$/i.test(raw.trim()) ? raw.trim() : null;
}

export default function EventCheckin({
  eventId,
  guests,
  onChanged,
}: {
  eventId: string;
  guests: EventGuestRow[];
  onChanged: () => void;
}) {
  const { t } = useTranslation(eventsT);

  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "dup" | "err"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const flashIt = useCallback((kind: "ok" | "dup" | "err", text: string) => {
    setFlash({ kind, text });
    const id = window.setTimeout(() => setFlash(null), 3200);
    timersRef.current.push(id);
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
  }, []);

  /* ── the stamp itself ─────────────────────────────────────────────────── */
  const checkIn = useCallback(
    async (target: { guestId?: string; token?: string }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusyId(target.guestId ?? "token");
      try {
        const res = await fetch(`/api/events/${eventId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target),
        });
        if (res.ok) {
          const body = (await res.json()) as { guest: { name: string } };
          flashIt("ok", `${body.guest.name} ${t("ci.justNow")}`);
          setQuery("");
          onChanged();
          return;
        }
        if (res.status === 409) {
          flashIt("dup", t("ci.duplicate"));
          onChanged();
          return;
        }
        if (res.status === 404 && target.token) {
          flashIt("err", t("ci.notFound"));
          return;
        }
        flashIt("err", t("state.error"));
      } finally {
        busyRef.current = false;
        setBusyId(null);
      }
    },
    [eventId, flashIt, onChanged, t],
  );

  /* ── camera + native QR decoding ──────────────────────────────────────── */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const DetectorCtor = window.BarcodeDetector;
      if (!DetectorCtor) throw new Error("no detector");
      const detector = new DetectorCtor({ formats: ["qr_code"] });

      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) {
            const token = tokenOf(raw);
            if (token) {
              stopCamera();
              await checkIn({ token });
              return;
            }
          }
        } catch {
          /* a single failed frame means nothing — keep polling */
        }
        window.setTimeout(() => void tick(), 350);
      };
      void tick();
    } catch {
      stopCamera();
      setCameraError(true);
    }
  }, [checkIn, stopCamera]);

  /* ── search ranking: unchecked first, then exact-prefix, then includes ── */
  const checked = useMemo(() => guests.filter((g) => g.checked_in_at), [guests]);
  const confirmed = useMemo(
    () => guests.filter((g) => g.status === "accepted" || g.status === "attended"),
    [guests],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    const hit = (g: EventGuestRow) =>
      [g.name, g.company, g.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
    return guests
      .filter(hit)
      .sort((a, b) => Number(!!a.checked_in_at) - Number(!!b.checked_in_at) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [guests, query]);

  const topHit = results[0];
  const checkTop = useCallback(() => {
    if (topHit && !topHit.checked_in_at) void checkIn({ guestId: topHit.id });
  }, [checkIn, topHit]);

  const recent = useMemo(
    () => [...checked].sort((a, b) => String(b.checked_in_at).localeCompare(String(a.checked_in_at))).slice(0, 10),
    [checked],
  );

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* ── The stamp panel ── */}
      <section className={`${CARD} p-4 sm:p-5 lg:col-span-2`}>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") checkTop();
            }}
            placeholder={t("ci.searchPh")}
            autoFocus
            className="h-12 min-w-52 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 text-[15px] text-[var(--text-primary)] outline-none"
          />
          <Button
            variant={scanning ? "secondary" : "primary"}
            icon={<ScanIcon size={15} />}
            onClick={() => (scanning ? stopCamera() : void startCamera())}
          >
            {scanning ? t("ci.stopScan") : t("ci.scan")}
          </Button>
        </div>

        {cameraError && (
          <p className="mt-3 text-[12px] text-amber-400">{t("ci.cameraDenied")}</p>
        )}

        {scanning && (
          <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            <video ref={videoRef} muted playsInline className="max-h-72 w-full object-cover" />
            <p className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-1.5 text-center text-[11px] text-white/80">
              {t("ci.cameraHint")}
            </p>
          </div>
        )}

        {/* flash line */}
        {flash && (
          <p
            className={`mt-4 rounded-lg border px-3 py-2 text-[13px] font-medium ${
              flash.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : flash.kind === "dup"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {flash.kind === "ok" && <CheckIcon size={13} className="me-1 inline" />}
            {flash.text}
          </p>
        )}

        {/* search hits */}
        {query.trim() && (
          <div className="mt-4 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
            {results.length === 0 && (
              <p className="px-4 py-6 text-center text-[12px] text-[var(--text-dim)]">{t("ci.notFound")}</p>
            )}
            {results.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{g.name}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">{[g.company, t(`cat.${g.category}`)].filter(Boolean).join(" · ")}</p>
                </div>
                {g.checked_in_at ? (
                  <span className="flex items-center gap-1 text-[12px] font-medium text-emerald-500">
                    <CheckIcon size={13} />
                    {t("ci.already")}
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busyId === g.id}
                    onClick={() => void checkIn({ guestId: g.id })}
                  >
                    {t("ci.checkIn")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Counters + recent ── */}
      <section className="space-y-3">
        <div className={`${CARD} grid grid-cols-3 divide-x divide-[var(--border-subtle)] text-center`}>
          <div className="px-2 py-4">
            <p className="text-[22px] font-bold tabular-nums text-emerald-500">{checked.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("ci.checkedIn")}</p>
          </div>
          <div className="px-2 py-4">
            <p className="text-[22px] font-bold tabular-nums">{confirmed.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("ci.confirmed")}</p>
          </div>
          <div className="px-2 py-4">
            <p className="text-[22px] font-bold tabular-nums">{guests.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("ci.total")}</p>
          </div>
        </div>

        <div className={`${CARD} divide-y divide-[var(--border-subtle)]`}>
          <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
            {t("ci.checkedIn")}
          </p>
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[var(--text-dim)]">{t("g.empty")}</p>
          ) : (
            recent.map((g) => (
              <div key={g.id} className="flex items-center gap-2.5 px-4 py-2">
                <CheckIcon size={13} className="shrink-0 text-emerald-500" />
                <p className="min-w-0 flex-1 truncate text-[13px]">{g.name}</p>
                <span className="text-[11px] tabular-nums text-[var(--text-dim)]">
                  {g.checked_in_at ? new Date(g.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
