import { debug, parseOauthParams } from './utils';
import { IRedirectStorageParams } from './types';

export const handleRedirectFromLogin = (): void => {
  const authData = parseOauthParams();

  // TODO: we won't have state so we can't really communicate this using our state uuid
  if (authData.error) {
    throw new Error(`[${authData.error}]: ${authData.error_description}`);
  }

  if (!authData.accessToken) {
    throw new Error('No accessToken provided');
  }

  const storageId = authData.state;
  if (!storageId) {
    throw new Error('No `state` param on redirect. Unable to determine location to save auth data');
  }

  const data: IRedirectStorageParams = JSON.parse(localStorage.getItem(storageId) || 'false');

  if (!data || !data.storageKey) {
    throw new Error('Unable to parse needed information from localStorage.');
  }

  /* merge the states */
  if (data.state) {
    authData.state = data.state;
  } else {
    delete authData.state;
  }

  debug(`setting auth data to key: ${data.storageKey}`, authData);
  localStorage.setItem(data.storageKey, JSON.stringify(authData));
  debug(`removing temp storage key: ${storageId}`);
  localStorage.removeItem(storageId);

  debug('Now we would normally close this window');
};
