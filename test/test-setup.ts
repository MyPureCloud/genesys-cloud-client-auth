import { MockLocalStorage, MockWindowLocation } from './utils/test-utils';

/* mock window.location */
Object.defineProperty(window, 'location', {
  value: new MockWindowLocation(),
  writable: true
});

/* mock window.localStorage */
Object.defineProperty(window, 'localStorage', {
  value: new MockLocalStorage(),
  writable: true
});