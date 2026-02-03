import { IPosAdapter } from '@impos2/kernel-base';
import { deviceInfoAdapter } from './DeviceInfoAdapter';
import { storageAdapter } from './StorageAdapter';
import { externalCallAdapter } from './ExternalCallAdapter';
import { loggerAdapter } from './LoggerAdapter';
import { systemStatusAdapter } from './SystemStatusAdapter';

/**
 * PosAdapter 单例类
 * 统一返回所有适配器能力
 * 多个 ReactInstanceManager 共用时不会导致逻辑错误
 */
class PosAdapterImpl implements IPosAdapter {
  private static instance: PosAdapterImpl;

  // 私有构造函数，防止外部实例化
  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): PosAdapterImpl {
    if (!PosAdapterImpl.instance) {
      PosAdapterImpl.instance = new PosAdapterImpl();
    }
    return PosAdapterImpl.instance;
  }

  /**
   * 存储适配器
   */
  get storage() {
    return storageAdapter;
  }

  /**
   * 设备信息适配器
   */
  get deviceInfo() {
    return deviceInfoAdapter;
  }

  /**
   * 外部调用适配器
   */
  get externalCall() {
    return externalCallAdapter;
  }

  /**
   * 日志适配器
   */
  get logger() {
    return loggerAdapter;
  }

  /**
   * 系统状态适配器
   */
  get systemStatus() {
    return systemStatusAdapter;
  }
}

// 导出单例实例
export const posAdapter = PosAdapterImpl.getInstance();
