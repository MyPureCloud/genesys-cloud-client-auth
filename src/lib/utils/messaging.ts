import { Complete, PubSubEvent, InProgress, Failure } from './interfaces';
import { debug, testForLocalStorage } from './utils';


export class LocalStoragePubSub {
  private _storageListenerRef: any;
  private _listeners: ((event: PubSubEvent) => void)[] = [];
  private _sentMessages: string[] = [];

  constructor (public key: string) {
    testForLocalStorage();
    this._setupListener();
  }

  on (callback: (event: PubSubEvent) => void) {
    const index = this._listeners.findIndex(l => l === callback);
    if (!index) {
      this._listeners.push(callback);
    }
  }

  off (callback?: (event: PubSubEvent) => void) {
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

  isCompleteEvent (event: PubSubEvent | Complete): event is Complete {
    return event && event.event === 'COMPLETE';
  }

  isInProgressEvent (event: PubSubEvent | InProgress): event is InProgress {
    return event && event.event === 'IN_PROGRESS';
  }

  isFailureEvent (event: PubSubEvent | Failure): event is Failure {
    return event && event.event === 'FAILURE';
  }

  _write (event: PubSubEvent) {
    if (!this.key) {
      return debug('cannot publish messages since PubSub client has stopped processing', { event });
    }

    const stringified = JSON.stringify(event);
    this._sentMessages.push(stringified);
    if (this._sentMessages.length > 3) {
      this._sentMessages.shift();
    }

    debug('writing value', { key: this.key, event, stringified });
    localStorage.setItem(this.key, stringified);
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

    /* if we sent the message from this pub/sub client, we want to ignore it */
    // const strValue = JSON.stringify(newValue);
    if (this._sentMessages.includes(newValue || 'DOES-NOT-EXIST')) {
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
}
