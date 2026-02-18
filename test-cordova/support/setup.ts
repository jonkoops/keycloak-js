import { adminClient } from './admin-client.ts'
import { CLIENT_ID, REALM_NAME, REDIRECT_URI, TEST_PASSWORD, TEST_USERNAME } from './common.ts'

/**
 * Provisions a Keycloak realm, client, and test user for the Cordova test app.
 * This script is intended to be run before the Cordova tests.
 */
async function setup (): Promise<void> {
  console.log(`Setting up Keycloak realm '${REALM_NAME}'...`)

  // Delete the realm if it already exists to start fresh.
  try {
    await adminClient.realms.del({ realm: REALM_NAME })
    console.log(`Deleted existing realm '${REALM_NAME}'.`)
  } catch {
    // Realm doesn't exist, which is fine.
  }

  // Create the realm.
  await adminClient.realms.create({
    realm: REALM_NAME,
    enabled: true
  })
  console.log(`Created realm '${REALM_NAME}'.`)

  // Create a public client with the custom URL scheme redirect URI.
  await adminClient.clients.create({
    realm: REALM_NAME,
    enabled: true,
    clientId: CLIENT_ID,
    publicClient: true,
    redirectUris: [
      `${REDIRECT_URI}`,
      `${REDIRECT_URI}/*`,
      'http://localhost'
    ],
    webOrigins: ['*']
  })
  console.log(`Created client '${CLIENT_ID}'.`)

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

  // Set the user's password.
  await adminClient.users.resetPassword({
    realm: REALM_NAME,
    id: userId,
    credential: {
      temporary: false,
      type: 'password',
      value: TEST_PASSWORD
    }
  })
  console.log(`Created user '${TEST_USERNAME}'.`)

  console.log('\nSetup complete. Configuration:')
  console.log(JSON.stringify({
    realm: REALM_NAME,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    testUser: TEST_USERNAME,
    testPassword: TEST_PASSWORD
  }, null, 2))
}

setup().catch((error) => {
  console.error('Setup failed:', error)
  process.exit(1)
})
