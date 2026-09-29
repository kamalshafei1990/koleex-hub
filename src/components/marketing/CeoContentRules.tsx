"use client";

/* CeoContentRules — CEO Brand's content rules in the composer (the Executive
   Assistant's JD, lib/marketing/ceo-rules; owner, 30/09/2026):
     · JdRulesCard — what is allowed and what is not, and the box the author
       ticks before sending the post to the CEO (the server refuses the send
       without it);
     · ContentCheckPanel — who confirmed, and what Koleex AI read in the words
       and each picture: nothing, what a picture may show, what it could not
       read. A warning for the CEO, never a block. Where the check stands is
       the server's word (content_state), so nothing here reads a clock;
     · CapturePanel — a quick capture's recording and what was said: who
       recorded it and when, the words Koleex AI heard (or that it could not),
       and the recording, played through a five-minute link the server signs
       only when asked. */

import { useState } from "react";
import Button from "@/components/kds/Button";
import Checkbox from "@/components/kds/Checkbox";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import MicrophoneIcon from "@/components/icons/ui/MicrophoneIcon";
import { JD_ALLOWED, JD_NOT_ALLOWED, type CheckReading, type JdFlag } from "@/lib/marketing/ceo-rules";
import { dmyHm } from "@/lib/marketing/format";
import type { PostView } from "@/lib/marketing/post-types";

type Tr = (key: string) => string;

export function JdRulesCard({ t, confirmed, onConfirm }: { t: Tr; confirmed?: boolean; onConfirm?: (v: boolean) => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("jd.title")}</h2>
        <p className="text-[11px] text-[var(--text-dim)]">{t("jd.source")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--text-muted)]">{t("jd.allowed")}</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-[12px] leading-5 text-[var(--text-primary)]">
            {JD_ALLOWED.map((k) => (
              <li key={k} className="flex items-start gap-2"><CheckIcon size={12} className="mt-1 shrink-0 text-[#10B981]" />{t(`jd.a.${k}`)}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--text-muted)]">{t("jd.notAllowed")}</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-[12px] leading-5 text-[var(--text-primary)]">
            {JD_NOT_ALLOWED.map((k) => (
              <li key={k} className="flex items-start gap-2"><CrossIcon size={12} className="mt-1 shrink-0 text-[#FF3333]" />{t(`jd.n.${k}`)}</li>
            ))}
          </ul>
        </div>
      </div>
      {onConfirm && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
          <Checkbox checked={!!confirmed} onChange={onConfirm} label={<span className="text-start text-[12px] leading-5">{t("jd.confirm")}</span>} />
        </div>
      )}
    </section>
  );
}

const flagged = (r: CheckReading | null | undefined) => !!r && r.flags.length > 0;

type FindingRow = { key: string; label: string; reading?: CheckReading | null; line?: string };

function Finding({ t, label, reading, line }: { t: Tr; label: string; reading?: CheckReading | null; line?: string }) {
  const items = reading?.flags.map((f: JdFlag) => t(`jd.n.${f}`)).join(" · ") ?? "";
  return (
    <li className="flex flex-col gap-0.5">
      <span><b>{label}</b> — {line ?? t("ck.mayShow").replace("{items}", items)}</span>
      {reading?.note && <span dir="auto" className="text-[11px] text-[var(--text-dim)]">{reading.note}</span>}
    </li>
  );
}

