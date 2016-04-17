import log from 'loglevel'
import Rx from 'rxjs/Rx'
import Model from './Model'

/**
 * Main public API. Binds driver and sink together.
 */
export default class State {
  /**
   * @param {object} stateConfig contains flow nodes
   * @return {object} interface of observerables
   */
  static create(sources) {
    //const driver = new StateDriver()
    //const sink = new StateSink()

    // Create new data store. Not exposed.
    const data = {
      // Last transition received
      transition: null,
      // Current node name
      current: null,
      // Complete graph of states
      nodes: null,
      // Previous states
      history: []
    }
    // Broadcasts when data properties are updated
    const dataSource = new Model(data)

    // Save data from external sources
    for (var key in data) {
      if (sources[key]) {
        dataSource[key] = sources[key]
      }
    }

    const saveStartNode = dataSource.nodes
      .map(({value}) => value.start)
      .map(current => dataSource.current = current)

    const validateTransition = changeEvent => {
      const transition = changeEvent.value
      const transitions = data.nodes[data.current].transitions
      if (!transitions) {
        if (transition) {
          throw new Error(`State: No transitions found for '${transition}' at` +
                          ` current state ${data.current}`)
        } else {
          // Transition back in history as the current node is an end node
          return {transition, forward: false}
        }
      }
      const nodeName = transitions[transition]
      if (!nodeName) {
        throw new Error(`State: Transition '${transition}' not available at ` +
                        `current state '${data.current}'`)
      }
      if (!data.nodes[nodeName]) {
        throw new Error(`State: Node '${nodeName}' not found on transition ` +
                        `'${transition}' at current state '${data.current}'`)
      }
      return {transition, forward: true}
    }

    // Skip initial undefined transition value
    const updateCurrentNodeOnTransition = dataSource.transition
      .skip(1)
      .map(validateTransition)
      .map(({transition, forward}) => {
        if (forward) {
          data.history.push(data.current)
          data.current = data.nodes[data.current].transitions[transition]
        } else {
          data.current = data.history.pop()
        }
      })

    // Parse and save starting node from data source only once
    saveStartNode.first().subscribe()
    updateCurrentNodeOnTransition.subscribe()

    return {
      /**
       * Expose data for testing
       * @return {object} internal data
       */
      _inspectData: () => data,

      /**
       * Transition current state to next node using given transition.
       * @param {string} transition name of transition to use on the current
       * node
       * @return {object} flow outcome if any exist, otherwise undefined
       */
      transition: transition => {dataSource.transition = transition},

      /**
       * Transition to the previous state.
       */
      previous: () => data.current = data.history.pop(),

      /**
       * Replace the current nodes set with the new nodes object.
       * @param {object} nodes New nodes to use
       */
      replace: nodes => dataSource.nodes = nodes
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
  }
}

// Driver
function intent(sources) {
  // actions
  return {
    // Saves config
    config: sources.config,
    // transition, meta => change data store
    next: sources.next,
    // meta => change data source
    previous: sources.previous
  }
}

// Return streams of results for each action
function model(actions) {
  return {
    // TODO: Maybe one model per action?
    // Provides config to data store
    config: actions.config.map(config => {
      // Validate config
    }),
    // Transform transition name to node name
  }
}

function dataStore(model$) {
  // Save model data back to data store, which feeds back as a source
}

/**
 * Stateless handling of events from sources.
 */
export class StateDriver {
  constructor(stateConfig) {
    this._nodes = stateConfig
    this._previous = null
    this._current = this._nodes[this._nodes.start]
    this._updateCurrentName(this._nodes.start)
  }

  /**
   * Transition current state to next node using given transition.
   * @param {string} transition name of transition to use on the current node
   * @return {object} cloned state
   */
  next(transition) {
    const transitions = this._current.transitions
    if (!transitions) {
      log.debug('No transitions in current node.')
    }

    const nextNodeName = transitions[transition]
    if (!nextNodeName) {
      let err = new Error(`No '${transition}' transition found at current ` +
                          `state '${this._current._name}'`)
      log.error(err.message)
      throw err
    }

    const nextNode = this._nodes[nextNodeName]
    if (!nextNode) {
      let err = new Error(`No '${nextNodeName}' state available to ` +
                          `transition to.`)
      log.error(err)
      throw err
    }

    this._previous = this._current
    this._current = this._nodes[nextNodeName]
    this._updateCurrentName(nextNodeName)
    return Object.assign({}, this._current)
  }

  // For debugging current node
  _updateCurrentName(name) {
    this._current._name = name
  }
}

export class StateSink {

}

export class Validator {
  constructor(stateConfig) {
  }
}
