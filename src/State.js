import {Observable} from 'rxjs/Observable'
import {Subject} from 'rxjs/Subject'
import 'rxjs/add/observable/fromPromise'
import 'rxjs/add/observable/merge'
import 'rxjs/add/operator/do'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/first'
import 'rxjs/add/operator/filter'
import 'rxjs/add/operator/mergeMap'
import 'rxjs/add/operator/single'
import 'rxjs/add/operator/skip'
import values from 'core-js/library/fn/object/values'

import Model from './Model'
import makeObjectDriver from './ObjectDriver'

/**
 * Main public API. Binds driver and sink together.
 */
export default class State {
  /**
   * @param {object} sources contains flow nodes
   * @return {object} interface of observerables
   */
  static create(sources) {
    // TODO: Directly pass to makeObjectDriver to prevent exposing.
    // Create new data store. Not exposed.
    const dataStore = {
      // Last transition received
      transition: null,
      // Current node name
      current: null,
      // Complete graph of states
      nodes: null,
      // Previous states
      history: [],
      // Last error
      error: null
    }
    // Stream of external API call events
    const externalCalls = new Subject()

    // Interface to communicate side effects (in the Object case, to and from
    // the data store)
    const drivers = {
      Object: makeObjectDriver(dataStore, sources),
      External: function(outputs) {
        externalObservable.next(outputs)
      }
    }

    // Broadcasts events to external listeners
    const externalObservable = new Subject()

    // Pass data sources to setup reducers that transform each side effect
    // intent to an output that would be applied to a sink (a data source that
    // generates side effects).
    
    // Starts drivers.Object with empty argument. Triggers first side
    // effect.
    const actions = intent(drivers.Object(),
                           externalCalls.asObservable(),
                           externalObservable)

    const state$ = model(actions)

    // Subscribes drivers to sinks. Event streams go live and become active.
    link(drivers, state$)

    return {
      /**
       * Expose data for testing
       * @return {object} internal data
       */
      _inspectData: () => dataStore,

      /**
       * Jumps to the state directly using the node name.
       */
      startAt: nodeName => externalCalls.next({
        key: 'current',
        value: nodeName,
      }),

      /**
       * Transition current state to next node using given transition.
       * @param {string} transition name of transition to use on the current
       * node
       */
      transition: transition => externalCalls.next({
        key: 'transition',
        value: transition
      }),

      /**
       * Transition to the previous state.
       */
      previous: () => externalCalls.next({
        key: 'previous'
      }),

      /**
       * Replace the current nodes set with the new nodes object.
       * @param {object} nodes New nodes to use
       */
      replace: nodes => externalCalls.next({
        key: 'replace',
        value: nodes
      }),

      on: (eventName, callback) => {
        return externalObservable.subscribe(event => {
          const {type, stateType} = event
          if (allEqual('ready', eventName, type) && stateType != 'branch') {
            return callback(event)
          }
          if (allEqual('error', eventName, type) && stateType != 'branch') {
            return callback(event)
          }
        })
      }
    }
  }
}

const allEqual = (base, ...args) => {
  for (let arg of args) {
    if (arg != base) {
      return false
    }
  }
  return true
}

const transitionToPreviousState = ({current, history, nodes}) => {
  // Pop history if moving back resulted in a branch node until a
  // state node is reached
  do {
    current = history.pop() || current
  } while (nodes[current].resolver)
  return {current, history, nodes}
}

const addToHistory = ({current, history, nodes}) => {
  // Don't save resolver nodes in history to allow simpler
  // transitions back
  if (!nodes[current].resolver) {
    // TODO: Potentially avoid history side effect at this step?
    history.push(current)
  }
  return {current, history, nodes}
}

const transitionByResolver = outputs => {
  // Support async outcome resolvers
  const {current, nodes} = outputs
  const currentNode = nodes[current]
  const props = currentNode.props

  const OutcomeResolver = currentNode.resolver
  if (typeof OutcomeResolver == 'function') {
    const resolver = new OutcomeResolver()
    // TODO: Handle outcome resolving errors
    const futureResult = new Promise(resolve => {
      resolver.then(outcome => {
        // Trigger transition change again (continue to given outcome)
        resolve({transition: outcome, ...outputs})
      })
    })
    return Observable.fromPromise(futureResult)
  } else {
    return Observable.of(outputs)
  }
}

