import { MockLocalStorage, MockWindowLocation } from './utils/test-utils';
import { randomUUID } from 'crypto';

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

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID }
});

