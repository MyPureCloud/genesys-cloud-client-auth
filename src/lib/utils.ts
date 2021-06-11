import { IAuthReturnData, IAuthData } from './types';
import VERSION from './version';

const debugColor = 'color: #f29f2c';

export class TimeoutError extends Error {
  name = 'TIMEOUT_ERROR';
}

export class TranslatableError extends Error {
  translationKey: 'errorToken' | 'errorStateParam' | 'errorParse' | 'errorTokenNotSet';

  /* istanbul ignore next */
  constructor (translationKey, messageOrError: string | Error) {
    /* if a Error is passed in, use its message and name properties */
    const isError = messageOrError && messageOrError instanceof Error;
    super(isError ? (messageOrError as any).message : messageOrError);

    if (isError) {
      this.name = (messageOrError as any).name;
    }

    this.translationKey = translationKey;
  }
}


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

export const isIssuedTimeWithinWindow = (expiresAtMs: number, expiresInMs = 691199000 /* 8 days */, windowMs = 1680 * 1000 /* default: 28 minutes */): boolean => {
  const issuedAt = tokenWasIssuedAt(expiresAtMs, expiresInMs);

  /* if current time is within the window from issuedAt */
  return Date.now() - issuedAt < windowMs;
};

export const tokenWasIssuedAt = (expiresAtMs: number, expiresInMs: number): number => {
  return expiresAtMs - expiresInMs;
};
