// 必须在最顶部引入 Reactotron 配置
if (__DEV__) {
  require('./src/config/ReactotronConfig');
}

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';
AppRegistry.registerComponent(appName, () => {
  return App;
});
