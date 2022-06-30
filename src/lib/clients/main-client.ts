import axios from 'axios';
import { v4 } from 'uuid';

import { VERSION } from '../utils/config';
import { AuthData, AuthenticatorConfig, InternalAuthenticatorConfig, LoginOptions, OAuthRequestParams, POJO, PopupAuthReturnType, InProgressEvent } from '../utils/interfaces';
import { LocalStoragePubSub } from '../utils/messaging';
import { parseEnv, testForLocalStorage, parseOauthParams, debug } from '../utils/utils';

export class GenesysCloudClientAuthenticator {
  /** client-auth version */
  readonly VERSION = GenesysCloudClientAuthenticator.VERSION;
  static get VERSION () {
    return VERSION;
  }
  /** current authencation data for this instance. default is an empty object `{}`*/
  authData: AuthData | null = null;
  /** current configuration for this instance */
  config: InternalAuthenticatorConfig;
  /** current environment. Ex. `mypurecloud.com` */
  environment!: string;
  /** base api path - utilizing the `environment` varialbe */
  basePath!: string;
  /** base auth path - utilizing the `environment` varialbe */
  authUrl!: string;

  private _popupAuthInfo?: PopupAuthReturnType & {
    window: Window | null;
    stateKey: string;
  };

  constructor (clientId: string, config: AuthenticatorConfig = {}) {
    this.config = {
      clientId,
      storageKey: config.storageKey || 'gc_client_auth_data',
      persist: typeof config.persist === 'boolean' ? config.persist : true,
      debugMode: typeof config.debugMode === 'boolean' ? config.debugMode : false,
      org: config.org || '',
      provider: config.provider || '',
      timeout: config.timeout || 0,
      hasLocalStorage: testForLocalStorage(),
      ...parseEnv(config.environment || 'mypurecloud.com')
    };
  }

  async loginImplicitGrantViaPopup (
    options: LoginOptions = {},
    existingAuthData?: AuthData
  ): Promise<PopupAuthReturnType> {
    if (!this.config.hasLocalStorage) {
      throw new Error('Cannot authenticate using popup auth. No localStorage API present');
    }

    const validAuthData = await this.parseAndValidateAuthData(options, existingAuthData);

    const storageEvent: InProgressEvent = {
      event: 'IN_PROGRESS',
      body: { debug: this.config.debugMode }
    }

    /* save the state passed in */
    if (options.state) {
      storageEvent.body.state = options.state;
    }

    /* save the "state" key that the popup window will use to communicate with */
    const stateKey = this._generateId();
    const messenger = new LocalStoragePubSub(stateKey);

    const query = this.buildQueryParams({ ...options, state: stateKey });
    const popupUrl = this.buildAuthUrl('oauth/authorize', query);

    /* add the popup url, and save to storage */
    storageEvent.body.href = popupUrl;
    this.saveStateToStorage(storageEvent, stateKey);

    const info = this._popupAuthInfo;

    if (validAuthData) {
      messenger._emitAuthData(validAuthData);

      /* close & clear existing popup stuff */
      if (info) {
        info.window?.close();
        this._popupAuthInfo = undefined;
      }
    } else {
      // if popup is already open, show it
      if (info && info.window && !info.window.closed) {
        info.window.focus();
      } else {
        debug('Implicit grant via popup – opening new window to: ' + popupUrl);
        const popupWindow = window.open(popupUrl, '_blank', 'width=500px,height=500px,resizable,scrollbars,status');

        this._popupAuthInfo = {
          messenger,
          popupUrl,
          window: popupWindow,
          stateKey
        };

        if (!popupWindow) {
          debug(`popup window did not open. it was probably blocked: ${popupUrl}`);
          messenger.writeFailureEvent({ type: 'BLOCKED', error: 'Failed to open popup window' });
        } else if (this.config.timeout) {
          setTimeout(() => {
            /* if we are still in progress when the timeout is reached */
            if (messenger.key && messenger.isInProgressEvent(messenger.getLastEventEmitted())) {
              debug('Timing out popup auth');
              messenger.writeFailureEvent({ type: 'TIMEOUT', error: 'Popup authentication timed out' });
            }
          }, this.config.timeout);
        }
      }
    }

    return {
      messenger,
      popupUrl
    };
  }

  async loginImplicitGrant (options: LoginOptions = {}, existingAuthData?: AuthData): Promise<AuthData> {
    const validAuthData = await this.parseAndValidateAuthData(options, existingAuthData);

    /* if we don't have a token that passed the test, we need to redirect */
    if (!validAuthData) {
      const query = this.buildQueryParams(options);
      const url = this.buildAuthUrl('oauth/authorize', query);
      debug('Implicit grant – redirecting to: ' + url);
      window.location.replace(url);

      /* reject for testing purposes */
      throw new Error(`Routing to login: "${url}"`);
    }

    /* if we had data that passed the token test, we are good to go */
    return validAuthData!;
  }

