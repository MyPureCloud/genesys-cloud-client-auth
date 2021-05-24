export interface IAuthenticatorConfig {
  environment: string;
  persist: boolean;
  storageKey: string;
  debugMode: boolean;
}

export interface IAuthData {
  accessToken?: string;
  state?: string;
  tokenExpiryTime?: number;
  tokenExpiryTimeString?: string;
  error?: string;
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
