import type { Translations } from "@/lib/i18n";

/* The Home launcher's own strings (My apps row, owner pick F, 23 Sep 2026).
   Kept OUT of hub.ts on purpose: hubT is read by the shell on every route,
   so anything added there ships in the bundle every page shares — these
   nine strings put six routes 1 KB over validate:budgets. Home merges this
   dictionary with hubT at module scope, inside its own chunk. */
export const homeLauncherT: Translations = {
  "home.myApps": { en: "My apps", zh: "\u6211\u7684\u5e94\u7528", ar: "\u062a\u0637\u0628\u064a\u0642\u0627\u062a\u064a" },
  "home.editApps": { en: "Edit", zh: "\u7f16\u8f91", ar: "\u062a\u0639\u062f\u064a\u0644" },
  "home.doneApps": { en: "Done", zh: "\u5b8c\u6210", ar: "\u062a\u0645" },
  "home.myAppsEmpty": { en: "Tap Edit to pin the apps you use most", zh: "\u70b9\u51fb\u7f16\u8f91\uff0c\u56fa\u5b9a\u4f60\u6700\u5e38\u7528\u7684\u5e94\u7528", ar: "\u0627\u0636\u063a\u0637 \u062a\u0639\u062f\u064a\u0644 \u0644\u062a\u062b\u0628\u064a\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642\u0627\u062a \u0627\u0644\u062a\u064a \u062a\u0633\u062a\u062e\u062f\u0645\u0647\u0627 \u0623\u0643\u062b\u0631" },
  "home.myAppsEditHint": { en: "Drag to reorder \u00b7 tap an app below to add or remove it", zh: "\u62d6\u52a8\u6392\u5e8f \u00b7 \u70b9\u51fb\u4e0b\u65b9\u5e94\u7528\u5373\u53ef\u6dfb\u52a0\u6216\u79fb\u9664", ar: "\u0627\u0633\u062d\u0628 \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u00b7 \u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0623\u064a \u062a\u0637\u0628\u064a\u0642 \u0628\u0627\u0644\u0623\u0633\u0641\u0644 \u0644\u0625\u0636\u0627\u0641\u062a\u0647 \u0623\u0648 \u0625\u0632\u0627\u0644\u062a\u0647" },
  "home.pinApp": { en: "Add {name} to My apps", zh: "\u5c06 {name} \u6dfb\u52a0\u5230\u6211\u7684\u5e94\u7528", ar: "\u0623\u0636\u0641 {name} \u0625\u0644\u0649 \u062a\u0637\u0628\u064a\u0642\u0627\u062a\u064a" },
  "home.unpinApp": { en: "Remove {name} from My apps", zh: "\u4ece\u6211\u7684\u5e94\u7528\u4e2d\u79fb\u9664 {name}", ar: "\u0623\u0632\u0644 {name} \u0645\u0646 \u062a\u0637\u0628\u064a\u0642\u0627\u062a\u064a" },
  "home.myAppsFull": { en: "My apps is full \u2014 remove one to add another", zh: "\u6211\u7684\u5e94\u7528\u5df2\u6ee1\uff0c\u8bf7\u5148\u79fb\u9664\u4e00\u4e2a", ar: "\u062a\u0637\u0628\u064a\u0642\u0627\u062a\u064a \u0645\u0645\u062a\u0644\u0626\u0629 \u2014 \u0623\u0632\u0644 \u062a\u0637\u0628\u064a\u0642\u064b\u0627 \u0644\u0625\u0636\u0627\u0641\u0629 \u0622\u062e\u0631" },
  "home.moveApp": { en: "{name}, {pos} of {total}. Use the arrow keys to move it.", zh: "{name}\uff0c\u7b2c {pos} \u4e2a\uff0c\u5171 {total} \u4e2a\u3002\u4f7f\u7528\u65b9\u5411\u952e\u79fb\u52a8\u3002", ar: "{name}\u060c {pos} \u0645\u0646 {total}. \u0627\u0633\u062a\u062e\u062f\u0645 \u0645\u0641\u0627\u062a\u064a\u062d \u0627\u0644\u0623\u0633\u0647\u0645 \u0644\u062a\u062d\u0631\u064a\u0643\u0647." },
};
