import type CredentialRepresentation from "@keycloak/keycloak-admin-client/lib/defs/credentialRepresentation";
import { adminClient } from "./admin-client";
import { APP_HOST, CLIENT_ID } from "./common";

export async function createTestResources() {
  const { realmName } = await adminClient.realms.create({
    realm: crypto.randomUUID(),
    enabled: true,
  })

  await Promise.all([
    adminClient.roles.create({
      realm: realmName,
      name: 'user',
      scopeParamRequired: false,
    }),
    adminClient.roles.create({
      realm: realmName,
      name: 'admin',
      scopeParamRequired: false,
    })
  ]);

  await Promise.all([
    createUserWithCredential({
      realm: realmName,
      enabled: true,
      username: 'test-user@localhost',
      realmRoles: ['user'],
      clientRoles: {
        'realm-management': ['view-realm', 'manage-users'],
        'account': ['view-profile', 'manage-account'],
      }
    }, {
      temporary: false,
      type: 'password',
      value: 'password',
    }),
    createUserWithCredential({
      realm: realmName,
      enabled: true,
      username: 'unauthorized',
    }, {
      temporary: false,
      type: 'password',
      value: 'password',
    })
  ]);

  await adminClient.clients.create({
    realm: realmName,
    enabled: true,
    clientId: CLIENT_ID,
    redirectUris: [`${APP_HOST}/*`],
    webOrigins: [APP_HOST],
    publicClient: true,
  });

  return realmName;
}

type CreateUserParams = NonNullable<Parameters<typeof adminClient.users.create>[0]>;

async function createUserWithCredential(user: CreateUserParams, credential: CredentialRepresentation) {
  const { id } = await adminClient.users.create(user);

  await adminClient.users.resetPassword({
    realm: user.realm,
    id,
    credential,
  });
}
