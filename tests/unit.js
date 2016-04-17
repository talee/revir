import Rx from 'rxjs/Rx'
import should from 'should'
import {spy} from 'sinon'
import 'should-sinon'

//import Main from '../src/main'
//import State from '../src/State'
//import states from './states'
import Model from '../src/Model'

const expect = should

describe('Model', function() {
  this.timeout(100)
  it('should notify subscribers of changes to its properties', () => {
    const newConfig = Object.freeze({start: 'New'})
    const initialConfig = Object.freeze({start: 'Initial'})
    const data = {config: initialConfig}
    const model = new Model(data)

    // Subscribe to when data.config is replaced
    let initialCall = true
    const onConfigReplace = spy(({value, prev}) => {
      value.should.eql(initialCall ? initialConfig : newConfig)
      if (initialCall) {
        should.equal(prev, undefined)
      } else {
        prev.should.eql(initialConfig)
      }
      initialCall = false
    })
    model.config.subscribe(onConfigReplace)
    onConfigReplace.should.be.calledOnce()

    // Replace config to trigger new value event
    model.config = newConfig
    onConfigReplace.should.be.calledTwice()
  })

  it('should return a property value via model.key.state.value', () => {
    const model = new Model({answer: 42})
    model.answer.state.value.should.equal(42)
  })
})

/*
describe('State', function() {
  this.timeout(1000)
  it('should save nodes', () => {
    const state = new State()
    state.create({
      nodes: states
    })
    state._inspectData().nodes.should.eql(states)
  })
})
*/

/*
describe('Main', function() {
  it('should support _config', () => {
    const main = new Main({yolo: 'nice'})
    main._config.should.have.property('yolo')
  })
})

describe('States', function() {
  it('has a start node', () => {
    states.should.have.property('start').which.is.a.String()
    states.should.have.property(states.start)
  })
})

describe('Transitions', function() {
  it('has transition names mapped to node names', () => {
    let transitions = states.EmployeeList.transitions
    Object.keys(transitions).forEach(name => {
      let nodeName = transitions[name]
      nodeName.should.be.a.String()
      states.should.have.property(nodeName).which.is.an.Object()
    })
  })
})

describe('State', function() {
  var state
  beforeEach(() => {
    state = new State(states)
  })

  it('transitions to next state', () => {
    state.next('Run payroll').should.eql(state._nodes.RunPayroll)
    state._current.should.equal(state._nodes.RunPayroll)
  })

  it('transitions to previous state when no transitions are defined on a node',
  () => {
    state.next('Run payroll')
    state.next().should.eql(state._nodes.EmployeeList)
  })
})
*/
