import { GenesysCloudClientAuthenticator } from './authenticator';
import { IAuthenticatorConfig } from './types';

const authenticators = new Map<string, GenesysCloudClientAuthenticator>();
const authenticatorFactory = (clientId: string, config: Partial<IAuthenticatorConfig>): GenesysCloudClientAuthenticator => {
  let authenticator = authenticators.get(clientId);

  if (!authenticator) {
    authenticator = new GenesysCloudClientAuthenticator(clientId, config);
    authenticators.set(clientId, authenticator);
  }

  return authenticator;
};

export * from './types';
export {
  GenesysCloudClientAuthenticator,
  authenticatorFactory
};
export default authenticatorFactory;