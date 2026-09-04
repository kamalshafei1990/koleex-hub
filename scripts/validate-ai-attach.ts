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

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the canvas encode in a real browser — attaching a camera-roll photo is the test.");
