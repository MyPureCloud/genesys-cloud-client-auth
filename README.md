[![Build Status](https://travis-ci.com/MyPureCloud/genesys-cloud-client-auth.svg?branch=main)](https://travis-ci.com/MyPureCloud/genesys-cloud-client-auth)
[![npm version](https://badge.fury.io/js/genesys-cloud-client-auth.svg)](https://badge.fury.io/js/genesys-cloud-client-auth)
[![codecov](https://codecov.io/gh/MyPureCloud/genesys-cloud-client-auth/branch/master/graph/badge.svg)](https://codecov.io/gh/MyPureCloud/genesys-cloud-client-auth)
[![dependabot-status](https://flat.badgen.net/dependabot/MyPureCloud/genesys-cloud-client-auth/?icon=dependabot)](https://dependabot.com)

# genesys-cloud-client-auth
Small, lightweight library and app to handle authentication for client applications. Big advantage is utilization of popup windows to authenticate apps within iframes.
This library only supports implicit logins for use within a front-end web application.

* [Install](#install)
* [Usage](#usage)
  * [Standard Usage](#usage)
  * [Popup Authentication (for Iframes)](#popup-auth)
* [API](#api)
* [Limitations](#limitations)


## Install
``` sh
npm add genesys-cloud-client-auth
# or
yarn add genesys-cloud-client-auth
```

Or you can download directly from the browser:

> NOTE: that since v1.0.0, you must specify the major version to download from the CDN. See v1.0.0's **BREAKING CHANGES** in the `CHANGELOG.md` for more details.

``` html
<!-- change out the domain if desired -->
<script src="https://apps.mypurecloud.com/client-auth/v1/genesys-cloud-client-auth.browser.min.js"></script>
```

## Usage
``` typescript
import { GenesysCloudClientAuthenticator, authenticatorFactory, IAuthData } from 'genesys-cloud-client-auth';

const clientId = 'Your Oauth ClientID';
const authenticator: GenesysCloudClientAuthenticator = authenticatorFactory(clientId, {
  /* these are the defaults */
  environment: 'mypurecloud.com',
  persist: false,
  storageKey: 'gc_client_auth_data',
  debugMode: false
});

authenticator.loginImplicitGrant({
  redirectUri: 'https://myapp.example.com/app/', // whatever valid redirect URI is configured for your Oauth client
  state: '', // optional state to return after authentication
  /* All optional – see the advanced usage and/or API section for these – defaults listed below */
  org: '',
  provider: '',
  usePopupAuth: false,
  popupTimeout: 15000
}).then((data: IAuthData) => {
  /* data will contain authentication information like accessToken */
}).catch(error => {
  /* authentication failed */
});
```

## Popup Auth
For applications that are iframed into a parent application, some identity providers will prevent authentication within an iframe using the `X-Frame-Options`. To work around this issue the iframed application can open a popup window and localStorage to perform the authentication.

#### Auth Flow Using Popup

```
Iframed App        Redirect App          Login
   |                    |                  |
   |------- (1) -------------------------->|
   |                    |                  |
   |                    |<------ (2) ------|
   |                    |                  |
   |<------ (3) --------|                  |
```

1. The Iframed app will initiate a login by opening a new popup window with the url to the login page. It will then setup a listener on localStorage events.
1. Once authenticated, the login page will redirect to the "Redirect App" (more on this below).
1. The Redirect App will parse the authentication data and save it to localStorage triggering a localStorage event which the Iframed App is listening on. The Redirect App should then close itself.

> IMPORTANT: If you are going to utilize the helper application located at `https://apps.{domain}/client-auth`, make sure to add it to your Oauth Client's approved redirects.

#### Popup Auth Usage
``` typescript
import { GenesysCloudClientAuthenticator, authenticatorFactory, IAuthData } from 'genesys-cloud-client-auth';

const clientId = 'Your Oauth ClientID';
const authenticator: GenesysCloudClientAuthenticator = authenticatorFactory(clientId, {
  environment: 'mypurecloud.com',
  persist: true, // this is required to use popup auth
  storageKey: 'gc_client_auth_data',
  debugMode: false // setting to `true` for popup auth will help with debugging
});

authenticator.loginImplicitGrant({
  // if left falsy, the `https://apps.{env}/client-auth/` app will be used for the redirectUri
  // else, your redirect will need to implement the parsing of the token (see next step)
  redirectUri: 'https://myapp.example.com/app/',
  usePopupAuth: true,
  popupTimeout: 15000 // default amount
}).then((data: IAuthData) => {
  /* data will contain authentication information like accessToken */
}).catch(error => {
  /* authentication failed */
  if (error.name === 'TIMEOUT_ERROR') {
    // this error will trigger after the `popupTimeout` expires without valid auth data saved
    //  this could be an indication that the user has popups blocked
    //  you will need to add application logic to handle these errors
  }
});
```

If you are not using the default redirect to `/client-auth`, then your redirect application can use the following function to perform the necessary parsing and saving to localStorage:

``` typescript
import { handleRedirectFromLogin } from 'genesys-cloud-client-auth';

try {
  // this will parse and save auth data to localStorage
  handleRedirectFromLogin();
} catch (error) {
  // it could error for multiple reasons.
  //  mainly, if the auth hash is not present
  //  or if there is no storage ID as the state field
}
```

It can also be used directly in the HTML:

``` html
<script src="https://apps.mypurecloud.com/client-auth/v1/genesys-cloud-client-auth.browser.min.js"></script>
<script>
try {
  GenesysCloudClientAuth.handleRedirectFromLogin();
  console.log('Successfully parsed params from hash');
} catch (error) {
  console.warn(`Error parsing auth params from hash – ${error.name}: "${error.message}"`);
}
</script>
```

The `redirectUri` is very important here. There are two options:
    1. If no `redirectUri` is provided, client-auth will redirect to `https://{domain}/client-auth`. If this method is used, make sure your Oauth client whitelists `https://{domain}/client-auth` as a valid redirectUri.
    1. If a `redirectUri` is provided, it can use the `handleRedirectFromLogin()` function listed below to perform the necessary parsing and saving to localStorage (more on that in step 2).

## API

### `authenticatorFactory()`
Factory function to generate a singleton instance of a ClientAuthenticator class.
 If an instance has already been created for passed in `clientId`, that instance
 will be returned _without_ updating the original configuration.

Declaration:
``` ts
authenticatorFactory: (clientId: string, config: Partial<IAuthenticatorConfig>) => GenesysCloudClientAuthenticator;
```

Params:
* `client: string` – Oauth Client ID
* `config: Partial<IAuthenticatorConfig>` – Optional; configuration for the ClientAuthenticator instance. Available options (with defaults):
    ``` ts
    interface IAuthenticatorConfig {
      /**
       * Genesys Cloud domain.
      * Defaults to: `'mypurecloud.com'`
      */
      environment: string;

      /**
       * Persist authentication data to localStorage.
      * Note: this is required if using popup authentication
      * Defaults to: `false`
      */
      persist: boolean;

      /**
       * Storage key to save auth data to localStorage.
      * Defaults to: `gc_client_auth_data`
      */
      storageKey: string;

      /**
       * Allow for extra console logs for debugging
      * Defaults to: `false`
      */
      debugMode: boolean;
    }
    ```

Returns: Singleton GenesysCloudClientAuthenticator instance

### GenesysCloudClientAuthenticator
Class to manage authentication and state. It is recommended to use the `authenticatorFactory` to construct a singleton instance of this class.

#### Properties

##### `authenticator.clientId`
Oauth client id

##### `authenticator.VERSION`
client-auth version

##### `authenticator.authData`
current authencation data for this instance. default is an empty object `{}`. Definition:
``` ts
interface IAuthData {
  /** access token received from login */
  accessToken?: string;
  /** optional state returned from login */
  state?: string;
  /** time at which the token expires */
  tokenExpiryTime?: number;
  /** time at which the token expires  in ISO string format */
  tokenExpiryTimeString?: string;
  /** error that may have occurred during login */
  error?: string;
  /** error description that may have occurred during login */
  error_description?: string;
}
```

##### `authenticator.config`
current configuration for this instance

##### `authenticator.environment`
current environment. Ex. `mypurecloud.com`.
> Note: do not update this property individually. Use `authenticator.setEnvironment(env: string)` if updating it is necessary.

##### `authenticator.basePath`
base api path – utilizing the `environment` varialbe

##### `authenticator.authUrl`
base auth path – utilizing the `environment` varialbe

#### Methods

##### `constructor()`
Construct a new Authenticator instance. It is recommended you use the `authenticatorFactory()` to construct a singleton for each necessary Oauth client.

Declaration:
``` ts
constructor (clientId: string, config: Partial<IAuthenticatorConfig> = {});
```

Params:
* `client: string` – Oauth Client ID
* `config: Partial<IAuthenticatorConfig>` – Optional; configuration for the ClientAuthenticator instance. See [authenticatorFactory()](#authenticatorfactory) for more details.

Returns: `GenesysCloudClientAuthenticator` instance

##### `authenticator.loginImplicitGrant()`
Initiates the implicit grant login flow. Will attempt to load the token from local storage, if enabled.

Declaration:
``` ts
loginImplicitGrant(opts?: ILoginOptions, existingAuthData?: IAuthData): Promise<IAuthData | undefined>;
```

Params:
* `opts: ILoginOptions` – Options to login with
    ``` ts
    interface ILoginOptions {
      /**
      * The redirect URI of the OAuth Implicit Grant client. Not needed if `usePopupAuth: true` _and_
      *  the consuming application wishes to use the standard redirect of genesys-cloud-client-auth
      *  standalone app.
      */
      redirectUri?: string;
      /**
      * Any state needed when returning from login
      */
      state?: string;
      /**
      * The organization name that would normally used when specifying an organization name when logging in.
      *  This is only used when a provider is also specified.
      */
      org?: string;
      /**
      * Authentication provider to log in with e.g. okta, adfs, salesforce, onelogin.
      *  This is only used when an org is also specified.
      */
      provider?: string;
      /**
      * Use a popup window to open to the login page.
      */
      usePopupAuth?: boolean;
      /**
      * Timeout for how long the auth pop should remain open before timing out
      *  and rejecting the loginImplicitGrant call. This is only used in conjunction
      *  with `usePopupAuth`.
      */
      popupTimeout?: number;
    }
    ```
* `existingAuthData?: IAuthData` – Optional; authentication data to use. default will be parsed from url hash

Returns: promise containing `IAuthData` (see [authenticator.authData](#authenticator.authData) for definition)

##### `authenticator.setEnvironment()`
Sets the environment, baseUrl, and authUrl used by the session

Declaration:
``` ts
setEnvironment(environment?: string): void;
```

Params:
* `environment?: string` –  (Optional, default "mypurecloud.com") Environment the instance uses, e.g. mypurecloud.ie, mypurecloud.com.au, etc.

Returns: void

##### `authenticator.clearAuthData()`
Will clear current auth data from localStorage.

> NOTE: this will _not_ log the user out. Using `logout()`
 for logging out

Declaration:
``` ts
clearAuthData(): void;
```

Params: none

Returns: void

##### `authenticator.logout()`
Clears auth data from localStorage and redirects the user to the GenesysCloud logout page

Declaration:
``` ts
logout(logoutRedirectUri?: string): void;
```

Params:
* `logoutRedirectUri?: string` – Optional, redirectUri to pass to the logout page

Returns: void

##### `authenticator.setAccessToken()`
Sets the access token on the authenticator instance and localStorage (if configured)

Declaration:
``` ts
setAccessToken(token: string): void;
```

Params:
* `token: string` – The access token

Returns: void

##### `authenticator.testAccessToken()`
Test an accessToken by using it to make an API call. It will resolve
 if the token is valid, and will reject if it is not valid.

Declaration:
``` ts
testAccessToken(token: string): Promise<any>;
```

Params:
* `token: string` – accessToken to test

Returns: promise that will resolve or reject depending on the validity of the token passed in

##### `authenticator.parseDate()`
Parses an ISO-8601 string representation of a date value.

Declaration:
``` ts
parseDate (str: string): Date;
```

Params:
* `str: string` – The date value as a string.

Returns: The parsed date object.

### `handleRedirectFromLogin()`
Helper function to parse the auth data opened from a popup authentication window.
 It will save the auth data to localStorage.

> Note: this will throw errors if it cannot parse or save the data correctly

Declaration:
``` ts
handleRedirectFromLogin: () => void;
```

Params: none

Returns: void

### `Utils`
Utility functions to supplement and extend usage.

#### `utils.parseOauthParams()`
Utility to parse the auth data returned from the login page and return
 authentication data as an object.

> Note: this will throw errors if it cannot parse or save the data correctly

Declaration:
``` ts
parseOauthParams: (hash?: string): IAuthData;
```

Params:
* `hash?: string` – Optional; hash to parse (default `window.location.hash`)

Returns: authentication data parsed from the passed in hash

#### `utils.tokenWasIssuedAt()`
Determine when a token was issued at by subtracting the validity
 time from the expires at time.

Declaration:
``` ts
tokenWasIssuedAt (expiresAtMs: number, expiresInMs: number): number;
```

Params:
* `expiresAtMs: number` – epoch time (in milliseconds) for when the token will expire
* `expiresInMs: number` – milliseconds for how long the token is valid for

Returns: milliseconds since epoch time

#### `utils.isIssuedTimeWithinTimeframe()`
Determine if a token was issued within a given timeframe window. Example may be:
 a token is received (either from localStorage or some other way) and you need
 to be able to tell if it was issued within the last 10 minutes. Use this function
 as follows:

``` ts
const tokenExpiryTime = 1624611600000; // "2021-06-25 09:00.000Z"
const tokenExpiresIn  = 86400000; // 1 day: meaning token was issuedAt "2021-06-24 09:00.000Z"
const timeframe = 600000; // 10 minutes
const startTime = 1624525260000; // "2021-06-24 09:01.000Z": 1 minute after issued time

const willBeTrue = isIssuedTimeWithinTimeframe(
 tokenExpiryTime,
 tokenExpiresIn,
 timeframe,
 startTime
);
```

Declaration:
``` ts
isIssuedTimeWithinTimeframe: (expiresAtMs: number, expiresInMs?: number, timeframe?: number, startTime?: number) => boolean;
```

Params:
* `expiresAtMs: number` – epoch time (in milliseconds) for when the token will expire
* `expiresInMs?: number` – Optional; milliseconds for how long the token is valid for (default 691199000)
* `timeframe?: number` – Optional; timeframe (in milliseconds) to check if the token was issued within
* `startTime?: number` – Optional; time to count `timeframe` back from (in epoch time). Default is `Date.now()`

Returns: boolean of whether the token was issued within the given timeframe (from now)

## Limitations
1. Most browsers will not allow the redirect app to close the window. They will log: `Scripts may close only the windows that were opened by them.` to the console and keep the window open.

## TODO
Need to add an "storage_key_expires_at" and then clean those up. So there aren't tons of `gc-ca_{uuid}`s in localStorage.
