/**
 * adapterRN84 的原生部分通过 turbomodule-lib 独立模块提供，
 * 不通过 autolinking 机制注册，避免 CLI 误解析裸工程结构。
 */
module.exports = {
  dependency: {
    platforms: {
      android: null,
      ios: null,
    },
  },
};
