// @ts-check

/** @type {import('keycloak-js').default | null} */
let keycloak = null

const KEYCLOAK_URL = 'http://10.0.2.2:8080'
const REDIRECT_URI = 'keycloakjstest://callback'

const statusEl = document.getElementById('status')

function setStatus (message) {
  console.log('[keycloak-test]', message)
  if (statusEl) {
    statusEl.textContent = message
  }
}

function setStatusJSON (data) {
  const message = JSON.stringify(data, null, 2)
  console.log('[keycloak-test]', message)
  if (statusEl) {
    statusEl.textContent = message
  }
}

function getAuthState () {
  if (!keycloak) {
    return { error: 'Keycloak not initialized' }
  }

  return {
    authenticated: keycloak.authenticated,
    subject: keycloak.subject,
    token: keycloak.token,
    refreshToken: keycloak.refreshToken,
    tokenParsed: keycloak.tokenParsed
  }
}

/**
 * Initialize the Keycloak adapter. Called automatically on deviceready,
 * but can also be called manually from the console with a custom config.
 * @param {{ realm?: string, clientId?: string }} [config]
 */
async function initKeycloak (config) {
  const Keycloak = (await import('../lib/keycloak.js')).default

  const realm = config?.realm ?? 'cordova-test'
  const clientId = config?.clientId ?? 'cordova-test-client'

  keycloak = new Keycloak({
    url: KEYCLOAK_URL,
    realm,
    clientId
  })

  try {
    const authenticated = await keycloak.init({
      adapter: 'cordova-native',
      redirectUri: REDIRECT_URI,
      responseMode: 'query'
    })

    setStatusJSON({
      status: 'initialized',
      authenticated,
      ...getAuthState()
    })
  } catch (error) {
    setStatusJSON({
      status: 'init-error',
      error: String(error)
    })
  }
}

async function doLogin () {
  if (!keycloak) {
    setStatus('Keycloak not initialized')
    return
  }

  try {
    await keycloak.login({ redirectUri: REDIRECT_URI })
    setStatusJSON({
      status: 'login-success',
      ...getAuthState()
    })
  } catch (error) {
    setStatusJSON({
      status: 'login-error',
      error: String(error)
    })
  }
}

async function doLogout () {
  if (!keycloak) {
    setStatus('Keycloak not initialized')
    return
  }

  try {
    await keycloak.logout({ redirectUri: REDIRECT_URI })
    setStatusJSON({
      status: 'logout-success',
      ...getAuthState()
    })
  } catch (error) {
    setStatusJSON({
      status: 'logout-error',
      error: String(error)
    })
  }
}

async function doRefreshToken () {
  if (!keycloak) {
    setStatus('Keycloak not initialized')
    return
  }

  try {
    const refreshed = await keycloak.updateToken(30)
    setStatusJSON({
      status: 'refresh-success',
      refreshed,
      ...getAuthState()
    })
  } catch (error) {
    setStatusJSON({
      status: 'refresh-error',
      error: String(error)
    })
  }
}

// Expose functions globally for Playwright and console access.
globalThis.initKeycloak = initKeycloak
globalThis.doLogin = doLogin
globalThis.doLogout = doLogout
globalThis.doRefreshToken = doRefreshToken
globalThis.getAuthState = getAuthState

document.addEventListener('deviceready', () => {
  setStatus('Device ready. Call initKeycloak() to start.')
}, false)
