import { v4 as uuid } from 'uuid';
import { parseOauthParams as _parseOauthParams } from '../../src/lib';
import {authenticatorFactory as _authenticatorFactory, GenesysCloudClientAuthenticator} from "../../src/lib/authenticator"
import { EmbeddedAppState, getEmbeddedAppState } from '../../src/lib/utils';
import {
    restoreHref, 
    handlePopupWindowRedirect as _handlePopupWindowRedirect,
    authenticate,
    Authenticated,
    AuthFailed,
    InPopupWindow,
    Redirecting,
    POPUP_AUTH_TIMEOUT_MS,
    getPreAuthFlowHref as _getPreAuthFlowHref,
    persistPreAuthFlowHref as _persistPreAuthFlowHref,
    clearAuthStateEntries as _clearAuthStateEntries
} from '../../src/lib/authenticate';


const APP_URL = 'https://apps.mypurecloud.com/agent-conversation-summary/';
export const OAUTH_CLIENT_ID = 'ba760f0a-f585-4f23-b483-45579b321006';
export const AUTH_DATA_STORAGE_KEY = 'conversation-summary-auth-data';

jest.mock('genesys-cloud-client-auth');
jest.mock('auth/redirectHandlers');
jest.mock('auth/storageHelpers');
jest.mock('auth/restoreHref');

const mocked = <T extends (...args: any[]) => any>(fn: T) => fn as jest.MockedFunction<T>;

const parseOauthParams = mocked(_parseOauthParams);
const authenticatorFactory = mocked(_authenticatorFactory);
const handlePopupWindowRedirect = mocked(_handlePopupWindowRedirect);
const getPreAuthFlowHref = mocked(_getPreAuthFlowHref);
const persistPreAuthFlowHref = mocked(_persistPreAuthFlowHref);
const clearAuthStateEntries = mocked(_clearAuthStateEntries);

