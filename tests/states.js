// TODO: Polyfill Promise to allow older clients
function RunPayrollResolver() {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve('Ready'), 2)
  })
}

export default {
  // Which node to start at
  start: 'EmployeeList',

  // SYNTAX
  //
  // NODE:
  //
  // 'node name': {
  //   ...
  //   transitions: {
  //     'transition name': 'node name to transition to',
  //     ... to n transitions etc.
  //   }
  // }
  //
  // 'node name': {
  //   ...
  //   transitions: 'node name. refers to same transitions as in given node'
  // }
  //
  // 'node name': {
  //   ...
  //   resolver: function() {return Promise.resolve('transition name')}
  //   props: {...}
  //   transitions: {...}
  // }
  //
  // ... to n nodes etc.
  //
  // Missing transitions object indicates this is an end node of a flow. Next
  // transition is either back a node or if currently in a subflow, the node
  // that started the subflow.

  EmployeeList: {
    transitions: {
      'Add employee': 'AddEmployee',
      'Edit employee': 'EditEmployee',
      'Run payroll': 'RunPayroll',
      'View tax center': 'TaxCenter',
      'Enter run payroll': 'EnterRunPayroll'
    },
  },

  AddEmployee: {
    transitions: {
      'Edit W-4': 'W4',
      'View employee list': 'EmployeeList'
    }
  },

  EditEmployee: {
    transitions: 'AddEmployee'
  },

  W4: {
  },

  TaxCenter: {
    transitions: {
      'Enter run payroll': 'EnterRunPayroll',
      'View employee list': 'EmployeeList'
    }
  },

  EnterRunPayroll: {
    resolver: RunPayrollResolver,
    transitions: {
      'No employees': 'AddEmployee',
      'Ready': 'RunPayroll'
    }
  },

  EnterPayTaxes: {
    resolver: RunPayrollResolver,
    transitions: {
      'No taxes': 'EmployeeList',
      'Ready': 'TaxCenter'
    }
  },

  RunPayroll: {
    props: {
      layout: 'trowser'
    }
  }
}
