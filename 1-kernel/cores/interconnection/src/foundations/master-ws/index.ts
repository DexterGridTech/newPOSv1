/**
 * Master WebSocket 客户端模块
 * 提供与 Master WebSocket 服务器的连接功能
 */

export { MasterWebSocketClient } from './WebSocketClient';

// 枚举需要作为值导出(不能用 export type)
export { ConnectionState, ConnectionEventType, ConnectionErrorType } from '../../types/foundations/masterWS';

export type {
  // 核心接口
  IWebSocketClient,

  // 配置类型
  WebSocketClientConfig,
  DeviceRegistration,
  RegistrationResponse,

  // 消息类型
  MessageWrapper,
  SendMessageOptions,

  // 错误类型
  ConnectionError,

  // 事件数据类型
  StateChangeEvent,
  ConnectedEvent,
  ConnectFailedEvent,
  DisconnectedEvent,
  MessageEvent as WSMessageEvent,
  ErrorEvent as WSErrorEvent,
  WebSocketEventCallbacks,
} from '../../types/foundations/masterWS';

export { SYSTEM_MESSAGE_TYPES } from '../../types/foundations/masterWS';
