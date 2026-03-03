/**
 * 数据同步服务
 */

import { DeviceRepository } from '../repositories/DeviceRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import { UnitDataRepository } from '../repositories/UnitDataRepository';
import { GetUnitDataByGroupRequest, GetUnitDataByGroupResponse, UnitData } from '../types';
import { getWebSocketService } from './WebSocketService';

export class DataSyncService {
  private deviceRepository: DeviceRepository;
  private unitRepository: UnitRepository;
  private unitDataRepository: UnitDataRepository;

  constructor() {
    this.deviceRepository = new DeviceRepository();
    this.unitRepository = new UnitRepository();
    this.unitDataRepository = new UnitDataRepository();
  }

  /**
   * 根据Group获取单元数据
   */
  getUnitDataByGroup(request: GetUnitDataByGroupRequest): GetUnitDataByGroupResponse {
    try {
      console.log(`[DataSync] Getting unit data for device ${request.deviceId}, group: ${request.group || 'all'}`);

      // 获取设备相关的所有单元数据
      const allData = this.getDeviceRelatedUnitData(request.deviceId, request.group);

      // 创建clientData映射(id -> updatedAt)
      const clientDataMap = new Map<string, number>();
      request.data.forEach(item => {
        clientDataMap.set(item.id, item.updatedAt);
      });

      // 服务器端数据映射
      const serverDataMap = new Map<string, UnitData>();
      allData.forEach(data => {
        serverDataMap.set(data.id, data);
      });

      // 计算更新和删除
      const updated: UnitData[] = [];
      const deleted: string[] = [];

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
    } catch (error) {
      console.error(`[DataSync] Error getting unit data for device ${request.deviceId}:`, error);
      throw error;
    }
  }

  /**
   * 获取设备相关的所有单元数据
   */
  private getDeviceRelatedUnitData(deviceId: string, groupKey?: string): UnitData[] {
    const device = this.deviceRepository.findById(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    const terminal = this.unitRepository.findById(device.terminalId);
    if (!terminal) {
      throw new Error('Terminal not found');
    }

    const relatedUnitIds: string[] = [];

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
    return this.unitDataRepository.findDataByUnitIds(relatedUnitIds, groupKey);
  }

  /**
   * 单元数据变更时推送给受影响的设备
   */
  onUnitDataChanged(unitDataId: string, changeType: 'create' | 'update' | 'delete'): void {
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

      affectedDevices.forEach(device => {
        if (wsService.isConnected(device.id) && device.operatingEntityId) {
          const message = {
            updated: changeType !== 'delete' && unitData ? [unitData] : [],
            deleted: changeType === 'delete' ? [unitDataId] : []
          };

          // 获取 groupKey，如果是删除操作则使用空字符串
          const groupKey = unitData?.groupKey || '';

          const success = wsService.pushUnitDataChange(device.id, groupKey, message.updated, message.deleted);
          if (success) pushedCount++;
        }
      });

      console.log(`[DataSync] Pushed unit data change to ${pushedCount} online devices`);
    } catch (error) {
      console.error(`[DataSync] Error pushing unit data change for ${unitDataId}:`, error);
    }
  }

  /**
   * 找到受单元数据变更影响的设备
   */
  private findAffectedDevices(unitId: string) {
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
