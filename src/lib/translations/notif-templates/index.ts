import type { Translations } from "@/lib/i18n";
import { todoTpl } from "./todo";
import { calendarTpl } from "./calendar";
import { qaTpl } from "./qa";
import { reportsTpl } from "./reports";
import { hrTpl } from "./hr";
import { workTpl } from "./work";
import { adminTpl } from "./admin";
import { commerceTpl } from "./commerce";

/* ---------------------------------------------------------------------------
   Notification templates, en / zh / ar — see lib/notification-templates.ts
   for the syntax. One file per app family, merged here: the bell and Koleex
   Mail render every family, so they load this whole index (in their own
   lazy chunks), and nothing else in the Hub imports it.

   Keys: `<k>.s` subject · `<k>.b` body (optional) · `enum.<name>.<code>`.
   validate:notification-types checks every entry has all three languages
   with the same placeholders, and that every key a writer uses exists.
   --------------------------------------------------------------------------- */
export const notifTemplatesT: Translations = {
  ...todoTpl,
  ...calendarTpl,
  ...qaTpl,
  ...reportsTpl,
  ...hrTpl,
  ...workTpl,
  ...adminTpl,
  ...commerceTpl,
};
