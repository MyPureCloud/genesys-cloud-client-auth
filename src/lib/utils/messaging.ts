import { CompleteEvent, PubSubEvent, InProgressEvent, FailureEvent, AuthData, InProgressBody, CompleteBody, FailureBody } from './interfaces';
import { debug, testForLocalStorage } from './utils';

export class LocalStoragePubSub {
  private _storageListenerRef: any;
  private _listeners: ((event: PubSubEvent) => void)[] = [];
  private _lastEvent?: PubSubEvent;

  constructor (public key: string) {
    testForLocalStorage();
    this._setupListener();
    this._loadInitialValue();
  }

  subscribe (callback: (event: PubSubEvent) => void) {
    const index = this._listeners.findIndex(l => l === callback);
    if (!index) {
      this._listeners.push(callback);

      /* replay the last event */
      const lastEvent = this.getLastEventEmitted();
      lastEvent && callback(lastEvent);
    }
  }

  unsubscribe (callback?: (event: PubSubEvent) => void) {
    if (!callback) {
      this._listeners = [];
    }

    const index = this._listeners.findIndex(l => l === callback);
    if (index) {
      this._listeners.splice(index, 1);
    }
  }

  emit (event: PubSubEvent): void {
    this._listeners.forEach(cb => cb(event));
  }

  done () {
    localStorage.removeItem(this.key);
    this._removeListener();
    this.key = '';
  }

  getLastEventEmitted (): PubSubEvent | undefined {
    return this._lastEvent
  }

  replayLastEvent (): void {
    const lastEvent = this.getLastEventEmitted();

    debug('replaying lastEvent from storage PubSub', {
      storageKey: this.key,
      lastEvent
    });

    lastEvent && this.emit(lastEvent);
  }

  isCompleteEvent (event?: PubSubEvent | CompleteEvent): event is CompleteEvent {
    return event?.event === 'COMPLETE';
  }

  isInProgressEvent (event?: PubSubEvent | InProgressEvent): event is InProgressEvent {
    return event?.event === 'IN_PROGRESS';
  }

  isFailureEvent (event?: PubSubEvent | FailureEvent): event is FailureEvent {
    return event?.event === 'FAILURE';
  }

  writeInProgressEvent (body: InProgressBody) {
    this._write({ event: 'IN_PROGRESS', body });
  }

  writeCompleteEvent (body: CompleteBody) {
    this._write({ event: 'COMPLETE', body });
  }

  writeFailureEvent (body: FailureBody) {
    this._write({ event: 'FAILURE', body });
  }

  _write (event: PubSubEvent) {
    if (!this.key) {
      return debug('cannot publish messages since PubSub client has stopped processing', { event });
    }

    const stringified = JSON.stringify(event);

    debug('writing value', { key: this.key, event, stringified });
    localStorage.setItem(this.key, stringified);
  }

  _emitAuthData (authData: AuthData) {
    const event: CompleteEvent = { event: 'COMPLETE', body: { authData } };
    authData && this._storageListener({ key: this.key, newValue: JSON.stringify(event), oldValue: '' } as StorageEvent);
  }

  private _removeListener () {
    window.removeEventListener('storage', this._storageListenerRef);
    this._storageListenerRef = null;
  }

  private _setupListener () {
    this._removeListener();
    this._storageListenerRef = this._storageListener.bind(this);
    window.addEventListener('storage', this._storageListenerRef);
  }

  private _storageListener (evt: StorageEvent) {
    const { key, newValue, oldValue } = evt;

    debug('value was just written to storage by another app', {
      ourKey: this.key,
      eventKey: key,
      newValue,
      oldValue
    });

    if (key !== this.key) {
      return;
    }

    const value = JSON.parse(newValue || '{}') as PubSubEvent;

    if (
      this.isCompleteEvent(value) ||
      this.isInProgressEvent(value) ||
      this.isFailureEvent(value)
    ) {
      debug('keys matched. processing value', { key, newValue });
      this.emit(value);
    }
  }


  private _loadInitialValue () {
    const value = localStorage.getItem(this.key);
    debug('processing localStorage value on LocalStoragePubSub initialization', {
      storageKey: this.key,
      value
    });
    value && this._storageListener({ key: this.key, newValue: value, oldValue: '' } as StorageEvent);
  }
}
