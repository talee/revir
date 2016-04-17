import State from './State'

export default class Revir {
  constructor(config) {
    if (!config || typeof config.states != 'object') {
      throw new Error('Revir: config.states is an required object')
    }
    this._states = State.create({nodes: config.states})
    // Expose State interface
    for (var key in this._states) {
      this[key] = this._states[key]
    }
  }
}
