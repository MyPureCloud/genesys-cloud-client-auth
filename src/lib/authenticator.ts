import superagent from 'superagent';
import { v4 } from 'uuid';

import {
  IAuthData,
  IAuthenticatorConfig,
  IAuthRequestParams,
  ILoginOptions,
  IRedirectStorageParams,
} from './types';
import { debug, parseOauthParams, TimeoutError } from './utils';
import VERSION from './version';

export class GenesysCloudClientAuthenticator {
  readonly clientId: string;
  readonly VERSION: string = VERSION;
  config: IAuthenticatorConfig;
  environment!: string;
  basePath!: string;
  authUrl!: string;
  authData: IAuthData;

  private hasLocalStorage: boolean;
  private authentications: { [authenitcation: string]: any };
  private timeout: number;

  constructor (clientId: string, config: Partial<IAuthenticatorConfig> = {}) {
    this.clientId = clientId;

    if (!config.storageKey) {
      config.storageKey = 'gc_client_auth_data';
    }

    if (typeof config.persist !== 'boolean') {
      config.persist = false;
    }

    this.config = { ...config } as IAuthenticatorConfig;

    this.setEnvironment(config.environment);

    this.timeout = 16000;
    this.authData = {};
    this.authentications = {
      'PureCloud OAuth': { type: 'oauth2' }
    };

    try {
      localStorage.setItem('genesys_cloud_local_storage_test', 'genesys_cloud_local_storage_test');
      localStorage.removeItem('genesys_cloud_local_storage_test');
      this.hasLocalStorage = true;
    } catch (e) {
      this.hasLocalStorage = false;
    }

    this._loadSettings();
  }

  /**
   * Parses an ISO-8601 string representation of a date value.
   * @param str The date value as a string.
   * @returns The parsed date object.
   */
  parseDate (str: string): Date {
    return new Date(str.replace(/T/i, ' '));
  }

  /**
   * Sets the environment used by the session
   * @param environment - (Optional, default "mypurecloud.com") Environment the session use, e.g. mypurecloud.ie, mypurecloud.com.au, etc.
   */
  setEnvironment (environment?: string): void {
    if (!environment) {
      environment = 'mypurecloud.com';
    }

    // Strip trailing slash
    environment = environment.replace(/\/+$/, '');

    // Strip protocol and subdomain
    if (environment.startsWith('https://')) {
      environment = environment.substring(8);
    }

    if (environment.startsWith('http://')) {
      environment = environment.substring(7)
    }

    if (environment.startsWith('api.')) {
      environment = environment.substring(4);
    }

    // Set vars
    this.environment = environment;
    this.basePath = `https://api.${environment}`;
    this.authUrl = `https://login.${environment}`;
  }

  /**
   * Initiates the implicit grant login flow. Will attempt to load the token from local storage, if enabled.
   */
  loginImplicitGrant (opts: ILoginOptions = {}, existingAuthData?: IAuthData): Promise<IAuthData | undefined> {
    // Check for auth token in hash
    const hash = existingAuthData || parseOauthParams();

    // // TODO: add logic for `usePopupAuth` _without_ a redirectUri (ie. using our standalone app)
    // this.redirectUri = opts.redirectUri;

    if (!opts) opts = {};

    return new Promise((resolve, reject) => {

      // Abort if org and provider are not set together
      if (opts.org && !opts.provider) {
        reject(new Error('opts.provider must be set if opts.org is set'));
      } else if (opts.provider && !opts.org) {
        reject(new Error('opts.org must be set if opts.provider is set'));
      } else if (!opts.redirectUri && !opts.usePopupAuth) {
        reject(new Error('redirectUri must be provided for implicit grant and not utilizing client-auth app for popup auth'));
      }

      // Abort on auth error
      if (hash && hash.error) {
        hash.accessToken = undefined;
        this._saveSettings(hash);
        reject(new Error(`[${hash.error}] ${hash.error_description}`))
      }

      /* if we have an acess token in the hash, save it before testing */
      if (hash.accessToken) {
        this._saveSettings(hash);
      }

      // Test token and proceed with login
      this._testTokenAccess()
        .then(() => {
          if (!this.authData.state && opts.state) {
            this.authData.state = opts.state;
          }

          return resolve(this.authData);
        })
        .catch((error) => {
          this._debug('Error encountered during login. This is normal if the application has not yet been authorized.', error);


          const query: IAuthRequestParams = {
            client_id: encodeURIComponent(this.clientId),
            response_type: 'token'
          };

          if (opts.redirectUri) query.redirect_uri = encodeURIComponent(opts.redirectUri);
          if (opts.state) query.state = encodeURIComponent(opts.state);
          if (opts.org) query.org = encodeURIComponent(opts.org);
          if (opts.provider) query.provider = encodeURIComponent(opts.provider);

          /* if we are using */
          if (opts.usePopupAuth) {
            if (!this.hasLocalStorage) {
              return reject(new Error('localStorage is unavailable. Cannot authenticate via popup window.'));
            }

            this._debug('using popup auth – adding listener');
            this._authenticateViaPopup(query, opts.popupTimeout || 15000)
              .then((data: IAuthData) => {
                this._saveSettings(data);
                resolve(data);
              })
              .catch(reject);
          } else {
            const url = this._buildAuthUrl('oauth/authorize', query as any);
            this._debug('Implicit grant: redirecting to: ' + url);
            window.location.replace(url);
            /* reject for testing purposes */
            reject(new Error(`Routing to login: "${url}"`));
          }
        });
    });
  }

