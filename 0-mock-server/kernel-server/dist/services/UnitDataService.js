/**
 * UnitData业务逻辑层
 */
import { UnitDataRepository } from '../repositories/UnitDataRepository';
import { DataSyncService } from './DataSyncService';
import { validateRequired } from '../utils/validator';
export class UnitDataService {
    repository;
    dataSyncService;
    constructor() {
        this.repository = new UnitDataRepository();
        this.dataSyncService = new DataSyncService();
    }
    /**
     * 创建单元数据
     */
    createData(data) {
        const error = validateRequired(data, ['name', 'path', 'group', 'unitId', 'unitType']);
        if (error)
            throw new Error(error);
        const unitData = this.repository.createData(data);
        // 触发数据同步
        this.dataSyncService.notifyUnitDataChanged(data.group, data.unitId);
        return unitData;
    }
    /**
     * 根据ID查找单元数据
     */
    findDataById(id) {
        return this.repository.findDataById(id);
    }
    /**
     * 根据unitId查找单元数据
     */
    findDataByUnitId(unitId) {
        return this.repository.findDataByUnitId(unitId);
    }
    /**
     * 根据group和unitId查找单元数据
     */
    findDataByGroupAndUnitId(group, unitId) {
        return this.repository.findDataByGroupAndUnitId(group, unitId);
    }
    /**
     * 更新单元数据
     */
    updateData(id, data) {
        const existing = this.repository.findDataById(id);
        if (!existing)
            throw new Error('UnitData not found');
        const updated = this.repository.updateData(id, data);
        // 触发数据同步
        this.dataSyncService.notifyUnitDataChanged(existing.group, existing.unitId);
        return updated;
    }
    /**
     * 删除单元数据
     */
    deleteData(id) {
        const existing = this.repository.findDataById(id);
        if (!existing)
            throw new Error('UnitData not found');
        this.repository.deleteData(id);
        // 触发数据同步
        this.dataSyncService.notifyUnitDataChanged(existing.group, existing.unitId);
    }
}
//# sourceMappingURL=UnitDataService.js.map