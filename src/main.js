import dep from 'dep'
export default main

var main = {
  setup(config) {
    console.log('main: config:', config)
  }
}

console.log('main: Loaded main file! Nice!')
dep.hello()
