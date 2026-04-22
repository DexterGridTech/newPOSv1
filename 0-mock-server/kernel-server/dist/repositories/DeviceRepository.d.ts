/**
 * Device数据访问层
 */
import { Device, DeviceInfo, DeviceConnectionInfo } from '../types';
export declare class DeviceRepository {
    /**
     * 创建设备
     */
    create(deviceInfo: DeviceInfo, terminalId: string): Device;
    /**
     * 根据ID查找设备
     */
    findById(id: string): Device | null;
    /**
     * 根据token查找设备
     */
    findByToken(token: string): Device | null;
    /**
     * 根据terminalId查找设备
     */
    findByTerminalId(terminalId: string): Device | null;
    /**
     * 查找所有设备
     */
    findAll(): Device[];
    /**
     * 根据modelId查找所有设备
     */
    findByModelId(modelId: string): Device[];
    /**
     * 根据entityId查找所有设备(rootPath包含该entity)
     */
    findByEntityInRootPath(entityId: string): Device[];
    /**
     * 更新设备的操作实体
     */
    updateOperatingEntity(id: string, operatingEntityId: string | null): Device;
    /**
     * 删除设备
     */
    delete(id: string): void;
    /**
     * 记录设备连接
     */
    createConnection(deviceId: string, clientIp?: string, userAgent?: string): DeviceConnectionInfo;
    /**
     * 更新连接状态为断开
     */
    disconnectConnection(deviceId: string): void;
    /**
     * 查找设备的连接记录
     */
    findConnectionById(id: string): DeviceConnectionInfo | null;
    /**
     * 查找设备的所有连接记录
     */
    findConnectionsByDeviceId(deviceId: string): DeviceConnectionInfo[];
    /**
     * 查找设备的当前连接状态
     */
    findCurrentConnection(deviceId: string): DeviceConnectionInfo | null;
    /**
     * 检查设备是否在线
     */
    isDeviceOnline(deviceId: string): boolean;
    /**
     * 将数据库行映射为Device对象
     */
    private mapToDevice;
    /**
     * 将数据库行映射为DeviceConnectionInfo对象
     */
    private mapToConnectionInfo;
}
//# sourceMappingURL=DeviceRepository.d.ts.map