/* Reports — EVERY family's section words in one object, for the server (a
   route that names a section) and validate:reports. Never imported by a page:
   the browser loads a report's own family through ./index.ts. */

import type { Translations } from "@/lib/i18n";
import work from "./work";
import team from "./team";
import office from "./office";
import visits from "./visits";
import sales from "./sales";
import marketing from "./marketing";
import suppliers from "./suppliers";
import quality from "./quality";
import logistics from "./logistics";
import service from "./service";
import travel from "./travel";
import memos from "./memos";
import hr from "./hr";
import projects from "./projects";
import inventory from "./inventory";
import finance from "./finance";
import executive from "./executive";
import compliance from "./compliance";

export const REPORT_SECTION_WORDS: Translations = { ...work, ...team, ...office, ...visits, ...sales, ...marketing, ...suppliers, ...quality, ...logistics, ...service, ...travel, ...memos, ...hr, ...projects, ...inventory, ...finance, ...executive, ...compliance };
