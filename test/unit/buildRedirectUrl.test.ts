import { buildRedirectUrl } from './../../src/lib/utils';

const LOCAL_URL = new URL('https://localhost:3000/#/?interactionId=foo&locale=en-us');
const PROD_URL = new URL(
    'https://apps.mypurecloud.com/agent-conversation-summary/#/?interactionId=foo&locale=en-us'
);

describe('buildRedirectUrl', () => {
    [
        {
            description: 'builds the right url for prod same-window flow',
            url: PROD_URL.href,
            usePopupAuth: false,
            expectedRedirectUrl: `${PROD_URL.origin}/agent-conversation-summary/`
        },
        {
            description: 'builds the right url for prod popup-window flow',
            url: PROD_URL.href,
            usePopupAuth: true,
            expectedRedirectUrl: `${PROD_URL.origin}/agent-conversation-summary/?authPopupWindow=true`
        },
        {
            description: 'builds the right url for local same-window flow',
            url: LOCAL_URL.href,
            usePopupAuth: false,
            expectedRedirectUrl: `${LOCAL_URL.origin}/`
        },
        {
            description: 'builds the right url for local popup-window flow',
            url: LOCAL_URL.href,
            usePopupAuth: true,
            expectedRedirectUrl: `${LOCAL_URL.origin}/?authPopupWindow=true`
        }
    ].forEach(({ description, url, usePopupAuth, expectedRedirectUrl }) => {
        it(description, () => {
            const redirectUrl = buildRedirectUrl({ usePopupAuth, location: new URL(url) });
            expect(redirectUrl).toBe(expectedRedirectUrl);
        });
    });
});
