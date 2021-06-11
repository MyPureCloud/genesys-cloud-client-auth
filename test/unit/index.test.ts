import {
  authenticatorFactory,
  GenesysCloudClientAuthenticator,
  IAuthenticatorConfig
} from '../../src/lib/index';

describe('Index', () => {
  describe('authenticatorFactory()', () => {
    it('should construct and return an anthenticator', () => {
      const clientId = 'my-client-id';
      const config: IAuthenticatorConfig = {
        environment: 'api.example.com',
        persist: true,
        storageKey: 'some_key',
        debugMode: false
      };

      const authenticator = authenticatorFactory(clientId, config);

      expect(authenticator instanceof GenesysCloudClientAuthenticator).toBe(true);
      expect(authenticator.clientId).toBe(clientId);
      expect(authenticator.config).toEqual(config);
    });

    it('should only construct one anthenticator per clientId', () => {
      const clientId = 'my-client-id';
      const config: IAuthenticatorConfig = {
        environment: 'api.example.com',
        persist: true,
        storageKey: 'some_key',
        debugMode: false
      };

      const authenticator1 = authenticatorFactory(clientId, config);
      const authenticator2 = authenticatorFactory(clientId, config);

      expect(authenticator1).toBe(authenticator2);
    });
  });
});