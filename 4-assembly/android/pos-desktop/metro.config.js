const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

module.exports = mergeConfig(getDefaultConfig(__dirname), {
    watchFolders: [path.resolve(__dirname, '../../..')],
    resolver: {
        nodeModulesPaths: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, '../../../node_modules'),
        ],
        resolverMainFields: ['react-native', 'browser', 'main'],
        unstable_enablePackageExports: true,
    },
});
