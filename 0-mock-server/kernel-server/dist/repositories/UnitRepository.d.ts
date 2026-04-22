/**
 * Unit数据访问层
 */
import { Unit, Terminal, UnitType, CreateUnitRequest, UpdateUnitRequest } from '../types';
export declare class UnitRepository {
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
     * 根据激活码查找终端
     */
    findByActiveCode(activeCode: string): Terminal | null;
    /**
     * 查找所有单元
     */
    findAll(type?: UnitType): Unit[];
    /**
     * 查找根单元
     */
    findRoots(type?: UnitType): Unit[];
    /**
     * 查找子单元
     */
    findChildren(parentId: string): Unit[];
    /**
     * 递归查找树形结构
     */
    findTree(rootId: string): Unit & {
        children?: Unit[];
    };
    /**
     * 更新单元
     */
    update(id: string, data: UpdateUnitRequest): Unit;
    /**
     * 删除单元(级联删除子单元)
     */
    delete(id: string): void;
    /**
     * 检查key是否已存在
     */
    existsByKey(key: string, excludeId?: string): boolean;
    /**
     * 将数据库行映射为Unit对象
     */
    private mapToUnit;
    /**
     * 更新rootPath(当parent变更时使用)
     */
    updateRootPath(id: string, newRootPath: string[]): void;
}
//# sourceMappingURL=UnitRepository.d.ts.map