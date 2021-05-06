import superagent from 'superagent';

import {
  IAuthData,
  IAuthenticatorConfig,
  IAuthRequestParams,
  IAuthReturnData,
  ILoginOptions
} from './types';

export class GenesysCloudClientAuthenticator {
  readonly clientId: string;
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
      config.storageKey = 'gc_client_auth_auth_data';
    }

    if (typeof config.persist !== 'boolean') {
      config.persist = false;
    }


    this.config = config as IAuthenticatorConfig;

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
    };

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
  loginImplicitGrant (opts: ILoginOptions = {}): Promise<IAuthData | undefined> {
    // Check for auth token in hash
    const hash = this._setValuesFromUrlHash();

    // // TODO: add logic for `usePopupAuth`
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

      // Test token and proceed with login
      this._testTokenAccess()
        .then(() => {
          if (!this.authData.state && opts.state) {
            this.authData.state = opts.state;
          }

          return resolve(this.authData);
        })
        .catch((error) => {
          this.debug('Error encountered during login. This is normal if the application has not yet been authorized.', error);


          const query: IAuthRequestParams = {
            client_id: encodeURIComponent(this.clientId),
            redirect_uri: encodeURIComponent(opts.redirectUri as string),
            response_type: 'token'
          };
          if (opts.state) query.state = encodeURIComponent(opts.state);
          if (opts.org) query.org = encodeURIComponent(opts.org);
          if (opts.provider) query.provider = encodeURIComponent(opts.provider);

          var url = this._buildAuthUrl('oauth/authorize', query as any);

          if (opts.usePopupAuth) {
            this.debug('using popup auth – adding listener');

            const listener = (evt: StorageEvent) => {
              this.debug('value was just written to storage by another app', {
                key: evt.key,
                newValue: evt.newValue,
                oldValue: evt.oldValue,
              });

              if (evt.key === this.config.storageKey) {
                this.debug('keys matched. resolving value', { key: evt.key, value: evt.newValue });
                window.removeEventListener('storage', listener);
                JSON.parse(evt.newValue || '');
              }
            };

            window.addEventListener('storage', listener);

            this.debug('Implicit grant: opening new window: ' + url);
            window.open(url, '_blank', 'width=500px, height=500px, resizable, scrollbars, status');
          } else {
            this.debug('Implicit grant: redirecting to: ' + url);
            window.location.replace(url);
          }
        });
    });
  }

  /**
   * Redirects the user to the PureCloud logout page
   */
  logout (logoutRedirectUri: string) {
    if (this.hasLocalStorage) {
      this._saveSettings({
        accessToken: undefined,
        state: undefined,
        tokenExpiryTime: undefined,
        tokenExpiryTimeString: undefined
      });
    }

    const query: { [key: string]: string } = {
      client_id: encodeURIComponent(this.clientId)
    };

    if (logoutRedirectUri) {
      query.redirect_uri = encodeURI(logoutRedirectUri);
    }

    const url = this._buildAuthUrl('logout', query);
    window.location.replace(url);
  }

  /**
   * Sets the access token to be used with requests
   * @param token - The access token
   */
  setAccessToken (token: string) {
    this._saveSettings({ accessToken: token });
  }

  /**
   * Returns a string representation for an actual parameter.
   * @param param The actual parameter.
   * @returns The string representation of <code>param</code>.
   */
  paramToString (param?: Date | Object): string {
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
  buildUrl (path: string, pathParams: { [key: string]: string } = {}) {
    if (!path.match(/^\//)) {
      path = `/${path}`;
    }
    var url = this.basePath + path;
    url = url.replace(/\{([\w-]+)\}/g, (fullMatch, key) => {
      var value;
      if (pathParams.hasOwnProperty(key)) {
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
   * @param path The path of the resource – this will be appended to base url.
   * @param httpMethod The HTTP method to use.
   * @returns A Promise request object.
   */
  callApi (path: string, httpMethod: 'get' | 'post'): superagent.Request {
    const uri = this.buildUrl(path);
    return superagent[httpMethod](uri)
      .type('application/json')
      .timeout(this.timeout)
      .set('Authorization', `Bearer ${this.authData?.accessToken}`)
      .send();
  }

  /**
   * Logs to the console.
   * @param message as a string
   * @param details any additional details
   */
  debug (message: string, details?: any): void {
    if (!this.config.debugMode) return;

    console.log(`%c [DEBUG:gc-client-authenticator] ${message}`, 'color: #f29f2c', details);
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
      if (!this.config.persist) return;

      // Ensure we can access local storage
      if (!this.hasLocalStorage) {
        this.debug('Warning: Cannot access local storage. Settings will not be saved.');
        return;
      }

      // Remove state from data so it's not persisted
      let tempData = JSON.parse(JSON.stringify(this.authData));

      // TODO: this needs to come out
      // delete tempData.state;

      // Save updated auth data
      localStorage.setItem(this.config.storageKey, JSON.stringify(tempData));
      this.debug('Auth data saved to local storage');
    } catch (e) {
      console.error(e);
    }
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
      this.callApi('/api/v2/tokens/me', 'get')
    } catch (error) {
      this._saveSettings({ accessToken: undefined });
      throw error;
    }
  }

  /**
   * Parses the URL hash, grabs the access token, and clears the hash. If no access token is found, no action is taken.
   */
  private _setValuesFromUrlHash (): IAuthData | void {
    // Check for window
    if (!(typeof window !== 'undefined' && window.location.hash)) return;

    // Process hash string into object
    const hashRegex = new RegExp(`^#*(.+?)=(.+?)$`, 'i');
    const hash: IAuthReturnData = {};
    window.location.hash.split('&').forEach((h) => {
      const match = hashRegex.exec(h);
      if (match) (hash as any)[match[1]] = decodeURIComponent(decodeURIComponent(match[2].replace(/\+/g, '%20')));
    });

    // Check for error
    if (hash.error) {
      return hash;
    }

    // Everything goes in here because we only want to act if we found an access token
    if (hash.access_token) {
      const opts: IAuthData = {};

      if (hash.state) {
        opts.state = hash.state;
      }

      if (hash.expires_in) {
        opts.tokenExpiryTime = (new Date()).getTime() + (parseInt(hash.expires_in.replace(/\+/g, '%20')) * 1000);
        opts.tokenExpiryTimeString = (new Date(opts.tokenExpiryTime)).toISOString();
      }

      // Set access token
      opts.accessToken = hash.access_token.replace(/\+/g, '%20');

      // Remove hash from URL
      // Credit: https://stackoverflow.com/questions/1397329/how-to-remove-the-hash-from-window-location-with-javascript-without-page-refresh/5298684#5298684
      let scrollV: number;
      let scrollH: number;
      const loc = window.location;

      if ('replaceState' in window.history) {
        window.history.replaceState('', document.title, loc.pathname + loc.search);
      } else {
        // Prevent scrolling by storing the page's current scroll offset
        scrollV = document.body.scrollTop;
        scrollH = document.body.scrollLeft;

        // Remove hash
        loc.hash = '';

        // Restore the scroll offset, should be flicker free
        document.body.scrollTop = scrollV;
        document.body.scrollLeft = scrollH;
      }

      this._saveSettings(opts);

      return opts;
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
      this.debug('Warning: Cannot access local storage. Settings will not be loaded.');
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
