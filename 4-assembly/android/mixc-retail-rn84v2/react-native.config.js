const path = require('path');

module.exports = {
  dependencies: {
    '@impos2/adapter-android-rn84': {
      root: path.resolve(__dirname, '../../../3-adapter/android/adapterRN84'),
      platforms: {
        android: {
          sourceDir: path.resolve(__dirname, '../../../3-adapter/android/adapterRN84/android/turbomodule-lib'),
        },
        ios: null,
      },
    },
  },
};
