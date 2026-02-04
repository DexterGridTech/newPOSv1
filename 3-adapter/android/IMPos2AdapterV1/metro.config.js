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
    // 启用 unstable_enablePackageExports 以支持 package.json 的 exports 字段
    unstable_enablePackageExports: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
