import { adminClient } from "./admin-client";
import { APP_HOST, CLIENT_ID } from "./common";

export async function createTestResources() {
  const { realmName } = await adminClient.realms.create({
    realm: crypto.randomUUID(),
    enabled: true,
  })

  await adminClient.clients.create({
    realm: realmName,
    clientId: CLIENT_ID,
    redirectUris: [`${APP_HOST}/*`],
    webOrigins: [APP_HOST],
    publicClient: true,
  });

  return realmName;
}
