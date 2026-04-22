/**
 * 单元相关类型定义
 */
/**
 * 单元类型枚举
 */
export declare enum UnitType {
    ENTITY = "entity",
    MODEL = "model",
    TERMINAL = "terminal"
}
/**
 * 单元基础接口
 */
export interface Unit {
    id: string;
    name: string;
    key: string;
    type: UnitType;
    parentId: string | null;
    rootPath: string[];
    entityUnitId?: string;
    modelUnitId?: string;
    activeCode?: string;
    deactiveCode?: string;
    createdAt: number;
    updatedAt: number;
}
/**
 * 终端扩展接口
 */
export interface Terminal extends Unit {
    type: UnitType.TERMINAL;
    entityUnitId: string;
    modelUnitId: string;
    activeCode: string;
    deactiveCode: string;
}
/**
 * 创建单元的请求
 */
export interface CreateUnitRequest {
    name: string;
    key: string;
    type: UnitType;
    parentId?: string;
    entityUnitId?: string;
    modelUnitId?: string;
    activeCode?: string;
    deactiveCode?: string;
}
/**
 * 更新单元的请求
 */
export interface UpdateUnitRequest {
    name?: string;
    key?: string;
    activeCode?: string;
    deactiveCode?: string;
}
//# sourceMappingURL=unit.d.ts.map