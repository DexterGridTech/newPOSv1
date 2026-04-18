const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const fs = require('fs');
const path = require('path');

const localNodeModules = path.resolve(__dirname, 'node_modules');
const rootNodeModules = path.resolve(__dirname, '../../../node_modules');
const redirectAnchor = path.join(localNodeModules, 'react-native', 'index.js');

function getPackageName(moduleName) {
  if (moduleName.startsWith('@')) {
    const parts = moduleName.split('/');
    return parts.slice(0, 2).join('/');
  }
  return moduleName.split('/')[0];
}

const redirectPackages = new Set([
  'react',
  'react-native',
  'react-dom',
]);

function shouldRedirectToLocal(moduleName) {
  const packageName = getPackageName(moduleName);
  if (packageName.startsWith('@impos2')) {
    return false;
  }
  return (
    redirectPackages.has(packageName) ||
    packageName.startsWith('@react-native') ||
    packageName.startsWith('@react-navigation')
  );
}

const config = {
  watchFolders: [path.resolve(__dirname, '../../..')],
  resolver: {
    nodeModulesPaths: [localNodeModules, rootNodeModules],
    resolverMainFields: ['react-native', 'browser', 'main'],
    unstable_enablePackageExports: true,
    /**
     * 单仓场景下，工作区源码默认会从仓库根目录往上找依赖，最终拿到根目录 hoist 的
     * react-native@0.77。Android 装配包必须强制把 react/react-native 相关依赖解析到
     * 自己本地的 RN84 依赖集，否则 JS 运行时代码版本会与原生 binary 不一致。
     */
    resolveRequest: (context, moduleName, platform) => {
      if (context.originModulePath === redirectAnchor) {
        return context.resolveRequest(context, moduleName, platform);
      }
      if (shouldRedirectToLocal(moduleName)) {
        const packageName = getPackageName(moduleName);
        const localPackagePath = path.join(localNodeModules, packageName);
        if (fs.existsSync(localPackagePath)) {
          return context.resolveRequest(
            {...context, originModulePath: redirectAnchor},
            moduleName,
            platform,
          );
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
