# revir

[![Build Status](https://img.shields.io/travis/talee/revir.svg?style=flat-square)](https://travis-ci.org/talee/revir)
[![Build Dependencies](https://img.shields.io/david/talee/revir.svg?style=flat-square)](https://david-dm.org/talee/revir)
[![Coveralls](https://img.shields.io/coveralls/talee/revir.svg?style=flat-square)](https://coveralls.io/github/talee/revir?branch=master)

Experimental state/flow manager with async branching, subflows, and history.

## Interface

### Setup all possible states

    const states = {
        start: 'EmployeeList',
        EmployeeList: {
          transitions: {
            'Add employee': 'AddEmployee'
          },
        },
        AddEmployee: {
          transitions: {
            'View employee list': 'EmployeeList'
          }
        }
    }

### Use

A state spec object is passed to Revir for it to understand all the possible
states it can transition to. The returned state instance can then transition to
various states via the given string.

	// states declared above

    const state = new Revir({states})
    // Current state is now at 'EmployeeList' node

    state.transition('Add employee')
    // Current state is now at 'AddEmployee' node

    state.transition('View employee list')
    // Current state is now back at 'EmployeeList' node

### Events

To know when a state transition has completed and the state is ready for
transitions, developers can add a callback that will be called with the props
property set on a state node. A ready callback could be used to notify view
renderers or routing.

	const states = {
		...
		EmployeeList: {
			props: {
				layout: 'modal'
			}
			...
		}
	}
	...
	state.on('ready', event => {
		// Props set on a state node will be passed
		let props = event.props
		// props would be {layout: 'modal'}
	})

Since transitions are async, error events are also broadcasted.

	state.on('error', event => {
		let error = event.error
	})

### Branching

Most of the time the app always transitions from state A to state B. However,
flows somtimes need to branch based on server or database values or A/B testing.

Outcome resolvers are set on a state node to decide what state to continue to.
An outcome resolver is a function returning a Promise that resolves to a
transition string. The transition string is then used the same way as if
`state.transition(transitionString)` was called.
	
	function AddEmployeeResolver() {
		return new Promise((resolve) => {
			// Run some logic to determine which outcome to resolve to.
			setTimeout(() => resolve('First time add'))
		})
	}

    const states = {
        start: 'EmployeeList',
        EmployeeList: {
          transitions: {
            'Add employee': 'EnterAddEmployee'
          }
        },
		EnterAddEmployee: {
			resolver: AddEmployeeResolver,
			transitions: {
				'First time add': 'FirstTimeAddEmployee'
				'Continue': 'AddEmployee'
			}
		},
        AddEmployee: {
          transitions: {
            'View employee list': 'EmployeeList'
          }
        },
        FirstTimeAddEmployee: {
          transitions: {
            'View employee list': 'EmployeeList'
          }
        }
    }

	let state = new Revir({states})
	state.transition('Add employee')

	// State goes from 'EmployeeList' -> 'EnterAddEmployee'

	// The outcome resolver function FirstTimeAddEmployee eventually resolves to
	// the outcome 'First time add'

	// State is now FirstTimeAddEmployee

### Jumps

Transitions make it clear what states the app can continue to. However,
sometimes the app needs to imperatively signal the state to start at e.g. when
the user navigates to a particular URL. Jumps allow the app to pass the node
name to go to. Jumps should NOT be used to transition between states as this
makes the flow unclear.

	state.startAt('TaxCenter')

The node specified can be a branch node to check permissions or valid state etc.

### Reference

Schema and example of states: [states.js](tests/states.js)
