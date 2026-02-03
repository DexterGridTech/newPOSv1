import type { IDeviceInfoAdapter, DeviceInfo } from '@impos2/kernel-base';
import { NativeModules } from 'react-native';

const { DeviceInfoTurboModule } = NativeModules;

export class DeviceInfoAdapterImpl implements IDeviceInfoAdapter {
  async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      const info = await DeviceInfoTurboModule.getDeviceInfo();
      return info;
    } catch (error) {
      throw {
        code: 'DEVICE_INFO_ERROR',
        msg: `获取设备信息失败: ${error}`,
        data: error,
      };
    }
  }
}

// 导出单例
export const deviceInfoAdapter = new DeviceInfoAdapterImpl();
