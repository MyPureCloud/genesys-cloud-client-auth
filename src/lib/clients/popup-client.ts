// import { debug, parseOauthParams, TranslatableError } from './utils';
// import { IRedirectStorageParams } from './types';

import { debug, parseQueryParams, TranslatableError } from "../utils/utils";
import { LocalStoragePubSub } from '../utils/messaging';
import { InProgressBody } from '../utils/interfaces';
import { DEBUG_MODE, setDebugMode } from "../utils/config";

/**
 * Helper function to parse the auth data opened from a popup authentication window.
 *  It will save the auth data to localStorage.
 * Note: this will throw errors if it cannot parse or save the data correctly
 */
export const handleRedirectFromLogin = (): void => {
  const queryParams = parseQueryParams({ strategy: 'hash' });

  // TODO: we won't have state so we can't really communicate this using our state uuid
  if (queryParams.error) {
    throw new Error(`[${queryParams.error}]: ${queryParams.error_description}`);
  }

  if (!queryParams.accessToken) {
    throw new TranslatableError('errorToken', 'No access token provided.');
  }

  const storageKey = queryParams.state;
  if (!storageKey) {
    throw new TranslatableError('errorStateParam', 'No state param on redirect. Unable to determine location to save auth data.');
  }

  const messenger = new LocalStoragePubSub(storageKey);
  const inProgressBody: InProgressBody = {};
  const lastMessage = messenger.getLastEventEmitted();

  // if (lastMessage?.event === 'FAILURE' && lastMessage.body.type === 'TIMEOUT')
  if (messenger.isInProgressEvent(lastMessage)) {
    Object.assign(inProgressBody, lastMessage.body);
    setDebugMode(!!lastMessage.body.debug);
  }
  const href = window.location.href;
  inProgressBody.href = href;

  /* emit that we are working */
  debug(`loaded popup auth at url: ${href}`);
  messenger.writeInProgressEvent(inProgressBody);


  if (queryParams.accessToken) {
    debug('found accessToken in url hash, completing auth');
    messenger.writeInProgressEvent({ ...queryParams, state: (lastMessage?.body as any).state });
  } else {
    debug('NO accessToken found in url hash, failing auth');
    messenger.writeFailureEvent({
      type: 'OTHER',
      error: 'No accessToken found in the popup window url hash'
    });
  }

  if (!DEBUG_MODE) {
    messenger.done();
    window.close();
  }
};
