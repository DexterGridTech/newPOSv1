/**
 * adapterRN84 通过 autolinking 机制注册，让 RN CLI 自动处理 Codegen 和 C++ 编译
 */
module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android/turbomodule-lib',
      },
      ios: null,
    },
  },
};
