globalThis.global = globalThis.global ?? globalThis;

const {AppRegistry} = require('react-native');
const App = require('./App').default;

AppRegistry.registerComponent('MixcCateringAssemblyRN84', () => App);
