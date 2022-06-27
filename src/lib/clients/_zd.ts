

// import { AuthenticationRequest, AuthData, OAuthRequestParams } from '../utils/interfaces';
// import { parseEnv, parseOauthParams, debug } from '../utils/utils';

// export const authenticate = async (
//   options: AuthenticationRequest,
//   win: Window = window,
//   existingAuthData?: AuthData
// ): Promise<AuthData> => {
//   /* validate */
//   if (options.org && !options.provider) {
//     throw new Error('options.provider must be set if options.org is set');
//   } else if (options.provider && !options.org) {
//     throw new Error('options.org must be set if options.provider is set');
//   } else if (!options.redirectUri) {
//     throw new Error('redirectUri must be provided for implicit grant authentication');
//   }

//   const { environment, apiUrl, authUrl } = parseEnv(options.environment);
//   const storageKey = options.storageKey || 'gc_client_auth_data';

//   const incomingAuthData = existingAuthData || parseOauthParams(win.location.hash);
//   let authDataFromStorage = loadAuthData(storageKey);

//   /* if the token in storage is expired, clear it */
//   if ((authDataFromStorage.tokenExpiryTime || 0) > Date.now()) {
//     writeAuthData(storageKey, undefined);
//     authDataFromStorage = {};
//   }

//   const validAuthData = await validateAuthData(apiUrl, incomingAuthData, authDataFromStorage);

//   /* save valid auth data (note, if there was none, it will clear any existing data) */
//   writeAuthData(storageKey, validAuthData);

//   if (validAuthData?.error) {
//     throw new Error(`[${validAuthData.error}] ${validAuthData.error_description}`)
//   }

//   /* if we don't have a token that passed the test, we need to redirect */
//   if (!validAuthData) {
//     const query: OAuthRequestParams = {
//       client_id: encodeURIComponent(options.clientId),
//       response_type: 'token'
//     };

//     if (options.redirectUri) query.redirect_uri = encodeURIComponent(options.redirectUri);
//     if (options.state) query.state = encodeURIComponent(options.state);
//     if (options.org) query.org = encodeURIComponent(options.org);
//     if (options.provider) query.provider = encodeURIComponent(options.provider);

//     const url = buildAuthUrl(`${authUrl}oauth/authorize`, query as any);
//     debug('Implicit grant: redirecting to: ' + url);
//     window.location.replace(url);

//     /* reject for testing purposes */
//     throw new Error(`Routing to login: "${url}"`);
//   }

//   /* if we had data that passed the token test, we are good to go */
//   return validAuthData!;
// }

