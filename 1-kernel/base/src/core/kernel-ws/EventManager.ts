/**
 * Kernel WebSocket 事件管理器
 */

import { KernelConnectionEventType } from '../../types';
import { logger } from '../nativeAdapter';
import { LOG_TAGS } from '../../types/core/logTags';
import { moduleName } from '../../types';

export class KernelEventManager {
  private eventHandlers: Map<KernelConnectionEventType, Set<Function>> = new Map();

  on(event: KernelConnectionEventType, callback: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback);
  }

  off(event: KernelConnectionEventType, callback: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  emit(event: KernelConnectionEventType, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error([moduleName, LOG_TAGS.WebSocket, "EventManager"], `[KernelEventManager] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  destroy(): void {
    this.eventHandlers.clear();
  }
}
