import { parseOauthParams } from '../../src/lib';
import { debug, isIssuedTimeWithinWindow } from '../../src/lib/utils';
import VERSION from '../../src/lib/version';

describe('utils', () => {
  describe('parseOauthParams()', () => {
    it('should correctly parse the hash from the url', () => {
      const expiresIn = 1000;
      const hash = `#access_token=myaccesstoken&state=app%2Froute&expires_in=${expiresIn}`;

      const returnedHash = parseOauthParams(hash);

      expect(returnedHash).toEqual({
        accessToken: 'myaccesstoken',
        state: 'app/route',
        tokenExpiryTime: expect.any(Number),
        tokenExpiryTimeString: expect.any(String)
      });
      expect(returnedHash.tokenExpiryTime).toBeCloseTo((new Date()).getTime() + (expiresIn * 1000), -2);
    });

    it('should return errors if present', () => {
      const error = 'bad_auth';
      const error_description = 'Authenication failed';

      window.location.href = `http://localhost:8000/oauth/#error=${error}&error_description=${encodeURIComponent(error_description)}`;

      const returnedHash = parseOauthParams();

      expect(returnedHash).toEqual({
        error,
        error_description
      });
    });

    it('should not pass back state or expire times', () => {
      const accessToken = 'my-token';
      window.location.href = `http://localhost:8000/oauth/#access_token=${accessToken}`;

      const returnedHash = parseOauthParams();

      expect(returnedHash).toEqual({ accessToken });
    });

    it('should return an empty object if no oauth params', () => {
      window.location.href = `http://localhost:8000/oauth/#&donotcountme`;
      const returnedHash = parseOauthParams();

      expect(returnedHash).toEqual({});
    });
  });

  describe('debug()', () => {
    let consoleSpy: jest.SpyInstance;
    const debugColor = 'color: #f29f2c';

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should log message with details', () => {
      const message = 'I am a message';
      const details = true;

      debug(message, details);

      expect(consoleSpy).toHaveBeenCalledWith(`%c [DEBUG:gc-client-auth:${VERSION}] ${message}`, debugColor, details);
    });

    it('should log message with details and stringify it', () => {
      const message = 'I am a message';
      const details = [{ obj: 1 }, { anotherObj: 2 }];

      debug(message, details);

      expect(consoleSpy).toHaveBeenNthCalledWith(1, `%c [DEBUG:gc-client-auth:${VERSION}] ${message}`, debugColor, details);
      expect(consoleSpy).toHaveBeenNthCalledWith(2, `%c [DEBUG:gc-client-auth:${VERSION}] ^ stringified: ${JSON.stringify(details)}`, debugColor);
    });

    it('should log message without details', () => {
      const message = 'I am a message';

      debug(message);

      expect(consoleSpy).toHaveBeenCalledWith(`%c [DEBUG:gc-client-auth:${VERSION}] ${message}`, debugColor);
    });
  });

  describe('isIssuedTimeWithinWindow()', () => {
    it('should return `true` issue time is within window', () => {
      const issuedAt = Date.now();
      const expiresInMs = 1000;
      const expiresAtMs = issuedAt + expiresInMs;
      const windowMs = 1110;

      expect(isIssuedTimeWithinWindow(expiresAtMs, expiresInMs, windowMs)).toBe(true);
    });

    it('should return `false` issue time is outside window', () => {
      const issuedAt = Date.now() - 1000;
      const expiresInMs = 10000;
      const expiresAtMs = issuedAt + expiresInMs;
      const windowMs = 900;

      expect(isIssuedTimeWithinWindow(expiresAtMs, expiresInMs, windowMs)).toBe(false);
    });

    it('should use defaults', () => {
      const issuedAt = Date.now() - 1000; // 27 minutes ago
      const expiresAtMs = issuedAt + 691199000;
      // const expiresInMs = 691199000;
      // const windowMs = 1680 * 1000;

      expect(isIssuedTimeWithinWindow(expiresAtMs)).toBe(true);
    });
  });
});