/**
 * 数据同步服务
 */
import { DeviceRepository } from '../repositories/DeviceRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import { UnitDataRepository } from '../repositories/UnitDataRepository';
import { getWebSocketService } from './WebSocketService';
export class DataSyncService {
    deviceRepository;
    unitRepository;
    unitDataRepository;
    constructor() {
        this.deviceRepository = new DeviceRepository();
        this.unitRepository = new UnitRepository();
        this.unitDataRepository = new UnitDataRepository();
    }
    /**
     * 根据Group获取单元数据
     */
    getUnitDataByGroup(request) {
        try {
            console.log(`[DataSync] Getting unit data for device ${request.deviceId}, group: ${request.group || 'all'}`);
            // 获取设备相关的所有单元数据
            const allData = this.getDeviceRelatedUnitData(request.deviceId, request.group);
            // 创建clientData映射(id -> updatedAt)
            const clientDataMap = new Map();
            request.data.forEach(item => {
                clientDataMap.set(item.id, item.updatedAt);
            });
            // 服务器端数据映射
            const serverDataMap = new Map();
            allData.forEach(data => {
                serverDataMap.set(data.id, data);
            });
            // 计算更新和删除
            const updated = [];
            const deleted = [];
            // 查找新增和需更新的数据
            serverDataMap.forEach((data, id) => {
                const clientUpdatedAt = clientDataMap.get(id);
                if (clientUpdatedAt === undefined || data.updatedAt > clientUpdatedAt) {
                    updated.push(data);
                }
            });
            // 查找需删除的数据
            clientDataMap.forEach((_, id) => {
                if (!serverDataMap.has(id)) {
                    deleted.push(id);
                }
            });
            console.log(`[DataSync] Sync result for device ${request.deviceId}: ${updated.length} updated, ${deleted.length} deleted, total: ${allData.length}`);
            return {
                group: request.group,
                updated,
                deleted
            };
        }
        catch (error) {
            console.error(`[DataSync] Error getting unit data for device ${request.deviceId}:`, error);
            throw error;
        }
    }
    /**
     * 获取设备相关的所有单元数据
     */
    getDeviceRelatedUnitData(deviceId, group) {
        const device = this.deviceRepository.findById(deviceId);
        if (!device) {
            throw new Error('Device not found');
        }
        const terminal = this.unitRepository.findById(device.terminalId);
        if (!terminal) {
            throw new Error('Terminal not found');
        }
        const relatedUnitIds = [];
        // 1. 终端自身
        relatedUnitIds.push(terminal.id);
        // 2. 终端关联的机型
        if (terminal.modelUnitId) {
            relatedUnitIds.push(terminal.modelUnitId);
        }
        // 3. 设备当前操作实体的rootPath
        if (device.operatingEntityId) {
            const operatingEntity = this.unitRepository.findById(device.operatingEntityId);
            if (operatingEntity && operatingEntity.rootPath) {
                relatedUnitIds.push(...operatingEntity.rootPath);
            }
        }
        // 查询这些单元下的所有单元数据
        return this.unitDataRepository.findDataByUnitIds(relatedUnitIds, group);
    }
    /**
     * 单元数据变更时推送给受影响的设备
     */
    onUnitDataChanged(unitDataId, changeType) {
        try {
            const unitData = changeType !== 'delete'
                ? this.unitDataRepository.findDataById(unitDataId)
                : null;
            if (!unitData && changeType !== 'delete') {
                console.warn(`[DataSync] UnitData not found: ${unitDataId}`);
                return;
            }
            const unitId = unitData?.unitId || '';
            console.log(`[DataSync] Unit data ${changeType}: ${unitDataId}, unitId: ${unitId}`);
            // 找到受影响的设备
            const affectedDevices = this.findAffectedDevices(unitId);
            console.log(`[DataSync] Found ${affectedDevices.length} affected devices`);
            // 推送给在线设备
            const wsService = getWebSocketService();
            let pushedCount = 0;
            affectedDevices.forEach(async (device) => {
                if (wsService.isConnected(device.id) && device.operatingEntityId) {
                    const message = {
                        updated: changeType !== 'delete' && unitData ? [unitData] : [],
                        deleted: changeType === 'delete' ? [unitDataId] : []
                    };
                    // 获取 group，如果是删除操作则使用空字符串
                    const group = unitData?.group || '';
                    const success = await wsService.pushUnitDataChange(device.id, group, message.updated, message.deleted);
                    if (success)
                        pushedCount++;
                }
            });
            console.log(`[DataSync] Pushed unit data change to ${pushedCount} online devices`);
        }
        catch (error) {
            console.error(`[DataSync] Error pushing unit data change for ${unitDataId}:`, error);
        }
    }
    /**
     * 通知单元数据变更（简化接口）
     */
    notifyUnitDataChanged(group, unitId) {
        // 查找该 unit 下该 group 的所有数据
        const dataList = this.unitDataRepository.findDataByUnitIds([unitId], group);
        dataList.forEach(data => {
            this.onUnitDataChanged(data.id, 'update');
        });
    }
    /**
     * 找到受单元数据变更影响的设备
     */
    findAffectedDevices(unitId) {
        const unit = this.unitRepository.findById(unitId);
        if (!unit) {
            return [];
        }
        switch (unit.type) {
            case 'terminal':
                // 直接查找绑定到此终端的设备
                const device = this.deviceRepository.findByTerminalId(unitId);
                return device ? [device] : [];
            case 'model':
                // 查找所有使用此机型的终端的设备
                return this.deviceRepository.findByModelId(unitId);
            case 'entity':
                // 查找所有operatingEntity的rootPath包含此entity的设备
                return this.deviceRepository.findByEntityInRootPath(unitId);
            default:
                return [];
        }
    }
}
//# sourceMappingURL=DataSyncService.js.map