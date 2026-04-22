/**
 * Device业务逻辑层
 */
import { Device, ActivateDeviceRequest, ActivateDeviceResponse, SetOperatingEntityRequest, DeactivateDeviceRequest } from '../types';
export declare class DeviceService {
    private deviceRepository;
    private unitRepository;
    constructor();
    /**
     * 激活设备
     */
    activate(data: ActivateDeviceRequest): ActivateDeviceResponse;
    /**
     * 设置操作实体
     */
    setOperatingEntity(data: SetOperatingEntityRequest): Device;
    /**
     * 解绑设备
     */
    deactivate(data: DeactivateDeviceRequest): void;
    /**
     * 根据ID查找设备
     */
    findById(id: string): Device | null;
    /**
     * 根据token查找设备
     */
    findByToken(token: string): Device | null;
    /**
     * 查找所有设备
     */
    findAll(): Device[];
    /**
     * 删除设备(管理后台使用)
     */
    delete(id: string): void;
    /**
     * 查找设备连接记录
     */
    findConnectionsByDeviceId(deviceId: string): import("../types").DeviceConnectionInfo[];
    /**
     * 检查设备是否在线
     */
    isDeviceOnline(deviceId: string): boolean;
}
//# sourceMappingURL=DeviceService.d.ts.map