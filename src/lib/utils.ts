import { v4 as uuid } from 'uuid';
import { IAuthReturnData, IAuthData, ErrorTranslationKeys } from './types';
import VERSION from './version';

const debugColor = 'color: #f29f2c';

export class TimeoutError extends Error {
  name = 'TIMEOUT_ERROR';
}

export class TranslatableError extends Error {
  translationKey: ErrorTranslationKeys;

  /* istanbul ignore next */
  constructor (translationKey: ErrorTranslationKeys, messageOrError: string | Error) {
    /* if a Error is passed in, use its message and name properties */
    const isError = messageOrError && messageOrError instanceof Error;
    super(isError ? (messageOrError as any).message : messageOrError);

    if (isError) {
      this.name = (messageOrError as any).name;
    }

    this.translationKey = translationKey;
  }
}

/**
 * Utility to parse the auth data returned from the login page and return
 *  authentication data as an object.
 * @param hash hash to parse (default `window.location.hash`)
 * @returns authentication data parsed from the passed in hash
 */
export const parseOauthParams = (hash: string = window.location.hash): IAuthData => {
  const hashAsObj: IAuthReturnData = {};
  const authData: IAuthData = {};

  // Process hash string into object
  const hashRegex = new RegExp(`^#*(.+?)=(.+?)$`, 'i');

  hash.split('&').forEach((h) => {
    const match = hashRegex.exec(h);
    if (match) {
      (hashAsObj as any)[match[1]] = decodeURIComponent(decodeURIComponent(match[2].replace(/\+/g, '%20')));
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
      const expiresInMs = (parseInt(hashAsObj.expires_in.replace(/\+/g, '%20')) * 1000);

      authData.tokenExpiryTime = Date.now() + expiresInMs;
      authData.tokenExpiryTimeString = (new Date(authData.tokenExpiryTime)).toISOString();
    }

    /* set the access token */
    authData.accessToken = hashAsObj.access_token.replace(/\+/g, '%20');
  }

  return authData;
};

export const debug = (message: string, details?: any): void => {
  if (details) {
    console.log(`%c [DEBUG:gc-client-auth:${VERSION}] ${message}`, debugColor, details);
    if (typeof details === 'object') {
      console.log(`%c [DEBUG:gc-client-auth:${VERSION}] ^ stringified: ${JSON.stringify(details)}`, debugColor);
    }
  } else {
    console.log(`%c [DEBUG:gc-client-auth:${VERSION}] ${message}`, debugColor);
  }
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
export const isIssuedTimeWithinWindow = (expiresAtMs: number, expiresInMs?: number, timeframe?: number): boolean => {
  return isIssuedTimeWithinTimeframe(expiresAtMs, expiresInMs, timeframe);
}

/**
 * Determine when a token was issued at by subtracting the validity
 *  time from the expires at time.
 * @param expiresAtMs epoch time (in milliseconds) for when the token will expire
 * @param expiresInMs milliseconds for how long the token is valid for
 * @returns milliseconds since epoch time
 */
export const tokenWasIssuedAt = (expiresAtMs: number, expiresInMs: number): number => {
  return expiresAtMs - expiresInMs;
};


// This util only keeps the value of the query param last specified in the query string if duplicates are specified.
export const getQueryParams = (searchStr: string): Record<string, string | undefined> => {
  // @ts-expect-error URLSearchParams is truly iterable and can be converted to an object via `fromEntries`
  return Object.fromEntries(new URLSearchParams(searchStr));
};

function assertNonEmptyStringQueryParam(
    maybeStr: string | undefined,
    name: string
): asserts maybeStr is string {
    if (!maybeStr) throw new Error(`'${name}' query param is not a non-empty string`);
}

export interface EmbeddedAppState {
    href: string;
    env: string;
    locale: string;
    branch?: string;
    interactionId: string;
    usePopupAuth: boolean;
}

export const getEmbeddedAppState = (href: string): EmbeddedAppState => {
    const url = new URL(href);
    const branchPath = url.pathname.split('/').slice(2).join('/');
    const branch = branchPath.endsWith('/') ? branchPath.slice(0, -1) : branchPath;

    const [, queryFromHash] = url.hash.split('?');
    if (!queryFromHash) throw new Error('Unable to extract query params from the hash');

    const { interactionId, pcEnvironment, usePopupAuth, locale = 'en-us' } = getQueryParams(
        queryFromHash
    );
    assertNonEmptyStringQueryParam(interactionId, 'interactionId');
    assertNonEmptyStringQueryParam(pcEnvironment, 'pcEnvironment');

    return {
        href,
        locale,
        interactionId,
        branch: branch ? branch : undefined,
        env: pcEnvironment === 'localhost' ? 'inindca.com' : pcEnvironment,
        usePopupAuth: usePopupAuth === 'true'
    };
};

interface BuildRedirectUrlProps {
  usePopupAuth: boolean;
  location: Pick<Location, 'origin' | 'hostname'>;
}

/**
* Builds up our redirect url based on the current window location and
* whether or not we should use popup auth.
*/
export const buildRedirectUrl = ({ usePopupAuth, location }: BuildRedirectUrlProps) => {
  const redirectUrl = new URL(location.origin);
  if (location.hostname === 'localhost') {
      redirectUrl.pathname = '/';
  } else {
      redirectUrl.pathname = '/agent-conversation-summary/';
  }
  if (usePopupAuth) {
      redirectUrl.searchParams.set('authPopupWindow', 'true');
  }
  return redirectUrl.href;
};

const STATE_KEY_PREFIX = 'cs-auth';

export const createStateKey = () => {
    return [STATE_KEY_PREFIX, uuid()].join('-');
};

export const persistPreAuthFlowHref = (storage: Pick<Storage, 'setItem'>, href: string) => {
    const stateKey = createStateKey();
    storage.setItem(stateKey, href);
    return stateKey;
};



export const clearAuthStateEntries = (storage: Storage) => {
    Object.keys(storage)
        .filter(key => key.startsWith(STATE_KEY_PREFIX))
        .forEach(key => storage.removeItem(key));
};

interface RestoreHrefProps {
  href: string;
  branch?: string;
  location: Pick<Location, 'href' | 'pathname' | 'replace'>;
  history: Pick<History, 'replaceState'>;
}

/**
* Restores our pre-auth href if necessary and possibly reloads the window
* using a time machine branch
*/
export const restoreHref = ({ href, branch, location, history }: RestoreHrefProps): void => {
  if (branch && !location.pathname.includes(branch)) {
      // If branch build and we're not on the branch, do a full reload
      // to pull the branch build from S3
      location.replace(href);
  } else if (location.href !== href) {
      // Otherwise, we can just restore the window's old href
      history.replaceState(null, '', href);
  }
};

export const getPreAuthFlowHref = (storage: Pick<Storage, 'getItem'>, key: string) => {
  const href = storage.getItem(key);
  if (!href) throw new Error('unable to find auth state stored locally');
  return href;
};