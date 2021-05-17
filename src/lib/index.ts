import { GenesysCloudClientAuthenticator } from './authenticator';
import { handleRedirectFromLogin } from './parse-redirect';
import { IAuthenticatorConfig } from './types';
import { isIssuedTimeWithinWindow } from './utils';
import VERSION from './version';

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
  authenticatorFactory,
  handleRedirectFromLogin,
  isIssuedTimeWithinWindow,
  VERSION
};
export default authenticatorFactory;