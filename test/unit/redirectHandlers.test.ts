import { handlePopupWindowRedirect } from "./../../src/lib/handlePopupWindowRedirect";
import {
  getEmbeddedAppState,
  getPreAuthFlowHref as getPreAuthFlowHrefNonMock,
} from "./../../src/lib/utils";
import { handleRedirectFromLogin as _handleRedirectFromLogin } from "./../../src/lib/parse-redirect";
import { v4 as uuid } from "uuid";

jest.mock("./../../src/lib/utils", () => {
  const original = jest.requireActual("../../src/lib/utils");
  return {
    _esModule: true,
    ...original,
    getPreAuthFlowHref: jest.fn(),
    parseOauthParams: jest.fn(),
  };
});

jest.mock("../../src/lib/parse-redirect");

const getPreAuthFlowHref = getPreAuthFlowHrefNonMock as jest.MockedFunction<
  typeof getPreAuthFlowHrefNonMock
>;

const handleRedirectFromLogin = _handleRedirectFromLogin as jest.MockedFunction<
  typeof _handleRedirectFromLogin
>;

describe("redirectHandlers", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handlePopupWindowRedirect", () => {
    const mockStorage: jest.Mocked<Storage> = { getItem: jest.fn() } as any;

    it("should throw an error if `state` not found in auth data", () => {
      try {
        handlePopupWindowRedirect(mockStorage, {});
      } catch (err) {
        expect(err.message).toBe("could not find `state` hash param");
      }
    });

    it("should throw an error if we cannot find gc-client-auth state in storage", () => {
      mockStorage.getItem.mockReturnValueOnce(null);
      try {
        handlePopupWindowRedirect(mockStorage, { state: uuid() });
      } catch (err) {
        expect(err.message).toBe("could not find gc-auth state stored locally");
      }
    });

    it("should throw an error if we cannot parse the gc-client-auth state", () => {
      mockStorage.getItem.mockReturnValueOnce(JSON.stringify({}));
      try {
        handlePopupWindowRedirect(mockStorage, { state: uuid() });
      } catch (err) {
        expect(err.message).toBe(
          "could not parse our popup auth state key from gc-auth state entry"
        );
      }
    });

    it("should handle a popup window redirect", () => {
      const gcAuthState = uuid();
      const ourState = uuid();
      const accessToken = "some-access-token";
      const href =
        "https://apps.mypurecloud.com/agent-conversation-summary/#/?interactionId=abc&locale=en-us&pcEnvironment=mypurecloud.com";

      mockStorage.getItem.mockReturnValueOnce(
        JSON.stringify({ state: ourState })
      );
      getPreAuthFlowHref.mockReturnValueOnce(href);

      const authData = {
        accessToken,
        state: gcAuthState,
      };

      const result = handlePopupWindowRedirect(mockStorage, authData);

      expect(result).toEqual(getEmbeddedAppState(href));
      expect(getPreAuthFlowHref).toHaveBeenCalledTimes(1);
      expect(getPreAuthFlowHref).toHaveBeenCalledWith(mockStorage, ourState);
      expect(handleRedirectFromLogin).toHaveBeenCalledTimes(1);
    });
  });
});
