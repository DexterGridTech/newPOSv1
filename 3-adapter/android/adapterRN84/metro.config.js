const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');
const fs = require('fs');

const localNodeModules = path.resolve(__dirname, 'node_modules');
const rootNodeModules = path.resolve(__dirname, '../../../node_modules');

// 用于重定向的锚点文件（本地 node_modules 内的真实文件）
const REDIRECT_ANCHOR = path.join(localNodeModules, 'react-native', 'index.js');

// 从模块名提取包名（处理 scoped 包和子路径）
function getPackageName(moduleName) {
  if (moduleName.startsWith('@')) {
    // scoped: @scope/pkg 或 @scope/pkg/subpath
    const parts = moduleName.split('/');
    return parts.slice(0, 2).join('/');
  }
  // 普通包: pkg 或 pkg/subpath
  return moduleName.split('/')[0];
}

// 需要强制解析到本地版本的包名
const REDIRECT_PACKAGES = new Set([
  'react',
  'react-native',
  'react-dom',
  'react-native-mmkv',
  'react-native-nitro-modules',
]);

function shouldRedirectToLocal(moduleName) {
  const pkgName = getPackageName(moduleName);
  return (
    REDIRECT_PACKAGES.has(pkgName) ||
    pkgName.startsWith('@react-native') ||
    pkgName.startsWith('@react-navigation')
  );
}

/**
 * Metro configuration for Monorepo
 * 强制所有包的 react/react-native 解析到本地版本，避免 monorepo 根目录版本污染
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    path.resolve(__dirname, '../../..'), // Monorepo 根目录
  ],
  resolver: {
    nodeModulesPaths: [
      localNodeModules,
      rootNodeModules,
    ],
    resolverMainFields: ['react-native', 'browser', 'main'],
    unstable_enablePackageExports: true,
    resolveRequest: (context, moduleName, platform) => {
      // 已经是从本地锚点发起的解析，直接走默认逻辑，避免无限递归
      if (context.originModulePath === REDIRECT_ANCHOR) {
        return context.resolveRequest(context, moduleName, platform);
      }

      if (shouldRedirectToLocal(moduleName)) {
        const pkgName = getPackageName(moduleName);
        const localPkg = path.join(localNodeModules, pkgName);
        if (fs.existsSync(localPkg)) {
          // 将 originModulePath 改为本地锚点，Metro 会从 localNodeModules 开始查找
          return context.resolveRequest(
            {...context, originModulePath: REDIRECT_ANCHOR},
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
