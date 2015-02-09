tests = require './sharedTests'

describe 'AggregateExpression', ->
  describe 'with reference variables', ->
    beforeEach ->
      this.expression = {
        op: 'aggregate',
        operand: { op: 'ref', name: 'diamonds', type: 'DATASET' },
        attribute: { op: 'ref', name: 'added', type: 'DATASET' }
      }

    tests.complexityIs(3)
    tests.simplifiedExpressionIs({
      op: 'aggregate',
      operand: { op: 'ref', name: 'diamonds', type: 'DATASET' },
      attribute: { op: 'ref', name: 'added', type: 'DATASET' },
    })