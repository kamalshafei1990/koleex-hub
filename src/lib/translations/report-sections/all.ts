/* Reports — EVERY family's section words in one object, for the server (a
   route that names a section) and validate:reports. Never imported by a page:
   the browser loads a report's own family through ./index.ts. */

import type { Translations } from "@/lib/i18n";
import work from "./work";
import visits from "./visits";
import sales from "./sales";
import suppliers from "./suppliers";
import quality from "./quality";
import logistics from "./logistics";
import service from "./service";
import travel from "./travel";
import memos from "./memos";
import hr from "./hr";

export const REPORT_SECTION_WORDS: Translations = { ...work, ...visits, ...sales, ...suppliers, ...quality, ...logistics, ...service, ...travel, ...memos, ...hr };
