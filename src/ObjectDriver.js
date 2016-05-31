import Rx from 'rxjs/Rx'

import Model from './Model'

/**
 * All get and set side effects to an object's properties are handled by this
 * driver.
 */
export default function makeObjectDriver(dataStore, dataSource) {
  // Save only supported data from external sources
  for (var key in dataStore) {
    if (dataSource[key]) {
      dataStore[key] = dataSource[key]
    }
  }

  const model = new Model(dataStore)
  return function objectDriver(newObject) {
    // If internally changed, save directly to dataStore to prevent infinite
    // loop of events.
    Object.assign(model, newObject)
    return {
      get(keys) {
        if (!keys) {
          throw new Error('ObjectDriver: No key given to get()')
        }
        keys = keys.split(' ')
        let observables = []
        for (let key of keys) {
          observables.push(model[key])
        }
        return Rx.Observable.combineLatest(...observables, function() {
          if (arguments.length === 1) {
            return arguments[0]
          }
          const result = {}
          let i = 0
          for (let key of keys) {
            result[key] = arguments[i++]
          }
          return result
        })
      },
      current(keys) {
        const result = {}
        for (let key of keys.split(' ')) {
          result[key] = model[key].state
        }
        return Rx.Observable.of(result)
      }
    }
  }
}
