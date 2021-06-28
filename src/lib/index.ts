import { GenesysCloudClientAuthenticator } from './authenticator';
import { handleRedirectFromLogin } from './parse-redirect';
import { IAuthenticatorConfig } from './types';
import { isIssuedTimeWithinWindow, parseOauthParams, tokenWasIssuedAt, TimeoutError, isIssuedTimeWithinTimeframe } from './utils';
import VERSION from './version';

const authenticators = new Map<string, GenesysCloudClientAuthenticator>();

/**
 * Factory function to generate a singleton instance of a ClientAuthenticator class.
 *  If an instance has already been created for passed in `clientId`, that instance
 *  will be returned _without_ updating the original configuration.
 *
 * @param clientId Oauth client ID
 * @param config Optional configuration for the ClientAuthenticator instance
 * @returns Singleton GenesysCloudClientAuthenticator instance
 */
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
  isIssuedTimeWithinTimeframe,
  isIssuedTimeWithinWindow,
  tokenWasIssuedAt,
  parseOauthParams,
  TimeoutError,
  VERSION
};
export default authenticatorFactory;