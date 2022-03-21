import { restoreHref } from './../../src/lib/authenticate';

const APP_URL = 'https://apps.mypurecloud.com/agent-conversation-summary';

describe('restoreHref', () => {
    it('should do a full reload if we should be on a time machine branch, but are not', () => {
        const branch = 'feature/foo-branch';
        const currentHref = `${APP_URL}/#/`;
        const hrefToRestore = `${APP_URL}/${branch}/#/`;
        const location = { href: currentHref, pathname: '/', replace: jest.fn() };

        restoreHref({ branch, href: hrefToRestore, location, history: { replaceState: () => {} } });

        expect(location.replace).toBeCalledTimes(1);
        expect(location.replace).toHaveBeenCalledWith(hrefToRestore);
    });

    it('should call history.replaceState if we are already on the branch, but href is different', () => {
        const branch = 'feature/foo-branch';
        const currentHref = `${APP_URL}/${branch}/#/`;
        const hrefToRestore = `${APP_URL}/${branch}/#/?interactionId=foo`;
        const history = { replaceState: jest.fn() };

        restoreHref({
            branch,
            href: hrefToRestore,
            location: { pathname: `/${branch}`, href: currentHref, replace: () => {} },
            history
        });

        expect(history.replaceState).toBeCalledTimes(1);
        expect(history.replaceState).toHaveBeenCalledWith(null, '', hrefToRestore);
    });

    it('should call history.replaceState if no branch and href is different', () => {
        const currentHref = `${APP_URL}/#/`;
        const hrefToRestore = `${APP_URL}/#/?interactionId=foo`;
        const history = { replaceState: jest.fn() };

        restoreHref({
            href: hrefToRestore,
            location: { pathname: '/', href: currentHref, replace: () => {} },
            history
        });

        expect(history.replaceState).toBeCalledTimes(1);
        expect(history.replaceState).toHaveBeenCalledWith(null, '', hrefToRestore);
    });

    it('should not do anything if our current window href === the href to restore', () => {
        const currentHref = `${APP_URL}/feature/foo-branch/#/`;
        const history = { replaceState: jest.fn() };
        const location = { pathname: '/feature/foo-branch', href: currentHref, replace: jest.fn() };

        restoreHref({
            href: currentHref,
            location,
            history
        });

        expect(history.replaceState).not.toHaveBeenCalled();
        expect(location.replace).not.toHaveBeenCalled();
    });
});
