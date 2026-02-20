/**
 * 开发调试入口
 * @format
 */

import {AppRegistry} from 'react-native';
import DevApp from './DevApp';
import {name as appName} from '../app.json';

AppRegistry.registerComponent(appName, () => DevApp);
