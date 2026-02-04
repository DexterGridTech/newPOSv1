import MultiDisplayTurboModule from './types/MultiDisplayTurboModule';

/**
 * 多屏显示管理器 - JS层封装
 */
export class MultiDisplayManager {
  private static module = MultiDisplayTurboModule;

  /**
   * 重启应用（主屏+副屏）
   * 通过中间页避免退回桌面
   *
   * 单屏设备：只重启主屏
   * 双屏设备：重启主屏+副屏（副屏延迟3秒启动）
   *
   * @returns Promise<boolean> 是否成功触发重启
   */
  static async restartApplication(): Promise<boolean> {
    try {
      const result = await this.module.restartApplication();
      return result;
    } catch (error) {
      console.error('MultiDisplayManager.restartApplication 失败:', error);
      throw error;
    }
  }
}

export default MultiDisplayManager;