  private async parseAndValidateAuthData (options: LoginOptions = {}, existingAuthData?: AuthData) {
    const org = options.org || this.config.org;
    const provider = options.provider || this.config.provider;

    /* validate */
    if (org && !provider) {
      throw new Error('options.provider must be set if options.org is set');
    } else if (provider && !org) {
      throw new Error('options.org must be set if options.provider is set');
    } else if (!options.redirectUri) {
      throw new Error('redirectUri must be provided for implicit grant authentication');
    }

    const incomingAuthData = existingAuthData || parseOauthParams(window.location.hash);
    let authDataFromStorage = this._readAuthData();

    /* if the token in storage is expired, clear it */
    if ((authDataFromStorage.tokenExpiryTime || 0) > Date.now()) {
      this._writeAuthData(undefined);
      authDataFromStorage = {};
    }

    const validAuthData = await this.validateAuthData(incomingAuthData, authDataFromStorage);

    /* save valid auth data (note, if there was none, it will clear any existing data) */
    this._writeAuthData(validAuthData);

    if (validAuthData?.error) {
      throw new Error(`[${validAuthData.error}] ${validAuthData.error_description}`)
    }


    // TODO – parse the state key from localStorage
    return validAuthData;
  }

  private buildQueryParams (options: LoginOptions): OAuthRequestParams {
    const { redirectUri, org, provider, state } = options;

    const query: OAuthRequestParams = {
      client_id: encodeURIComponent(this.config.clientId),
      response_type: 'token'
    };

    if (redirectUri) query.redirect_uri = encodeURIComponent(redirectUri);
    if (org) query.org = encodeURIComponent(org);
    if (provider) query.provider = encodeURIComponent(provider);
    if (state) {
      let stateString: string = state as any;
      if (typeof state !== 'string') {
        stateString = this.saveStateToStorage(state);
      }
      query.state = encodeURIComponent(stateString);
    }

    return query;
  }

  private readStateInStorage (id: string): POJO | undefined {
    const item = localStorage.getItem(id);
    return item ? JSON.parse(item) : undefined;
  }

  private deleteStateInStorage (id: string): void {
    localStorage.removeItem(id);
  }

  private saveStateToStorage (state: POJO, id?: string): string {
    const storageId = id || this._generateId();

    debug('writing state data', { storageId, state });
    localStorage.setItem(storageId, JSON.stringify(state));

    return storageId;
  }

  /**
   * Return a unique id for client-auth
   * @param id optional id string
   * @returns unique id specific to client-auth
   */
  private _generateId (id?: string): string {
    return `gc-ca_${id || v4()}`;
  }

  /**
   * Clears auth data from localStorage and redirects the user to the GenesysCloud logout page
   *
   * @param logoutRedirectUri optional, redirectUri to pass to the logout page
   */
  logout (logoutRedirectUri?: string): void {
    this.clearAuthData();

    const query: { [key: string]: string } = {
      client_id: encodeURIComponent(this.config.clientId)
    };

    if (logoutRedirectUri) {
      query.redirect_uri = encodeURIComponent(logoutRedirectUri);
    }

    const url = this.buildAuthUrl('logout', query);
    window.location.replace(url);
  }

  /**
 * Sets the access token on the authenticator instance and localStorage (if configured)
 * @param token - The access token
 */
  setAccessToken (token: string): void {
    this._writeAuthData({ accessToken: token });
  }

  async validateAuthData (
    incomingData: AuthData,
    dataFromStorage: AuthData
  ): Promise<AuthData | undefined> {
    const tests = [
      { /* test incoming data first */
        data: incomingData,
        debugMsg: 'incoming auth data (via passed in param or from window hash) failed token test'
      },
      {
        data: dataFromStorage,
        debugMsg: 'auth data from localStorage failed token test'
      }
    ] as const;

    for (let test of tests) {
      const { data, debugMsg } = test;

      /* if there was an error, just return it */
      if (data?.error) {
        return data;
      }

      /* if we have a token, test it */
      if (data?.accessToken) {
        try {
          await this.testAccessToken(data.accessToken);
          /* if the token passed, use this auth data */
          return incomingData;
        } catch (error) {
          /* else, we move on to the next one */
          debug(debugMsg, incomingData);
        }
      }
    }
  }

  testAccessToken (token: string): Promise<any> {
    return axios.get(`${this.config.apiBase}/api/v2/tokens/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  buildAuthUrl (path: 'oauth/authorize' | 'logout', queryParams: POJO = {}): string {
    return Object.keys(queryParams)
      .reduce((url, key) =>
        !queryParams[key] ? url : `${url}&${key}=${queryParams[key]}`,
        `${this.config.authBase}/${path}?`
      );
  }

  /**
   * Will clear current auth data from localStorage.
   * NOTE: this will _not_ log the user out. Using `logout()`
   *  for logging out
   */
  clearAuthData (): void {
    this._writeAuthData(undefined);
  }


  private _readAuthData (): AuthData {
    let data: AuthData = {};
    try {
      data = JSON.parse(localStorage.getItem(this.config.storageKey) || '{}') as AuthData;
    } catch (error) { }

    return data;
  }

  private _writeAuthData (data?: AuthData): void {
    if (!data) {
      debug('deleting auth data', {
        key: this.config.storageKey,
        currentAuthData: this.authData
      });
      this.authData = null;
      return localStorage.removeItem(this.config.storageKey);
    }

    debug('writing auth data', {
      key: this.config.storageKey,
      currentAuthData: data
    });
    this.authData = data;

    const strData = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(this.config.storageKey, strData);
  }
}


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
export const authenticatorFactory = (clientId: string, config: AuthenticatorConfig): GenesysCloudClientAuthenticator => {
  let authenticator = authenticators.get(clientId);

  if (!authenticator) {
    authenticator = new GenesysCloudClientAuthenticator(clientId, config);
    authenticators.set(clientId, authenticator);
  }

  return authenticator;
};