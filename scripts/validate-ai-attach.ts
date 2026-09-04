/* ---------------------------------------------------------------------------
   validate:ai-attach — photos shrunk on the device before they are attached.
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { MAX_EDGE, SHRINK_ABOVE_BYTES, planShrink, shouldShrink, shrunkName } from "../src/lib/ai/image-shrink";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok = false;
  try { ok = typeof cond === "function" ? cond() : cond; } catch (e) { label += ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
  if (ok) { pass++; console.log(`  ✓ ${label}`); } else { failures.push(label); console.log(`  ✗ ${label}`); }
}

console.log("── 1. The plan ──");
check("a phone photo's long side is capped, aspect kept, never upscaled",
  JSON.stringify(planShrink(4032, 3024)) === JSON.stringify({ width: 2048, height: 1536, scaled: true }) &&
  JSON.stringify(planShrink(3024, 4032)) === JSON.stringify({ width: 1536, height: 2048, scaled: true }) &&
  JSON.stringify(planShrink(1200, 800)) === JSON.stringify({ width: 1200, height: 800, scaled: false }) &&
  planShrink(10, 100000).width === 1 && MAX_EDGE === 2048);
check("only images above the threshold are shrunk; GIFs and documents never are",
  shouldShrink({ type: "image/png", name: "IMG_2293.png", size: 17_000_000 }) &&
  shouldShrink({ type: "", name: "photo.HEIC", size: 3_000_000 }) &&
  !shouldShrink({ type: "image/jpeg", name: "small.jpg", size: SHRINK_ABOVE_BYTES }) &&
  !shouldShrink({ type: "image/gif", name: "anim.gif", size: 9_000_000 }) &&
  !shouldShrink({ type: "application/pdf", name: "spec.pdf", size: 90_000_000 }));
check("the shrunk file keeps its stem and becomes .jpg",
  shrunkName("IMG_2293.png") === "IMG_2293.jpg" && shrunkName("photo") === "photo.jpg" && shrunkName(".png") === "photo.jpg");

console.log("\n── 2. The composer, read ──");
{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("every attach route shrinks first, then runs the size gate on what will be sent",
    /const addFiles = useCallback\(\(incoming: File\[\]\) => \{\s*if \(incoming\.length === 0\) return;[\s\S]{0,400}?Promise\.all\(incoming\.map\(\(f\) => shrinkImage\(f\)\)\)\.then\(\(files\) => addFilesSized\(files\)\);/.test(app) &&
    /const addFilesSized = useCallback\(\(incoming: File\[\]\) => \{[\s\S]{0,900}?f\.size > capMb \* 1024 \* 1024/.test(app) &&
    app.indexOf("const addFilesSized") < app.indexOf("const addFiles = useCallback"));
  const shrink = readFileSync("src/lib/ai/image-shrink.ts", "utf8");
  check("the shrink never throws and never returns something bigger than the original",
    /if \(!blob \|\| blob\.size >= file\.size\) return file;/.test(shrink) && /catch \{\s*return file;\s*\}/.test(shrink) && /bitmap\?\.close\?\.\(\);/.test(shrink));
}

console.log("\n── 3. The turn goes into the thread first (owner ask, 2026-09-04) ──");
{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const send = app.slice(app.indexOf("const send = useCallback("), app.indexOf("/* ── Phase 12: message-level actions"));
  const posted = send.indexOf("setMessages((prev) => [\n        ...prev,\n        optimistic,");
  const read = send.indexOf('fetch("/api/ai/attachments"');
  check("the user bubble and the thinking placeholder are posted BEFORE the attachment is read, and the composer is cleared at once",
    posted > 0 && read > posted && send.indexOf("setAttachments([]);") > posted && send.indexOf("setAttachments([]);") < read);
  check("a picture rides in the bubble as a local preview URL; a document as a name only",
    /url: \(f\.type \|\| ""\)\.startsWith\("image\/"\) \? URL\.createObjectURL\(f\) : null,/.test(send) &&
    /\.\.\.\(attachedFiles\.length > 0 \? \{ attachedFiles \} : \{\}\),/.test(send));
  check("no blocking 'Reading attachment…' bar remains; the placeholder says it through the orb activity",
    !/L_READING/.test(app) && /setAttachReading\(true\);/.test(send) && /setAttachReading\(false\);/.test(send) &&
    /sending\s*\?\s*attachReading\s*\?\s*"reading"/.test(app));
  check("when nothing could be read, the question is NOT sent without its file: both bubbles come out, words and files return to the composer, the error says why",
    /if \(failure !== null \|\| attachPayload\.length === 0\) \{\s*setMessages\(\(prev\) => prev\.filter\(\(m\) => m\.id !== optimistic\.id && m\.id !== placeholderId\)\);\s*setInput\(\(cur\) => \(cur\.trim\(\) \? cur : text\)\);\s*setAttachments\(\(cur\) => \(cur\.length > 0 \? cur : filesToSend\)\);\s*setError\(failure \?\? partial \?\? "Couldn't read the attachment\(s\)\."\);\s*sendingRef\.current = false;\s*setSending\(false\);\s*return;/.test(send));
  check("a dropped connection is retried once with a rebuilt body; a server answer never is",
    /try \{\s*up = await request\(\);\s*\} catch \(first\) \{\s*if \(!\(first instanceof TypeError\)\) throw first;\s*await new Promise\(\(r\) => setTimeout\(r, 1500\)\);\s*up = await request\(\);\s*\}/.test(send) &&
    /request = \(\) => \{\s*const fd = new FormData\(\);/.test(send));
  check("preview URLs are revoked when the thread is left, and on unmount",
    (app.match(/revokeMessagePreviews\(\);/g) ?? []).length >= 2 && /useEffect\(\(\) => revokeMessagePreviews, \[revokeMessagePreviews\]\);/.test(app));
  const bubble = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  check("the user bubble shows the picture itself, tappable into the lightbox, and a 📎 chip for a document — only for user rows",
    /const attachedFiles = isUser \? \(msg\.attachedFiles \?\? \[\]\) : \[\];/.test(bubble) &&
    /onClick=\{\(\) => setOpenPhoto\(\{ url, label: f\.name \}\)\}/.test(bubble) &&
    /<PhotoLightbox photo=\{openPhoto\} onClose=\{\(\) => setOpenPhoto\(null\)\} closeLabel=\{copy\.back\} \/>/.test(bubble));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the canvas encode and the blob preview in a real browser — attaching a camera-roll photo is the test.");
