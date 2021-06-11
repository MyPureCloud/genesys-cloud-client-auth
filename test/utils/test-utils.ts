import nock from 'nock';

export function createNock (hostUri?: string): nock.Scope {
  return nock(hostUri || 'https://api.mypurecloud.com');
}

export class MockWindowLocation {
  private _url: URL = new URL('https://apps.inindca.com/');

  get href (): string {
    return this._url.toString();
  }

  set href (url: string) {
    this._url = new URL(url);
  }

  get protocol (): string {
    return this._url.protocol;
  }

  get host (): string {
    return this._url.host;
  }

  get hostname (): string {
    return this._url.hostname;
  }

  get origin (): string {
    return this._url.origin;
  }

  get port (): string {
    return this._url.port;
  }

  get pathname (): string {
    return this._url.pathname;
  }

  get hash (): string {
    return this._url.hash;
  }

  get search (): string {
    return this._url.search;
  }

  replace (url: string): void {
    this.href = url;
  }

  assign (url: string): void {
    this.href = url;
  }

  reload () { }

  toString (): string {
    return this._url.toString();
  }
}

export class MockLocalStorage {
  private store: { [key: string]: string };

  constructor () {
    this.store = {};
  }

  clear () {
    this.store = {};
  }

  getItem (key: string): string | undefined {
    return this.store[key];
  }

  setItem (key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem (key: string) {
    delete this.store[key];
  }
}
