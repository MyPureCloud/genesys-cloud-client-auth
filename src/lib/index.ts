import { GenesysCloudClientAuthenticator, authenticatorFactory } from './authenticator';
import { handleRedirectFromLogin } from './parse-redirect';
import { isIssuedTimeWithinWindow, parseOauthParams, tokenWasIssuedAt, TimeoutError, isIssuedTimeWithinTimeframe } from './utils';
import VERSION from './version';
import { authenticate, AuthResponse } from './authenticate';



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
  VERSION,
  authenticate,
  AuthResponse
};
export default authenticatorFactory;