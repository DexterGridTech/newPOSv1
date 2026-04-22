import { DeviceInfo } from "../../types/shared/device";
import { PowerStatusChangeEvent, SystemStatus } from "../../types/shared/systemStatus";
export interface Device {
    getDeviceInfo(): Promise<DeviceInfo>;
    /**
     * 获取系统运行状态
     * @returns Promise<PosSystemStatus> 系统运行状态
     */
    getSystemStatus(): Promise<SystemStatus>;
    /**
     * 添加电源状态变化监听器
     * @param listener 监听器回调函数
     * @returns 取消监听的函数
     */
    addPowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): () => void;
    /**
     * 移除电源状态变化监听器
     * @param listener 监听器回调函数
     */
    removePowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): void;
}
export declare const device: Device;
export declare const registerDevice: (device: Device) => void;
//# sourceMappingURL=device.d.ts.map