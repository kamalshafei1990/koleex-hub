import type { Translations } from "@/lib/i18n";

import { CT_ACTION } from "./contacts/action";
import { CT_ADD } from "./contacts/add";
import { CT_BACK } from "./contacts/back";
import { CT_BADGE } from "./contacts/badge";
import { CT_BTN } from "./contacts/btn";
import { CT_CLASSIFICATIONS } from "./contacts/classifications";
import { CT_COV } from "./contacts/cov";
import { CT_CREATE } from "./contacts/create";
import { CT_CS } from "./contacts/cs";
import { CT_CUSTOMERTAB } from "./contacts/customerTab";
import { CT_DELETE } from "./contacts/delete";
import { CT_DEPT } from "./contacts/dept";
import { CT_DETAIL } from "./contacts/detail";
import { CT_EDITCONTACT } from "./contacts/editContact";
import { CT_ENTITY } from "./contacts/entity";
import { CT_ERROR } from "./contacts/error";
import { CT_FIELD } from "./contacts/field";
import { CT_FILTER } from "./contacts/filter";
import { CT_FS } from "./contacts/fs";
import { CT_HINT } from "./contacts/hint";
import { CT_HUB } from "./contacts/hub";
import { CT_KPI } from "./contacts/kpi";
import { CT_MISC } from "./contacts/misc";
import { CT_MONTH } from "./contacts/month";
import { CT_MS } from "./contacts/ms";
import { CT_NEG } from "./contacts/neg";
import { CT_NEWCONTACT } from "./contacts/newContact";
import { CT_NEWCUSTOMER } from "./contacts/newCustomer";
import { CT_NEWSUPPLIER } from "./contacts/newSupplier";
import { CT_NOCONTACTSFOUND } from "./contacts/noContactsFound";
import { CT_OPT } from "./contacts/opt";
import { CT_OWNER } from "./contacts/owner";
import { CT_PHOTO } from "./contacts/photo";
import { CT_PIPELINE } from "./contacts/pipeline";
import { CT_PLACEHOLDER } from "./contacts/placeholder";
import { CT_RDCHK } from "./contacts/rdChk";
import { CT_RDWHY } from "./contacts/rdWhy";
import { CT_REFRESHING } from "./contacts/refreshing";
import { CT_RESUMETYPE } from "./contacts/resumeType";
import { CT_RS } from "./contacts/rs";
import { CT_SCC } from "./contacts/scc";
import { CT_SD } from "./contacts/sd";
import { CT_SEARCHCUSTOMERS } from "./contacts/searchCustomers";
import { CT_SEARCHPLACEHOLDER } from "./contacts/searchPlaceholder";
import { CT_SEARCHSUPPLIERS } from "./contacts/searchSuppliers";
import { CT_SECTION } from "./contacts/section";
import { CT_SELECTCONTACT } from "./contacts/selectContact";
import { CT_SETUP } from "./contacts/setup";
import { CT_SRCG } from "./contacts/srcg";
import { CT_SREASON } from "./contacts/sreason";
import { CT_SUBSECTION } from "./contacts/subsection";
import { CT_SUPGROUP } from "./contacts/supgroup";
import { CT_SUPPLIER } from "./contacts/supplier";
import { CT_TAB } from "./contacts/tab";
import { CT_TIER } from "./contacts/tier";
import { CT_TITLE } from "./contacts/title";
import { CT_TOOLTIP } from "./contacts/tooltip";
import { CT_TS } from "./contacts/ts";
import { CT_TYPE } from "./contacts/type";
import { CT_TYPECHOOSER } from "./contacts/typeChooser";
import { CT_UNIT } from "./contacts/unit";
import { CT_UNNAMEDCONTACT } from "./contacts/unnamedContact";
/* ⚠️ THIS UNION EXISTS FOR COMPATIBILITY, NOT FOR SCREENS TO IMPORT.
   1,725 keys x 3 languages — 225 KB of source — imported whole by eleven
   components. Nine of them read fewer than eighty keys: SourcingSection 57,
   ContactsSection 51, MediaSection 48, NegotiationSection 47. /suppliers/[id]
   was the heaviest route left in the Hub at 1,054 KB because of it.

   The strings live one file per namespace under ./contacts/; each screen
   imports only what it calls. `validate:contacts-i18n` fails the build if a
   component imports this union again, or calls a key it does not import. */
export const contactsT: Translations = {
  ...CT_ACTION,
  ...CT_ADD,
  ...CT_BACK,
  ...CT_BADGE,
  ...CT_BTN,
  ...CT_CLASSIFICATIONS,
  ...CT_COV,
  ...CT_CREATE,
  ...CT_CS,
  ...CT_CUSTOMERTAB,
  ...CT_DELETE,
  ...CT_DEPT,
  ...CT_DETAIL,
  ...CT_EDITCONTACT,
  ...CT_ENTITY,
  ...CT_ERROR,
  ...CT_FIELD,
  ...CT_FILTER,
  ...CT_FS,
  ...CT_HINT,
  ...CT_HUB,
  ...CT_KPI,
  ...CT_MISC,
  ...CT_MONTH,
  ...CT_MS,
  ...CT_NEG,
  ...CT_NEWCONTACT,
  ...CT_NEWCUSTOMER,
  ...CT_NEWSUPPLIER,
  ...CT_NOCONTACTSFOUND,
  ...CT_OPT,
  ...CT_OWNER,
  ...CT_PHOTO,
  ...CT_PIPELINE,
  ...CT_PLACEHOLDER,
  ...CT_RDCHK,
  ...CT_RDWHY,
  ...CT_REFRESHING,
  ...CT_RESUMETYPE,
  ...CT_RS,
  ...CT_SCC,
  ...CT_SD,
  ...CT_SEARCHCUSTOMERS,
  ...CT_SEARCHPLACEHOLDER,
  ...CT_SEARCHSUPPLIERS,
  ...CT_SECTION,
  ...CT_SELECTCONTACT,
  ...CT_SETUP,
  ...CT_SRCG,
  ...CT_SREASON,
  ...CT_SUBSECTION,
  ...CT_SUPGROUP,
  ...CT_SUPPLIER,
  ...CT_TAB,
  ...CT_TIER,
  ...CT_TITLE,
  ...CT_TOOLTIP,
  ...CT_TS,
  ...CT_TYPE,
  ...CT_TYPECHOOSER,
  ...CT_UNIT,
  ...CT_UNNAMEDCONTACT,
};
