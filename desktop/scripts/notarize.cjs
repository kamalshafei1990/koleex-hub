/* electron-builder `afterSign` hook — macOS notarization.
 *
 * SAFE BY DEFAULT: this no-ops unless Apple credentials are present in the
 * environment, so unsigned local builds still succeed. It only notarizes when
 * ALL of these are set:
 *   APPLE_ID                     Apple Developer account email
 *   APPLE_APP_SPECIFIC_PASSWORD  app-specific password for that account
 *   APPLE_TEAM_ID                Apple Developer Team ID
 * and `@electron/notarize` is installed (add it when you enable signing):
 *   npm i -D @electron/notarize
 */
exports.default = async function notarize(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log("[notarize] Apple credentials not set — skipping notarization (unsigned build).");
    return;
  }

  let notarizeFn;
  try {
    ({ notarize: notarizeFn } = require("@electron/notarize"));
  } catch {
    console.log("[notarize] @electron/notarize not installed — skipping. Run: npm i -D @electron/notarize");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  console.log(`[notarize] Notarizing ${appName}.app …`);
  await notarizeFn({
    appBundleId: "com.koleex.hub",
    appPath: `${appOutDir}/${appName}.app`,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
  console.log("[notarize] Done.");
};
