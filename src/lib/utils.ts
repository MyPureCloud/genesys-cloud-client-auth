import { IAuthReturnData, IAuthData } from './types';

export const parseOauthParams = (): IAuthData => {
  const hash: IAuthReturnData = {};
  const authData: IAuthData = {};

  // Process hash string into object
  const hashRegex = new RegExp(`^#*(.+?)=(.+?)$`, 'i');

  window.location.hash.split('&').forEach((h) => {
    const match = hashRegex.exec(h);
    if (match) (hash as any)[match[1]] = decodeURIComponent(decodeURIComponent(match[2].replace(/\+/g, '%20')));
  });

  /* if there is an error, return and don't attempt to parse the rest */
  if (hash.error) {
    return hash;
  }

  if (hash.access_token) {

    /* use the hash if we have one */
    if (hash.state) {
      authData.state = hash.state;
    }

    /* calculate expiry time */
    if (hash.expires_in) {
      authData.tokenExpiryTime = (new Date()).getTime() + (parseInt(hash.expires_in.replace(/\+/g, '%20')) * 1000);
      authData.tokenExpiryTimeString = (new Date(authData.tokenExpiryTime)).toISOString();
    }

    /* set the access token */
    authData.accessToken = hash.access_token.replace(/\+/g, '%20');
  }

  return authData;
};

export const debug = (message: string, details?: any): void => {
  console.log(`%c [DEBUG:gc-client-auth] ${message}`, 'color: #f29f2c', details);
};
