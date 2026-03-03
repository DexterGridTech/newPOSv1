/**
 * API调用封装
 */

const BASE_URL = '/kernel-server/manager';

/**
 * 通用请求函数
 */
async function request<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  const result = await response.json();

  // 检查响应状态
  if (result.code && result.code !== 'SUCCESS') {
    throw new Error(result.message || '请求失败');
  }

  return result.data;
}

/**
 * API接口封装
 */
export const api = {
  // Unit相关
  getUnits: (type?: string) =>
    request(`/units${type ? `?type=${type}` : ''}`),
  getUnit: (id: string) =>
    request(`/units/${id}`),
  getUnitTree: (id: string) =>
    request(`/units/${id}/tree`),
  createUnit: (data: any) =>
    request('/units', { method: 'POST', body: JSON.stringify(data) }),
  updateUnit: (id: string, data: any) =>
    request(`/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnit: (id: string) =>
    request(`/units/${id}`, { method: 'DELETE' }),

  // Device相关
  getDevices: () =>
    request('/devices'),
  getDevice: (id: string) =>
    request(`/devices/${id}`),
  getOnlineDevices: () =>
    request('/devices/online/list'),
  deactivateDevice: (id: string, deactiveCode: string) =>
    request(`/devices/${id}/deactivate`, { method: 'POST', body: JSON.stringify({ deactiveCode }) }),
  deleteDevice: (id: string) =>
    request(`/devices/${id}`, { method: 'DELETE' }),

  // UnitDataGroup相关
  getUnitDataGroups: () =>
    request('/unit-data-groups'),
  createUnitDataGroup: (data: any) =>
    request('/unit-data-groups', { method: 'POST', body: JSON.stringify(data) }),
  updateUnitDataGroup: (key: string, data: any) =>
    request(`/unit-data-groups/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnitDataGroup: (key: string) =>
    request(`/unit-data-groups/${key}`, { method: 'DELETE' }),

  // UnitDataItem相关
  getUnitDataItems: (group?: string) =>
    request(`/unit-data-items${group ? `?group=${group}` : ''}`),
  createUnitDataItem: (data: any) =>
    request('/unit-data-items', { method: 'POST', body: JSON.stringify(data) }),
  updateUnitDataItem: (id: string, data: any) =>
    request(`/unit-data-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnitDataItem: (id: string) =>
    request(`/unit-data-items/${id}`, { method: 'DELETE' }),

  // CommandItem相关
  getCommandItems: () =>
    request('/command-items'),
  createCommandItem: (data: any) =>
    request('/command-items', { method: 'POST', body: JSON.stringify(data) }),
  updateCommandItem: (id: string, data: any) =>
    request(`/command-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCommandItem: (id: string) =>
    request(`/command-items/${id}`, { method: 'DELETE' }),

  // UnitDataTemplate相关
  getUnitTemplates: (unitId: string) =>
    request(`/units/${unitId}/templates`),
  createUnitTemplate: (unitId: string, data: any) =>
    request(`/units/${unitId}/templates`, { method: 'POST', body: JSON.stringify(data) }),
  updateUnitTemplate: (id: string, data: any) =>
    request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnitTemplate: (id: string) =>
    request(`/templates/${id}`, { method: 'DELETE' }),

  // UnitData相关
  getTemplateData: (templateId: string) =>
    request(`/templates/${templateId}/data`),
  createUnitData: (templateId: string, data: any) =>
    request(`/templates/${templateId}/data`, { method: 'POST', body: JSON.stringify(data) }),
  updateUnitData: (id: string, data: any) =>
    request(`/unit-data/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnitData: (id: string) =>
    request(`/unit-data/${id}`, { method: 'DELETE' }),

  // Command发送
  sendCommand: (deviceId: string, data: any) =>
    request(`/devices/${deviceId}/commands`, { method: 'POST', body: JSON.stringify(data) }),

  // CommandRecord相关
  getCommandRecords: (deviceId: string) =>
    request(`/devices/${deviceId}/command-records`),
  deleteCommandRecord: (id: string) =>
    request(`/command-records/${id}`, { method: 'DELETE' }),

  // DeviceConnection相关
  getDeviceConnection: (deviceId: string) =>
    request(`/devices/${deviceId}/connection`)
};
