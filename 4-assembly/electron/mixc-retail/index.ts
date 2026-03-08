import { AppRegistry } from 'react-native'
import App from './App'

AppRegistry.registerComponent('PosDesktop', () => App)
AppRegistry.runApplication('PosDesktop', {
    rootTag: document.getElementById('app'),
})
