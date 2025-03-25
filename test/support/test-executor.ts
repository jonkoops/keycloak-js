import type { Page } from 'playwright';
import type { default as Keycloak, KeycloakConfig } from '../../lib/keycloak';
import { APP_HOST, AUTH_SERVER_HOST } from './common.ts';

export class TestExecutor {
  #isInstantiated = false;

  readonly #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async gotoApp() {
    await this.#page.goto(APP_HOST);
  }

  async instantiate(config: KeycloakConfig) {
    if (this.#isInstantiated) {
      throw new Error('The adapter is already instantiated.');
    }

    await this.#page.evaluate((config) => {
      (globalThis as any).keycloak = new (globalThis as any).Keycloak(config);
    }, config);

    this.#isInstantiated = true;
  }

  async initialize(options: any): Promise<boolean> {
    this.#assertInstantiated();

    try {
      return await this.#page.evaluate((options) => {
        return ((globalThis as any).keycloak as Keycloak).init(options);
      }, options)
    } catch {
      return false;
    }
  }

  #assertInstantiated() {
    if (!this.#isInstantiated) {
      throw new Error('The adapter is not instantiated, call the `instantiate()` first.');
    }
  }

  async waitForLoginPage() {
    // TODO: Narrow down this selector to the login form
    await this.#page.waitForURL(AUTH_SERVER_HOST + "/**");
  }

  async loginForm(username: string, password: string) {
    await this.#page.getByRole('textbox', { name: 'Username or email' }).fill(username);
    await this.#page.getByRole('textbox', { name: 'Password' }).fill(password);
    await this.#page.getByRole('button', { name: 'Sign In' }).click();
  }
}
