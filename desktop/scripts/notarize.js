const path = require('node:path');
const { notarize } = require('@electron/notarize');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (process.env.SELF_SIGNED === 'true') {
    console.warn('[notarize] SELF_SIGNED=true, skipping notarization.');
    return;
  }

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  const missingCredentials =
    !process.env.APPLE_ID ||
    !process.env.APPLE_APP_SPECIFIC_PASSWORD ||
    !process.env.APPLE_TEAM_ID;

  if (missingCredentials) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      throw new Error(
        '[notarize] Missing APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID in CI.'
      );
    }

    console.warn(
      '[notarize] Missing APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID. Skipping notarization.'
    );
    return;
  }

  await notarize({
    appBundleId: packager.appInfo.id,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
    tool: 'notarytool'
  });
};
