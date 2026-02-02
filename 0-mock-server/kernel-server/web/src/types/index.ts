/**
 * 前端类型定义
 */

export interface Unit {
  id: string;
  name: string;
  key: string;
  type: 'entity' | 'model' | 'terminal';
  parentId: string | null;
  rootPath: string[];
  entityUnitId?: string;
  modelUnitId?: string;
  activeCode?: string;
  deactiveCode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Device {
  id: string;
  manufacturer: string;
  os: string;
  osVersion: string;
  cpu: string;
  memory: string;
  disk: string;
  network: string;
  terminalId: string;
  token: string;
  operatingEntityId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UnitDataGroup {
  key: string;
  name: string;
  description: string | null;
  valid: boolean;
  updatedAt: number;
}

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

export interface UnitDataTemplate {
  id: string;
  name: string;
  unitId: string;
  unitType: string;
  valid: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UnitData {
  id: string;
  name: string;
  path: string;
  key: string;
  value: string | null;
  templateId: string;
  groupKey: string;
  unitId: string;
  unitType: string;
  extra: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CommandItem {
  id: string;
  name: string;
  type: string;
  valid: boolean;
  defaultPayload: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CommandRecord {
  id: string;
  commandId: string;
  deviceId: string;
  type: string;
  requestId: string | null;
  sessionId: string | null;
  sendAt: number;
  sendResult: boolean;
  receiveAt: number | null;
  receiveResult: boolean | null;
}

export interface ApiResponse<T = any> {
  code: string;
  message?: string;
  data?: T;
  extra?: any;
}
