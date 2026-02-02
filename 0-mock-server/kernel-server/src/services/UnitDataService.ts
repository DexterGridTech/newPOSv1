/**
 * UnitData业务逻辑层
 */

import { UnitDataRepository } from '../repositories/UnitDataRepository';
import { UnitRepository } from '../repositories/UnitRepository';
import { DataSyncService } from './DataSyncService';
import {
  UnitDataGroup, UnitDataItem, UnitDataTemplate, UnitData,
  CreateUnitDataGroupRequest, UpdateUnitDataGroupRequest,
  CreateUnitDataItemRequest, UpdateUnitDataItemRequest,
  CreateUnitDataTemplateRequest, UpdateUnitDataTemplateRequest,
  CreateUnitDataRequest, UpdateUnitDataRequest
} from '../types';
import { validateRequired, validateJSON } from '../utils/validator';

export class UnitDataService {
  private unitDataRepository: UnitDataRepository;
  private unitRepository: UnitRepository;
  private dataSyncService: DataSyncService;

  constructor() {
    this.unitDataRepository = new UnitDataRepository();
    this.unitRepository = new UnitRepository();
    this.dataSyncService = new DataSyncService();
  }

  // ==================== UnitDataGroup ====================

  createGroup(data: CreateUnitDataGroupRequest): UnitDataGroup {
    const error = validateRequired(data, ['key', 'name']);
    if (error) throw new Error(error);

    return this.unitDataRepository.createGroup(data);
  }

  findGroupByKey(key: string): UnitDataGroup | null {
    return this.unitDataRepository.findGroupByKey(key);
  }

  findAllGroups(): UnitDataGroup[] {
    return this.unitDataRepository.findAllGroups();
  }

  updateGroup(key: string, data: UpdateUnitDataGroupRequest): UnitDataGroup {
    const group = this.unitDataRepository.findGroupByKey(key);
    if (!group) throw new Error('Group not found');

    return this.unitDataRepository.updateGroup(key, data);
  }

  deleteGroup(key: string): void {
    this.unitDataRepository.deleteGroup(key);
  }

  // ==================== UnitDataItem ====================

  createItem(data: CreateUnitDataItemRequest): UnitDataItem {
    const error = validateRequired(data, ['name', 'path', 'groupKey']);
    if (error) throw new Error(error);

    // 验证defaultValue是否是合法JSON
    if (data.defaultValue) {
      const jsonError = validateJSON(data.defaultValue, 'defaultValue');
      if (jsonError) throw new Error(jsonError);
    }

    return this.unitDataRepository.createItem(data);
  }

  findItemById(id: string): UnitDataItem | null {
    return this.unitDataRepository.findItemById(id);
  }

  findAllItems(groupKey?: string): UnitDataItem[] {
    return this.unitDataRepository.findAllItems(groupKey);
  }

  updateItem(id: string, data: UpdateUnitDataItemRequest): UnitDataItem {
    const item = this.unitDataRepository.findItemById(id);
    if (!item) throw new Error('Item not found');

    if (data.defaultValue) {
      const jsonError = validateJSON(data.defaultValue, 'defaultValue');
      if (jsonError) throw new Error(jsonError);
    }

    return this.unitDataRepository.updateItem(id, data);
  }

  deleteItem(id: string): void {
    this.unitDataRepository.deleteItem(id);
  }

  // ==================== UnitDataTemplate ====================

  createTemplate(data: CreateUnitDataTemplateRequest): UnitDataTemplate {
    const error = validateRequired(data, ['name', 'unitId', 'unitType']);
    if (error) throw new Error(error);

    // 验证unit存在
    const unit = this.unitRepository.findById(data.unitId);
    if (!unit) throw new Error('Unit not found');

    return this.unitDataRepository.createTemplate(data);
  }

  findTemplateById(id: string): UnitDataTemplate | null {
    return this.unitDataRepository.findTemplateById(id);
  }

  findTemplatesByUnitId(unitId: string): UnitDataTemplate[] {
    return this.unitDataRepository.findTemplatesByUnitId(unitId);
  }

  updateTemplate(id: string, data: UpdateUnitDataTemplateRequest): UnitDataTemplate {
    const template = this.unitDataRepository.findTemplateById(id);
    if (!template) throw new Error('Template not found');

    return this.unitDataRepository.updateTemplate(id, data);
  }

  deleteTemplate(id: string): void {
    this.unitDataRepository.deleteTemplate(id);
  }

  // ==================== UnitData ====================

  createData(data: CreateUnitDataRequest): UnitData {
    const error = validateRequired(data, ['name', 'path', 'templateId', 'groupKey', 'unitId', 'unitType']);
    if (error) throw new Error(error);

    // 验证value和extra是否是合法JSON
    if (data.value) {
      const jsonError = validateJSON(data.value, 'value');
      if (jsonError) throw new Error(jsonError);
    }

    if (data.extra) {
      const jsonError = validateJSON(data.extra, 'extra');
      if (jsonError) throw new Error(jsonError);
    }

    const unitData = this.unitDataRepository.createData(data);

    // 触发数据变更推送
    this.dataSyncService.onUnitDataChanged(unitData.id, 'create');

    return unitData;
  }

  findDataById(id: string): UnitData | null {
    return this.unitDataRepository.findDataById(id);
  }

  findDataByTemplateId(templateId: string): UnitData[] {
    return this.unitDataRepository.findDataByTemplateId(templateId);
  }

  updateData(id: string, data: UpdateUnitDataRequest): UnitData {
    const unitData = this.unitDataRepository.findDataById(id);
    if (!unitData) throw new Error('UnitData not found');

    if (data.value) {
      const jsonError = validateJSON(data.value, 'value');
      if (jsonError) throw new Error(jsonError);
    }

    if (data.extra) {
      const jsonError = validateJSON(data.extra, 'extra');
      if (jsonError) throw new Error(jsonError);
    }

    const updated = this.unitDataRepository.updateData(id, data);

    // 触发数据变更推送
    this.dataSyncService.onUnitDataChanged(updated.id, 'update');

    return updated;
  }

  deleteData(id: string): void {
    // 先获取数据以便推送删除通知
    const unitData = this.unitDataRepository.findDataById(id);

    this.unitDataRepository.deleteData(id);

    // 触发数据变更推送
    if (unitData) {
      this.dataSyncService.onUnitDataChanged(id, 'delete');
    }
  }
}
