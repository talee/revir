import {BehaviorSubject} from 'rxjs/BehaviorSubject'

/**
 * Emit newly set properties on subscribed property data streams
 */
export default class Model {
  /**
   * @constructor
   * @param {object} data Properties to observe and emit change events on
   * subscribers to this Model instance.
   */
  constructor(data) {
    this._committing = false
    this._txEventQueue = []
    Object.keys(data).forEach(key => {
      if (key == 'commit') {
        throw new Error(`Model: 'commit' is a reserved property`)
      }
      // Emits current value on subscription
      const subject = new BehaviorSubject({
        value: data[key],
        prev: undefined,
        key
      })
      Object.defineProperty(this, key, {
        enumerable: true,
        set(value) {
          const prev = data[key]
          // Prevent infinite event loop
          if (prev === value) {
            return
          }
          data[key] = value
          if (this._committing) {
            this._txEventQueue.push(() => subject.next({value, prev, key}))
          } else {
            subject.next({value, prev, key})
          }
        },
        get() {
          // Proxy listener interface to subscribers
          const observable = subject.asObservable()
          // Check in case subject interface changes in the future
          if (observable.state !== undefined) {
            throw new Error('Model: subject.state is already defined.')
          }
          Object.defineProperty(observable, 'state', {
            get: () => subject.getValue()
          })
          return observable
        }
      })
    })
  }

  /**
   * Save data to model as a transaction. No events are fired off until data has
   * been commited and the transaction is complete.
   * @param {object} dataTx data matching schema given on model construction
   */
  commit(dataTx) {
    this._committing = true
    if (dataTx && dataTx.commit) {
      throw new Error(`Model: 'commit' is a reserved property`)
    }
    Object.assign(this, dataTx)
    while (this._txEventQueue.length) {
      this._txEventQueue.pop()()
    }
    this._committing = false
  }
}
