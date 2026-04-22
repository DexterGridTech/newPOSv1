const {registerRootComponent} = require('expo')
const TestExpoApp = require('./test-expo/App').default

registerRootComponent(TestExpoApp)

module.exports = require('./src')
