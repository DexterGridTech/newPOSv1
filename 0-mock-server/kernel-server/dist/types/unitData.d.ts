/**
 * 单元数据相关类型定义
 */
/**
 * 单元数据
 */
export interface UnitData {
    id: string;
    name: string;
    path: string;
    value: string | null;
    group: string;
    unitId: string;
    unitType: string;
    extra: string | null;
    createdAt: number;
    updatedAt: number;
}
/**
 * 创建单元数据请求
 */
export interface CreateUnitDataRequest {
    name: string;
    path: string;
    value?: string;
    group: string;
    unitId: string;
    unitType: string;
    extra?: string;
}
/**
 * 更新单元数据请求
 */
export interface UpdateUnitDataRequest {
    name?: string;
    value?: string;
    extra?: string;
}
/**
 * 获取单元数据请求(设备API)
 */
export interface GetUnitDataByGroupRequest {
    deviceId: string;
    group: string;
    data: Array<{
        id: string;
        updatedAt: number;
    }>;
}
/**
 * 获取单元数据响应(设备API)
 */
export interface GetUnitDataByGroupResponse {
    group: string;
    updated: UnitData[];
    deleted: string[];
}
//# sourceMappingURL=unitData.d.ts.map