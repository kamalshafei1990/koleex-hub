import type { Translations } from "@/lib/i18n";
import { reportCommonT } from "./report-ui/common";
import { reportHomeT } from "./report-ui/home";
import { reportPageT } from "./report-ui/page";
import { reportComposerT } from "./report-ui/composer";
import { reportPrintT } from "./report-ui/print";
import { reportComplianceT } from "./report-ui/compliance";
import { reportServerT } from "./report-ui/server";

/* Reports app (Phase 1, 25 Sep 2026; phase 2 A–D; obligations 3A). Template strings follow
   `tpl.<key>.name|desc|s.<section>[.hint]`; validate:reports checks every
   template key and section has all three languages.

   Phase 4C: only a template's NAME is a Reports word (every list shows it —
   ./report-ui/common.ts). Its section words (`tpl.<key>.s.*` — sections,
   points, answers, columns, hints) live in ./report-sections/<family>.ts and
   load with the report that shows them; its one-line description
   (`tpl.<key>.desc`, Phase 5B) lives in ./report-descs.ts, carried only where
   a type is picked; and the blocks' own words (`blk.*` — checklist marks,
   numbers columns, statuses, empty lines) live in ./report-blocks.ts, riding
   the blocks' own chunk.

   26 Sep 2026: the app's own words live one file per place that reads them —
   ./report-ui/{common, home, page, composer, print, compliance, server} —
   and each screen imports only its own: the home no longer downloads the
   report page's words, nor the page the home's. THIS UNION is for the
   server (notifications, the calendar, the AI routes); a screen importing
   it gets every word back, so validate:reports §26 fails. */
export const reportsT: Translations = {
  ...reportCommonT,
  ...reportHomeT,
  ...reportPageT,
  ...reportComposerT,
  ...reportPrintT,
  ...reportComplianceT,
  ...reportServerT,
};
