import { test as base, expect } from '@playwright/test'
import { _android as android, type AndroidDevice, type Page } from 'playwright'
import { adminClient } from '../support/admin-client.ts'
import { CLIENT_ID, REALM_NAME, REDIRECT_URI, TEST_PASSWORD, TEST_USERNAME } from '../support/common.ts'

const APP_PACKAGE = 'org.keycloak.jstest'
const APP_ACTIVITY = `${APP_PACKAGE}/.MainActivity`

const test = base.extend<{ device: AndroidDevice }>({
  async device ({}, use) {
    const [device] = await android.devices()

    if (!device) {
      throw new Error('No Android device found. Make sure an emulator is running or a device is connected.')
    }

    await use(device)
    await device.close()
  }
})

test.beforeAll(async () => {
  // Delete the realm if it already exists to start fresh.
  try {
    await adminClient.realms.del({ realm: REALM_NAME })
  } catch {
    // Realm doesn't exist, which is fine.
  }

  // Create the realm.
  await adminClient.realms.create({
    realm: REALM_NAME,
    enabled: true
  })

  // Create a public client with the custom URL scheme redirect URI.
  await adminClient.clients.create({
    realm: REALM_NAME,
    enabled: true,
    clientId: CLIENT_ID,
    publicClient: true,
    redirectUris: [REDIRECT_URI, `${REDIRECT_URI}/*`, 'http://localhost'],
    webOrigins: ['*']
  })

  // Create a test user.
  const { id: userId } = await adminClient.users.create({
    realm: REALM_NAME,
    enabled: true,
    username: TEST_USERNAME,
    firstName: 'Test',
    lastName: 'User',
    email: TEST_USERNAME,
    emailVerified: true
  })

  await adminClient.users.resetPassword({
    realm: REALM_NAME,
    id: userId,
    credential: {
      temporary: false,
      type: 'password',
      value: TEST_PASSWORD
    }
  })
})

test.afterAll(async () => {
  try {
    await adminClient.realms.del({ realm: REALM_NAME })
  } catch {
    // Ignore cleanup errors.
  }
})

/**
 * Get a Playwright Page connected to the Cordova app's WebView.
 */
async function getAppPage (device: AndroidDevice): Promise<Page> {
  const webview = await device.webView({ pkg: APP_PACKAGE })
  return await webview.page()
}

/**
 * Intercept the BrowserTab Cordova plugin so that calls to `openUrl` capture
 * the URL instead of launching a Chrome Custom Tab.  This keeps the WebView
 * context alive and lets us handle the OAuth redirect programmatically.
 */
async function interceptBrowserTab (page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = globalThis as Record<string, unknown>
    g._capturedBrowserTabUrl = null

    // Replace openUrl — just store the URL, never open the system browser.
    ;(window as any).cordova.plugins.browsertab.openUrl = (url: string) => {
      g._capturedBrowserTabUrl = url
    }
    // Replace close — nothing to close since we never opened anything.
    ;(window as any).cordova.plugins.browsertab.close = () => {}
  })
}

/**
 * Wait for the intercepted BrowserTab to have captured a URL, then return it
 * and reset the capture slot for the next call.
 */
async function getCapturedUrl (page: Page, timeout = 15_000): Promise<string> {
  await page.waitForFunction(
    () => (globalThis as Record<string, unknown>)._capturedBrowserTabUrl != null,
    { timeout }
  )

  return await page.evaluate(() => {
    const g = globalThis as Record<string, unknown>
    const url = g._capturedBrowserTabUrl as string
    g._capturedBrowserTabUrl = null
    return url
  })
}

/**
 * Submit the Keycloak login form by making direct HTTP requests from Node.
 *
 * 1. GET the auth URL → receive the HTML login form + session cookies.
 * 2. POST username / password to the form action → receive a 302 redirect
 *    to `keycloakjstest://callback?code=…&state=…`.
 *
 * Returns the redirect URL (custom-scheme) that must be delivered back to
 * the app via a deep-link intent.
 */
