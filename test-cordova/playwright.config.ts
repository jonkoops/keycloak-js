import { defineConfig } from '@playwright/test'

const KEYCLOAK_VERSION = 'latest'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 120_000,
  retries: 0,
  workers: 1,
  webServer: {
    command: `podman run --rm --network=host -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin -e KC_HEALTH_ENABLED=true --pull=newer quay.io/keycloak/keycloak:${KEYCLOAK_VERSION} start-dev`,
    url: 'http://localhost:9000/health/live',
    stdout: 'pipe',
    reuseExistingServer: true,
    gracefulShutdown: {
      signal: 'SIGTERM',
      timeout: 5000
    }
  }
})
