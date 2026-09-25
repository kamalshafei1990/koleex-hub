"use client";

/* ---------------------------------------------------------------------------
   NotificationText — a notification's subject or body in the reader's
   language.

   A row written with a template (metadata.tpl) renders from the dictionary
   at once; only the pieces a person wrote (a task title, a reason) go
   through auto-translation, each on its own. A row without one — written
   before templates, or a type that has none — shows its stored text through
   AutoTranslatedText exactly as before. One component for the bell and
   Koleex Mail, so the two can never disagree about what a row says.
   --------------------------------------------------------------------------- */

import { useMemo } from "react";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { renderNotification, type TplPart } from "@/lib/notification-templates";
import { cleanInboxBody, cleanInboxSubject } from "@/lib/inbox-display";
import type { Lang } from "@/lib/i18n";

function Parts({ parts }: { parts: TplPart[] }) {
  return (
    <>
      {parts.map((p, i) => (typeof p === "string" ? p : <AutoTranslatedText key={i} text={p.free} plain />))}
    </>
  );
}

/** The template render for a row, memoised on the row and language. */
export function useRenderedNotification(meta: unknown, lang: Lang) {
  return useMemo(() => renderNotification(meta, lang), [meta, lang]);
}

/* `plain` inside a <button> host (a Koleex Mail list row): the older rows'
   "auto-translated" chip is itself a button, and a button inside a button is
   invalid HTML — React's hydration error on every open of the mailbox. */
export function NotificationSubject({
  meta, subject, lang, plain,
}: { meta: unknown; subject: string; lang: Lang; plain?: boolean }) {
  const r = useRenderedNotification(meta, lang);
  if (r) return <Parts parts={r.subject} />;
  return <AutoTranslatedText text={cleanInboxSubject(subject)} plain={plain} />;
}

/** The body, or nothing. `className` goes on the block either way. */
export function NotificationBody({
  meta, body, lang, className, plain,
}: { meta: unknown; body: string | null | undefined; lang: Lang; className?: string; plain?: boolean }) {
  const r = useRenderedNotification(meta, lang);
  if (r?.body) {
    return (
      <p className={className} style={{ whiteSpace: "pre-wrap" }}>
        <Parts parts={r.body} />
      </p>
    );
  }
  if (!body) return null;
  return <AutoTranslatedText text={cleanInboxBody(body)} block className={className} plain={plain} />;
}
