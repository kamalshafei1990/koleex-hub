"use client";

/* ---------------------------------------------------------------------------
   EventPostEvent — closing the loop after the event.

   · HOW IT WENT — attendance rate, no-shows, and who came by category,
     straight from the guest rows (the funnel's own numbers).
   · FOLLOW-UPS — pick an audience (attended / no-show / declined) and a
     language; the message is written from the event's real facts and copied
     for sending through whatever channel that guest reads. No email infra
     in the platform yet — the copy IS the delivery, same as invitations.
   · EXPORT CSV — the guest table as a file the CRM (or Excel) imports.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import type { EventDetail, EventGuestRow } from "@/lib/events/types";
import Button from "@/components/ui/Button";
import { CARD, SelectField } from "@/components/events/fields";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";

type Audience = "attended" | "noshow" | "declined";
type MsgLang = "en" | "ar" | "zh";

function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* best effort */
    }
    ta.remove();
  });
}

/** The message, written from the event's real facts. Kept as a function of
 *  (event, guest) so it personalizes per recipient when pasted. */
function writeMessage(
  lang: MsgLang,
  audience: Audience,
  ev: EventDetail,
  guest: EventGuestRow,
): string {
  const where = [ev.city, ev.country].filter(Boolean).join(", ");
  const when = ev.start_at ? new Date(ev.start_at).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const name = guest.name.split(" ")[0];

  if (lang === "ar") {
    if (audience === "attended")
      return `يا ${name}،\n\nشكراً إنك حضرت "${ev.title}"${where ? ` في ${where}` : ""}${when ? ` يوم ${when}` : ""}. كان لطيف نشوفك، وإحنا كلمنا عن منتجات KOLEEX للماكينات — هبعتلك الكتالوج والعرض اللي اتكلمنا عنه.\n\nأي أسئلة، أنا تحت أمرك دايماً.\n\nمع خالص التحية،\nفريق KOLEEX`;
    if (audience === "noshow")
      return `يا ${name}،\n\nللأسف فاتك "${ev.title}"${when ? ` يوم ${when}` : ""}! كنا نتمنى نشوفك. هبعتلك ملخص اللي اتعرض والكتالوج — ولو حابب معاد شخصي نعرضلك الماكينات على راحتك، قولي.\n\nمع خالص التحية،\nفريق KOLEEX`;
    return `يا ${name}،\n\nشكراً إنك أخبرتنا إنك مش هتقدر تحضر "${ev.title}". مفيش مشكلة خالص — هفضل أبعتلك جديد منتجات KOLEEX ومعارضنا الجاية، ولو حابب عرض سعر أو عيّنة في أي وقت، أنا موجود.\n\nمع خالص التحية،\nفريق KOLEEX`;
  }
  if (lang === "zh") {
    if (audience === "attended")
      return `${name}，您好！\n\n非常感谢您出席${when ? `${when}在${where || ""}举行的` : ""}"${ev.title}"。很高兴与您交流 KOLEEX 服装机械产品，稍后我会把产品目录和现场提到的方案发给您。\n\n如有任何问题，随时联系我。\n\n顺祝商祺！\nKOLEEX 团队`;
    if (audience === "noshow")
      return `${name}，您好！\n\n很遗憾您错过了${when ? `${when}的` : ""}"${ev.title}"。我会把现场资料和产品目录发给您，如果您想安排一次专场演示，也请随时告诉我。\n\n顺祝商祺！\nKOLEEX 团队`;
    return `${name}，您好！\n\n感谢您告知无法出席"${ev.title}"。没关系——我会继续与您分享 KOLEEX 的新产品和 upcoming 展会信息，如需报价或样品，随时联系。\n\n顺祝商祺！\nKOLEEX 团队`;
  }
  if (audience === "attended")
    return `Dear ${name},\n\nThank you for joining us at "${ev.title}"${where ? ` in ${where}` : ""}${when ? ` on ${when}` : ""}. It was a pleasure meeting you — I'll send over our catalog and the offer we discussed.\n\nShould you have any questions, I'm always at your service.\n\nBest regards,\nThe KOLEEX Team`;
  if (audience === "noshow")
    return `Dear ${name},\n\nWe missed you at "${ev.title}"${when ? ` on ${when}` : ""}! I'll send you a summary of what was shown and our catalog — and if you'd like a private demo of the machines at your convenience, just say the word.\n\nBest regards,\nThe KOLEEX Team`;
  return `Dear ${name},\n\nThank you for letting us know you couldn't make "${ev.title}". No problem at all — I'll keep you posted on new KOLEEX machines and our upcoming exhibitions, and I'm here anytime for a quotation or samples.\n\nBest regards,\nThe KOLEEX Team`;
}

