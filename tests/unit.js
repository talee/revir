import should from 'should'
import dep from '../src/dep'

const expect = should

describe('dep', function() {
  it('has life answering 42', () => {
    expect(dep.life()).be.exactly(42)
  })
})
