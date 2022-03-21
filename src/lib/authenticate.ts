import { handleRedirectFromLogin } from './parse-redirect';
import { EmbeddedAppState, getEmbeddedAppState, parseOauthParams, getQueryParams, buildRedirectUrl } from "./utils";
import { v4 as uuid } from 'uuid';
import { authenticatorFactory } from "./authenticator";
import { IAuthData } from "./types";

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
        debugMode:true,
        useUpdatedPopupAuthFlow:true
    });

    try {
        const authData = await authenticator.loginImplicitGrant({
            usePopupAuth,
            state: stateKey,
            redirectUri: buildRedirectUrl({ usePopupAuth, location }),
            // Shorten our popup timeout to 5s so the agent isn't looking at a blank screen
            // for 15s, this is also right outside our interapptions bootstrap timeout,
            // so the app should show and immediately render 'Auth Failed'
            popupTimeout: POPUP_AUTH_TIMEOUT_MS
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

export const handlePopupWindowRedirect = (storage: Storage, authData: IAuthData) => {
    // Retrieve the state set by `genesys-cloud-client-auth`
    if (!authData.state) throw new Error('could not find `state` hash param');
    const gcAuthState = storage.getItem(authData.state);
    if (!gcAuthState) throw new Error('could not find gc-auth state stored locally');
    const { state: popupAuthState } = JSON.parse(gcAuthState);
    if (!popupAuthState || typeof popupAuthState !== 'string') {
        throw new Error('could not parse our popup auth state key from gc-auth state entry');
    }
    const href = getPreAuthFlowHref(storage, popupAuthState);

    handleRedirectFromLogin();

    return getEmbeddedAppState(href);
};

const STATE_KEY_PREFIX = 'cs-auth';

export const createStateKey = () => {
    return [STATE_KEY_PREFIX, uuid()].join('-');
};

export const persistPreAuthFlowHref = (storage: Pick<Storage, 'setItem'>, href: string) => {
    const stateKey = createStateKey();
    storage.setItem(stateKey, href);
    return stateKey;
};

export const getPreAuthFlowHref = (storage: Pick<Storage, 'getItem'>, key: string) => {
    const href = storage.getItem(key);
    if (!href) throw new Error('unable to find auth state stored locally');
    return href;
};

export const clearAuthStateEntries = (storage: Storage) => {
    Object.keys(storage)
        .filter(key => key.startsWith(STATE_KEY_PREFIX))
        .forEach(key => storage.removeItem(key));
};

export const extractAccessToken = (authData?: IAuthData) => {
    if (!authData) throw new Error('Invalid auth data');
    if (!authData.accessToken) throw new Error('Unable to extract access token');
    return authData.accessToken;
};

interface RestoreHrefProps {
    href: string;
    branch?: string;
    location: Pick<Location, 'href' | 'pathname' | 'replace'>;
    history: Pick<History, 'replaceState'>;
}

/**
 * Restores our pre-auth href if necessary and possibly reloads the window
 * using a time machine branch
 */
export const restoreHref = ({ href, branch, location, history }: RestoreHrefProps) => {
    if (branch && !location.pathname.includes(branch)) {
        // If branch build and we're not on the branch, do a full reload
        // to pull the branch build from S3
        location.replace(href);
    } else if (location.href !== href) {
        // Otherwise, we can just restore the window's old href
        history.replaceState(null, '', href);
    }
};
