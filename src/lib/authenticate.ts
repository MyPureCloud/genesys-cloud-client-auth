import { EmbeddedAppState, getEmbeddedAppState, parseOauthParams, getQueryParams, buildRedirectUrl, persistPreAuthFlowHref, clearAuthStateEntries, restoreHref, getPreAuthFlowHref } from "./utils";
import { authenticatorFactory } from "./authenticator";
import { IAuthData } from "./types";
import { handlePopupWindowRedirect } from "./handlePopupWindowRedirect";

export const POPUP_AUTH_TIMEOUT_MS = 5000;

export interface Authenticated {
    state: 'authenticated';
    accessToken: string;
    appState: EmbeddedAppState;
}

export interface InPopupWindow {
    state: 'popupWindow';
    appState: EmbeddedAppState;
}

export interface AuthFailed {
    state: 'failed';
    reason: string;
    appState: EmbeddedAppState;
}

export interface Redirecting {
    state: 'redirecting';
    appState: EmbeddedAppState;
}

export type AuthResponse = Authenticated | AuthFailed | InPopupWindow | Redirecting;

/**
 * This method attempts to determine the state of the window to either:
 * 1. Determine if we have a valid access token in localStorage, if so, immediately return state = 'authenticated'.
 * 2. Trigger the appropriate login flow (redirect/popup).
 * 3. Parse the auth response from login and restore the previous state of the window.
 *   a. If the window is a popup window, then state = 'inPopupWindow'.
 *   b. If we originally loaded a time machine branch, then reload the window to that branch.
 *   c. Restore all previous hash + query params that were on the original window.
 */
export const authenticate = async ({
    history,
    location,
    localStorage
}: Pick<Window, 'history' | 'location' | 'localStorage'>, oathClientID: string, authDataStoragekey: string): Promise<AuthResponse> => {

    

    const oauthParams = parseOauthParams(location.hash);
    const { authPopupWindow } = getQueryParams(location.search);
    const isPopupWindow = authPopupWindow === 'true';

    if (isPopupWindow) {
        const appState = handlePopupWindowRedirect(localStorage, oauthParams);
        return { state: 'popupWindow', appState };
    }

    let stateKey: string | undefined;
    let appState: EmbeddedAppState;
    if (oauthParams.state) {
        // If we are returning from login, we need to get our env params from the
        // previous href (we which stored in localStorage with the key in state)
        appState = getEmbeddedAppState(getPreAuthFlowHref(localStorage, oauthParams.state));
    } else {
        // Otherwise, we can get the state from the current href
        // and persist the href before we begin the login flow
        appState = getEmbeddedAppState(location.href);
        stateKey = persistPreAuthFlowHref(localStorage, location.href);
    }

    const { env, href, branch, usePopupAuth } = appState;
    const authenticator = authenticatorFactory(oathClientID, {
        persist: true,
        storageKey: authDataStoragekey,
        environment: env,
        useUpdatedPopupAuthFlow:true
    });

    try {
        const authData = await authenticator.loginImplicitGrant({
            usePopupAuth,
            state: stateKey,
            redirectUri: buildRedirectUrl({ usePopupAuth, location }),
        });

        restoreHref({ href, branch, location, history });

        clearAuthStateEntries(localStorage);

        return {
            state: 'authenticated',
            accessToken: extractAccessToken(authData),
            appState
        };
    } catch (reason: any) {
        if (reason.message?.includes('Routing to login')) {
            return { state: 'redirecting', appState };
        }

        console.error('Unable to authenticate', { reason });
        return { state: 'failed', appState, reason };
    }
};





export const extractAccessToken = (authData?: IAuthData) => {
    if (!authData) throw new Error('Invalid auth data');
    if (!authData.accessToken) throw new Error('Unable to extract access token');
    return authData.accessToken;
};