/**
 * 数据同步服务
 */
import { GetUnitDataByGroupRequest, GetUnitDataByGroupResponse } from '../types';
export declare class DataSyncService {
    private deviceRepository;
    private unitRepository;
    private unitDataRepository;
    constructor();
    /**
     * 根据Group获取单元数据
     */
    getUnitDataByGroup(request: GetUnitDataByGroupRequest): GetUnitDataByGroupResponse;
    /**
     * 获取设备相关的所有单元数据
     */
    private getDeviceRelatedUnitData;
    /**
     * 单元数据变更时推送给受影响的设备
     */
    onUnitDataChanged(unitDataId: string, changeType: 'create' | 'update' | 'delete'): void;
    /**
     * 通知单元数据变更（简化接口）
     */
    notifyUnitDataChanged(group: string, unitId: string): void;
    /**
     * 找到受单元数据变更影响的设备
     */
    private findAffectedDevices;
}
//# sourceMappingURL=DataSyncService.d.ts.map