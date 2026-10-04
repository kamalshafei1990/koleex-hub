"use client";

/* ---------------------------------------------------------------------------
   QaFocusGate — loads the QA "Open Route" highlighter only when a page was
   actually opened from the QA console (?qa_issue / ?qa_focus). Every other
   page view used to download and parse it on the first load for nothing.

   LATCHED: the highlighter cleans the QA params out of the URL once it has
   read them, but its arrival banner and "capture after" button must stay on
   screen — so once opened it stays mounted for the rest of the visit, exactly
   as it did when it was always mounted.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

const QaFocusHighlight = dynamic(() => import("./QaFocusHighlight"), { ssr: false });

export default function QaFocusGate() {
  const sp = useSearchParams();
  const arrived = !!(sp.get("qa_issue") || sp.get("qa_focus"));
  const [latched, setLatched] = useState(arrived);
  if (arrived && !latched) setLatched(true);
  return latched ? <QaFocusHighlight /> : null;
}
