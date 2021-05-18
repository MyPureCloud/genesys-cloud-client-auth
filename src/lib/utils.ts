import { IAuthReturnData, IAuthData } from './types';
import VERSION from './version';

export const parseOauthParams = (hash: string = window.location.hash): IAuthData => {
  const hashAsObj: IAuthReturnData = {};
  const authData: IAuthData = {};

  // Process hash string into object
  const hashRegex = new RegExp(`^#*(.+?)=(.+?)$`, 'i');

  hash.split('&').forEach((h) => {
    const match = hashRegex.exec(h);
    if (match) (hashAsObj as any)[match[1]] = decodeURIComponent(decodeURIComponent(match[2].replace(/\+/g, '%20')));
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
      authData.tokenExpiryTime = (new Date()).getTime() + (parseInt(hashAsObj.expires_in.replace(/\+/g, '%20')) * 1000);
      authData.tokenExpiryTimeString = (new Date(authData.tokenExpiryTime)).toISOString();
    }

    /* set the access token */
    authData.accessToken = hashAsObj.access_token.replace(/\+/g, '%20');
  }

  return authData;
};

export const debug = (message: string, details?: any): void => {
  console.log(`%c [DEBUG:gc-client-auth:${VERSION}] ${message}`, 'color: #f29f2c', details);
};

export const isIssuedTimeWithinWindow = (expiresAtMs: number, expiresInMs: number = 691199000 /* 8 days */, windowMs: number = 1680 * 1000 /* default: 28 minutes */): boolean => {
  const issuedAt = expiresAtMs - expiresInMs;

  /* if current time is within the window from issuedAt */
  return Date.now() - issuedAt < windowMs;
}

// function calcIssuedAt (expiresAt) {
//   const issuedAt = expiresAt - 691199 * 1000;
//   const issuedAtDate = new Date(issuedAt);
//   console.log({ issuedAt, issuedAtDate });
//   return issuedAtDate;
// }

// const TWENTY_EIGHT_MINUTES_MS = 1680 * 1000

// function add28Minutes (date) {
//   const futureDate = new Date(
//     date.getTime() + TWENTY_EIGHT_MINUTES_MS // add 28 minutes to issued date
//   );
//   return futureDate;
// }

// function isWithinWindow (futureDate) {
//   return futureDate - Date.now() < TWENTY_EIGHT_MINUTES_MS;
// }
