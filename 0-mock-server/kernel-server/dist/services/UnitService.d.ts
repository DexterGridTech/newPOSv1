/**
 * Unit业务逻辑层
 */
import { Unit, Terminal, UnitType, CreateUnitRequest, UpdateUnitRequest } from '../types';
export declare class UnitService {
    private unitRepository;
    constructor();
    /**
     * 创建单元
     */
    create(data: CreateUnitRequest): Unit;
    /**
     * 根据ID查找单元
     */
    findById(id: string): Unit | null;
    /**
     * 根据key查找单元
     */
    findByKey(key: string): Unit | null;
    /**
     * 查找所有单元
     */
    findAll(type?: UnitType): Unit[];
    /**
     * 查找根单元
     */
    findRoots(type?: UnitType): Unit[];
    /**
     * 查找树形结构
     */
    findTree(rootId: string): Unit & {
        children?: Unit[];
    };
    /**
     * 更新单元
     */
    update(id: string, data: UpdateUnitRequest): Unit;
    /**
     * 删除单元
     */
    delete(id: string): void;
    /**
     * 根据激活码查找终端
     */
    findTerminalByActiveCode(activeCode: string): Terminal | null;
}
//# sourceMappingURL=UnitService.d.ts.map