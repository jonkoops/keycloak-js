import { expect, test } from '@playwright/test'
import type { KeycloakInitOptions } from '../../lib/keycloak.js'
import { SILENT_SSO_REDIRECT_URL } from '../support/common.ts'
import { createTestResources } from '../support/helpers.ts'
import { TestExecutor } from '../support/test-executor.ts'

test('logs in and out', async ({ page }) => {
  const realm = await createTestResources()
  const executor = new TestExecutor(page, realm)
  // Initially, no user should be authenticated.
  expect(await executor.initializeAdapter()).toBe(false)
  expect(await executor.isAuthenticated()).toBe(false)
  // After triggering a login, the user should be authenticated.
  await executor.login()
  await executor.submitLoginForm()
  expect(await executor.initializeAdapter()).toBe(true)
  expect(await executor.isAuthenticated()).toBe(true)
  // After logging out, the user should no longer be authenticated.
  await executor.logout()
  expect(await executor.initializeAdapter()).toBe(false)
  expect(await executor.isAuthenticated()).toBe(false)
})


test('logs in and out without PKCE', async ({ page }) => {
  const realm = await createTestResources()
  const executor = new TestExecutor(page, realm)
  const initOptions: KeycloakInitOptions = { ...executor.getDefaultInitOptions(), pkceMethod: false };
  // Initially, no user should be authenticated.
  expect(await executor.initializeAdapter(initOptions)).toBe(false)
  // After triggering a login, the user should be authenticated.
  await executor.login()
  await executor.submitLoginForm()
  expect(await executor.initializeAdapter(initOptions)).toBe(true)
  // After logging out, the user should no longer be authenticated.
  await executor.logout()
  expect(await executor.initializeAdapter(initOptions)).toBe(false)
})


test("logs in and out with 'POST' logout configured at initialization", async ({ page }) => {
  const realm = await createTestResources()
  const executor = new TestExecutor(page, realm)
  const initOptions: KeycloakInitOptions = { ...executor.getDefaultInitOptions(), logoutMethod: 'POST' };
  // Initially, no user should be authenticated.
  expect(await executor.initializeAdapter(initOptions)).toBe(false)
  // After triggering a login, the user should be authenticated.
  await executor.login()
  await executor.submitLoginForm()
  expect(await executor.initializeAdapter(initOptions)).toBe(true)
  // After logging out, the user should no longer be authenticated.
  await executor.logout()
  expect(await executor.initializeAdapter(initOptions)).toBe(false)
})


test("logs in and out with 'POST' logout configured at logout", async ({ page }) => {
  const realm = await createTestResources()
  const executor = new TestExecutor(page, realm)
  // Initially, no user should be authenticated.
  expect(await executor.initializeAdapter()).toBe(false)
  // After triggering a login, the user should be authenticated.
  await executor.login()
  await executor.submitLoginForm()
  expect(await executor.initializeAdapter()).toBe(true)
  // After logging out, the user should no longer be authenticated.
  await executor.logout({ logoutMethod: 'POST' })
  expect(await executor.initializeAdapter()).toBe(false)
})

test('logs in with a silent SSO redirect', async ({ page }) => {
  const realm = await createTestResources()
  const executor = new TestExecutor(page, realm)
  const initOptions: KeycloakInitOptions = { ...executor.getDefaultInitOptions(), silentCheckSsoRedirectUri: SILENT_SSO_REDIRECT_URL.toString() };
  // Initially, no user should be authenticated.
  expect(await executor.initializeAdapter(initOptions)).toBe(false)
  // After initializing the adapter, only the initial page load should have occurred.
  expect(await executor.countNavigations()).toBe(1)
  // After triggering a login, the user should be authenticated.
  await executor.login()
  await executor.submitLoginForm()
  // The user was redirected to the login page and back to the app.
  expect(await executor.countNavigations()).toBe(3)
  expect(await executor.initializeAdapter(initOptions)).toBe(true)
  // After re-initializing the adapter, the user should still be authenticated, without any redirects.
  expect(await executor.countNavigations()).toBe(3)
})
