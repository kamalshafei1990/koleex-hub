/* electron-builder `afterPack` hook — ad-hoc code signing for macOS.
 *
 * WHY: Apple Silicon (arm64) refuses to launch a binary with NO code signature
 * at all — Finder reports it as "damaged and can't be opened". Our CI builds
 * are unsigned (no Developer ID yet), so without this the .app won't open.
 *
 * An ad-hoc signature (`codesign --sign -`) satisfies the kernel's signature
 * requirement so the app runs. It is NOT notarized, so a downloaded copy still
 * shows the normal "unidentified developer" prompt — the user clears that with
 * right-click → Open (one time). This turns "damaged" into the expected,
 * bypassable Gatekeeper prompt.
 *
 * Skipped automatically when a real Developer ID is configured (CSC_LINK /
 * CSC_IDENTITY) — electron-builder handles proper signing in that case.
 */
const { execFileSync } = require("node:child_process");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.CSC_LINK || process.env.CSC_IDENTITY) return; // real cert → skip

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  console.log(`[adhoc-sign] ad-hoc signing ${appPath}`);
  try {
    execFileSync(
      "codesign",
      ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
      { stdio: "inherit" },
    );
    console.log("[adhoc-sign] done — app will launch on Apple Silicon.");
  } catch (e) {
    console.warn("[adhoc-sign] failed (non-macOS runner?):", e.message);
  }
};
