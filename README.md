# revir

[![Build Status](https://img.shields.io/travis/talee/revir.svg?style=flat-square)](https://travis-ci.org/talee/revir)
[![Build Dependencies](https://img.shields.io/david/talee/revir.svg?style=flat-square)](https://david-dm.org/talee/revir)

Experiment

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

    const revir = new Revir({states})
    // Current state is now at 'EmployeeList' node

    revir.transition('Add employee')
    // Current state is now at 'AddEmployee' node

    revir.transition('View employee list')
    // Current state is now back at 'EmployeeList' node

### Reference

Schema and example of states: [states.js](tests/states.js)
