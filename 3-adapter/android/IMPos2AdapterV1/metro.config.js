const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

/**
 * Metro configuration for Monorepo
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    path.resolve(__dirname, '../../..'), // Monorepo 根目录
  ],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../../../node_modules'),
    ],
    // 配置解析字段优先级，确保使用 React Native 和浏览器版本
    resolverMainFields: ['react-native', 'browser', 'main'],
    // 将 Node.js 核心模块解析为空对象,避免 axios 等库引入 Node.js 模块导致错误
    extraNodeModules: new Proxy(
      {},
      {
        get: (target, name) => {
          if (typeof name === 'string') {
            // 对于 Node.js 核心模块,返回一个空模块路径
            return path.join(__dirname, `node_modules/.empty/${name}.js`);
          }
          return target[name];
        },
      }
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
