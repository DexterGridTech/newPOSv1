export * from './features';
export * from './types';
export * from './hooks';
export * from './core';
export * from './module';

// 初始化: 注入 registerScreenPart 函数到 kernel-base
// 这样可以避免循环依赖,因为 kernel-base 不需要直接导入 ui-navigation
import { setScreenPartRegisterFunction } from '@impos2/kernel-base';
import { registerScreenPart } from './core';

// 在模块加载时立即注入
setScreenPartRegisterFunction(registerScreenPart);
