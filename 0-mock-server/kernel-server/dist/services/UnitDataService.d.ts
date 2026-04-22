/**
 * UnitData业务逻辑层
 */
import { UnitData, CreateUnitDataRequest, UpdateUnitDataRequest } from '../types';
export declare class UnitDataService {
    private repository;
    private dataSyncService;
    constructor();
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
     * 更新单元数据
     */
    updateData(id: string, data: UpdateUnitDataRequest): UnitData;
    /**
     * 删除单元数据
     */
    deleteData(id: string): void;
}
//# sourceMappingURL=UnitDataService.d.ts.map