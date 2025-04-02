# Keycloak JS test suite

This directory contains the test suite for Keycloak JS, which is based on [Playwright](https://playwright.dev/). It contains a suite of integration tests that embed the adapter in various scenarios and tests it against a Keycloak server running in the background.

## Setup

Run the following command to install the [Playwright browsers](https://playwright.dev/docs/browsers):

```sh
npx playwright install
```

### Setup on Fedora 41 (or other not supported Linux distro)

Playwright doesn't support Fedora distribution. Following is a description how to run the tests using Ubuntu 22.04 image using `distrobox` which is fairy supported on various Linux distributions.

#### Install `distrobox` and `podman` packages

```sh
sudo dnf install distrobox podman
```

Create home directory for your `distrobox` environment. It is useful not to mess with your host system home directory.

```sh
mkdir ~/distrobox
```

#### Create `distrobox` container environment to run tests

This command creates container using `podman` in your host. For more information see the [documentation](https://distrobox.it/).

```sh
distrobox create \
--name pw --image ubuntu:22.04 \
--home ~/distrobox  \
--root \
--additional-packages "podman libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2 libxtst6 xauth xvfb" \
--unshare-all \
--absolutely-disable-root-password-i-am-really-positively-sure
```

> [!NOTE]
> The last option of the previous command is not necessary. If avoided one will be asked for password used in `sudo` command in the container.

One can enter the created `distrobox` environment using:

```sh
distrobox enter --root pw
```

#### Install nodejs and npm in the newly created environment

We recommend to use [Nodesource](https://nodesource.com/) to help you with the nodejs setup in the container.

Enter the container using:
```sh
distrobox enter --root pw
```

Download and run the setup for nodejs on Ubuntu installation:
```sh
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install nodejs -y
```

This made nodejs environment setup complete.

Next is to change working directory to keycloak-js test and run them (following original setup).
```sh
cd ~/dev/keycloak-js/test
npx playwright install
npm test
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