async function submitKeycloakLoginForm (
  authUrl: string,
  username: string,
  password: string
): Promise<string> {
  // The app builds the URL with the emulator-to-host address; from Node we
  // talk to Keycloak directly on localhost.
  const nodeUrl = authUrl.replace('10.0.2.2', 'localhost')

  // 1. Fetch the login page.
  const loginPageRes = await fetch(nodeUrl)

  // Collect any cookies Keycloak set (AUTH_SESSION_ID, KC_RESTART, …).
  const cookies = (loginPageRes.headers.getSetCookie?.() ?? [])
    .map((c: string) => c.split(';')[0])
    .join('; ')

  const html = await loginPageRes.text()

  // Extract the <form action="…"> URL.
  const actionMatch = html.match(/action="([^"]+)"/)
  if (!actionMatch) {
    throw new Error(
      `Could not find login form action in Keycloak response:\n${html.substring(0, 500)}`
    )
  }

  let actionUrl = actionMatch[1].replace(/&amp;/g, '&')

  // Make relative action URLs absolute.
  if (actionUrl.startsWith('/')) {
    const base = new URL(nodeUrl)
    actionUrl = `${base.origin}${actionUrl}`
  }

  // Also rewrite 10.0.2.2 → localhost in the action URL (some KC versions
  // echo the original host back).
  actionUrl = actionUrl.replace('10.0.2.2', 'localhost')

  // 2. POST the credentials.
  const loginRes = await fetch(actionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookies ? { Cookie: cookies } : {})
    },
    body: new URLSearchParams({ username, password }).toString(),
    redirect: 'manual'
  })

  // Follow any intermediate (HTTP) 3xx redirects until we arrive at the
  // custom-scheme redirect.
  let location = loginRes.headers.get('location')
  while (location && !location.startsWith('keycloakjstest://')) {
    const next = await fetch(
      location.replace('10.0.2.2', 'localhost'),
      { redirect: 'manual' }
    )
    location = next.headers.get('location')
  }

  if (!location) {
    throw new Error(
      `No keycloakjstest:// redirect received after login (status ${loginRes.status}).`
    )
  }

  return location
}

/**
 * Follow a Keycloak logout URL and return the redirect that Keycloak issues
 * back to the app's custom scheme.
 */
async function followKeycloakLogout (logoutUrl: string): Promise<string> {
  const nodeUrl = logoutUrl.replace('10.0.2.2', 'localhost')

  let location: string | null = nodeUrl
  // Follow HTTP redirects until we land on the custom scheme or run out.
  while (location && !location.startsWith('keycloakjstest://')) {
    const res = await fetch(
      location.replace('10.0.2.2', 'localhost'),
      { redirect: 'manual' }
    )
    location = res.headers.get('location')
  }

  // If Keycloak didn't redirect (e.g. RP-initiated logout with no redirect),
  // we send the redirect URI directly.
  return location ?? REDIRECT_URI
}

/**
 * Deliver a deep-link URL to the Cordova app via an ADB intent.
 * The `cordova-plugin-deeplinks` intent-filter will route it to the
 * `universalLinks` handler that keycloak-js subscribes to.
 */
