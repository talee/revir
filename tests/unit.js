import Rx from 'rxjs/Rx'
import should from 'should'
import {spy} from 'sinon'
import 'should-sinon'

import Revir from '../src/Revir'
import State from '../src/State'
import states from './states'
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

describe('State', function() {
  var state
  beforeEach(() => {
    state = State.create({
      nodes: states
    })
  })

  it('should save nodes', () => {
    state._inspectData().nodes.should.eql(states)
  })

  it('should set current state to the start node of the given nodes', () => {
    state._inspectData().current.should.eql(states.start)
  })

  it('replacing with new nodes should update internal nodes', () => {
    const expectedNodes = {
      start: 'NewStart',
      NewStart: {}
    }
    state.replace(expectedNodes)
    state._inspectData().nodes.should.equal(expectedNodes)
    state._inspectData().current.should.not.equal(expectedNodes.start)
  })

  it('transitions to next state', () => {
    should.equal(state.transition('Run payroll'), undefined)
    state._inspectData().current.should.equal('RunPayroll')
  })

  it('transitions to next state via transition reference string', () => {
    state._inspectData().current = 'EditEmployee'
    state.transition('Edit W-4')
    state._inspectData().current.should.equal('W4')
  })

  it('transitions to previous state when no transitions are defined on a node',
  () => {
    state.transition('Run payroll')
    state.transition()
    state._inspectData().current.should.equal('EmployeeList')
  })

  it('transitions to previous state multiple times', () => {
    const data = state._inspectData()
    state.transition('Add employee')
    state.transition('Edit W-4')
    data.current.should.equal('W4')

    state.previous()
    data.current.should.equal('AddEmployee')
    state.previous()
    data.current.should.equal('EmployeeList')
  })

  it('should not transition to previous state when no history exists', () => {
    state._inspectData().current.should.equal('EmployeeList')
    state.previous()
    state._inspectData().current.should.equal('EmployeeList')
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

  it(`can reference another node's transitions`, () => {
    let transitionReference = states.EditEmployee.transitions
    transitionReference.should.be.a.String()
    states[transitionReference].should.eql(states.AddEmployee)
  })
})

describe('Revir', function() {
  it('exposes State interface with correct scope', () => {
    const revir = new Revir({
      states
    })
    should.equal(revir.transition('Run payroll'), undefined)
    revir._states._inspectData().current.should.equal('RunPayroll')
  })
})
