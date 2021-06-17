import { handleRedirectFromLogin } from '../../src/lib/parse-redirect';
import * as Utils from '../../src/lib/utils';

describe('parse-redirect', () => {
  describe('handleRedirectFromLogin()', () => {
    let getItemSpy: jest.SpyInstance;
    let setItemSpy: jest.SpyInstance;
    let windowCloseSpy: jest.SpyInstance;
    let debugSpy: jest.SpyInstance;

    beforeEach(() => {
      getItemSpy = jest.spyOn(window.localStorage, 'getItem');
      setItemSpy = jest.spyOn(window.localStorage, 'setItem');
      windowCloseSpy = jest.spyOn(window, 'close');
      debugSpy = jest.spyOn(Utils, 'debug').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw if there are errors', () => {
      window.location.href = 'http://localhost:8000/app/#error=bad-things&error_description=oops';

      try {
        handleRedirectFromLogin();
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('[bad-things]: oops');
      }
    });

    it('should if there is no accessToken', () => {
      window.location.href = 'http://localhost:8000/app/#someparams=true';

      try {
        handleRedirectFromLogin();
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('No access token provided.');
      }
    });

    it('should throw if there is no state', () => {
      window.location.href = 'http://localhost:8000/app/#access_token=my-token';

      try {
        handleRedirectFromLogin();
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('No state param on redirect. Unable to determine location to save auth data.');
      }
    });

    it('should throw if there is no item in localStorage', () => {
      window.location.href = 'http://localhost:8000/app/#access_token=my-token&state=gc-ca_id';

      try {
        handleRedirectFromLogin();
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('Unable to parse information from localStorage.');
      }
    });

    it('should throw if there is no storageKey from the data in localStorage', () => {
      const storageId = 'gc-ca_id'
      window.location.href = `http://localhost:8000/app/#access_token=my-token&state=${storageId}`;

      localStorage.setItem(storageId, JSON.stringify({}));
      try {
        handleRedirectFromLogin();
        fail('should have thrown');
      } catch (error) {
        expect(error.message).toBe('Unable to parse information from localStorage.');
      }
    });

    it('should save to localStorage and close the window', () => {
      const storageId = 'gc-ca_id';
      const state = 'some/state/in/app';
      const accessToken = 'my-token';
      const storageKey = 'my_app_auth_data';

      window.location.href = `http://localhost:8000/app/#access_token=${accessToken}&state=${storageId}`;

      localStorage.setItem(storageId, JSON.stringify({ storageKey, state }));

      handleRedirectFromLogin();

      expect(setItemSpy).toHaveBeenCalledWith(storageKey, JSON.stringify({  state, accessToken }));
      expect(window.close).toHaveBeenCalled();
    });

    it('should not use state if not present and not close the window if in debug mode', () => {
      const storageId = 'gc-ca_id';
      const accessToken = 'my-token';
      const storageKey = 'my_app_auth_data';

      window.location.href = `http://localhost:8000/app/#access_token=${accessToken}&state=${storageId}`;

      localStorage.setItem(storageId, JSON.stringify({ storageKey, debug: true }));

      handleRedirectFromLogin();

      expect(setItemSpy).toHaveBeenCalledWith(storageKey, JSON.stringify({  accessToken }));
      expect(window.close).not.toHaveBeenCalled();
    });
  });
});