  clearAuthData (): void {
    this._saveSettings({
      accessToken: undefined,
      state: undefined,
      tokenExpiryTime: undefined,
      tokenExpiryTimeString: undefined
    });
  }

  /**
   * Redirects the user to the PureCloud logout page
   */
  logout (logoutRedirectUri: string): void {
    this.clearAuthData();

    const query: { [key: string]: string } = {
      client_id: encodeURIComponent(this.clientId)
    };

    if (logoutRedirectUri) {
      query.redirect_uri = encodeURIComponent(logoutRedirectUri);
    }

    const url = this._buildAuthUrl('logout', query);
    window.location.replace(url);
  }

  /**
   * Sets the access token to be used with requests
   * @param token - The access token
   */
  setAccessToken (token: string): void {
    this._saveSettings({ accessToken: token });
  }

  /**
   * Returns a string representation for an actual parameter.
   * @param param The actual parameter.
   * @returns The string representation of <code>param</code>.
   */
  paramToString (param?: Date | Record<string, unknown> | string): string {
    if (!param) {
      return '';
    }
    if (param instanceof Date) {
      return param.toJSON();
    }
    return param.toString();
  }

  /**
   * Builds full URL by appending the given path to the base URL and replacing path parameter place-holders with parameter values.
   * NOTE: query parameters are not handled here.
   * @param path The path to append to the base URL.
   * @param pathParams The parameter values to append.
   * @returns The encoded path with parameter values substituted.
   */
  buildUrl (path: string, pathParams: { [key: string]: string } = {}): string {
    if (!path.match(/^\//)) {
      path = `/${path}`;
    }
    const url = (this.basePath + path)
      .replace(/\{([\w-]+)\}/g, (fullMatch, key) => {
        let value: string;
        if (!!Object.getOwnPropertyDescriptor(pathParams, key)) {
          value = this.paramToString(pathParams[key]);
        } else {
          value = fullMatch;
        }
        return encodeURIComponent(value);
      });
    return url;
  }

  testAccessToken (token: string): Promise<any> {
    // Test token
    return this.callApi('/api/v2/tokens/me', 'get', token)
  }

  /**
   * Invokes the REST service using the supplied settings and parameters.
   * @param path The path of the resource - this will be appended to base url.
   * @param httpMethod The HTTP method to use.
   * @returns A Promise request object.
   */
  callApi (path: string, httpMethod: 'get' | 'post', token?: string): superagent.Request {
    const uri = this.buildUrl(path);
    return superagent[httpMethod](uri)
      .type('application/json')
      .timeout(this.timeout)
      .set('Authorization', `Bearer ${token || this.authData?.accessToken}`)
      .send();
  }

  /**
   * Logs to the console.
   * @param message as a string
   * @param details any additional details
   */
  private _debug (message: string, details?: any): void {
    if (!this.config.debugMode) return;
    debug(message, details);
  }

  /**
   * Saves the auth token to local storage, if enabled.
   */
  private _saveSettings (opts: IAuthData): void {
    try {
      this.authData.accessToken = opts.accessToken;
      this.authentications['PureCloud OAuth'].accessToken = opts.accessToken;

      if (opts.state) {
        this.authData.state = opts.state;
      }

      this.authData.error = opts.error;
      this.authData.error_description = opts.error_description;

      if (opts.tokenExpiryTime) {
        this.authData.tokenExpiryTime = opts.tokenExpiryTime;
        this.authData.tokenExpiryTimeString = opts.tokenExpiryTimeString;
      }

      // Don't save settings if we aren't supposed to be persisting them
      if (!this.config.persist) {
        this._debug('persist is not true. Settings will not be saved.');
        return;
      }

      // Ensure we can access local storage
      if (!this.hasLocalStorage) {
        this._debug('Warning: Cannot access local storage. Settings will not be saved.');
        return;
      }

      // Remove state from data so it's not persisted
      const tempData = JSON.parse(JSON.stringify(this.authData));

      delete tempData.state;

      // Save updated auth data
      localStorage.setItem(this.config.storageKey, JSON.stringify(tempData));
      this._debug('Auth data saved to local storage', tempData);
    } catch (e) {
      console.error(e);
    }
  }

  private _getId (id?: string): string {
    id = id || v4();
    return `gc-ca_${id}`;
  }

  private _authenticateViaPopup (query: IAuthRequestParams, timeout: number): Promise<IAuthData> {
    /* save original options */
    const id = this._getId();
    const storageData: IRedirectStorageParams = { ...query, storageKey: this.config.storageKey };

    if (this.config.debugMode) {
      storageData.debug = true;
    }

    localStorage.setItem(id, JSON.stringify(storageData));

    /* change `state` to new id */
    query.state = id;

    /* if we aren't provided a redirectUri, use our app */
    if (!query.redirect_uri) {
      query.redirect_uri = encodeURIComponent(`https://apps.${this.environment}/client-auth`);
    }

    const loginUrl = this._buildAuthUrl('oauth/authorize', query as any);

    return new Promise<IAuthData>((resolve, reject) => {
      this._debug('Implicit grant: opening new window: ' + loginUrl);

      /* this will always be `null` if `nofererrer` or `noopener` is set */
      window.open(loginUrl, '_blank', 'width=500px,height=500px,noreferrer,noopener,resizable,scrollbars,status') as Window;

      const timeoutId = setTimeout(() => {
        this._debug('timeout for loginImplicitGrant using popup', query);
        const error = new TimeoutError('Popup authentation timeout. It is possible that the popup was blocked or the login page encountered an error');
        reject(error);
      }, timeout);

      const storageListener = (evt: StorageEvent) => {
        this._debug('value was just written to storage by another app', {
          key: evt.key,
          newValue: evt.newValue,
          oldValue: evt.oldValue,
        });

        if (evt.key === this.config.storageKey) {
          this._debug('keys matched. resolving value', { key: evt.key, value: evt.newValue });
          window.removeEventListener('storage', storageListener);
          clearTimeout(timeoutId);

          const authData = JSON.parse(evt.newValue || '');
          localStorage.removeItem(id);

          // TODO: do something with the saved temp state (if saved)
          resolve(authData);
        }
      };

      window.addEventListener('storage', storageListener);
    });
  }

  /**
   * Loads token from storage, if enabled, and checks to ensure it works.
   */
  private async _testTokenAccess (): Promise<void> {
    // Load from storage
    this._loadSettings();

    // Check if there is a token to test
    if (!this.authentications['PureCloud OAuth'].accessToken) {
      throw new Error('Token is not set');
    }

    try {
      // Test token
      await this.callApi('/api/v2/tokens/me', 'get');
    } catch (error) {
      this._saveSettings({ accessToken: undefined });
      throw error;
    }
  }

  /**
   * Loads settings from local storage, if enabled.
   */
  private _loadSettings () {
    // Don't load settings if we aren't supposed to be persisting them
    if (!this.config.persist) return;

    // Ensure we can access local storage
    if (!this.hasLocalStorage) {
      this._debug('Warning: Cannot access local storage. Settings will not be loaded.');
      return;
    }

    // Load current auth data
    const tempState = this.authData.state;
    const authDataFromStorage: string | null = localStorage.getItem(this.config.storageKey);

    if (!authDataFromStorage) {
      this.authData = {};
    } else {
      this.authData = JSON.parse(authDataFromStorage);
    }

    if (this.authData.accessToken) {
      this.setAccessToken(this.authData.accessToken);
    }

    this.authData.state = tempState;
  }

  /**
   * Constructs a URL to the auth server
   * @param path - The path for the URL
   * @param queryParams - An object of key/value pairs to use for querystring keys/values
   */
  private _buildAuthUrl (path: string, queryParams: { [key: string]: string | number } = {}) {
    return Object.keys(queryParams)
      .reduce((url, key) =>
        !queryParams[key] ? url : `${url}&${key}=${queryParams[key]}`,
        `${this.authUrl}/${path}?`
      );
  }
}
