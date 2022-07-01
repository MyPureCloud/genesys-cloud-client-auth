import axios, { AxiosRequestConfig } from 'axios';

import { AuthData, ErrorTranslationKeys, InternalAuthenticatorConfig, LoginOptions, OAuthReturnedData, ParseQueryParamsOptions } from './interfaces';
import { DEBUG_MODE, VERSION } from './config';

export const parseQueryParams = (options: ParseQueryParamsOptions = {}) => {
  /* defaults */
  const win = options.window || window;
  const strategy = options.strategy || 'both';
  const requiredParams = options.requiredParams || [];

  const url = new URL(win.location.href);
  const queryParams: { [key: string]: string } = {};
  const errors: string[] = [];

  if (['both', 'regular'].includes(strategy)) {
    Object.assign(queryParams, parseString(url.search));
  }

  if (['both', 'hash'].includes(strategy)) {
    Object.assign(queryParams, parseString(url.hash));
  }

  requiredParams.forEach(param => {
    if (!queryParams.hasOwnProperty(param)) {
      errors.push(param);
    }
  });

  if (errors.length) {
    throw new Error(`Missing required query params: "${errors.join('", "')}"`);
  }

  return queryParams;
}

export const parseString = (str: string): { [key: string]: string } => {
  const returnedObj: { [key: string]: string } = {};
  // Process hash string into object
  const hashRegex = new RegExp(`^#*(.+?)=(.+?)$`, 'i');

  str.split('&').forEach((h) => {
    const match = hashRegex.exec(h);
    if (match) {
      (returnedObj as any)[match[1]] = decodeURIComponent(
        decodeURIComponent(match[2].replace(/\+/g, '%20'))
      );
    }
  });

  return returnedObj;
};

export const debug = (message: string, details?: any): void => {
  if (!DEBUG_MODE) return;

  const debugColor = 'color: #f29f2c';

  if (details) {
    console.log(
      `%c [DEBUG:gc-client-auth:${VERSION}] ${message}`,
      debugColor,
      details
    );

    if (typeof details === 'object') {
      console.log(
        `%c [DEBUG:gc-client-auth:${VERSION}] ^ stringified: ${JSON.stringify(
          details
        )}`,
        debugColor
      );
    }
  } else {
    console.log(`%c [DEBUG:gc-client-auth:${VERSION}] ${message}`, debugColor);
  }
}

export const testForLocalStorage = () => {
  try {
    localStorage.setItem('genesys_cloud_local_storage_test', 'genesys_cloud_local_storage_test');
    localStorage.removeItem('genesys_cloud_local_storage_test');
  } catch (e) {
    return false;
    // throw new Error('Genesys Cloud Client Auth does not running in an environment with access to `localStorage`');
  }
  return true;
}

export const parseEnv = (environment?: string): Pick<InternalAuthenticatorConfig, 'apiBase' | 'environment' | 'authBase'> => {
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

  return {
    environment,
    apiBase: `https://api.${environment}`,
    authBase: `https://login.${environment}`
  };
}

export const callApi = async <T = any> (url: string, options: AxiosRequestConfig<T>): Promise<T> => {
  return axios.get(url, options);
}

/**
 * Utility to parse the auth data returned from the login page and return
 *  authentication data as an object.
 * @param hash hash to parse (default `window.location.hash`)
 * @returns authentication data parsed from the passed in hash
 */
export const parseOauthParams = (hash: string): AuthData => {
  const hashAsObj: OAuthReturnedData = {};
  const authData: AuthData = {};

  // Process hash string into object
  const hashRegex = new RegExp(`^#*(.+?)=(.+?)$`, 'i');

  hash.split('&').forEach((h) => {
    const match = hashRegex.exec(h);
    if (match) {
      (hashAsObj as any)[match[1]] = decodeURIComponent(
        decodeURIComponent(match[2].replace(/\+/g, '%20'))
      );
    }
  });

  /* if there is an error, return and don't attempt to parse the rest */
  if (hashAsObj.error) {
    return hashAsObj;
  }

  if (hashAsObj.access_token) {
    /* use the hash if we have one */
    if (hashAsObj.state) {
      authData.state = hashAsObj.state;
    }

    /* calculate expiry time */
    if (hashAsObj.expires_in) {
      const expiresInMs = parseInt(hashAsObj.expires_in.replace(/\+/g, '%20')) * 1000;

      authData.tokenExpiryTime = Date.now() + expiresInMs;
      authData.tokenExpiryTimeString = new Date(
        authData.tokenExpiryTime
      ).toISOString();
    }

    /* set the access token */
    authData.accessToken = hashAsObj.access_token.replace(/\+/g, '%20');
  }

  return authData;
};


/**
 * Determine if a token was issued within a given timeframe window. Example may be:
 *  a token is received (either from localStorage or some other way) and you need
 *  to be able to tell if it was issued within the last 10 minutes. Use this function
 *  as follows:
 * ``` ts
 * const tokenExpiryTime = 1624611600000; // "2021-06-25 09:00.000Z"
 * const tokenExpiresIn  = 86400000; // 1 day: meaning token was issuedAt "2021-06-24 09:00.000Z"
 * const timeframe = 600000; // 10 minutes
 * const startTime = 1624525260000; // "2021-06-24 09:01.000Z": 1 minute after issued time
 *
 * const willBeTrue = isIssuedTimeWithinTimeframe(
 *  tokenExpiryTime,
 *  tokenExpiresIn,
 *  timeframe,
 *  startTime
 * );
 * ```
 * @param expiresAtMs epoch time (in milliseconds) for when the token will expire
 * @param expiresInMs milliseconds for how long the token is valid for. Default `691199000`
 * @param timeframe timeframe (in milliseconds) to check if the token was issued within. Default `1680000`
 * @param startTime time to count `timeframe` back from (in epoch time). Default is `Date.now()`
 * @returns boolean of whether the token was issued within the given timeframe (from now)
 */
export const isIssuedTimeWithinTimeframe = (
  expiresAtMs: number,
  expiresInMs = 691199000 /* 8 days */,
  timeframe = 1680 * 1000 /* default: 28 minutes */,
  startTime = Date.now()
): boolean => {
  const issuedAt = tokenWasIssuedAt(expiresAtMs, expiresInMs);

  /* if current time is within the window from issuedAt */
  return startTime - issuedAt < timeframe;
};

/**
 * @deprecated use `isIssuedTimeWithinTimeframe()`
 */
export const isIssuedTimeWithinWindow = (
  expiresAtMs: number,
  expiresInMs?: number,
  timeframe?: number
): boolean => {
  return isIssuedTimeWithinTimeframe(expiresAtMs, expiresInMs, timeframe);
};

/**
 * Determine when a token was issued at by subtracting the validity
 *  time from the expires at time.
 * @param expiresAtMs epoch time (in milliseconds) for when the token will expire
 * @param expiresInMs milliseconds for how long the token is valid for
 * @returns milliseconds since epoch time
 */
export const tokenWasIssuedAt = (
  expiresAtMs: number,
  expiresInMs: number
): number => {
  return expiresAtMs - expiresInMs;
};

export class TranslatableError extends Error {
  translationKey: ErrorTranslationKeys;

  /* istanbul ignore next */
  constructor (
    translationKey: ErrorTranslationKeys,
    messageOrError: string | Error
  ) {
    /* if a Error is passed in, use its message and name properties */
    const isError = messageOrError && messageOrError instanceof Error;
    super(isError ? (messageOrError as any).message : messageOrError);

    if (isError) {
      this.name = (messageOrError as any).name;
    }

    this.translationKey = translationKey;
  }
}