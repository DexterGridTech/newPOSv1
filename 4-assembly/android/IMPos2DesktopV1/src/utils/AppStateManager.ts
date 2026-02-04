// src/utils/AppStateManager.ts
// 应用状态管理器 - 用于重置应用状态

class AppStateManager {
  private static instance: AppStateManager;
  private resetCallbacks: Array<() => void> = [];

  private constructor() {}

  static getInstance(): AppStateManager {
    if (!AppStateManager.instance) {
      AppStateManager.instance = new AppStateManager();
    }
    return AppStateManager.instance;
  }

  /**
   * 注册重置回调
   * 各个模块可以注册自己的重置逻辑
   */
  registerResetCallback(callback: () => void) {
    this.resetCallbacks.push(callback);
  }

  /**
   * 执行重置
   * 调用所有注册的重置回调
   */
  reset() {
    console.log('开始重置应用状态...');
    this.resetCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('重置回调执行失败:', error);
      }
    });
    console.log('应用状态重置完成');
  }
}

export default AppStateManager.getInstance();
