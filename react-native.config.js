const {bundleCommand, startCommand} = require('@react-native/community-cli-plugin');
const androidPlatform = require('@react-native-community/cli-platform-android');

module.exports = {
    commands: [bundleCommand, startCommand],
    platforms: {
        android: {
            npmPackageName: 'react-native',
            projectConfig: androidPlatform.projectConfig,
            dependencyConfig: androidPlatform.dependencyConfig,
        },
    },
    dependencies: {
        '@impos2/adapter-android-v1': {
            platforms: {android: null},
        },
        '@impos2/assembly-android-mixc-retail': {
            platforms: {android: null},
        },
    },
};
