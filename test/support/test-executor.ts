import type { Page } from 'playwright';
import type { default as Keycloak, KeycloakConfig } from '../../lib/keycloak';
import { APP_HOST } from './common.ts';

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

    return this.#page.evaluate((options) => {
      return ((globalThis as any).keycloak as Keycloak).init(options);
    }, options)
  }

  #assertInstantiated() {
    if (!this.#isInstantiated) {
      throw new Error('The adapter is not instantiated, call the `instantiate()` first.');
    }
  }
}
