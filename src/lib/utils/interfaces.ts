import { LocalStoragePubSub } from './messaging';

export type ParseQueryStrategies = 'both' | 'regular' | 'hash';

export interface ParseQueryParamsOptions {
  window?: Window;
  strategy?: ParseQueryStrategies;
  requiredParams?: string[];
}

export type PubSubEvent = CompleteEvent | InProgressEvent | FailureEvent;

export interface CompleteEvent {
  event: 'COMPLETE';
  body: CompleteBody;
}

export interface CompleteBody {
  authData: AuthData;
}

export interface InProgressEvent {
  event: 'IN_PROGRESS';
  body: InProgressBody;
}

export interface InProgressBody {
  debug?: boolean;
  href?: string;
  state?: string | POJO;
}

export interface FailureEvent {
  event: 'FAILURE';
  body: FailureBody;
}

export interface FailureBody {
  type: 'TIMEOUT' | 'BLOCKED' | 'CLOSED' | 'OAUTH_ERROR' | 'OTHER'; // TODO: not sure about these
  error: Error | string;
  error_Description?: string;
}

export type POJO = { [key: string]: any }; //<T = RecordTypes> = { [key: string]: T | POJO<T> };
export type RecordTypes = string | boolean | number | null | undefined;
export type ShallowPOJO = Record<string, RecordTypes | Array<RecordTypes>>;
export interface AuthData {
  /** access token received from login */
  accessToken?: string;
  /** optional state returned from login */
  state?: POJO | string;
  /** time at which the token expires */
  tokenExpiryTime?: number;
  /** time at which the token expires in ISO string format */
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

export interface OAuthRequestParams extends POJO {
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
   * The organization name that would normally be used when specifying an organization name when logging in.
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
  state?: string | POJO;
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
   * Timeout for how long the auth pop should remain open before timing out
   *  and rejecting the loginImplicitGrant call. This is only used in conjunction
   *  with `usePopupAuth`.
   */
  popupTimeout?: number;
}

export interface PopupAuthReturnType {
  messenger: LocalStoragePubSub;
  popupUrl: string;
}

export type ErrorTranslationKeys = 'errorToken' | 'errorStateParam' | 'errorParse' | 'errorTokenNotSet';
