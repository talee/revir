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
  // ... to n nodes etc.
  //
  // Missing transitions object indicates this is an end node of a flow. Next
  // transition is either back a node or if currently in a subflow, the node
  // that started the subflow.

  EmployeeList: {
    transitions: {
      'Add employee': 'AddEmployee',
      'Edit employee': 'EditEmployee',
      'Run payroll': 'RunPayroll'
    },
  },

  AddEmployee: {
    transitions: {
      'Edit W-4': 'W4',
      'View employee List': 'EmployeeList'
    }
  },

  EditEmployee: {
    transitions: 'AddEmployee'
  },

  W4: {
  },

  RunPayroll: {
  }
}
