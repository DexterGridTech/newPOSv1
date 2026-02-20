import { TurboModule, TurboModuleRegistry } from 'react-native';

/**
 * 多屏显示TurboModule接口定义
 */
export interface Spec extends TurboModule {
  /**
   * 重启应用（主屏+副屏）
   * 通过中间页避免退回桌面
   * 单屏设备：只重启主屏
   * 双屏设备：重启主屏+副屏（副屏延迟3秒启动）
   */
  restartApplication(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MultiDisplayTurboModule');
