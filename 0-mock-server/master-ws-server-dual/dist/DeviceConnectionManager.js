import WebSocket from 'ws';
import { DeviceType } from './types';
import { DEFAULT_RUNTIME_CONFIG, mergeRuntimeConfig } from './config';
export class DeviceConnectionManager {
    /** token -> DeviceInfo */
    pendingDevices = new Map();
    /** masterDeviceId -> DevicePair */
    pairs = new Map();
    /** socket -> deviceId（快速反查） */
    socketToDeviceId = new Map();
    /** slave deviceId -> masterDeviceId（快速反查） */
    slaveToMaster = new Map();
    preRegisterDevice(registration, token) {
        const { type, deviceId, masterDeviceId } = registration;
        if (type === DeviceType.MASTER) {
            // master 不能重复注册
            const pair = this.pairs.get(deviceId);
            if (pair?.master) {
                return { success: false, error: 'Master device already connected' };
            }
        }
        else {
            if (!masterDeviceId) {
                return { success: false, error: 'masterDeviceId is required for slave device' };
            }
            const pair = this.pairs.get(masterDeviceId);
            if (!pair?.master) {
                return { success: false, error: 'Master device not connected' };
            }
            if (pair.slave) {
                return { success: false, error: 'This master already has a slave connected' };
            }
        }
        this.pendingDevices.set(token, {
            ...registration,
            connectedAt: new Date(),
            token
        });
        return { success: true };
    }
    connectDeviceWithToken(socket, token) {
        const deviceInfo = this.pendingDevices.get(token);
        if (!deviceInfo) {
            return { success: false, error: 'Invalid or expired token' };
        }
        const { type, deviceId, masterDeviceId } = deviceInfo;
        this.pendingDevices.delete(token);
        deviceInfo.connectedAt = new Date();
        const connected = { socket, info: deviceInfo, lastHeartbeat: Date.now() };
        if (type === DeviceType.MASTER) {
            const existing = this.pairs.get(deviceId);
            if (existing?.master) {
                return { success: false, error: 'Master device already connected' };
            }
            const pair = existing ?? { runtimeConfig: mergeRuntimeConfig(deviceInfo.runtimeConfig) };
            pair.master = connected;
            this.pairs.set(deviceId, pair);
        }
        else {
            const pair = this.pairs.get(masterDeviceId);
            if (!pair?.master) {
                return { success: false, error: 'Master device disconnected' };
            }
            if (pair.slave) {
                return { success: false, error: 'This master already has a slave' };
            }
            pair.slave = connected;
            this.slaveToMaster.set(deviceId, masterDeviceId);
        }
        this.socketToDeviceId.set(socket, deviceId);
        return { success: true, deviceInfo };
    }
    getRuntimeConfig(masterDeviceId) {
        return this.pairs.get(masterDeviceId)?.runtimeConfig ?? DEFAULT_RUNTIME_CONFIG;
    }
    findDeviceBySocket(socket) {
        const deviceId = this.socketToDeviceId.get(socket);
        if (!deviceId)
            return undefined;
        // master: deviceId 就是 masterDeviceId
        const pair = this.pairs.get(deviceId);
        if (pair?.master?.socket === socket) {
            return { type: DeviceType.MASTER, deviceId, masterDeviceId: deviceId };
        }
        // slave: 通过 slaveToMaster 直接查
        const masterId = this.slaveToMaster.get(deviceId);
        if (masterId) {
            return { type: DeviceType.SLAVE, deviceId, masterDeviceId: masterId };
        }
        return undefined;
    }
    getPeer(masterDeviceId, selfType) {
        const pair = this.pairs.get(masterDeviceId);
        if (!pair)
            return undefined;
        return selfType === DeviceType.MASTER ? pair.slave : pair.master;
    }
    getSlave(masterDeviceId) {
        return this.pairs.get(masterDeviceId)?.slave;
    }
    getMaster(masterDeviceId) {
        return this.pairs.get(masterDeviceId)?.master;
    }
    disconnectSlave(masterDeviceId) {
        const pair = this.pairs.get(masterDeviceId);
        if (!pair?.slave)
            return;
        this.socketToDeviceId.delete(pair.slave.socket);
        this.slaveToMaster.delete(pair.slave.info.deviceId);
        if (pair.slave.socket.readyState === WebSocket.OPEN) {
            pair.slave.socket.close();
        }
        pair.slave = undefined;
    }
    disconnectMaster(masterDeviceId) {
        const pair = this.pairs.get(masterDeviceId);
        if (!pair)
            return;
        // 先断 slave
        if (pair.slave) {
            this.socketToDeviceId.delete(pair.slave.socket);
            this.slaveToMaster.delete(pair.slave.info.deviceId);
            if (pair.slave.socket.readyState === WebSocket.OPEN) {
                pair.slave.socket.close();
            }
        }
        // 再断 master
        if (pair.master) {
            this.socketToDeviceId.delete(pair.master.socket);
        }
        this.pairs.delete(masterDeviceId);
    }
    updateHeartbeat(socket) {
        const device = this.findDeviceBySocket(socket);
        if (!device)
            return;
        const pair = this.pairs.get(device.masterDeviceId);
        if (!pair)
            return;
        const target = device.type === DeviceType.MASTER ? pair.master : pair.slave;
        if (target)
            target.lastHeartbeat = Date.now();
    }
    checkAndDisconnectTimeoutDevices() {
        const result = [];
        const now = Date.now();
        for (const [masterId, pair] of this.pairs) {
            const timeout = pair.runtimeConfig.heartbeatTimeout;
            if (pair.master && now - pair.master.lastHeartbeat > timeout) {
                result.push({ type: DeviceType.MASTER, deviceId: pair.master.info.deviceId, masterDeviceId: masterId });
                pair.master.socket.close();
            }
            if (pair.slave && now - pair.slave.lastHeartbeat > timeout) {
                result.push({ type: DeviceType.SLAVE, deviceId: pair.slave.info.deviceId, masterDeviceId: masterId });
                pair.slave.socket.close();
            }
        }
        return result;
    }
    cleanExpiredPendingDevices(expireTime) {
        const now = Date.now();
        for (const [token, info] of this.pendingDevices) {
            if (now - info.connectedAt.getTime() > expireTime) {
                this.pendingDevices.delete(token);
            }
        }
    }
    getAllSockets() {
        const result = [];
        for (const [masterId, pair] of this.pairs) {
            if (pair.master)
                result.push({ socket: pair.master.socket, masterDeviceId: masterId });
            if (pair.slave)
                result.push({ socket: pair.slave.socket, masterDeviceId: masterId });
        }
        return result;
    }
    getStats() {
        let masterCount = 0, slaveCount = 0;
        const pairList = [];
        for (const [masterId, pair] of this.pairs) {
            if (pair.master)
                masterCount++;
            if (pair.slave)
                slaveCount++;
            pairList.push({
                masterDeviceId: masterId,
                slaveDeviceId: pair.slave?.info.deviceId
            });
        }
        return {
            masterCount,
            slaveCount,
            pendingCount: this.pendingDevices.size,
            pairs: pairList
        };
    }
}
//# sourceMappingURL=DeviceConnectionManager.js.map