module.exports = {
  dependencies: {
    // adapterRN84 的原生部分通过 settings.gradle 手动引入 turbomodule-lib，
    // 不需要 autolinking 处理，排除以避免 CLI 解析裸工程结构报错
    '@impos2/adapter-android-rn84': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
