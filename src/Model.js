import Rx from 'rxjs/Rx'

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
    Object.keys(data).forEach(key => {
      // Emits current value on subscription
      const subject = new Rx.BehaviorSubject({
        value: data[key],
        prev: undefined,
        key
      })
      Object.defineProperty(this, key, {
        enumerable: true,
        set(value) {
          const prev = data[key]
          data[key] = value
          subject.next({value, prev, key})
        },
        get() {
          // Proxy listener interface to subscribers
          const observable = subject.asObservable()
          // Check in case subject interface changes in the future
          if (observable.state !== undefined) {
            throw new Error('Model - subject.state is already defined.')
          }
          Object.defineProperty(observable, 'state', {
            get: () => subject.getValue()
          })
          return observable
        },
      })
    })
  }
}
