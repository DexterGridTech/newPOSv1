/**
 * 指令相关类型定义
 */

/**
 * 指令项
 */
export interface CommandItem {
  id: string;
  name: string;
  type: string;
  valid: boolean;
  defaultPayload: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 指令
 */
export interface Command {
  id: string;
  type: string;
  payload: string | null;
  requestId: string | null;
  sessionId: string | null;
  createdAt: number;
}

/**
 * 指令记录
 */
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

/**
 * 创建指令项请求
 */
export interface CreateCommandItemRequest {
  name: string;
  type: string;
  valid?: boolean;
  defaultPayload?: string;
}

/**
 * 更新指令项请求
 */
export interface UpdateCommandItemRequest {
  name?: string;
  type?: string;
  valid?: boolean;
  defaultPayload?: string;
}

/**
 * 发送指令请求
 */
export interface SendCommandRequest {
  commandItemId: string;
  payload?: string;
  requestId?: string;
  sessionId?: string;
}

/**
 * 确认指令接收请求
 */
export interface CommandConfirmRequest {
  commandId: string;
}
