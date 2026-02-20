import {DeviceInfo} from "../../types/shared/device";
import {PowerStatusChangeEvent, SystemStatus} from "../../types/shared/systemStatus";

export interface Device {
    getDeviceInfo(): Promise<DeviceInfo>

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

export const device: Device = {
    getDeviceInfo: async () => {
        if (registeredDevice)
            return registeredDevice.getDeviceInfo()
        else return {
            id: "test id",
            manufacturer: "test manufacturer",
            os: "test os",
            osVersion: "test os version",
            cpu: "test cpu",
            memory: "test memory",
            disk: "test disk",
            network: "test network",
            displays: [
                {
                    id: "test display id",
                    displayType: "test display type",
                    refreshRate: 60,
                    width: 1920,
                    height: 1080,
                    physicalWidth: 24,
                    physicalHeight: 12,
                    touchSupport: true
                }
            ]
        }
    },
    getSystemStatus(): Promise<SystemStatus> {
        if (registeredDevice)
            return registeredDevice.getSystemStatus()
        return Promise.resolve({
            cpu: {app: 0, cores: 0},
            memory: {app: 0, appPercentage: 0, total: 0},
            disk: {app: 0, available: 0, overall: 0, used: 0, total: 0},
            power: {
                batteryHealth: 'good',
                batteryLevel: 100,
                batteryStatus: 'full',
                isCharging: false,
                powerConnected: true
            },
            usbDevices: [],
            bluetoothDevices: [],
            serialDevices: [],
            networks: [],
            installedApps: [],
            updateAt: Date.now()
        })
    },
    addPowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): () => void {
        if (registeredDevice)
            registeredDevice.addPowerStatusChangeListener(listener)
        return () => {
        }
    },
    removePowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): void {
        if (registeredDevice)
            registeredDevice.removePowerStatusChangeListener(listener)
    }
}

let registeredDevice: Device | null = null
export const registerDevice = (device: Device): void => {
    registeredDevice = device
}