describe('authenticate', () => {
    let mockWindow: jest.Mocked<Window>;
    let loginImplicitGrant: jest.MockedFunction<
        InstanceType<typeof GenesysCloudClientAuthenticator>['loginImplicitGrant']
    >;

    const mockAppUrl = (appState: Partial<EmbeddedAppState>) => {
        const url = new URL(APP_URL);
        const queryStr = new URLSearchParams({
            interactionId: uuid(),
            pcEnvironment: 'mypurecloud.com',
            locale: 'en-us',
            ...appState,
            usePopupAuth: JSON.stringify(!!appState.usePopupAuth)
        }).toString();
        url.hash = `#/?${queryStr}`;
        return url;
    };

    const setMockLocation = (url: URL) => {
        // The URL object isn't spreadable, so this util assigns the necessary props to location.
        const props = ['hash', 'href', 'hostname', 'origin', 'search'] as const;
        props.forEach(key => {
            (mockWindow.location as any)[key] = url[key];
        });
    };

    beforeEach(() => {
        mockWindow = {
            location: { replace: jest.fn() },
            localStorage: {
                setItem: jest.fn()
            },
            history: {
                replaceState: jest.fn()
            }
        } as any;
        loginImplicitGrant = jest.fn();
        authenticatorFactory.mockReturnValue({ loginImplicitGrant } as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should properly handle the popup window redirect state', async () => {
        const url = new URL(APP_URL);
        url.searchParams.set('authPopupWindow', 'true');
        setMockLocation(url);

        const appState = {} as EmbeddedAppState;
        parseOauthParams.mockReturnValueOnce({ accessToken: 'access-token' });
        handlePopupWindowRedirect.mockReturnValueOnce(appState);

        const result = (await authenticate(mockWindow, OAUTH_CLIENT_ID, AUTH_DATA_STORAGE_KEY)) as InPopupWindow;

        expect(result.state).toBe('popupWindow');
        expect(result.appState).toEqual(appState);
    });

    it('should handle returning from the same-window login flow', async () => {
        const { history, location, localStorage } = mockWindow;
        setMockLocation(new URL(APP_URL));

        const stateKey = uuid();
        const mockReturnHref = mockAppUrl({ usePopupAuth: false }).href;
        const expectedAppState = getEmbeddedAppState(mockReturnHref);
        parseOauthParams.mockReturnValueOnce({ state: stateKey, accessToken: 'access-token' });
        getPreAuthFlowHref.mockReturnValueOnce(mockReturnHref);
        loginImplicitGrant.mockResolvedValueOnce({ accessToken: 'access-token' });

        const result = (await authenticate(mockWindow, OAUTH_CLIENT_ID, AUTH_DATA_STORAGE_KEY)) as Authenticated;
        expect(result.state).toBe('authenticated');
        expect(result.accessToken).toBe('access-token');
        expect(result.appState).toEqual(expectedAppState);

        // We should retrieve the stored href to recover
        expect(getPreAuthFlowHref).toHaveBeenCalledTimes(1);
        expect(getPreAuthFlowHref).toHaveBeenCalledWith(localStorage, stateKey);

        // Expect that we call gc-auth lib with the right payload
        expect(authenticatorFactory).toHaveBeenCalledTimes(1);
        expect(authenticatorFactory).toHaveBeenCalledWith(OAUTH_CLIENT_ID, {
            persist: true,
            storageKey: 'conversation-summary-auth-data',
            environment: expectedAppState.env
        });
        expect(loginImplicitGrant).toHaveBeenCalledTimes(1);
        expect(loginImplicitGrant).toHaveBeenCalledWith({
            usePopupAuth: false,
            state: undefined,
            redirectUri: APP_URL,
            popupTimeout: POPUP_AUTH_TIMEOUT_MS
        });

        // Expect that we attempt to restore the right href
        expect(restoreHref).toHaveBeenCalledTimes(1);
        expect(restoreHref).toHaveBeenCalledWith({
            href: mockReturnHref,
            branch: undefined,
            location,
            history
        });

        // Expect that we clear any stored auth state
        expect(clearAuthStateEntries).toHaveBeenCalledTimes(1);
        expect(clearAuthStateEntries).toHaveBeenCalledWith(localStorage);
    });

    it('should trigger the same-window login flow and handle when the promise resolves', async () => {
        const { history, location, localStorage } = mockWindow;
        setMockLocation(mockAppUrl({ usePopupAuth: false }));

        const stateKey = uuid();
        const expectedAppState = getEmbeddedAppState(location.href);
        parseOauthParams.mockReturnValueOnce({});
        persistPreAuthFlowHref.mockReturnValueOnce(stateKey);
        loginImplicitGrant.mockResolvedValueOnce({ accessToken: 'access-token' });

        const result = (await authenticate(mockWindow, OAUTH_CLIENT_ID, AUTH_DATA_STORAGE_KEY)) as Authenticated;

        expect(result.state).toBe('authenticated');
        expect(result.accessToken).toBe('access-token');
        expect(result.appState).toEqual(expectedAppState);

        // Expect that we persist the current window's href
        expect(persistPreAuthFlowHref).toHaveBeenCalledTimes(1);
        expect(persistPreAuthFlowHref).toHaveBeenCalledWith(localStorage, location.href);

        // Expect that we call gc-auth lib with the right payload
        expect(authenticatorFactory).toHaveBeenCalledTimes(1);
        expect(authenticatorFactory).toHaveBeenCalledWith(OAUTH_CLIENT_ID, {
            persist: true,
            storageKey: 'conversation-summary-auth-data',
            environment: expectedAppState.env
        });
        expect(loginImplicitGrant).toHaveBeenCalledTimes(1);
        expect(loginImplicitGrant).toHaveBeenCalledWith({
            usePopupAuth: false,
            state: stateKey,
            redirectUri: APP_URL,
            popupTimeout: POPUP_AUTH_TIMEOUT_MS
        });

        // Expect that we attempt to restore the right href
        expect(restoreHref).toHaveBeenCalledTimes(1);
        expect(restoreHref).toHaveBeenCalledWith({
            href: location.href,
            branch: undefined,
            location,
            history
        });

        // Expect that we clear any stored auth state
        expect(clearAuthStateEntries).toHaveBeenCalledTimes(1);
        expect(clearAuthStateEntries).toHaveBeenCalledWith(localStorage);
    });

    it('should trigger the same-window login flow and return redirecting state', async () => {
        const { location } = mockWindow;
        setMockLocation(mockAppUrl({ usePopupAuth: false }));

        const stateKey = uuid();
        const expectedAppState = getEmbeddedAppState(location.href);
        const redirectError = new Error('Routing to login');
        parseOauthParams.mockReturnValueOnce({});
        persistPreAuthFlowHref.mockReturnValueOnce(stateKey);
        loginImplicitGrant.mockRejectedValueOnce(redirectError);

        const result = (await authenticate(mockWindow, OAUTH_CLIENT_ID, AUTH_DATA_STORAGE_KEY)) as Redirecting;
        expect(result.state).toBe('redirecting');
        expect(result.appState).toEqual(expectedAppState);
    });

    it('should trigger the popup-window login flow and handle when the promise resolves', async () => {
        const { history, location, localStorage } = mockWindow;
        setMockLocation(mockAppUrl({ usePopupAuth: true }));

        const stateKey = uuid();
        const expectedAppState = getEmbeddedAppState(location.href);
        parseOauthParams.mockReturnValueOnce({});
        persistPreAuthFlowHref.mockReturnValueOnce(stateKey);
        loginImplicitGrant.mockResolvedValueOnce({ accessToken: 'access-token' });

        const result = (await authenticate(mockWindow, OAUTH_CLIENT_ID, AUTH_DATA_STORAGE_KEY)) as Authenticated;

        expect(result.state).toBe('authenticated');
        expect(result.accessToken).toBe('access-token');
        expect(result.appState).toEqual(expectedAppState);

        // Expect that we persist the current window's href
        expect(persistPreAuthFlowHref).toHaveBeenCalledTimes(1);
        expect(persistPreAuthFlowHref).toHaveBeenCalledWith(localStorage, location.href);

        // Expect that we call gc-auth lib with the right payload
        expect(authenticatorFactory).toHaveBeenCalledTimes(1);
        expect(authenticatorFactory).toHaveBeenCalledWith(OAUTH_CLIENT_ID, {
            persist: true,
            storageKey: 'conversation-summary-auth-data',
            environment: expectedAppState.env
        });
        expect(loginImplicitGrant).toHaveBeenCalledTimes(1);
        expect(loginImplicitGrant).toHaveBeenCalledWith({
            usePopupAuth: true,
            state: stateKey,
            redirectUri: `${APP_URL}?authPopupWindow=true`,
            popupTimeout: POPUP_AUTH_TIMEOUT_MS
        });

        // Expect that we attempt to restore the right href
        expect(restoreHref).toHaveBeenCalledTimes(1);
        expect(restoreHref).toHaveBeenCalledWith({
            href: location.href,
            branch: undefined,
            location,
            history
        });

        // Expect that we clear any stored auth state
        expect(clearAuthStateEntries).toHaveBeenCalledTimes(1);
        expect(clearAuthStateEntries).toHaveBeenCalledWith(localStorage);
    });

    it('should return auth failed state if an error is thrown during login (pop-up blocked)', async () => {
        const { location } = mockWindow;
        setMockLocation(mockAppUrl({ usePopupAuth: true }));

        const expectedAppState = getEmbeddedAppState(location.href);
        const errorSpy = jest.spyOn(console, 'error').mockImplementationOnce(() => {});
        parseOauthParams.mockReturnValueOnce({});

        // Simulate a popup auth timeout error
        const error = { name: 'TIMEOUT_ERROR' };
        loginImplicitGrant.mockRejectedValueOnce(error);

        const result = (await authenticate(mockWindow, OAUTH_CLIENT_ID, AUTH_DATA_STORAGE_KEY)) as AuthFailed;

        expect(result.state).toBe('failed');
        expect(result.reason).toBe(error);
        expect(result.appState).toEqual(expectedAppState);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('Unable to authenticate', { reason: error });
    });
});
