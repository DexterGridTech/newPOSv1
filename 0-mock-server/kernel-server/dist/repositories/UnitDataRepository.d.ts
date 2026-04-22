/**
 * UnitData数据访问层
 */
import { UnitData, CreateUnitDataRequest, UpdateUnitDataRequest } from '../types';
export declare class UnitDataRepository {
    /**
     * 创建单元数据
     */
    createData(data: CreateUnitDataRequest): UnitData;
    /**
     * 根据ID查找单元数据
     */
    findDataById(id: string): UnitData | null;
    /**
     * 根据unitId查找单元数据
     */
    findDataByUnitId(unitId: string): UnitData[];
    /**
     * 根据group和unitId查找单元数据
     */
    findDataByGroupAndUnitId(group: string, unitId: string): UnitData[];
    /**
     * 根据多个unitId和group查找单元数据
     */
    findDataByUnitIds(unitIds: string[], group?: string): UnitData[];
    /**
     * 更新单元数据
     */
    updateData(id: string, data: UpdateUnitDataRequest): UnitData;
    /**
     * 删除单元数据
     */
    deleteData(id: string): void;
    /**
     * 映射数据库行到UnitData对象
     */
    private mapToData;
}
//# sourceMappingURL=UnitDataRepository.d.ts.map