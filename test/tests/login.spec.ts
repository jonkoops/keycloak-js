import { test } from '@playwright/test';
import { AUTH_SERVER_HOST, CLIENT_ID } from '../support/common.ts';
import { createTestResources } from '../support/helpers.ts';
import { TestExecutor } from '../support/test-executor.ts';

test('authenticates when logging in', async ({ page }) => {
  const realm = await createTestResources();
  const executor = new TestExecutor(page);
  await executor.gotoApp();
  await executor.instantiate({ url: AUTH_SERVER_HOST, realm, clientId: CLIENT_ID })
  await executor.initialize({ onLoad: 'login-required' });
});
