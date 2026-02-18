#!/usr/bin/env node
/**
 * Cordova before_prepare hook that:
 *
 * 1. Ensures platform directories have a package.json with "type": "commonjs".
 *    This is necessary because the project uses "type": "module" in its own
 *    package.json, and without an explicit package.json in the platforms
 *    directory, Node.js would inherit the ESM setting and fail to load
 *    cordova-android's CJS Api.js file.
 *    See: https://github.com/apache/cordova-android/issues/1009
 *
 * 2. Copies keycloak.js from the workspace-resolved node_modules into www/lib/
 *    so Cordova can bundle it into the APK. A symlink can't be used here because
 *    Cordova's prepare step copies symlinks as-is, causing "src and dest cannot
 *    be the same" errors on subsequent builds.
 */

const fs = require('fs');
const path = require('path');

function ensureCjsPlatforms(root) {
  const platformsDir = path.join(root, 'platforms');

  if (!fs.existsSync(platformsDir)) {
    return;
  }

  const entries = fs.readdirSync(platformsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pkgPath = path.join(platformsDir, entry.name, 'package.json');

    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ type: 'commonjs' }, null, 2) + '\n'
      );
      console.log(`[hook] Created ${pkgPath} with "type": "commonjs"`);
    }

    // Remove stale symlinks in platform assets to avoid "src and dest" errors.
    const assetsWwwLib = path.join(
      platformsDir, entry.name, 'app', 'src', 'main', 'assets', 'www', 'lib'
    );
    if (fs.existsSync(assetsWwwLib)) {
      const libEntries = fs.readdirSync(assetsWwwLib, { withFileTypes: true });
      for (const libEntry of libEntries) {
        const fullPath = path.join(assetsWwwLib, libEntry.name);
        if (libEntry.isSymbolicLink()) {
          fs.unlinkSync(fullPath);
          console.log(`[hook] Removed stale symlink ${fullPath}`);
        }
      }
    }
  }
}

function copyKeycloakJs(root) {
  const dest = path.join(root, 'www', 'lib', 'keycloak.js');
  // Resolve keycloak-js from the project's node_modules (workspace-resolved).
  let src;
  try {
    const keycloakPkg = require.resolve('keycloak-js', { paths: [root] });
    // keycloakPkg resolves to the package entry point; we need lib/keycloak.js
    src = path.join(path.dirname(keycloakPkg), 'lib', 'keycloak.js');
    if (!fs.existsSync(src)) {
      // If the entry point IS lib/keycloak.js, use it directly.
      src = keycloakPkg;
    }
  } catch {
    // Fallback: look in node_modules directly.
    src = path.join(root, 'node_modules', 'keycloak-js', 'lib', 'keycloak.js');
  }

  if (!fs.existsSync(src)) {
    console.error(`[hook] keycloak.js not found at ${src}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[hook] Copied keycloak.js from ${fs.realpathSync(src)}`);
}

// Determine project root: Cordova passes it as argv[2] for non-.js hooks.
const projectRoot = process.argv[2] || process.cwd();

ensureCjsPlatforms(projectRoot);
copyKeycloakJs(projectRoot);
