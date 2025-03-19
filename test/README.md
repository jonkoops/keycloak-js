# Keycloak JS test suite

This directory contains the test suite for Keycloak JS, which is based on [Playwright](https://playwright.dev/). It contains a suite of integration tests that embed the adapter in various scenarios and tests it against a Keycloak server running in the background.

## Setup

Run the following command to install the [Playwright browsers](https://playwright.dev/docs/browsers):

```sh
npx playwright install
```

## Running the tests

To run the tests headlessly you can run the following command:

```sh
npm test
```

It is also possible to run the tests in [various other modes](https://playwright.dev/docs/running-tests), for example, to debug the tests `--debug` can be passed:

```sh
npm test -- --debug
```

## Speeding up testing

By default, the tests will run against a Keycloak server that is running the latest version. This server is started by Playwright using Podman by running the following command:

```sh
podman run -p 8080:8080 -p 9000:9000 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin -e KC_HEALTH_ENABLED=true quay.io/keycloak/keycloak:latest start-dev
```

Every time the tests run the Keycloak server will also be restarted, which can slow down development. You can instead opt to keep a Keycloak server running in the background, and re-use this server. To do so, remove the `gracefulShutdown` section from the Playwright configuration (`playwright.config.ts`):

```diff
{
-  gracefulShutdown: {
-    // Podman requires a termination signal to stop.
-    signal: 'SIGTERM',
-    timeout: 5000
-  }
},
```