// Translate external data source inputs/events to actions on our models
function intent(dataSource, externalCall) {
  return {
    Object: {
    saveStartNode: dataSource.get('nodes')
      .map(({value}) => ({current: value.start}))
      .first(),

    saveTransition: externalCall.filter(({key}) => key == 'transition')
      .map(mapValueStateToValue),

    previous: externalCall.filter(({key}) => key == 'previous')
      .map(() => ({}))
      .mergeMap(willMergeDependencies(dataSource, 'current history nodes'))
      .map(transitionToPreviousState),

    _saveCurrent: externalCall.filter(({key}) => key == 'current')
      .map(({value}) => ({incoming: value}))
      .mergeMap(willMergeDependencies(dataSource, 'current history nodes'))
      .map(({history, nodes, current, incoming}) => {
        addToHistory({current, history, nodes})
        return {current: incoming, history, nodes}
      })
      .mergeMap(transitionByResolver),

    saveNodes: externalCall.filter(({key}) => key == 'replace')
      .map(({value}) => ({nodes: value})),

    // Skip initial undefined transition value
    updateCurrentNodeOnTransition: dataSource.get('transition')
      .skip(1)
      .map(transition => mapToValues({transition}))
      .mergeMap(willMergeDependencies(dataSource, 'current nodes'))
      .map(validateAndSelectTransition)
      .mergeMap(result => {
        if (result instanceof Error) {
          return Observable.of({error: result})
        }
        return Observable.of(result)
          .mergeMap(willMergeDependencies(dataSource, 'current history nodes'))
          .map(({transition, transitions, forward, current, history, nodes}) => {
            // Add current state to history and set incoming state to current
            if (forward) {
              addToHistory({current, history, nodes})
              current = transitions[transition]
              return {history, current, nodes}
            } else {
              return transitionToPreviousState({current, history, nodes})
            }
          })
          .mergeMap(transitionByResolver)
      })
    },

    External: {
      // Broadcast to external listeners after the current node is updated.
      // Resolver nodes are not broadcasted as 'ready' events.
      notifyPostTransition: dataSource.get('current')
        .skip(1)
        .map(mapValueStateToValue)
        .mergeMap(willMergeDependencies(dataSource, 'nodes'))
        .map(({current, nodes}) => {
          const props = nodes[current].props
          const stateType = nodes[current].resolver ? 'branch' : 'state'
          return {type: 'ready', stateType, current, props}
      }),

      notifyError: dataSource.get('error')
        .skip(1)
        .map(mapValueStateToValue)
        .map(({error}) => {
          return {type: 'error', error}
        })
    }
  }
}

// Link each driver setup with actions back to each driver's sink.
const link = (drivers, sinks) => {
  for (const key in drivers) {
    sinks[key].subscribe(dataOutput => drivers[key](dataOutput))
  }
}

const mapToValues = modelValuesMap => {
  let result = {}
  for (const state of Object::values(modelValuesMap)) {
    result[state.key] = state.value
  }
  return result
}

const mapValueStateToValue = state => ({[state.key]: state.value})

/**
 * @return {function(object)} Callback maps current model dependencies to a
 * regular key-value map (discards state metadata)
 */
const willMergeDependencies = (dataSource, dependencies) =>
  // Output is the item emitted by an Observable
  output => dataSource.current(dependencies)
    .map(modelValuesMap => {
      return Object.assign(output, mapToValues(modelValuesMap))
    })

const validateAndSelectTransition = ({transition, current, nodes}) => {
  let transitions = nodes[current].transitions
  if (!transitions) {
    if (transition) {
      return new Error(`State: No transitions on current state ` +
                      `${current}. Transition given: '${transition}'`)
    } else {
      // Transition back in history as the current node is an end node
      return {transition, transitions, forward: false}
    }
  }
  // Allow transition reference string to link to another node's transitions
  if (typeof transitions == 'string') {
    const reference = transitions
    transitions = nodes[reference].transitions
  }
  const nodeName = transitions[transition]
  if (!nodeName) {
    return new Error(`State: Transition '${transition}' not available at ` +
                    `current state '${current}'`)
  }
  if (!nodes[nodeName]) {
    return new Error(`State: Node '${nodeName}' not found on transition ` +
                    `'${transition}' at current state '${current}'`)
  }
  return {transition, transitions, forward: true}
}

// Returns resulting state from actions.
function model(actions) {
  let state$ = {}
  for (const actionContainerKey in actions) {
    state$[actionContainerKey] = Observable.merge(
      ...Object::values(actions[actionContainerKey])
    )
  }
  return state$
}

// map external data -> data store
// map data store change intent -> action
// map action side effects -> data store

// map external state config
//    -> data store
//    -> side effect -> save state config to data store
//
//    state = new State(config)
//    const model = new Model({
//      data keys
//    })
//    model.nodes.subscribe()
//
//
// map data store state config change
//    -> action: extract model info from data store to initialize state
//    -> side effect -> none
//
// map action to extract model info and data store (source)
//    -> model representing initial state/pointers
//    -> side effect -> none
//
// map model
//    -> data store
//    -> side effect -> save model to data store

// External passes in:
// object of public actions each mapped to an Observable that provides
// events e.g. {
//   config: stateConfig$  // Stream of state configs
//   next: transition$     // Stream of transitions
// }
// Potentially if people don't want to use streams, we could create streams
// for them to use...
//
// Driver maps each source to the corresponding stream handler to turn into
// a model
//

// Data store emits change events
//const actions = intent(sources)
//const state$ = model(actions)

// Saves next nodes to data store
