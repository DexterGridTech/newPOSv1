import WebSocket from 'ws';
import { DeviceType, DeviceInfo, DeviceRegistration, RuntimeConfig } from './types';
interface ConnectedDevice {
    socket: WebSocket;
    info: DeviceInfo;
    lastHeartbeat: number;
}
export declare class DeviceConnectionManager {
    /** token -> DeviceInfo */
    private pendingDevices;
    /** masterDeviceId -> DevicePair */
    private pairs;
    /** socket -> deviceId（快速反查） */
    private socketToDeviceId;
    /** slave deviceId -> masterDeviceId（快速反查） */
    private slaveToMaster;
    preRegisterDevice(registration: DeviceRegistration, token: string): {
        success: boolean;
        error?: string;
    };
    connectDeviceWithToken(socket: WebSocket, token: string): {
        success: boolean;
        error?: string;
        deviceInfo?: DeviceInfo;
    };
    getRuntimeConfig(masterDeviceId: string): RuntimeConfig;
    findDeviceBySocket(socket: WebSocket): {
        type: DeviceType;
        deviceId: string;
        masterDeviceId: string;
    } | undefined;
    getPeer(masterDeviceId: string, selfType: DeviceType): ConnectedDevice | undefined;
    getSlave(masterDeviceId: string): ConnectedDevice | undefined;
    getMaster(masterDeviceId: string): ConnectedDevice | undefined;
    disconnectSlave(masterDeviceId: string): void;
    disconnectMaster(masterDeviceId: string): void;
    updateHeartbeat(socket: WebSocket): void;
    checkAndDisconnectTimeoutDevices(): Array<{
        type: DeviceType;
        deviceId: string;
        masterDeviceId: string;
    }>;
    cleanExpiredPendingDevices(expireTime: number): void;
    getAllSockets(): Array<{
        socket: WebSocket;
        masterDeviceId: string;
    }>;
    getStats(): {
        masterCount: number;
        slaveCount: number;
        pendingCount: number;
        pairs: {
            masterDeviceId: string;
            slaveDeviceId?: string;
        }[];
    };
}
export {};
//# sourceMappingURL=DeviceConnectionManager.d.ts.map