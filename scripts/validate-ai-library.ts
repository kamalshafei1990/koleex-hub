/* ---------------------------------------------------------------------------
   validate:ai-library — the picture gallery (roadmap C3).
   Section 1 drives the pure module; section 2 reads the route and the
   client and says so.
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { LIBRARY_LABEL_CHARS, LIBRARY_MAX_ITEMS, collectLibrary, imagesIn } from "../src/lib/server/ai/library";
import { BUDGETS } from "../src/lib/server/ai/security/rate-limit";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok = false;
  try { ok = typeof cond === "function" ? cond() : cond; } catch (e) { label += ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
  if (ok) { pass++; console.log(`  ✓ ${label}`); } else { failures.push(label); console.log(`  ✗ ${label}`); }
}

console.log("── 1. Pictures in a message ──");
check("markdown images are read with their labels, https only, in order",
  JSON.stringify(imagesIn("see ![KX-200](https://a/x.jpg) and ![](https://b/y.png) but not ![bad](http://c/z.jpg) nor ![no](javascript:alert(1))")) ===
  JSON.stringify([{ url: "https://a/x.jpg", label: "KX-200" }, { url: "https://b/y.png", label: "" }]));
check("a label is one line and capped; nothing, null and text without pictures give an empty list",
  imagesIn(`![${"x".repeat(200)}\n y](https://a/b)`)[0].label.length === LIBRARY_LABEL_CHARS && imagesIn(null).length === 0 && imagesIn("plain").length === 0);

console.log("\n── 2. Rows to a gallery ──");
{
  const titles = new Map<string, string | null>([["c1", "Ningbo shipment"], ["c2", null]]);
  const rows = [
    { id: "m3", conversation_id: "c1", content: "![new](https://p/1.jpg) ![two](https://p/2.jpg)", created_at: "2026-09-03T10:00:00Z" },
    { id: "m2", conversation_id: "c2", content: "![dup](https://p/1.jpg) ![three](https://p/3.jpg)", created_at: "2026-09-02T10:00:00Z" },
    { id: "m1", conversation_id: "c9", content: "![orphan](https://p/4.jpg)", created_at: "2026-09-01T10:00:00Z" },
  ];
  const items = collectLibrary(rows, titles);
  check("one entry per URL, newest sighting wins, order kept, the chat's title attached (null when it has none)",
    items.map((i) => i.url).join(",") === "https://p/1.jpg,https://p/2.jpg,https://p/3.jpg,https://p/4.jpg" &&
    items[0].message_id === "m3" && items[0].conversation_title === "Ningbo shipment" && items[2].conversation_title === null && items[3].conversation_title === null);
  const many = Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, conversation_id: "c1", content: `![p](https://p/${i}.jpg)`, created_at: "t" }));
  check("the gallery is capped", collectLibrary(many, titles).length === LIBRARY_MAX_ITEMS && collectLibrary(many, titles, 7).length === 7);
}

console.log("\n── 3. The route and the client, read ──");
{
  const route = readFileSync("src/app/api/ai/library/route.ts", "utf8");
  check("the route opens with the conversation doors and reads messages INSIDE the caller's own conversation ids, images only",
    /requireAuth\(\)[\s\S]{0,200}?requireInternalUser\(auth\)/.test(route) &&
    /from\("ai_conversations"\)[\s\S]{0,200}?\.eq\("tenant_id", auth\.tenant_id\)\s*\.eq\("account_id", auth\.account_id\)/.test(route) &&
    /from\("ai_messages"\)[\s\S]{0,200}?\.in\("conversation_id", Array\.from\(titles\.keys\(\)\)\)\s*\.like\("content", "%!\[%\]\(https:\/\/%"\)/.test(route) &&
    /if \(titles\.size === 0\) return NextResponse\.json\(\{ items: \[\] \}\);/.test(route));
  check("budgeted per account; logs carry counts only",
    /BUDGETS\.libraryPerAccount\(\)/.test(route) && BUDGETS.libraryPerAccount().bucket === "library" &&
    /console\.log\(`\[ai\.library\] ok rows=/.test(route) && !/console\.\w+\([^)]*content/.test(route));
  const panel = readFileSync("src/components/ai/LibraryPanel.tsx", "utf8");
  check("the panel fetches its own list from the fixed path, aborts on unmount, lazy-loads tiles and opens a picture in the lightbox with one action: open the chat",
    /fetchFn\(LIBRARY_PATH, \{ credentials: "include", signal: ctl\.signal \}\)/.test(panel) && /return \(\) => ctl\.abort\(\);/.test(panel) &&
    /loading="lazy"/.test(panel) && /<PhotoLightbox photo=\{open \? \{ url: open\.url, label: open\.label \} : null\}/.test(panel) &&
    /onOpenConversation\(id\)/.test(panel) && !/dangerouslySetInnerHTML/.test(panel));
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("the app shows the library in the main pane while open, and opening or starting a chat closes it",
    /\{libraryOpen \? \(\s*<LibraryPanel copy=\{copy\} onOpenConversation=\{\(id\) => void openConversation\(id\)\} \/>/.test(app) &&
    /const openConversation = useCallback\(\s*async \(id: string\) => \{\s*setLibraryOpen\(false\);/.test(app) &&
    /const startNewChat = useCallback\(async \(\) => \{\s*setLibraryOpen\(false\);/.test(app));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the database read and the grid on a phone — opening the Library is the test.");
