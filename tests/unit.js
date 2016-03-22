import should from 'should'
import Main from '../src/main'

const expect = should

describe('Main', function() {
  it('should support _config', () => {
    const main = new Main({yolo: 'nice'})
    main._config.should.have.property('yolo')
  })
})
