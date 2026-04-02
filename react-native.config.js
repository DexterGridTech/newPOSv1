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
    dependencies: {},
};
