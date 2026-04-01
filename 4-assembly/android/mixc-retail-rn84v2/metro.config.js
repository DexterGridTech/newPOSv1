const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');
const fs = require('fs');

const localNodeModules = path.resolve(__dirname, 'node_modules');
const rootNodeModules = path.resolve(__dirname, '../../../node_modules');
const REDIRECT_ANCHOR = path.join(localNodeModules, 'react-native', 'index.js');

function getPackageName(moduleName) {
  if (moduleName.startsWith('@')) {
    const parts = moduleName.split('/');
    return parts.slice(0, 2).join('/');
  }
  return moduleName.split('/')[0];
}

const REDIRECT_PACKAGES = new Set([
  'react',
  'react-native',
  'react-dom',
  'react-native-mmkv',
  'react-native-nitro-modules',
]);

function shouldRedirectToLocal(moduleName) {
  const pkgName = getPackageName(moduleName);
  if (pkgName.startsWith('@impos2')) {
    return false;
  }
  return (
    REDIRECT_PACKAGES.has(pkgName) ||
    pkgName.startsWith('@react-native') ||
    pkgName.startsWith('@react-navigation')
  );
}

const config = {
  watchFolders: [path.resolve(__dirname, '../../..')],
  resolver: {
    nodeModulesPaths: [localNodeModules, rootNodeModules],
    resolverMainFields: ['react-native', 'browser', 'main'],
    unstable_enablePackageExports: true,
    resolveRequest: (context, moduleName, platform) => {
      if (context.originModulePath === REDIRECT_ANCHOR) {
        return context.resolveRequest(context, moduleName, platform);
      }
      if (shouldRedirectToLocal(moduleName)) {
        const pkgName = getPackageName(moduleName);
        const localPkg = path.join(localNodeModules, pkgName);
        if (fs.existsSync(localPkg)) {
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
