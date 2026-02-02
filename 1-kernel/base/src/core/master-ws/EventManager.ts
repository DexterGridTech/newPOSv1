import { ConnectionEventType } from '../../types';
import {logger} from "../nativeAdapter";

/**
 * 事件管理器
 * 负责管理事件回调的注册、注销和触发
 */
export class MasterEventManager {
  private eventListeners: Map<ConnectionEventType, Set<Function>> = new Map();

  /**
   * 注册事件监听器
   */
  on(eventType: ConnectionEventType, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
  }

  /**
   * 注销事件监听器
   */
  off(eventType: ConnectionEventType, callback: Function): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  /**
   * 触发事件
   */
  emit(eventType: ConnectionEventType, ...args: any[]): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          logger.error(`事件回调执行错误 [${eventType}]:`, error);
        }
      });
    }
  }

  /**
   * 注销所有事件监听器
   */
  removeAllListeners(eventType?: ConnectionEventType): void {
    if (eventType) {
      this.eventListeners.delete(eventType);
    } else {
      this.eventListeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(eventType: ConnectionEventType): number {
    return this.eventListeners.get(eventType)?.size || 0;
  }

  /**
   * 销毁事件管理器
   */
  destroy(): void {
    this.eventListeners.clear();
  }
}