async function sendDeepLink (device: AndroidDevice, url: string): Promise<void> {
  // Shell-escape the URL (the & characters in query strings need quoting).
  const escaped = url.replace(/'/g, "'\\''")
  await device.shell(`am start -a android.intent.action.VIEW -d '${escaped}'`)
  // Give the plugin a moment to dispatch the JS event.
  await new Promise(resolve => setTimeout(resolve, 2000))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('login with cordova-native adapter', async ({ device }) => {
  // Launch the Cordova app.
  await device.shell(`am force-stop ${APP_PACKAGE}`)
  await device.shell(`am start -n ${APP_ACTIVITY}`)

  // Small delay to let the WebView initialize before connecting.
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Wait for the app's WebView to be ready.
  const page = await getAppPage(device)

  await page.waitForFunction(() => {
    // @ts-expect-error — runs in browser context.
    return document.getElementById('status')?.textContent === 'Device ready. Call initKeycloak() to start.'
  }, { timeout: 30_000 })

  // Initialize the Keycloak adapter.
  await page.evaluate(() => (globalThis as any).initKeycloak())

  // Verify initialization succeeded.
  const initState = await page.evaluate(() => (globalThis as any).getAuthState())
  expect(initState.authenticated).toBe(false)

  // Intercept BrowserTab so the adapter never opens a Chrome Custom Tab.
  await interceptBrowserTab(page)

  // Start the login flow (fire-and-forget — it waits for the deep link).
  const loginPromise = page.evaluate(() => (globalThis as any).doLogin())

  // Grab the auth URL the adapter tried to open.
  const authUrl = await getCapturedUrl(page)
  console.log('[DEBUG] Captured auth URL:', authUrl)

  // Submit the login form directly to Keycloak from Node.
  const redirectUrl = await submitKeycloakLoginForm(authUrl, TEST_USERNAME, TEST_PASSWORD)
  console.log('[DEBUG] Redirect URL:', redirectUrl)

  // Deliver the redirect as a deep link → triggers universalLinks 'keycloak'.
  await sendDeepLink(device, redirectUrl)

  // Wait for the adapter to finish processing (token exchange, etc.).
  await loginPromise

  // Check the status text for any error info.
  const statusText = await page.evaluate(() => document.getElementById('status')?.textContent)
  console.log('[DEBUG] Status after login:', statusText)

  // Assert the user is authenticated.
  const authState = await page.evaluate(() => (globalThis as any).getAuthState())
  console.log('[DEBUG] Auth state:', JSON.stringify(authState))
  expect(authState.authenticated).toBe(true)
  expect(authState.subject).toBeTruthy()
  expect(authState.token).toBeTruthy()
})

test('logout with cordova-native adapter', async ({ device }) => {
  const page = await getAppPage(device)

  const preState = await page.evaluate(() => (globalThis as any).getAuthState())
  if (!preState.authenticated) {
    test.skip()
    return
  }

  // Intercept BrowserTab for the logout redirect.
  await interceptBrowserTab(page)

  const logoutPromise = page.evaluate(() => (globalThis as any).doLogout())

  const logoutUrl = await getCapturedUrl(page)
  const redirectUrl = await followKeycloakLogout(logoutUrl)

  await sendDeepLink(device, redirectUrl)
  await logoutPromise

  // Assert the user is no longer authenticated.
  const authState = await page.evaluate(() => (globalThis as any).getAuthState())
  expect(authState.authenticated).toBe(false)
  expect(authState.token).toBeFalsy()
})

test('refresh token with cordova-native adapter', async ({ device }) => {
  // Fresh start — launch, init, log in.
  await device.shell(`am force-stop ${APP_PACKAGE}`)
  await device.shell(`am start -n ${APP_ACTIVITY}`)

  await new Promise(resolve => setTimeout(resolve, 2000))

  const page = await getAppPage(device)

  await page.waitForFunction(() => {
    // @ts-expect-error — runs in browser context.
    return document.getElementById('status')?.textContent === 'Device ready. Call initKeycloak() to start.'
  }, { timeout: 30_000 })

  await page.evaluate(() => (globalThis as any).initKeycloak())

  await interceptBrowserTab(page)

  const loginPromise = page.evaluate(() => (globalThis as any).doLogin())
  const authUrl = await getCapturedUrl(page)
  console.log('[DEBUG refresh] Auth URL:', authUrl)
  const redirectUrl = await submitKeycloakLoginForm(authUrl, TEST_USERNAME, TEST_PASSWORD)
  console.log('[DEBUG refresh] Redirect URL:', redirectUrl)
  await sendDeepLink(device, redirectUrl)
  await loginPromise

  const statusText = await page.evaluate(() => document.getElementById('status')?.textContent)
  console.log('[DEBUG refresh] Status after login:', statusText)

  // Verify authenticated.
  const beforeRefresh = await page.evaluate(() => (globalThis as any).getAuthState())
  console.log('[DEBUG refresh] Auth state:', JSON.stringify(beforeRefresh))
  expect(beforeRefresh.authenticated).toBe(true)

  // Trigger token refresh (happens over HTTP, no browser needed).
  await page.evaluate(() => (globalThis as any).doRefreshToken())

  // Verify still authenticated with a (possibly new) token.
  const afterRefresh = await page.evaluate(() => (globalThis as any).getAuthState())
  expect(afterRefresh.authenticated).toBe(true)
  expect(afterRefresh.token).toBeTruthy()
})