export function ContentCheckPanel({ t, post, canCheck, busy, onCheck }: {
  t: Tr;
  post: PostView;
  canCheck: boolean;
  busy: boolean;
  onCheck: () => void;
}) {
  const check = post.content_check;
  const state = post.content_state;
  if (!check || state === "none") return null;
  const ai = check.ai;
  const who = check.confirmed_by && check.confirmed_by === post.created_by ? post.author : null;
  const words = state === "done" ? ai?.words : undefined;
  const pictures = state === "done" ? ai?.pictures ?? [] : [];
  const findings: FindingRow[] = [
    ...(words === null ? [{ key: "w", label: t("ck.words"), line: t("ck.notRead") }] : flagged(words) ? [{ key: "w", label: t("ck.words"), reading: words }] : []),
    ...pictures.flatMap((p): FindingRow[] => {
      const label = t("ck.picture").replace("{n}", String(p.index + 1));
      if (p.skipped === "video") return [{ key: `p${p.index}`, label, line: t("ck.video") }];
      if (p.reading === null) return [{ key: `p${p.index}`, label, line: t("ck.notRead") }];
      return flagged(p.reading) ? [{ key: `p${p.index}`, label, reading: p.reading }] : [];
    }),
  ];
  const warn = state === "failed" || state === "changed" || pictures.some((p) => flagged(p.reading)) || flagged(words);
  return (
    <section className={`mt-4 flex flex-col gap-2 rounded-xl border px-4 py-3 text-[13px] text-[var(--text-primary)] ${
      warn ? "border-[#F59E0B]/35 bg-[#F59E0B]/10" : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
    }`}>
      <div className="flex items-center gap-2 font-semibold">
        {warn ? <ShieldExclamationIcon size={14} className="shrink-0 text-[#F59E0B]" /> : <ShieldCheckIcon size={14} className="shrink-0 text-[var(--text-muted)]" />}
        {t("ck.title")}
      </div>
      {check.confirmed_at && (
        <p className="text-[12px]">{t("ck.confirmed").replace("{name}", who || "—").replace("{when}", dmyHm(check.confirmed_at))}</p>
      )}
      {state === "running" && (
        <p className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]"><SpinnerIcon size={12} className="motion-safe:animate-spin" />{t("ck.checking")}</p>
      )}
      {state === "failed" && <p className="text-[12px]">{t("ck.failed")}</p>}
      {state === "changed" && <p className="text-[12px]">{t("ck.changed")}</p>}
      {state === "done" && findings.length === 0 && <p className="text-[12px]">{t("ck.clean")}</p>}
      {state === "done" && findings.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-[12px]">
          {findings.map((f) => <Finding key={f.key} t={t} label={f.label} reading={f.reading} line={f.line} />)}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--text-dim)]">{t("ck.hint")}</p>
        {canCheck && state !== "running" && (state !== "done" || findings.length > 0) && (
          <Button type="button" variant="secondary" disabled={busy} onClick={onCheck}>
            {busy ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : null}
            {t("ck.again")}
          </Button>
        )}
      </div>
    </section>
  );
}

export function CapturePanel({ t, post }: { t: Tr; post: PostView }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const c = post.capture;
  if (!c) return null;
  const who = c.captured_by === post.created_by ? post.author : null;
  const play = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/marketing/posts/${post.id}/voice`, { cache: "no-store" });
      const b = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !b.url) throw new Error("no link");
      setUrl(b.url);
      setState("idle");
    } catch {
      setState("failed");
    }
  };
  return (
    <section className="mt-4 flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-[13px] text-[var(--text-primary)]">
      <div className="flex items-center gap-2 font-semibold">
        <MicrophoneIcon size={14} className="shrink-0 text-[var(--text-muted)]" />
        {t("cp.title").replace("{name}", who || "—").replace("{when}", dmyHm(c.captured_at))}
      </div>
      {!c.transcript && c.audio_path && <p className="text-[12px] text-[#F59E0B]">{t("cp.unread")}</p>}
      {!!c.transcript && !c.drafted && <p className="text-[12px] text-[#F59E0B]">{t("cp.asIs")}</p>}
      {!!c.transcript && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-[var(--text-muted)]">{t("cp.said")}</summary>
          <p dir="auto" className="mt-1 whitespace-pre-wrap">{c.transcript}</p>
        </details>
      )}
      {!!c.typed && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-[var(--text-muted)]">{t("cp.typed")}</summary>
          <p dir="auto" className="mt-1 whitespace-pre-wrap">{c.typed}</p>
        </details>
      )}
      {c.audio_path && (url ? (
        <audio controls autoPlay src={url} className="h-9 w-full" />
      ) : (
        <div>
          <Button type="button" variant="secondary" disabled={state === "loading"} onClick={() => void play()}>
            {state === "loading" ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : <MicrophoneIcon size={14} />}
            {state === "loading" ? t("cp.loading") : t("cp.play")}
          </Button>
        </div>
      ))}
      {state === "failed" && <p className="text-[12px] text-[#F59E0B]">{t("cp.noLink")}</p>}
    </section>
  );
}
