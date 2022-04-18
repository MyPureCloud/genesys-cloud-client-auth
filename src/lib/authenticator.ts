import superagent from 'superagent';
import { v4 } from 'uuid';

import {
  IAuthData,
  IAuthenticatorConfig,
  IAuthRequestParams,
  ILoginOptions,
  IRedirectStorageParams,
} from './types';
import { debug, parseOauthParams, TimeoutError, TranslatableError } from './utils';
import VERSION from './version';

/**
 * Class to manage authentication and state. It is recommended to use the `authenticatorFactory`
 *  to construct a singleton instance of this class.
 */
export class GenesysCloudClientAuthenticator {
  /** Oauth client id */
  readonly clientId: string;
  /** client-auth version */
  readonly VERSION: string = VERSION;
  /** current authencation data for this instance. default is an empty object `{}`*/
  authData: IAuthData;
  /** current configuration for this instance */
  config: IAuthenticatorConfig;
  /** current environment. Ex. `mypurecloud.com` */
  environment!: string;
  /** base api path - utilizing the `environment` varialbe */
  basePath!: string;
  /** base auth path - utilizing the `environment` varialbe */
  authUrl!: string;

  private hasLocalStorage: boolean;
  private authentications: { [authenitcation: string]: any };
  private timeout: number;

  /**
   * Construct a new Authenticator instance. It is recommended you use the `authenticatorFactory()`
   *  to construct a singleton for each necessary Oauth client.
   *
   * @param clientId oauth client id
   * @param config optional configuration options
   */
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
   * Initiates the implicit grant login flow. Will attempt to load the token from local storage, if enabled.
   *
   * @param opts Optional options to login with
   * @param existingAuthData optional authentication data to use. default will be parsed from url hash
   * @returns Promise with the authentication data
   */
  loginImplicitGrant (opts: ILoginOptions = {}, existingAuthData?: IAuthData): Promise<IAuthData | undefined> {
    // Check for auth token in hash
    const hash = existingAuthData || parseOauthParams();

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

  /**
   * Sets the environment, baseUrl, and authUrl used by the session
   * @param environment - (Optional, default "mypurecloud.com") Environment the instance uses, e.g. mypurecloud.ie, mypurecloud.com.au, etc.
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
   * Will clear current auth data from localStorage.
   * NOTE: this will _not_ log the user out. Using `logout()`
   *  for logging out
   */
  clearAuthData (): void {
    this._saveSettings({
      accessToken: undefined,
      state: undefined,
      tokenExpiryTime: undefined,
      tokenExpiryTimeString: undefined
    });
  }

  /**
   * Clears auth data from localStorage and redirects the user to the GenesysCloud logout page
   *
   * @param logoutRedirectUri optional, redirectUri to pass to the logout page
   */
  logout (logoutRedirectUri?: string): void {
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
   * Sets the access token on the authenticator instance and localStorage (if configured)
   * @param token - The access token
   */
  setAccessToken (token: string): void {
    this._saveSettings({ accessToken: token });
  }

  /**
   * Test an accessToken by using it to make an API call. It will resolve
   *  if the token is valid, and will reject if it is not valid.
   * @param token accessToken to test
   * @returns a promise that will resolve is successful
   */
  testAccessToken (token: string): Promise<any> {
    return this.callApi('/api/v2/tokens/me', 'get', token)
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
   * Returns a string representation for an actual parameter.
   *
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

  /**
   * Return a unique id for client-auth
   * @param id optional id string
   * @returns unique id specific to client-auth
   */
  private _getId (id?: string): string {
    id = id || v4();
    return `gc-ca_${id}`;
  }

  /**
   * Authenticate using a popup with and localStorage.
   * @param query query params
   * @param timeout milliseconds for our long to wait for successful authentication
   * @returns promiise with the authentication data
   */
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

      let openWindow: Window | null;
      let throwErrorTimeout: ReturnType<typeof setTimeout> | null;
      let newWindowInterval: ReturnType<typeof setInterval> | null;

      let closePopupWindowOnUnloadListener: ((e:PageTransitionEvent)=>void) | null = null;

      if(this.config.useUpdatedPopupAuthFlow){
        openWindow = window.open(loginUrl, '_blank', 'width=500px,height=500px,resizable,scrollbars,status');
        closePopupWindowOnUnloadListener = ()=>{
          openWindow?.close();
        }
        window.addEventListener("pagehide", closePopupWindowOnUnloadListener)
        newWindowInterval = setInterval(()=>{
          if(openWindow === null || openWindow.closed){
            if(newWindowInterval){
              clearInterval(newWindowInterval);
            }
            if(closePopupWindowOnUnloadListener){
              window.removeEventListener("pagehide", closePopupWindowOnUnloadListener);
            }
            
            this._debug('popup was closed or never opened', query);
            const error = new Error('Popup was closed or never open');
            reject(error);
          }
        }, 500)
      }else{
        /* this will always be `null` if `nofererrer` or `noopener` is set */
        window.open(loginUrl, '_blank', 'width=500px,height=500px,noreferrer,noopener,resizable,scrollbars,status');
        throwErrorTimeout = setTimeout(() => {
          this._debug('timeout for loginImplicitGrant using popup', query);
          const error = new TimeoutError('Popup authentation timeout. It is possible that the popup was blocked or the login page encountered an error');
          reject(error);
        }, timeout);
      }

      

      const storageListener = (evt: StorageEvent) => {
        this._debug('value was just written to storage by another app', {
          key: evt.key,
          newValue: evt.newValue,
          oldValue: evt.oldValue,
        });

        if (evt.key === this.config.storageKey) {
          this._debug('keys matched. resolving value', { key: evt.key, value: evt.newValue });
          window.removeEventListener('storage', storageListener);
          if(throwErrorTimeout){
            clearTimeout(throwErrorTimeout);
          }
          if(newWindowInterval){
            clearInterval(newWindowInterval);
          }
          if(closePopupWindowOnUnloadListener){
            window.removeEventListener("pagehide", closePopupWindowOnUnloadListener);
          }
          if(openWindow){
            openWindow.close();
          }

          const authData = JSON.parse(evt.newValue as string);
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
      throw new TranslatableError(
        'errorTokenNotSet',
        'No access token provided.'
      );
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
export const authenticatorFactory = (clientId: string, config: Partial<IAuthenticatorConfig>): GenesysCloudClientAuthenticator => {
  let authenticator = authenticators.get(clientId);

  if (!authenticator) {
    authenticator = new GenesysCloudClientAuthenticator(clientId, config);
    authenticators.set(clientId, authenticator);
  }

  return authenticator;
};