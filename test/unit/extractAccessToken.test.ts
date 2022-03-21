import { extractAccessToken } from './../../src/lib/authenticate';

describe('extractAccessToken', () => {
    it('should throw an error if no auth data', () => {
        try {
            extractAccessToken();
            fail('An error should have been thrown');
        } catch (err) {
            expect(err.message).toBe('Invalid auth data');
        }
    });

    it('should throw an error if auth data does not contain an access token', () => {
        try {
            extractAccessToken({ state: 'some-string' });
            fail('An error should have been thrown');
        } catch (err) {
            expect(err.message).toBe('Unable to extract access token');
        }
    });

    it('should extract the access token from auth data', () => {
        const result = extractAccessToken({ accessToken: 'some-access-token' });
        expect(result).toBe('some-access-token');
    });
});
