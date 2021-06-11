import { GenesysCloudClientAuthenticator, IAuthData, IAuthenticatorConfig, IAuthRequestParams, ILoginOptions } from '../../src/lib';
import * as utils from '../../src/lib/utils';
import { createNock } from '../utils/test-utils';
import { TimeoutError } from '../../src/lib/utils';

describe('GenesysCloudClientAuthenticator', () => {
  let authenticator: GenesysCloudClientAuthenticator;
  const clientId = 'client-id';

  beforeEach(() => {
    authenticator = new GenesysCloudClientAuthenticator(clientId);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor()', () => {
    it('should set default config and other state props', () => {
      authenticator = new GenesysCloudClientAuthenticator(clientId);

      expect(authenticator.clientId).toBe(clientId);
      expect(authenticator.config).toEqual({
        storageKey: 'gc_client_auth_data',
        persist: false
      });
      expect(authenticator.environment).toBe('mypurecloud.com');
      expect(authenticator.basePath).toBe('https://api.mypurecloud.com');
      expect(authenticator.authUrl).toBe('https://login.mypurecloud.com');

      expect(authenticator.authData).toEqual({});
      expect(authenticator['timeout']).toBe(16000);
      expect(authenticator['authentications']).toEqual({ 'PureCloud OAuth': { type: 'oauth2' } });
    });

    it('should use passed in config', () => {
      const ourConfig: IAuthenticatorConfig = {
        environment: 'inindca.com.au',
        storageKey: 'our_app_auth_data',
        persist: true,
        debugMode: true
      };

      authenticator = new GenesysCloudClientAuthenticator(clientId, ourConfig);

      expect(authenticator.clientId).toBe(clientId);
      expect(authenticator.config).not.toBe(ourConfig);
      expect(authenticator.config).toEqual(ourConfig);
      expect(authenticator.environment).toBe('inindca.com.au');
      expect(authenticator.basePath).toBe('https://api.inindca.com.au');
      expect(authenticator.authUrl).toBe('https://login.inindca.com.au');
    });

    it('should determine if we have local storage', () => {
      jest.spyOn(console, 'error').mockImplementation();
      const lsSpy = jest.spyOn(window.localStorage, 'setItem');

      authenticator = new GenesysCloudClientAuthenticator(clientId);

      /* if we have it */
      expect(lsSpy).toHaveBeenCalled();
      expect(authenticator['hasLocalStorage']).toBe(true);

      /* if we don't (for w/e reason) */
      lsSpy.mockImplementation(() => { throw new Error('No localStorage') });

      authenticator = new GenesysCloudClientAuthenticator(clientId);

      expect(authenticator['hasLocalStorage']).toBe(false);
    });
  });

  describe('parseDate()', () => {
    it('should return correct date', () => {
      const str = '2021-06-02T17:39:34.961Z';
      expect(authenticator.parseDate(str).toUTCString()).toBe('Wed, 02 Jun 2021 17:39:34 GMT');
    });
  });

  describe('setEnvironment()', () => {
    it('should use default', () => {
      authenticator.setEnvironment();
      expect(authenticator.environment).toBe('mypurecloud.com');
      expect(authenticator.basePath).toBe('https://api.mypurecloud.com');
      expect(authenticator.authUrl).toBe('https://login.mypurecloud.com');
    });

    it('should strip trailing slash', () => {
      const env = 'example.com/';
      authenticator.setEnvironment(env);
      expect(authenticator.environment).toBe('example.com');
      expect(authenticator.basePath).toBe('https://api.example.com');
      expect(authenticator.authUrl).toBe('https://login.example.com');
    });

    it('should strip leading https://', () => {
      const env = 'https://example.com';
      authenticator.setEnvironment(env);
      expect(authenticator.environment).toBe('example.com');
      expect(authenticator.basePath).toBe('https://api.example.com');
      expect(authenticator.authUrl).toBe('https://login.example.com');
    });

    it('should strip leading http://', () => {
      const env = 'http://example.com';
      authenticator.setEnvironment(env);
      expect(authenticator.environment).toBe('example.com');
      expect(authenticator.basePath).toBe('https://api.example.com');
      expect(authenticator.authUrl).toBe('https://login.example.com');
    });

    it('should strip leading api', () => {
      const env = 'api.example.com';
      authenticator.setEnvironment(env);
      expect(authenticator.environment).toBe('example.com');
      expect(authenticator.basePath).toBe('https://api.example.com');
      expect(authenticator.authUrl).toBe('https://login.example.com');
    });
  });

  describe('loginImplicitGrant()', () => {
    let _testTokenAccessSpy: jest.SpyInstance;
    let _saveSettingsSpy: jest.SpyInstance;
    let _authenticateViaPopupSpy: jest.SpyInstance;
    let parseOauthParamsSpy: jest.SpyInstance;

    beforeEach(() => {
      _testTokenAccessSpy = jest.spyOn(authenticator, '_testTokenAccess' as any).mockResolvedValue(null);
      _saveSettingsSpy = jest.spyOn(authenticator, '_saveSettings' as any);
      _authenticateViaPopupSpy = jest.spyOn(authenticator, '_authenticateViaPopup' as any).mockResolvedValue(null);
      parseOauthParamsSpy = jest.spyOn(utils, 'parseOauthParams').mockReturnValue({});
    });

    it('should reject if we have an org but no provider', async () => {
      try {
        await authenticator.loginImplicitGrant({ org: 'my-org-id' });
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('opts.provider must be set if opts.org is set');
      }
    });

    it('should reject if we have a provider but no org', async () => {
      try {
        await authenticator.loginImplicitGrant({ provider: 'my-provider-id' });
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('opts.org must be set if opts.provider is set');
      }
    });

    it('should reject if we do not have a redirectUri and usePopupAuth', async () => {
      try {
        await authenticator.loginImplicitGrant();
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('redirectUri must be provided for implicit grant and not utilizing client-auth app for popup auth');
      }
    });

    it('should reject if hash has an error', async () => {
      const hash: IAuthData = {
        error: 'invalid_redirect',
        error_description: 'Bad redirect URI'
      };

      parseOauthParamsSpy.mockReturnValue(hash);

      try {
        await authenticator.loginImplicitGrant({ redirectUri: 'localhost/video' });
        fail('should have thrown');
      } catch (e) {
        expect(_saveSettingsSpy).toHaveBeenCalledWith({ ...hash, accessToken: undefined });
        expect(e.message).toBe(`[${hash.error}] ${hash.error_description}`);
      }
    });

    it('should resolve with auth data if there is a token in storage and it passed the test', async () => {
      const state = 'some/state';
      const hash: IAuthData = {
        accessToken: 'new-token'
      };

      parseOauthParamsSpy.mockReturnValue(hash);

      const authData = await authenticator.loginImplicitGrant({ redirectUri: 'localhost/video', state });

      expect(_saveSettingsSpy).toHaveBeenCalledWith(hash);
      expect(authData).toEqual({
        ...hash,
        state,
        error: undefined,
        error_description: undefined
      });
    });

    it('should reject if testing token failed, usePopupAuth is true, and we do not have localStorage', async () => {
      _testTokenAccessSpy.mockRejectedValue(new Error('token validation failed'));

      authenticator['hasLocalStorage'] = false;

      try {
        await authenticator.loginImplicitGrant({ usePopupAuth: true });
        fail('should have thrown');
      } catch (e) {
        expect(e.message).toBe('localStorage is unavailable. Cannot authenticate via popup window.');
      }
    });

    it('should call to authenticate using popup auth if we do not have a valid token', async () => {
      const expectedQuery: IAuthRequestParams = {
        client_id: encodeURIComponent(clientId),
        response_type: 'token'
      };

      const hash: IAuthData = {
        accessToken: 'new-token-from-popup'
      };

      _testTokenAccessSpy.mockRejectedValue(new Error('token validation failed'));
      _authenticateViaPopupSpy.mockResolvedValue(hash)

      const authData = await authenticator.loginImplicitGrant({ usePopupAuth: true });

      expect(authData).toBe(hash);
      expect(_authenticateViaPopupSpy).toHaveBeenCalledWith(expectedQuery, 15000);
      expect(_saveSettingsSpy).toHaveBeenCalledWith(hash);
    });

    it('should use passed in auth data instead of parsing the hash', async () => {
      const hash: IAuthData = {
        accessToken: 'new-token-from-popup',
        error: undefined,
        error_description: undefined
      };

      const authData = await authenticator.loginImplicitGrant({ usePopupAuth: true }, hash);

      expect(authData).toEqual(hash);
    });

    it('should redirect to login if we do not have a valid token', async () => {
      const options: ILoginOptions = {
        redirectUri: 'localhost:8888/my-app/',
        state: 'app/route',
        org: 'org-id',
        provider: 'something',
        usePopupAuth: false
      };

      const expectedQuery: IAuthRequestParams = {
        client_id: encodeURIComponent(clientId),
        response_type: 'token',
        redirect_uri: encodeURIComponent(options.redirectUri),
        state: encodeURIComponent(options.state),
        org: encodeURIComponent(options.org),
        provider: encodeURIComponent(options.provider)
      };

      const expectedUrl = authenticator['_buildAuthUrl']('oauth/authorize', expectedQuery as any);

      const replaceSpy = jest.spyOn(window.location, 'replace');
      _testTokenAccessSpy.mockRejectedValue(new Error('token validation failed'));

      try {
        await authenticator.loginImplicitGrant(options);
        fail('should have thrown');
      } catch (e) {
        expect(_authenticateViaPopupSpy).not.toHaveBeenCalled();
        expect(replaceSpy).toHaveBeenCalledWith(expectedUrl);
        expect(e.message).toBe(`Routing to login: "${expectedUrl}"`)
      }
    });
  });

  describe('clearAuthData()', () => {
    it('should remove current auth data', () => {
      const saveSpy = jest.spyOn(authenticator, '_saveSettings' as any);
      authenticator['hasLocalStorage'] = true;

      authenticator.clearAuthData();

      expect(saveSpy).toHaveBeenCalledWith({
        accessToken: undefined,
        state: undefined,
        tokenExpiryTime: undefined,
        tokenExpiryTimeString: undefined
      });
    });
  });

  describe('logout()', () => {
    it('should replace window location with logout url', () => {
      const logoutRedirectUri = 'https://example.com/login';

      authenticator.logout(logoutRedirectUri);

      expect(window.location.replace).toHaveBeenCalledWith(
        'https://login.mypurecloud.com/logout?&client_id=client-id&redirect_uri=https%3A%2F%2Fexample.com%2Flogin'
      );
    });
  });

  describe('setAccessToken()', () => {
    it('should set accessToken', () => {
      const saveSpy = jest.spyOn(authenticator, '_saveSettings' as any);
      const accessToken = 'new-security-token';

      authenticator.setAccessToken(accessToken);

      expect(saveSpy).toHaveBeenCalledWith({ accessToken });
    });
  });

  describe('paramToString()', () => {
    it('should return empty if falsy passed in', () => {
      expect(authenticator.paramToString()).toBe('');
      expect(authenticator.paramToString(null)).toBe('');
    });

    it('should return Date toJSON value', () => {
      const date = new Date();
      expect(authenticator.paramToString(date)).toBe(date.toJSON());
    });

    it('should return objects toString value', () => {
      const obj = { some: 'value' };
      expect(authenticator.paramToString(obj)).toBe(obj.toString());

      const str = 'stringy';
      expect(authenticator.paramToString(str)).toBe(str.toString());
    });
  });

  describe('buildUrl()', () => {
    it('should build full path and replace path params', () => {
      const path = 'video/{videoId}/endpoint/{part-of-path}';
      const options = { videoId: 'vid123' };

      expect(authenticator.buildUrl(path, options)).toBe(
        'https://api.mypurecloud.com/video/vid123/endpoint/%7Bpart-of-path%7D'
      );
    });
  });

  describe('callApi()', () => {
    it('should call api to test the token', async () => {
      const token = 'token-to-test';
      const callApiSpy = jest.spyOn(authenticator, 'callApi').mockResolvedValue(null);

      await authenticator.testAccessToken(token);

      expect(callApiSpy).toHaveBeenCalledWith('/api/v2/tokens/me', 'get', token);
    });
  });

  describe('callApi()', () => {
    it('should call using get request and passed in token', async () => {
      const token = 'my-token';
      const path = '/my/endpoint';
      const endpoint = createNock()
        .get(path)
        .matchHeader('Authorization', `Bearer ${token}`)
        .matchHeader('Content-Type', 'application/json')
        .reply(200);

      await authenticator.callApi(path, 'get', token);
      endpoint.done();
    });

    it('should call using post request and stored token', async () => {
      const token = 'my-token-2';
      const path = '/my/endpoint';
      const endpoint = createNock()
        .post(path)
        .matchHeader('Authorization', `Bearer ${token}`)
        .matchHeader('Content-Type', 'application/json')
        .reply(200);

      authenticator.setAccessToken(token);

      await authenticator.callApi(path, 'post');
      endpoint.done();
    });
  });

  describe('_debug()', () => {
    let debugSpy: jest.SpyInstance;
    beforeEach(() => {
      debugSpy = jest.spyOn(utils, 'debug').mockImplementation();
    });
    it('should do nothing if not in debug mode', () => {
      authenticator['_debug']('some', 'data');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should call through to logger to debug', () => {
      authenticator.config.debugMode = true;
      authenticator['_debug']('some', 'data');
      expect(debugSpy).toHaveBeenCalledWith('some', 'data');
    });
  });

  describe('_saveSettings()', () => {
    let setItemSpy: jest.SpyInstance;

    beforeEach(() => {
      setItemSpy = jest.spyOn(window.localStorage, 'setItem');
    });

    afterEach(() => {
      setItemSpy.mockRestore();
    });

    it('should save all fields (and not save state to storage)', () => {
      const data: IAuthData = {
        accessToken: 'token-to-save',
        state: 'app/url',
        error: 'BadError',
        error_description: 'something bad happened',
        tokenExpiryTime: 1234567890,
        tokenExpiryTimeString: '2021-12-12'
      };

      authenticator.config.persist = true;
      authenticator['hasLocalStorage'] = true;

      authenticator['_saveSettings'](data);

      expect(authenticator.authData).toEqual(data);
      expect(authenticator['authentications']['PureCloud OAuth'].accessToken).toBe(data.accessToken);

      const expected = { ...data };
      delete expected.state;
      expect(setItemSpy).toHaveBeenCalledWith(
        'gc_client_auth_data',
        JSON.stringify(expected)
      );
    });

    it('should not save unprovided, non-required fields', () => {
      const data: IAuthData = {
        accessToken: 'token-to-save',
        error: 'BadError',
        error_description: 'something bad happened',
      };

      authenticator.config.persist = true;
      authenticator['hasLocalStorage'] = true;

      authenticator['_saveSettings'](data);

      expect(authenticator.authData).toEqual(data);
      expect(authenticator['authentications']['PureCloud OAuth'].accessToken).toBe(data.accessToken);

      expect(setItemSpy).toHaveBeenCalledWith(
        'gc_client_auth_data',
        JSON.stringify(data)
      );
    });

    it('should not save if the config option is not set', () => {
      const data: IAuthData = {
        accessToken: 'token-to-save'
      };

      authenticator.config.persist = false;
      authenticator['hasLocalStorage'] = true;

      authenticator['_saveSettings'](data);

      expect(authenticator.authData).toEqual(data);
      expect(authenticator['authentications']['PureCloud OAuth'].accessToken).toBe(data.accessToken);

      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should not save if we do not have localStorage', () => {
      const data: IAuthData = {
        accessToken: 'token-to-save'
      };

      authenticator.config.persist = true;
      authenticator['hasLocalStorage'] = false;

      authenticator['_saveSettings'](data);

      expect(authenticator.authData).toEqual(data);
      expect(authenticator['authentications']['PureCloud OAuth'].accessToken).toBe(data.accessToken);

      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should handle errors', () => {
      const logSpy = jest.spyOn(console, 'error').mockImplementation();

      /* deleting this will cause an error */
      delete authenticator.authData;

      authenticator['_saveSettings']({});

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('_getId()', () => {
    it('should return set string with uuid', () => {
      expect(authenticator['_getId']().substr(0, 6)).toBe('gc-ca_');
    });
  });

  describe('_authenticateViaPopup()', () => {
    let openSpy: jest.SpyInstance;
    let eventListenerSpy: jest.SpyInstance;
    let localStorageSpy: jest.SpyInstance;
    let storageListener: (evt: StorageEvent) => void;

    beforeEach(() => {
      openSpy = jest.spyOn(window, 'open').mockImplementation();
      localStorageSpy = jest.spyOn(window.localStorage, 'setItem');
      eventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation((evt, listener: any) => {
        storageListener = listener;
      });
    });

    afterEach(() => {
      storageListener = null;
    });

    it('should authenticate using a Popup', async () => {
      const query: IAuthRequestParams = {
        client_id: clientId,
        response_type: 'token',
        // redirect_uri: 'localhost/something',
        state: 'some/state'
      };
      const mockStorageId = 'gc-ca_uuid';
      const authData: IAuthData = {
        accessToken: 'secure-token',
        state: 'some/state'
      };
      const mockStorageEventPayload = {
        key: authenticator.config.storageKey,
        newValue: JSON.stringify(authData),
        oldValue: undefined,
      };
      const mockStorageEvent = new StorageEvent('storage', mockStorageEventPayload);
      const loginUrl = authenticator['_buildAuthUrl']('oauth/authorize', {
        ...query,
        state: mockStorageId,
        redirect_uri: encodeURIComponent(`https://apps.${authenticator.environment}/client-auth`)
      });

      jest.spyOn(authenticator, '_getId' as any).mockReturnValue(mockStorageId);
      authenticator.config.debugMode = true;

      const promise = authenticator['_authenticateViaPopup']({ ...query }, 4000);

      expect(localStorageSpy).toHaveBeenCalledWith(mockStorageId, JSON.stringify({
        ...query,
        storageKey: authenticator.config.storageKey,
        debug: true
      }));
      expect(openSpy).toHaveBeenCalledWith(
        loginUrl,
        '_blank',
        'width=500px,height=500px,noreferrer,noopener,resizable,scrollbars,status'
      );

      /* simulate the event firing */
      storageListener(mockStorageEvent);

      const returnedAuthData = await promise;
      expect(returnedAuthData).toEqual(authData);
    });

    it('should timeout if an error occurs', async () => {
      const query: IAuthRequestParams = {
        client_id: clientId,
        response_type: 'token',
        redirect_uri: 'localhost/something',
        state: 'some/state'
      };
      const mockStorageId = 'gc-ca_uuid';
      const authData: IAuthData = {
        accessToken: 'secure-token',
        state: 'some/state'
      };
      const mockStorageEventPayload = {
        key: 'gc_client_auth_data',
        newValue: JSON.stringify(authData),
        oldValue: undefined,
      };

      jest.spyOn(authenticator, '_getId' as any).mockReturnValue(mockStorageId);

      // never fire the storage event
      // storageListener(mockStorageEvent);

      try {
        await authenticator['_authenticateViaPopup'](query, 4);
        fail('should have thrown');
      } catch (error) {
        expect(error instanceof TimeoutError).toBe(true);
        expect(error.message).toBe('Popup authentation timeout. It is possible that the popup was blocked or the login page encountered an error');
      }
    });
  });

  describe('_testTokenAccess()', () => {
    let callApiSpy: jest.SpyInstance;

    beforeEach(() => {
      callApiSpy = jest.spyOn(authenticator, 'callApi').mockResolvedValue(null);
    });

    it('should throw if token is not set', async () => {
      try {
        await authenticator['_testTokenAccess']();
        fail('should have thrown for lack of token');
      } catch (e) {
        expect(e.message).toBe('No access token provided.');
      }
    });

    it('should throw if calling the api fails', async () => {
      callApiSpy.mockRejectedValue(new Error('Unauthorized'));
      authenticator['authentications']['PureCloud OAuth'].accessToken = 'token-to-test';

      try {
        await authenticator['_testTokenAccess']();
        fail('should have thrown for API error');
      } catch (e) {
        expect(e.message).toBe('Unauthorized');
      }
    });
  });

  describe('_loadSettings()', () => {
    let getItemSpy: jest.SpyInstance;
    let setAccessTokenSpy: jest.SpyInstance;

    beforeEach(() => {
      getItemSpy = jest.spyOn(window.localStorage, 'getItem');
      setAccessTokenSpy = jest.spyOn(authenticator, 'setAccessToken');
    });

    afterEach(() => {
      window.localStorage.clear();
      jest.restoreAllMocks();
    });

    it('should do nothing if persist is not set', () => {
      authenticator.config.persist = false;

      authenticator['_loadSettings']();

      expect(getItemSpy).not.toHaveBeenCalled();
      expect(authenticator.authData).toEqual({});
    });

    it('should do nothing if does not have localStorege', () => {
      authenticator.config.persist = true;
      authenticator['hasLocalStorage'] = false;

      authenticator['_loadSettings']();

      expect(getItemSpy).not.toHaveBeenCalled();
      expect(authenticator.authData).toEqual({});
    });

    it('should load nothing if localStorage does not have auth data', () => {
      authenticator.config.persist = true;
      authenticator['hasLocalStorage'] = true;

      authenticator['_loadSettings']();

      expect(getItemSpy).toHaveBeenCalled();
      expect(setAccessTokenSpy).not.toHaveBeenCalled();
      expect(authenticator.authData).toEqual({});
    });

    it('should load auth data from localStorage and keep auth state', () => {
      const currentAuthData: IAuthData = {
        state: 'some/state',
        accessToken: 'current-token'
      };
      const savedAuthData: IAuthData = {
        accessToken: 'token-from-storage'
      };
      authenticator.config.persist = true;
      authenticator['hasLocalStorage'] = true;
      authenticator.authData = currentAuthData;
      window.localStorage.setItem(authenticator.config.storageKey, JSON.stringify(savedAuthData));

      authenticator['_loadSettings']();

      expect(getItemSpy).toHaveBeenCalled();
      expect(setAccessTokenSpy).toHaveBeenCalledWith(savedAuthData.accessToken);
      expect(authenticator.authData).toEqual({
        state: currentAuthData.state,
        accessToken: savedAuthData.accessToken
      });
    });
  });
});