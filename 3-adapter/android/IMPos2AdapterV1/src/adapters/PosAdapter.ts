import { IPosAdapter } from '@impos2/kernel-base';
import { deviceInfoAdapter } from './DeviceInfoAdapter';
import { storageAdapter } from './StorageAdapter';

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
}

// 导出单例实例
export const posAdapter = PosAdapterImpl.getInstance();
