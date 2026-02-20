import ScreenControlTurboModule from '../types/ScreenControlTurboModule.ts';

/**
 * 屏幕控制管理器（TypeScript 层）
 *
 * 提供简洁的 API 给 React 组件调用
 */
class ScreenControlManager {
  private static module = ScreenControlTurboModule;

  /**
   * 启用全屏模式
   */
  static async enableFullscreen(): Promise<boolean> {
    try {
      const result = await this.module.enableFullscreen();
      console.log('✅ 全屏模式已启用');
      return result;
    } catch (error) {
      console.error('启用全屏模式失败:', error);
      throw error;
    }
  }

  /**
   * 禁用全屏模式
   */
  static async disableFullscreen(): Promise<boolean> {
    try {
      const result = await this.module.disableFullscreen();
      console.log('✅ 全屏模式已禁用');
      return result;
    } catch (error) {
      console.error('禁用全屏模式失败:', error);
      throw error;
    }
  }

  /**
   * 启动锁定任务模式
   */
  static async startLockTask(): Promise<boolean> {
    try {
      const result = await this.module.startLockTask();
      console.log('✅ 锁定任务模式已启动');
      return result;
    } catch (error) {
      console.error('启动锁定任务模式失败:', error);
      throw error;
    }
  }

  /**
   * 停止锁定任务模式
   */
  static async stopLockTask(): Promise<boolean> {
    try {
      const result = await this.module.stopLockTask();
      console.log('✅ 锁定任务模式已停止');
      return result;
    } catch (error) {
      console.error('停止锁定任务模式失败:', error);
      throw error;
    }
  }

  /**
   * 获取全屏状态
   */
  static async isFullscreen(): Promise<boolean> {
    try {
      return await this.module.isFullscreen();
    } catch (error) {
      console.error('获取全屏状态失败:', error);
      return false;
    }
  }

  /**
   * 获取锁定任务模式状态
   */
  static async isInLockTaskMode(): Promise<boolean> {
    try {
      return await this.module.isInLockTaskMode();
    } catch (error) {
      console.error('获取锁定任务模式状态失败:', error);
      return false;
    }
  }
}

export default ScreenControlManager;
