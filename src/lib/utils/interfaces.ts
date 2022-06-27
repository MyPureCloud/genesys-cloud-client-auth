export type ParseQueryStrategies = 'both' | 'regular' | 'hash';

export interface ParseQueryParamsOptions {
  window?: Window;
  strategy?: ParseQueryStrategies;
  requiredParams?: string[];
}

export type PubSubEventTypes = 'COMPLETE' | 'IN_PROGRESS' | 'FAILURE';

export interface PubSubEvent {
  event: string;
  body: any;
}

export interface Complete extends PubSubEvent {
  event: 'COMPLETE';
  body: {
    href?: string;
    authData: AuthData;
  } // auth data
}

export interface InProgress extends PubSubEvent {
  event: 'IN_PROGRESS';
  body: {
    href?: string;
  } // nothing?
}

export interface Failure extends PubSubEvent {
  event: 'FAILURE';
  body: {
    type: 'TIMEOUT' | 'BLOCKED' | 'CLOSED' | 'OAUTH_ERROR' | 'OTHER';
    error: Error | string;
    error_Description?: string;
  } // ERROR
}
export interface AuthData {
  /** access token received from login */
  accessToken?: string;
  /** optional state returned from login */
  state?: string;
  /** time at which the token expires */
  tokenExpiryTime?: number;
  /** time at which the token expires  in ISO string format */
  tokenExpiryTimeString?: string;
  /** error that may have occurred during login */
  error?: string;
  /** error description that may have occurred during login */
  error_description?: string;
}

export interface AuthenticationRequest {
  clientId: string;
  environment: string;

  redirectUri?: string;
  storageKey?: string;
  usePopupAuth?: boolean;
  org?: string;
  provider?: string;

  state?: string | number | boolean | null // | { [key: string]: string | number | boolean  };
  href?: string;
  // TODO: maybe add these
  timemachineConfig?: {
    appBasePath?: string;
  }
  // storageKey?: string; // prefix really
  // persist?: boolean;
  // debugMode?: boolean;
  // popupTimeout?: number;

}

export interface OAuthReturnedData {
  access_token?: string;
  expires_in?: string;
  state?: string;
  type?: string;
  error?: string;
  error_description?: string;
}

export interface OAuthRequestParams {
  client_id: string;
  response_type: string;
  redirect_uri?: string;
  state?: string;
  org?: string;
  provider?: string;
}

export interface AuthenticatorConfig {
  /**
   * Genesys Cloud domain.
   * Defaults to: `'mypurecloud.com'`
   */
  environment?: string;

  /**
   * Persist authentication data to localStorage.
   * Note: this is required if using popup authentication
   * Defaults to: `false`
   */
  persist?: boolean;

  /**
   * Storage key to save auth data to localStorage.
   * Defaults to: `gc_client_auth_data`
   */
  storageKey?: string;

  /**
   * Allow for extra console logs for debugging
   * Defaults to: `false`
   */
  debugMode?: boolean;

  timeout?: number;
  /**
 * The organization name that would normally used when specifying an organization name when logging in.
 *  This is only used when a provider is also specified.
 */
  org?: string;
  /**
   * Authentication provider to log in with e.g. okta, adfs, salesforce, onelogin.
   *  This is only used when an org is also specified.
   */
  provider?: string;
}

export interface InternalAuthenticatorConfig extends Required<AuthenticatorConfig> {
  clientId: string;
  apiBase: string;
  authBase: string;
  hasLocalStorage: boolean;
}

export interface LoginOptions {
  /**
   * The redirect URI of the OAuth Implicit Grant client. Not needed if `usePopupAuth: true` _and_
   *  the consuming application wishes to use the standard redirect of genesys-cloud-client-auth
   *  standalone app.
   */
  redirectUri?: string;
  /**
   * Any state needed when returning from login
   */
  state?: string;
  /**
   * The organization name that would normally used when specifying an organization name when logging in.
   *  This is only used when a provider is also specified.
   */
  org?: string;
  /**
   * Authentication provider to log in with e.g. okta, adfs, salesforce, onelogin.
   *  This is only used when an org is also specified.
   */
  provider?: string;
  /**
   * Use a popup window to open to the login page.
   */
  usePopupAuth?: boolean;
  /**
   * Timeout for how long the auth pop should remain open before timing out
   *  and rejecting the loginImplicitGrant call. This is only used in conjunction
   *  with `usePopupAuth`.
   */
  popupTimeout?: number;
}