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
      history: []
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
       * Support jumps for testing.
       */
      _current: current => externalCalls.next({
        key: 'current',
        value: current,
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
        externalObservable.subscribe(event => {
          if (eventName == 'ready' && event.type == 'ready') {
            callback(event)
          }
        })
      }
    }
  }
}

const transitionToPreviousState = ({current, history}) => {
  return ({current: history.pop() || current})
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
      .mergeMap(willMergeDependencies(dataSource, 'current history'))
      .map(transitionToPreviousState),

    _saveCurrent: externalCall.filter(({key}) => key == 'current')
      .map(mapValueStateToValue),

    saveNodes: externalCall.filter(({key}) => key == 'replace')
      .map(({value}) => ({nodes: value})),

    // Skip initial undefined transition value
    updateCurrentNodeOnTransition: dataSource.get('transition')
      .skip(1)
      .map(transition => mapToValues({transition}))
      .mergeMap(willMergeDependencies(dataSource, 'current nodes'))
      .map(validateAndSelectTransition)
      .mergeMap(willMergeDependencies(dataSource, 'current history'))
      .map(({transition, transitions, forward, history, current}) => {
        if (forward) {
          // TODO: Potentially avoid history modification at this step?
          history.push(current)
          current = transitions[transition]
          return {history, current}
        } else {
          // TODO: Transition to previous state with resolver
          return transitionToPreviousState({current, history})
        }
      })
      .mergeMap(willMergeDependencies(dataSource, 'nodes'))
      .mergeMap(outputs => {
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
      })
    },

    External: {
      // Broadcast to external listeners after the current node is updated
      notifyPostTransition: dataSource.get('current')
        .skip(1)
        .map(mapValueStateToValue)
        .mergeMap(willMergeDependencies(dataSource, 'nodes'))
        .map(({current, nodes}) => {
          const props = nodes[current].props
          return {type: 'ready', props}
      })
    }
  }
}

// Link each driver setup with actions back to each driver's sink.
const link = (drivers, sinks) => {
  for (const key in drivers) {
    sinks[key].subscribe(dataOutput => {
      drivers[key](dataOutput)
    })
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
      throw new Error(`State: No transitions on current state ` +
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
    throw new Error(`State: Transition '${transition}' not available at ` +
                    `current state '${current}'`)
  }
  if (!nodes[nodeName]) {
    throw new Error(`State: Node '${nodeName}' not found on transition ` +
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
