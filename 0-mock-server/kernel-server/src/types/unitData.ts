/**
 * 单元数据相关类型定义
 */

/**
 * 单元数据分组
 */
export interface UnitDataGroup {
  key: string;
  name: string;
  description: string | null;
  valid: boolean;
  updatedAt: number;
}

/**
 * 单元数据项
 */
export interface UnitDataItem {
  id: string;
  name: string;
  path: string;
  defaultValue: string | null;
  valid: boolean;
  groupKey: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 单元数据模板
 */
export interface UnitDataTemplate {
  id: string;
  name: string;
  unitId: string;
  unitType: string;
  valid: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 单元数据
 */
export interface UnitData {
  id: string;
  name: string;
  path: string;
  key: string | null;
  value: string | null;
  templateId: string;
  groupKey: string;
  unitId: string;
  unitType: string;
  extra: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 创建数据分组请求
 */
export interface CreateUnitDataGroupRequest {
  key: string;
  name: string;
  description?: string;
  valid?: boolean;
}

/**
 * 更新数据分组请求
 */
export interface UpdateUnitDataGroupRequest {
  name?: string;
  description?: string;
  valid?: boolean;
}

/**
 * 创建数据项请求
 */
export interface CreateUnitDataItemRequest {
  name: string;
  path: string;
  defaultValue?: string;
  valid?: boolean;
  groupKey: string;
}

/**
 * 更新数据项请求
 */
export interface UpdateUnitDataItemRequest {
  name?: string;
  path?: string;
  defaultValue?: string;
  valid?: boolean;
  groupKey?: string;
}

/**
 * 创建数据模板请求
 */
export interface CreateUnitDataTemplateRequest {
  name: string;
  unitId: string;
  unitType: string;
  valid?: boolean;
}

/**
 * 更新数据模板请求
 */
export interface UpdateUnitDataTemplateRequest {
  name?: string;
  valid?: boolean;
}

/**
 * 创建单元数据请求
 */
export interface CreateUnitDataRequest {
  name: string;
  path: string;
  key?: string;
  value?: string;
  templateId: string;
  groupKey: string;
  unitId: string;
  unitType: string;
  extra?: string;
}

/**
 * 更新单元数据请求
 */
export interface UpdateUnitDataRequest {
  name?: string;
  key?: string;
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
