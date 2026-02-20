import { TurboModule, TurboModuleRegistry } from 'react-native';

/**
 * 屏幕控制 TurboModule 接口定义
 */
export interface Spec extends TurboModule {
  /**
   * 启用全屏模式
   */
  enableFullscreen(): Promise<boolean>;

  /**
   * 禁用全屏模式
   */
  disableFullscreen(): Promise<boolean>;

  /**
   * 启动锁定任务模式
   */
  startLockTask(): Promise<boolean>;

  /**
   * 停止锁定任务模式
   */
  stopLockTask(): Promise<boolean>;

  /**
   * 获取全屏状态
   */
  isFullscreen(): Promise<boolean>;

  /**
   * 获取锁定任务模式状态
   */
  isInLockTaskMode(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ScreenControlTurboModule');
