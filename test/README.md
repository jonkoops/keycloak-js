# Keycloak JS test suite

This directory contains the test suite for Keycloak JS, which is based on [Playwright](https://playwright.dev/). It contains a suite of integration tests that embed the adapter in various scenarios and tests it against a Keycloak server running in the background.

## Setup

Make sure that all dependencies are installed by running the following command in the root of the project:


```sh
npm install
```

Afterwards, run the following command to install the [Playwright browsers](https://playwright.dev/docs/browsers):

```sh
npx playwright install
```

## Running the tests

