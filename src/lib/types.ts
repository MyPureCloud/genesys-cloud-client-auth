export interface IAuthenticatorConfig {
  /**
   * Genesys Cloud domain.
   * Defaults to: `'mypurecloud.com'`
   */
  environment: string;

  /**
   * Persist authentication data to localStorage.
   * Note: this is required if using popup authentication
   * Defaults to: `false`
   */
  persist: boolean;

  /**
   * Storage key to save auth data to localStorage.
   * Defaults to: `gc_client_auth_data`
   */
  storageKey: string;

  /**
   * Allow for extra console logs for debugging
   * Defaults to: `false`
   */
  debugMode: boolean;

  /**
   * Set this if you want to prevent the auth from sending an error on timeout
   * even when the login window is still displayed to the user
   */
  useUpdatedPopupAuthFlow: boolean;
}

export interface IAuthData {
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

export interface IAuthReturnData {
  access_token?: string;
  expires_in?: string;
  state?: string;
  type?: string;
  error?: string;
  error_description?: string;
}

export interface IAuthRequestParams {
  client_id: string;
  response_type: string;
  redirect_uri?: string;
  state?: string;
  org?: string;
  provider?: string;
}

export interface IRedirectStorageParams extends IAuthRequestParams {
  storageKey: string;
  debug?: boolean;
}

export interface ILoginOptions {
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

export type ErrorTranslationKeys = 'errorToken' | 'errorStateParam' | 'errorParse' | 'errorTokenNotSet';