export default function EventPostEvent({ detail }: { detail: EventDetail }) {
  const { t } = useTranslation(eventsT);
  const [audience, setAudience] = useState<Audience>("attended");
  const [msgLang, setMsgLang] = useState<MsgLang>("en");
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => {
    const attended = detail.guests.filter((g) => g.status === "attended");
    const noshow = detail.guests.filter((g) => g.checked_in_at == null && (g.status === "accepted"));
    const declined = detail.guests.filter((g) => g.status === "declined");
    return { attended, noshow, declined };
  }, [detail.guests]);

  const invitedCount = detail.guests.filter((g) => g.status !== "listed").length;
  const rate = invitedCount > 0 ? Math.round((groups.attended.length / invitedCount) * 100) : null;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups.attended) m.set(g.category, (m.get(g.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [groups.attended]);

  const sample = groups[audience][0];
  const message = sample ? writeMessage(msgLang, audience, detail, sample) : null;

  const copyMessage = useCallback(async () => {
    if (!message) return;
    await copyText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }, [message]);

  const exportCsv = useCallback(() => {
    const esc = (v: string | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["name", "company", "email", "phone", "category", "status", "checked_in_at"].join(","),
      ...detail.guests.map((g) =>
        [g.name, g.company, g.email, g.phone, g.category, g.status, g.checked_in_at ?? ""].map(esc).join(","),
      ),
    ];
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${detail.title.replace(/[^\w\u4e00-\u9fff]+/g, "-").slice(0, 60)}-guests.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [detail.guests, detail.title]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* ── How it went ── */}
      <section className="space-y-3 lg:col-span-2">
        <div className={`${CARD} grid grid-cols-2 divide-x divide-[var(--border-subtle)] text-center sm:grid-cols-3`}>
          <div className="px-2 py-4">
            <p className="text-[22px] font-bold tabular-nums text-emerald-500">{groups.attended.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("p.attended")}</p>
          </div>
          <div className="px-2 py-4">
            <p className="text-[22px] font-bold tabular-nums">{rate != null ? `${rate}%` : "—"}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("p.rate")}</p>
          </div>
          <div className="px-2 py-4">
            <p className="text-[22px] font-bold tabular-nums text-amber-400">{groups.noshow.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("p.noShow")}</p>
          </div>
        </div>

        <div className={`${CARD} p-4 sm:p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("p.byCategory")}</p>
          {byCategory.length === 0 ? (
            <p className="mt-3 text-[12px] text-[var(--text-dim)]">{t("p.empty")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {byCategory.map(([cat, n]) => (
                <div key={cat} className="flex items-center gap-3 text-[13px]">
                  <span className="w-20 shrink-0 text-[var(--text-secondary)]">{t(`cat.${cat}`)}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                    <span
                      className="block h-full rounded-full bg-[var(--text-dim)]"
                      style={{ width: `${groups.attended.length ? (n / groups.attended.length) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-8 text-end tabular-nums font-medium">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Follow-ups + export ── */}
      <section className="space-y-3">
        <div className={`${CARD} p-4 sm:p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("p.followup")}</p>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <SelectField<Audience>
              label={t("p.audience")}
              value={audience}
              onChange={(v) => setAudience(v)}
              options={(["attended", "noshow", "declined"] as const).map((a) => ({
                value: a,
                label: `${t(`aud.${a}`)} · ${groups[a].length} ${t("p.count")}`,
              }))}
            />
            <SelectField<MsgLang>
              label="Language"
              value={msgLang}
              onChange={(v) => setMsgLang(v)}
              options={[
                { value: "en", label: "English" },
                { value: "ar", label: "العربية" },
                { value: "zh", label: "中文" },
              ]}
            />
          </div>

          {message ? (
            <>
              <pre className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-[12px] leading-relaxed text-[var(--text-primary)]">
                {message}
              </pre>
              <p className="mt-1.5 text-[10px] text-[var(--text-dim)]">
                {sample.name} — ×{groups[audience].length}
              </p>
              <div className="mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  icon={copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                  onClick={() => void copyMessage()}
                >
                  {copied ? t("p.copied") : t("p.copy")}
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-[12px] text-[var(--text-dim)]">{t("p.empty")}</p>
          )}
        </div>

        <div className={`${CARD} p-4 sm:p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">CSV</p>
          <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
            {detail.guests.length} {t("p.count")} — {t("p.export")}
          </p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" icon={<DownloadIcon size={13} />} onClick={exportCsv}>
              {t("p.export")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
