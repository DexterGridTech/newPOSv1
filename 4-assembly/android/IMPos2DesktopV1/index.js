/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

console.log('========== index.js 开始执行 ==========');
console.log('应用名称:', appName);

// 注册组件前添加日志
console.log('准备注册组件:', appName);
AppRegistry.registerComponent(appName, () => {
  console.log('组件工厂函数被调用:', appName);
  return App;
});
console.log('组件注册完成:', appName);
console.log('========== index.js 执行完成 ==========');
