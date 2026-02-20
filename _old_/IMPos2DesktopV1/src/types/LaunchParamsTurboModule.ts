import { TurboModule, TurboModuleRegistry } from 'react-native';

/**
 * 启动参数接口
 */
export interface LaunchParams {
  screenType: string;
  displayId: number;
  displayName: string;
}

/**
 * 启动参数TurboModule接口定义
 */
export interface Spec extends TurboModule {
  getLaunchParams(): Promise<LaunchParams>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('LaunchParamsTurboModule');
