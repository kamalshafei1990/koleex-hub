/* electron-builder `afterPack` hook — VALID ad-hoc code signing for macOS.
 *
 * WHY: Apple Silicon (arm64) refuses to launch a binary with NO code signature
 * ("damaged and can't be opened"). Our CI builds have no Developer ID, so the
 * app must at least be ad-hoc signed to run.
 *
 * IMPORTANT: `codesign --deep` is unreliable for Electron apps — it can seal
 * the nested helper apps / frameworks incorrectly, producing an INVALID
 * signature that macOS also reports as "damaged". The correct approach is to
 * sign every nested Mach-O bundle INSIDE-OUT (deepest first), then the outer
 * .app last. That yields a valid ad-hoc signature.
 *
 * Result: the app launches. It is still NOT notarized (needs a paid Apple
 * Developer ID), so a freshly downloaded copy is gated by quarantine — the
 * user allows it once via System Settings → Privacy & Security → "Open Anyway"
 * (macOS 13–26), or `xattr -dr com.apple.quarantine <app>`.
 *
 * Skipped automatically when a real Developer ID is configured (CSC_LINK /
 * CSC_IDENTITY) — electron-builder handles proper signing in that case.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.CSC_LINK || process.env.CSC_IDENTITY) return; // real cert → skip

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;

  const sign = (target) =>
    execFileSync(
      "codesign",
      ["--force", "--sign", "-", "--timestamp=none", target],
      { stdio: "inherit" },
    );

  try {
    const frameworks = path.join(appPath, "Contents", "Frameworks");
    if (fs.existsSync(frameworks)) {
      const entries = fs.readdirSync(frameworks);
      // 1) loose dylibs
      for (const e of entries.filter((n) => n.endsWith(".dylib")))
        sign(path.join(frameworks, e));
      // 2) helper apps — inner executable first, then the bundle
      for (const e of entries.filter((n) => n.endsWith(".app"))) {
        const helper = path.join(frameworks, e);
        const innerExec = path.join(
          helper,
          "Contents",
          "MacOS",
          e.replace(/\.app$/, ""),
        );
        if (fs.existsSync(innerExec)) sign(innerExec);
        sign(helper);
      }
      // 3) frameworks (Electron Framework, Squirrel, Mantle, …)
      for (const e of entries.filter((n) => n.endsWith(".framework")))
        sign(path.join(frameworks, e));
    }
    // 4) outer app LAST so its seal covers the freshly-signed contents
    sign(appPath);

    // Sanity-check the result so a bad signature fails the build loudly
    // instead of shipping another "damaged" .app.
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      stdio: "inherit",
    });
    console.log(`[adhoc-sign] valid ad-hoc signature applied to ${appName}.app`);
  } catch (e) {
    console.warn("[adhoc-sign] failed (non-macOS runner?):", e.message);
  }
};
