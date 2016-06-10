import should from 'should'
import {spy} from 'sinon'
import 'should-sinon'

import Revir from '../src/Revir'
import State from '../src/State'
import states from './states'
import Model from '../src/Model'

const expect = should

describe('Model', function() {
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

  it('transactions should only notify after a commit completes', () => {
    const data = {prop: 'first', size: 'small'}
    const model = new Model(data)
    const onChange = spy(function() {
      data.prop.should.equal('second')
      data.size.should.equal('medium')
    })
    model.prop.skip(1).subscribe(onChange)
    model.size.skip(1).subscribe(onChange)
    model.commit({size: 'medium', prop: 'second'})
    onChange.should.be.calledTwice()
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
    state._current('EditEmployee')
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

  it('should support async transitions and pass state props to listeners',
    done => {
    state._inspectData().current.should.equal('EmployeeList')
    const handleReady = event => {
      try {
        state._inspectData().current.should.equal('RunPayroll')
        event.props.layout.should.equal('trowser')
        done()
      } catch(err) {
        done(err)
        throw err
      }
    }
    state.on('ready', handleReady)
    // Transitions to EnterRunPayroll then RunPayroll
    state.transition('Enter run payroll')
  })

  it('should pass state name to listeners', done => {
    const handleReady = spy(({current}) => {
      try {
        current.should.equal('EditEmployee')
        done()
      } catch (err) {
        done(err)
      }
    })
    state.on('ready', handleReady)
    state.transition('Edit employee')
    handleReady.should.be.calledOnce()
  })

  it('should pass state type to listeners', done => {
    const handleReadyA = spy(({stateType}) => {
      try {
        stateType.should.equal('state')
      } catch (err) {
        done(err)
      }
    })
    let subscription = state.on('ready', handleReadyA)
    state.transition('Add employee')
    subscription.unsubscribe()

    // Reset
    state.transition('View employee list')
    state._inspectData().current.should.equal('EmployeeList')

    const handleReadyB = spy(({stateType}) => {
      try {
        // Branch nodes are not broadcasted
        stateType.should.equal('state')
        state._inspectData().current.should.equal('RunPayroll')
        subscription.unsubscribe()
        done()
      } catch (err) {
        done(err)
      }
    })
    subscription = state.on('ready', handleReadyB)
    state.transition('Enter run payroll')
    handleReadyA.should.be.calledOnce()
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
