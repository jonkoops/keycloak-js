# Keycloak JS Cordova Test Application

A Cordova application for testing the `cordova-native` adapter integration of Keycloak JS on Android.

This app exercises the login, logout, and token refresh flows using the `cordova-native` adapter, which uses the system browser (Chrome Custom Tabs) and deep links (via `cordova-plugin-browsertab` and `cordova-plugin-deeplinks`).

## Prerequisites

- [Node.js](https://nodejs.org/) (v22+)
- [Android SDK](https://developer.android.com/studio) with:
  - Platform tools
  - Android API 35
  - Build tools 35.0.0
- Android emulator or physical device connected via ADB
- [Podman](https://podman.io/) (for running Keycloak)

## Setup

From the repository root:

```sh
# Install all workspace dependencies.
npm install

# Start Keycloak.
podman run --rm --network=host -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev

# Provision the Keycloak realm, client, and test user.
cd test-cordova
npm run setup
```

## Building

```sh
cd test-cordova
npx cordova build android
```

## Running on an Emulator/Device

```sh
# Make sure an emulator is running or a device is connected.
adb devices

# Install and launch the app.
npx cordova run android
```

## Running Tests

The tests use Playwright's Android API to drive the Cordova app on an emulator.

```sh
cd test-cordova

# Make sure an emulator is running and the app APK is built.
npx cordova build android
adb install platforms/android/app/build/outputs/apk/debug/app-debug.apk

# Run the tests (Keycloak will be started automatically via Playwright's webServer config).
npm test
```

## Manual Testing

After deploying the app to an emulator, you can use Chrome DevTools remote debugging:

1. Open `chrome://inspect` in Chrome on your host machine
2. Find the WebView for `org.keycloak.jstest`
3. Click "inspect" to open DevTools
4. In the console, run:

```js
// Initialize Keycloak (realm and client must already be provisioned).
await initKeycloak()

// Trigger login — system browser opens, authenticate, deep link returns.
await doLogin()

// Check auth state.
getAuthState()

// Refresh the token.
await doRefreshToken()

// Logout.
await doLogout()
```

## Running on CI

The GitHub Actions workflow (`.github/workflows/test-cordova.yml`) runs these tests automatically. To verify locally with [act](https://github.com/nektos/act):

```sh
act -j test-cordova
```

## Architecture

- **`www/`** — The Cordova app source. `keycloak.js` is copied from the workspace-resolved package into `www/lib/` by a `before_prepare` hook.
- **`scripts/`** — Build hooks:
  - `ensure-cjs-platforms.cjs` — Ensures `platforms/*/package.json` has `"type": "commonjs"` (workaround for [cordova-android#1009](https://github.com/apache/cordova-android/issues/1009)) and copies `keycloak.js` into `www/lib/`
- **`support/`** — Test infrastructure:
  - `common.ts` — Shared constants (URLs, credentials)
  - `admin-client.ts` — Keycloak Admin API client (same pattern as `test/support/admin-client.ts`)
  - `setup.ts` — Provisions realm, client, and test user
- **`tests/`** — Playwright test specs using the Android API:
  - `cordova-native.spec.ts` — Login, logout, and token refresh tests
- **`config.xml`** — Cordova configuration with:
  - `AndroidLaunchMode: singleTask` (prevents duplicate app instances on deep link)
  - Deep link configuration for `keycloakjstest://callback`
