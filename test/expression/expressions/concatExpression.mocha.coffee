{ expect } = require("chai")

tests = require './sharedTests'

describe 'ConcatExpression', ->
  beforeEach ->
    this.expression = { op: 'concat', operands: [{ op: 'literal', value: 'Honda' }, { op: 'literal', value: 'BMW' }, { op: 'literal', value: 'Suzuki' } ]}

  tests.complexityIs(4)